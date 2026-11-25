import * as THREE from "three"
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js"
import {pointerNdc, toScene, toWorld} from "./stereo_math.mjs"
import {visualLaserStart} from "./laser_burst.mjs"
import {createLaserCrosshairGeometry, placeGazeCursor} from "./cockpit_reticles.mjs"
import {stereoViewports, applyTransientStereoOffset, inwardStereoProjectionOffset} from "./stereo_viewport.mjs"
import {LensDistortionPass, lensCenterU} from "./lens_distortion.mjs"
import {cockpitHudFit, HUD_GEOMETRY} from "./stereo_layout.mjs"
import {flightBasis, degrees} from "./flight_basis.mjs"
import {orientationTelemetry} from "./orientation_interpolation.mjs"
import {cockpitDestinationCamera} from "./cockpit_camera_source.mjs"
import {steeringLineTip, COCKPIT_VERTICAL_FOV_DEG} from "./mouse_steering.mjs"
import {targetRange, LASER_FEEDBACK_MS} from "./laser_feedback.mjs"
import {createDartModel, dartHeadingRotation} from "./dart_model.mjs"
import {createScowModel} from "./scow_model.mjs"
import {npcVisualClass} from "./ship_model_selection.mjs"
import {surrenderedHudLabel} from "./target_hud_status.mjs"
import {PlanetaryBody} from "./planetary_body.js"
import {SpaceBaseVisual} from "./space_base_visual.js"
import {AmbientRefineryTraffic} from "./ambient_refinery_traffic.mjs"
import {GreenStarbaseVisual} from "./green_starbase_visual.js"
import {GreenStarbaseInterior, greenStarbaseInteriorVisible} from "./green_starbase_interior.js"
import {EncounterShipVisual} from "./encounter_ship.js"
import {SpaceEnvironmentVisual} from "./space_environment_visual.js"
import {helmetHudLines, HMD_HUD_PAGES} from "./helmet_hud_pages.mjs"
import {paintCockpitModeIcon} from "./cockpit_mode_icons.mjs"
import {cockpitModePlacement} from "./cockpit_mode_layout.mjs"
import {MODE_GAZE_TARGET} from "./helmet_mode_gaze.mjs"

// Rendering only: no Phoenix socket, no movement authority, no combat calculations.
const clamp = (value, min, max) => Math.max(min, Math.min(value, max))
const material = hex => new THREE.MeshStandardMaterial({
  color: hex, metalness: 0.45, roughness: 0.48, emissive: hex, emissiveIntensity: 0.17,
})

function beam(a, b, radius, mat) {
  const start = new THREE.Vector3(...a)
  const end = new THREE.Vector3(...b)
  const line = end.sub(start)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, line.length(), 8), mat)
  mesh.position.copy(start).addScaledVector(line, 0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), line.normalize())
  return mesh
}

function shipModel(npc, npcTypeId = null, shipClass = null) {
  const model = npc ? npcVisualClass(npcTypeId, shipClass) : "player"
  if (model === "dart") return createDartModel(THREE)
  if (model === "scow") return createScowModel(THREE)
  const root = new THREE.Group()
  const hull = new THREE.Mesh(
    npc ? new THREE.OctahedronGeometry(2, 0) : new THREE.ConeGeometry(1.65, 4.8, 4),
    material(npc ? 0xe68b44 : 0x95c8ef),
  )
  if (!npc) hull.rotation.z = -Math.PI / 2
  root.add(hull)
  if (!npc) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.25, 5.5), material(0x4a718a))
    wing.position.x = -0.7
    root.add(wing)
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.08, 5, 48), new THREE.MeshBasicMaterial({color: 0xffa765}))
  ring.position.y = -1.25
  ring.rotation.x = -Math.PI / 2
  ring.visible = false
  root.add(ring)
  root.userData.ring = ring
  return root
}

// Canvas textures are painted once and reused in both SBS eyes. These are
// physical cockpit surfaces, not fixed screen overlays: head motion can
// look away from them naturally.
function cockpitLabel(lines, {width = 512, height = 256} = {}) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = "#071c22"
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = "#53e6ae"
  ctx.lineWidth = 10
  ctx.strokeRect(8, 8, width - 16, height - 16)
  ctx.fillStyle = "#bbffe2"
  const fontSize = Math.round(Math.min(height / (lines.length + 1.5), width / 13))
  ctx.font = "bold " + fontSize + "px monospace"
  ctx.textAlign = "center"
  lines.forEach((text, i) => ctx.fillText(text, width / 2,
    height * (i + 1) / (lines.length + 1) + fontSize / 3, width - 38))
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// One compact SBS ship symbol, repainted in place when the mode changes.
function modeIconTexture(mode, selected = false, pending = false) {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 256
  paintCockpitModeIcon(canvas.getContext("2d"), {mode, selected, pending})
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function disposeMesh(root) {
  root.traverse(child => {
    child.geometry?.dispose()
    if (child.material) {
      for (const m of (Array.isArray(child.material) ? child.material : [child.material])) m.dispose()
    }
  })
}

// Weapon crosshair geometry is sized for 5 units; scaling by distance/5
// preserves its angular size at the forward sight plane.
const SIGHT_BASE_DISTANCE = 5
export const SIGHT_FAR_DISTANCE = 60
export const STEERING_LINE_DISTANCE = SIGHT_FAR_DISTANCE
// About 0.3 degrees wide at that distance: several pixels per eye on a phone.
export const STEERING_LINE_RADIUS = 0.16
// Dot at the stick tip, ~1.1 degrees across, so the pointer is unmistakable.
export const STEERING_TIP_RADIUS = 0.6
const STEERING_LINE_AXIS = new THREE.Vector3(0, 1, 0)
// SBS is viewed through headset lenses: parallel eye axes (zero parallax at
// infinity). Lens alignment is handled by the calibrated centre gap, not by
// converging the virtual cameras on a plane 10 units ahead.
export const SBS_PARALLEL_FOCUS = 1e6
const MONO_FOCUS = 10

export class StereoSpaceView {
  constructor(canvas) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({canvas, alpha: false, antialias: true, powerPreference: "high-performance"})
    this.renderer.setClearColor(0x020816)
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x020816)
    this.camera = new THREE.PerspectiveCamera(COCKPIT_VERTICAL_FOV_DEG, 1, 0.1, 3000)
    this.stereo = new THREE.StereoCamera()
    this.stereo.eyeSep = 0.064
    this.eyeGapPx = 0
    this.mode = "3d"
    // Laptop keeps the historical 1.5 cap; the headset raises it because the
    // lenses magnify every pixel (see helmet_display.mjs).
    this.maxPixelRatio = 1.5
    this.lensDistortion = null
    this.size = {width: 1, height: 1, dpr: 1}
    this.scene.add(this.camera)
    this.nodes = new Map()
    this.pickables = []
    this.raycaster = new THREE.Raycaster()
    this.floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    this.scene.add(new THREE.HemisphereLight(0x9cbffb, 0x0a1421, 2.3))
    const sun = new THREE.DirectionalLight(0xb6eaff, 2.1)
    sun.position.set(25, 60, 15)
    this.scene.add(sun)
    // Space has no artificial ground plane. The atlas alone owns the XY chart.
    this.addStars()
    // The spherical planet is visually scaled by its angular diameter.
    // It must not inherit the tactical map's 3,000-unit clipping limits.
    this.planetaryBody = new PlanetaryBody(THREE, this.scene)
    this.spaceBase = new SpaceBaseVisual(THREE, this.scene)
    this.refineryTraffic = new AmbientRefineryTraffic(THREE, this.scene)
    this.greenStarbase = new GreenStarbaseVisual(THREE, this.scene)
    // Keep the hangar in a separate, static scene: parked pilots are removed
    // from tactical entities and must not inherit ship camera/physics state.
    this.hangarScene = new THREE.Scene()
    this.hangarScene.background = new THREE.Color(0x03140e)
    this.hangar = new GreenStarbaseInterior(THREE, this.hangarScene, {
      // Optional local character asset. The GLB is packaged with the desktop
      // client; the paired SBS display fetches it once as a static file.
      loadGltf: url => new GLTFLoader().loadAsync(url),
    })
    this.interiorActive = false
    this.stationViewPose = null
    this.stationLastFrameAt = null
    this.encounterShip = new EncounterShipVisual(THREE, this.scene)
    this.spaceEnvironment = new SpaceEnvironmentVisual(THREE, this.scene)
    // These must be initialized BEFORE addCockpit builds the VR meshes:
    // Three.js treats visible=undefined as visible, not hidden.
    this.helmetGazeEnabled = false
    this.helmetNavOpen = false
    this.helmetHudPage = "flight"
    this.lastHelmetHudText = ""
    this.lastHelmetHudUpdateAt = -Infinity
    this.helmetHeadRotation = null
    this.onHelmetGaze = null
    this.lastGazeArcProgress = -1
    this.addCockpit()
    this.beamGroup = new THREE.Group()
    this.scene.add(this.beamGroup)
    this.lastHudAt = -Infinity
  }

  addStars() {
    let seed = 0x51a7
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    const positions = new Float32Array(1800 * 3)
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = (rand() - 0.5) * 2900
      positions[i + 1] = (rand() - 0.5) * 1500
      positions[i + 2] = (rand() - 0.5) * 2900
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    const stars = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: 0xc8e3ff, size: 1.3, depthTest: false, depthWrite: false,
    }))
    // Stars are an infinitely distant backdrop, never in front of a planet.
    stars.renderOrder = -100
    this.stars = stars
    this.scene.add(stars)
  }

  addCockpit() {
    const framing = new THREE.Group()
    const steel = material(0x183d5b)
    // Keep canopy struts near the outside of each eye's view; the previous
    // inward-leaning supports cut across the center and distracted from space.
    framing.add(beam([-2.0, -0.96, -2.75], [-1.75, 1.0, -3.25], 0.023, steel))
    framing.add(beam([2.0, -0.96, -2.75], [1.75, 1.0, -3.25], 0.023, steel))
    framing.add(beam([-2.0, -0.96, -2.75], [2.0, -0.96, -2.75], 0.028, steel))
    // Two visible wing-mounted emitters. Their tips correspond exactly to
    // Core.Combat.LineOfFire's server-owned muzzle positions: ship-local
    // (+/-1.75, +1.3, -3.2), relative to the cockpit eye at Y=+2.75.
    const emitterMetal = material(0x42576b)
    this.cockpitEmitters = {}
    for (const side of [-1, 1]) {
      const x = side * 1.75
      framing.add(beam([x, -1.45, -2.60], [x, -1.45, -3.20],
        0.095, emitterMetal))
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.095, 10, 8),
        new THREE.MeshBasicMaterial({color: 0xff424a}),
      )
      tip.position.set(x, -1.45, -3.20)
      framing.add(tip)
      this.cockpitEmitters[side < 0 ? "left" : "right"] = tip
    }
    const dash = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.72, 0.25), material(0x0d2238))
    dash.position.set(0, -0.72, -2.65)
    framing.add(dash)
    this.dash = dash

    // Draw cockpit telemetry once and present it as a stereo-correct 3D surface.
    this.hudCanvas = document.createElement("canvas")
    this.hudCanvas.width = 1024
    this.hudCanvas.height = 256
    this.hudTexture = new THREE.CanvasTexture(this.hudCanvas)
    this.hudTexture.colorSpace = THREE.SRGBColorSpace
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(HUD_GEOMETRY.width, HUD_GEOMETRY.height),
      new THREE.MeshBasicMaterial({map: this.hudTexture}),
    )
    panel.position.set(0, HUD_GEOMETRY.centerY, -HUD_GEOMETRY.depth)
    framing.add(panel)
    this.hudPanel = panel

    // Server-owned five-second docking progress: paint locally in both eyes.
    // No per-second Phoenix events, timers with flight authority, or 2D overlays.
    this.dockingCountdownCanvas = document.createElement("canvas")
    this.dockingCountdownCanvas.width = 640
    this.dockingCountdownCanvas.height = 320
    this.dockingCountdownTexture = new THREE.CanvasTexture(this.dockingCountdownCanvas)
    this.dockingCountdownTexture.colorSpace = THREE.SRGBColorSpace
    this.dockingCountdownMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.95, 0.98),
      new THREE.MeshBasicMaterial({
        map: this.dockingCountdownTexture, transparent: true,
        depthTest: false, depthWrite: false,
      }),
    )
    this.dockingCountdownMesh.position.set(0, 0.28, -2.27)
    this.dockingCountdownMesh.renderOrder = 82
    this.dockingCountdownMesh.visible = false
    framing.add(this.dockingCountdownMesh)
    this.lastCountdownNumber = null

    // The weapon sight belongs to the ship, not the pilot's moving head.
    // Four separated bars leave an open center for the circular gaze cursor.
    const sight = new THREE.Mesh(
      createLaserCrosshairGeometry(THREE),
      new THREE.MeshBasicMaterial({color: 0x78e6fc, transparent: true, opacity: 0.8,
        depthTest: false, depthWrite: false}),
    )
    sight.position.z = -SIGHT_FAR_DISTANCE
    sight.scale.setScalar(SIGHT_FAR_DISTANCE / SIGHT_BASE_DISTANCE)
    sight.renderOrder = 50
    framing.add(sight)
    this.sight = sight

    this.cockpitFraming = framing
    this.scene.add(framing)

    // Headset copy of the laptop's virtual-joystick line. It is SHIP-fixed
    // (cockpit frame, not head), from the nose to the laptop stick's world
    // direction, drawn far away so both eyes converge on it comfortably.
    // A WebGL Line is always ONE physical pixel wide, which vanishes on a
    // high-DPI phone behind headset lenses, so this is a thin open tube
    // with a real width. Unit length along +Y; alpha fades in from the nose.
    const steeringGeometry = new THREE.CylinderGeometry(
      STEERING_LINE_RADIUS, STEERING_LINE_RADIUS, 1, 6, 1, true)
    steeringGeometry.translate(0, 0.5, 0)
    const along = steeringGeometry.getAttribute("position")
    const rgba = []
    // Fade in over the first third, then solid out to the tip.
    for (let i = 0; i < along.count; i++) {
      rgba.push(0.47, 0.90, 0.99, Math.min(1, 0.2 + along.getY(i) * 2.4))
    }
    steeringGeometry.setAttribute("color", new THREE.Float32BufferAttribute(rgba, 4))
    this.steeringLine = new THREE.Mesh(steeringGeometry, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthTest: false, depthWrite: false,
      side: THREE.DoubleSide,
    }))
    this.steeringLine.position.set(0, 0, -STEERING_LINE_DISTANCE)
    this.steeringLineDirection = new THREE.Vector3()
    this.steeringLine.frustumCulled = false
    this.steeringLine.renderOrder = 49
    this.steeringLine.visible = false
    framing.add(this.steeringLine)
    this.steeringTip = new THREE.Mesh(
      new THREE.CircleGeometry(STEERING_TIP_RADIUS, 24),
      new THREE.MeshBasicMaterial({color: 0x78e6fc, transparent: true,
        depthTest: false, depthWrite: false, side: THREE.DoubleSide}),
    )
    this.steeringTip.renderOrder = 49
    this.steeringTip.visible = false
    framing.add(this.steeringTip)
    // Diagnostic: names which link is missing when the line cannot be drawn.
    this.steeringStatus = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.34),
      new THREE.MeshBasicMaterial({transparent: true, depthTest: false, depthWrite: false}),
    )
    this.steeringStatus.position.set(0, 0.62, -2.5)
    this.steeringStatus.renderOrder = 72
    this.steeringStatus.visible = false
    this.steeringStatusText = null
    //framing.add(this.steeringStatus)

    // A NAV switch mounted right of the main telemetry instrument.
    this.navSwitch = new THREE.Mesh(
      new THREE.PlaneGeometry(0.50, 0.25),
      new THREE.MeshBasicMaterial({
        map: cockpitLabel(["NAV"], {width: 512, height: 256}),
        transparent: true, depthTest: false,
      }),
    )
    // Within the narrower per-eye SBS field of view; turn right/down slightly.
    this.navSwitch.position.set(1.24, -0.68, -2.46)
    this.navSwitch.renderOrder = 68
    //framing.add(this.navSwitch)

    // The HUD itself is gaze-selectable. Inspecting it opens this compact,
    // read-only information panel; there are no HMD flight/combat commands.
    // Its controls sit OUTSIDE the text surface so they cannot obscure it.
    this.helmetNavPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.52, 0.55),
      new THREE.MeshBasicMaterial({
        map: cockpitLabel(["FLIGHT / STATUS", "LOOK AT A TAB", "HMD READ-ONLY"],
          {width: 1024, height: 480}),
        transparent: true, depthTest: false,
      }),
    )
    this.helmetNavPanel.position.set(0, 0.25, -2.46)
    this.helmetNavPanel.renderOrder = 70
    framing.add(this.helmetNavPanel)
    this.helmetNavClose = new THREE.Mesh(
      new THREE.PlaneGeometry(0.46, 0.23),
      new THREE.MeshBasicMaterial({
        map: cockpitLabel(["CLOSE"], {width: 512, height: 256}),
        transparent: true, depthTest: false,
      }),
    )
    this.helmetNavClose.position.set(0.58, 0.66, -2.40)
    this.helmetNavClose.renderOrder = 71

    // Death recovery. A pilot in an HMD cannot reach the keyboard, so this is
    // the one cockpit surface that must be reachable by gaze alone. It is
    // centred and large on purpose: it appears only when the ship is already
    // wreckage, and nothing else is selectable while it is up.
    this.helmetRespawnPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.70, 0.62),
      new THREE.MeshBasicMaterial({
        map: cockpitLabel(["SHIP DESTROYED"], {width: 1024, height: 480}),
        transparent: true, depthTest: false,
      }),
    )
    this.helmetRespawnPanel.position.set(0, 0.26, -2.44)
    this.helmetRespawnPanel.renderOrder = 74
    this.helmetRespawnPanel.visible = false
    framing.add(this.helmetRespawnPanel)

    this.helmetRespawnButton = new THREE.Mesh(
      new THREE.PlaneGeometry(1.02, 0.30),
      new THREE.MeshBasicMaterial({
        map: cockpitLabel(["RECOVER AT EARTH"], {width: 768, height: 256}),
        transparent: true, depthTest: false,
      }),
    )
    this.helmetRespawnButton.position.set(0, -0.30, -2.38)
    this.helmetRespawnButton.renderOrder = 75
    this.helmetRespawnButton.visible = false
    framing.add(this.helmetRespawnButton)

    // Surrender choice. Unlike the wreck panel this appears mid-fight, so it
    // sits BELOW the sight line and never takes the forward view: a pilot
    // tracking a target must not dwell on it by accident.
    this.helmetSurrenderPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.62, 0.40),
      new THREE.MeshBasicMaterial({
        map: cockpitLabel(["CONTACT YIELDS"], {width: 1024, height: 320}),
        transparent: true, depthTest: false,
      }),
    )
    this.helmetSurrenderPanel.position.set(0, -0.44, -2.44)
    this.helmetSurrenderPanel.renderOrder = 76
    this.helmetSurrenderPanel.visible = false
    framing.add(this.helmetSurrenderPanel)

    // One ship-mode icon at one fixed gaze target, showing current flight mode.
    const initialModePlacement = cockpitModePlacement(1)
    const position = initialModePlacement.icon
    this.helmetModeIcon = new THREE.Mesh(
      new THREE.PlaneGeometry(initialModePlacement.side, initialModePlacement.side),
      new THREE.MeshBasicMaterial({
        map: modeIconTexture("cruise"),
        transparent: true, depthTest: false, depthWrite: false,
      }),
    )
    this.helmetModeIcon.position.set(position.x, position.y, position.z)
    this.helmetModeIcon.renderOrder = 72
    this.helmetModeIcon.visible = false
    framing.add(this.helmetModeIcon)

    // One larger invisible raycast surface follows the same position.
    this.helmetModeHitbox = new THREE.Mesh(
      new THREE.PlaneGeometry(0.265, 0.34),
      new THREE.MeshBasicMaterial({
        transparent: true, opacity: 0, depthTest: false, depthWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    this.helmetModeHitbox.position.set(position.x, position.y, position.z + 0.035)
    this.helmetModeHitbox.visible = false
    framing.add(this.helmetModeHitbox)

    this.helmetSurrenderButtons = {}
    for (const [name, x] of [["accept", -0.58], ["seize", 0.0]]) {
      const button = new THREE.Mesh(
        new THREE.PlaneGeometry(0.54, 0.22),
        new THREE.MeshBasicMaterial({
          map: cockpitLabel([""], {width: 512, height: 224}),
          transparent: true, depthTest: false,
        }),
      )
      button.position.set(x, -0.76, -2.38)
      button.renderOrder = 77
      button.visible = false
      framing.add(button)
      this.helmetSurrenderButtons[name] = button
    }
    framing.add(this.helmetNavClose)
    this.helmetNavRecenter = new THREE.Mesh(
      new THREE.PlaneGeometry(0.64, 0.23),
      new THREE.MeshBasicMaterial({
        map: cockpitLabel(["RECENTER"], {width: 512, height: 256}),
        transparent: true, depthTest: false,
      }),
    )
    this.helmetNavRecenter.position.set(-0.58, 0.66, -2.40)
    this.helmetNavRecenter.renderOrder = 71
    framing.add(this.helmetNavRecenter)
    const helmetHudTab = (label, x) => {
      const node = new THREE.Mesh(
        new THREE.PlaneGeometry(0.44, 0.22),
        new THREE.MeshBasicMaterial({
          map: cockpitLabel([label], {width: 512, height: 256}),
          transparent: true, depthTest: false,
        }),
      )
      node.position.set(x, -0.44, -2.40)
      node.renderOrder = 71
      framing.add(node)
      return node
    }
    this.helmetNavFlight = helmetHudTab("FLIGHT", -0.52)
    this.helmetNavContacts = helmetHudTab("CONTACTS", 0)
    this.helmetNavSpace = helmetHudTab("SPACE", 0.52)

    // Both eyes inherit the same reticle via the central camera. The
    // arc stays hidden until dwell has armed a genuine interactive target.
    this.gazeReticle = new THREE.Mesh(
      new THREE.RingGeometry(0.019, 0.026, 48),
      new THREE.MeshBasicMaterial({
        color: 0x81fbc7, transparent: true, opacity: 0.92,
        depthTest: false, depthWrite: false,
      }),
    )
    this.gazeReticle.position.set(0, 0, -1.65)
    this.gazeReticle.renderOrder = 90
    this.camera.add(this.gazeReticle)
    this.gazeArc = new THREE.Mesh(
      new THREE.RingGeometry(0.032, 0.041, 48, 1, -Math.PI / 2, 0.0001),
      new THREE.MeshBasicMaterial({
        color: 0xffdc82, depthTest: false, depthWrite: false,
      }),
    )
    this.gazeArc.position.set(0, 0, -1.65)
    this.gazeArc.renderOrder = 91
    this.camera.add(this.gazeArc)
    // Display an actionable reason in SBS when orientation sensors are not
    // usable. No such warning or gaze mesh appears in the Tauri cockpit.
    this.helmetTrackingHint = new THREE.Mesh(
      new THREE.PlaneGeometry(1.70, 0.29),
      new THREE.MeshBasicMaterial({
        map: cockpitLabel(["HEAD TRACKING UNAVAILABLE"], {width: 800, height: 138}),
        transparent: true, depthTest: false, depthWrite: false,
      }),
    )
    this.helmetTrackingHint.position.set(0, 0.88, -2.5)
    this.helmetTrackingHint.renderOrder = 72
    framing.add(this.helmetTrackingHint)
    this.setHelmetNavOpen(false)
    this.setHelmetHeadRotation(null)
    this.setHelmetTrackingUnavailable(false)
  }

  setHelmetGazeEnabled(enabled) {
    this.helmetGazeEnabled = enabled === true
    // Reapply visibility even when enabling: initial construction hides
    // these physical meshes until the HMD explicitly opts into gaze mode.
    this.setHelmetNavOpen(this.helmetGazeEnabled && this.helmetNavOpen)
    this.setHelmetHeadRotation(this.helmetHeadRotation)
    this.setHelmetTrackingUnavailable(this.helmetTrackingUnavailable)
    this.updateGazeFeedback({target: null, armed: false, progress: 0})
  }

  // The "HEAD TRACKING UNAVAILABLE" panel follows the sensor *status*
  // (denied / unsupported / HTTPS required), never a momentary missing pose:
  // flashing it whenever the head held still was disorienting in VR.
  setHelmetTrackingUnavailable(unavailable) {
    this.helmetTrackingUnavailable = unavailable === true
    if (this.helmetTrackingHint) this.helmetTrackingHint.visible =
      Boolean(this.helmetGazeEnabled && this.helmetTrackingUnavailable)
  }

  setHelmetHeadRotation(quaternion) {
    this.helmetHeadRotation = quaternion &&
      [quaternion.x, quaternion.y, quaternion.z, quaternion.w].every(Number.isFinite)
      ? new THREE.Quaternion(quaternion.x, quaternion.y, quaternion.z,
        quaternion.w).normalize() : null
    if (this.gazeReticle) this.gazeReticle.visible =
      Boolean(this.helmetGazeEnabled && this.helmetHeadRotation !== null)

    if (!this.helmetHeadRotation && this.gazeArc) this.gazeArc.visible = false
  }

  // Painted from helmetRespawnView(). Keeping the texture swap behind a
  // content check avoids rebuilding a canvas every frame while the pilot
  // stares at the panel.
  setHelmetDestroyed(view) {
    const destroyed = view?.destroyed === true
    this.helmetDestroyed = destroyed
    this.helmetRespawnArmed = destroyed && view?.armed === true
    if (this.helmetRespawnPanel) this.helmetRespawnPanel.visible = destroyed
    if (this.helmetRespawnButton) this.helmetRespawnButton.visible = destroyed
    if (!destroyed) {
      this.lastRespawnText = null
      return
    }
    // While the wreck panel is up, no other cockpit surface is selectable.
    this.setHelmetNavOpen(false)
    this.setHelmetSurrenderChoice({open: false})
    this.setHelmetModeIcon({visible: false})
    const text = (view.lines || []).join("\n") + "|" + (view.button || "")
    if (text === this.lastRespawnText) return
    this.lastRespawnText = text
    const panelMap = this.helmetRespawnPanel.material.map
    this.helmetRespawnPanel.material.map =
      cockpitLabel(view.lines || [], {width: 1024, height: 480})
    this.helmetRespawnPanel.material.needsUpdate = true
    panelMap?.dispose()
    const buttonMap = this.helmetRespawnButton.material.map
    this.helmetRespawnButton.material.map =
      cockpitLabel([view.button || ""], {width: 768, height: 256})
    this.helmetRespawnButton.material.needsUpdate = true
    buttonMap?.dispose()
  }

  // Painted from helmetSurrenderChoice(). Additive rather than exclusive:
  // the pilot is still flying, so the normal cockpit surfaces stay live.
  setHelmetSurrenderChoice(view) {
    const open = view?.open === true
    this.helmetSurrenderOpen = open
    this.helmetSurrenderArmed = open && view?.armed === true
    if (this.helmetSurrenderPanel) this.helmetSurrenderPanel.visible = open
    for (const [name, button] of Object.entries(this.helmetSurrenderButtons || {})) {
      if (button) button.visible = open && Boolean(view?.[name])
    }
    if (!open) {
      this.lastSurrenderText = null
      return
    }
    const text = (view.lines || []).join("\n") + "|" +
      [view.accept, view.seize, view.dismiss].join("|")
    if (text === this.lastSurrenderText) return
    this.lastSurrenderText = text
    const panelMap = this.helmetSurrenderPanel.material.map
    this.helmetSurrenderPanel.material.map =
      cockpitLabel(view.lines || [], {width: 1024, height: 320})
    this.helmetSurrenderPanel.material.needsUpdate = true
    panelMap?.dispose()
    for (const name of ["accept", "seize", "dismiss"]) {
      const button = this.helmetSurrenderButtons?.[name]
      if (!button) continue
      const old = button.material.map
      button.material.map = cockpitLabel([view[name] || ""],
        {width: 512, height: 224})
      button.material.needsUpdate = true
      old?.dispose()
    }
  }

  // The one icon displays the current server-confirmed mode.
  setHelmetModeIcon(icon) {
    const visible = icon?.visible === true && this.helmetGazeEnabled &&
      !this.helmetDestroyed
    const mode = icon?.mode
    this.helmetModeCurrent = visible && ["cruise", "newtonian"].includes(mode)
      ? mode : null
    this.helmetModeArmed = Boolean(this.helmetModeCurrent && icon?.armed === true)
    if (this.helmetModeIcon) this.helmetModeIcon.visible = Boolean(this.helmetModeCurrent)
    if (this.helmetModeHitbox) {
      // Keep the fixed target available during relay ACK to preserve the latch.
      this.helmetModeHitbox.visible = Boolean(this.helmetModeCurrent)
    }
    if (!this.helmetModeCurrent) {
      this.lastModeIconState = null
      return
    }
    const pending = icon.pending === true
    const signature = mode + ":" + pending
    if (signature === this.lastModeIconState) return
    this.lastModeIconState = signature
    if (this.helmetModeIcon) {
      const old = this.helmetModeIcon.material.map
      this.helmetModeIcon.material.map = modeIconTexture(mode, true, pending)
      this.helmetModeIcon.material.needsUpdate = true
      old?.dispose()
    }
  }

  setHelmetNavOpen(open) {
    this.helmetNavOpen = open === true && !this.helmetDestroyed
    if (this.navSwitch) this.navSwitch.visible =
      Boolean(this.helmetGazeEnabled && !this.helmetNavOpen && !this.helmetDestroyed)
    if (this.helmetNavPanel) this.helmetNavPanel.visible =
      Boolean(this.helmetGazeEnabled && this.helmetNavOpen)
    if (this.helmetNavClose) this.helmetNavClose.visible =
      Boolean(this.helmetGazeEnabled && this.helmetNavOpen)
    if (this.helmetNavRecenter) this.helmetNavRecenter.visible =
      Boolean(this.helmetGazeEnabled && this.helmetNavOpen)
    for (const control of [this.helmetNavFlight, this.helmetNavContacts,
      this.helmetNavSpace]) {
      if (control) control.visible =
        Boolean(this.helmetGazeEnabled && this.helmetNavOpen)
    }
  }

  setHelmetHudPage(page) {
    if (!HMD_HUD_PAGES.includes(page)) return
    this.helmetHudPage = page
    this.lastHelmetHudUpdateAt = -Infinity
  }

  updateHelmetHudPanel(client, time) {
    if (!this.helmetGazeEnabled || !this.helmetNavOpen ||
        time - this.lastHelmetHudUpdateAt < 350) return
    this.lastHelmetHudUpdateAt = time
    const lines = helmetHudLines(this.helmetHudPage, client)
    const text = lines.join("\n")
    if (text === this.lastHelmetHudText) return
    this.lastHelmetHudText = text
    const old = this.helmetNavPanel.material.map
    this.helmetNavPanel.material.map = cockpitLabel(lines, {width: 1024, height: 480})
    this.helmetNavPanel.material.needsUpdate = true
    old?.dispose()
  }

  // The gaze ring and dwell arc share the depth of the control being looked
  // at. In empty space they converge at the distant sight plane instead.
  placeGazeReticle(distance) {
    placeGazeCursor(this.gazeReticle, this.gazeArc, distance, SIGHT_FAR_DISTANCE)
  }

  gazeTarget() {
    this.gazeHitDistance = null
    if (!this.helmetGazeEnabled || !this.helmetHeadRotation) return null
    const surrender = this.helmetSurrenderArmed ?
      Object.values(this.helmetSurrenderButtons || {}) : []
    // A fixed gaze ID remains latched even when the displayed artwork changes.
    const mode = this.helmetModeCurrent ? [this.helmetModeHitbox] : []
    const candidates = this.helmetDestroyed ?
      (this.helmetRespawnArmed ? [this.helmetRespawnButton] : []) :
      this.helmetNavOpen ?
        [this.helmetNavClose, this.helmetNavRecenter, this.helmetNavFlight,
          this.helmetNavContacts, this.helmetNavSpace, ...surrender, ...mode] :
        [...surrender, ...mode]
    this.camera.updateMatrixWorld(true)
    this.cockpitFraming.updateMatrixWorld(true)
    this.raycaster.set(this.camera.position,
      new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion))
    const hits = this.raycaster.intersectObjects(
      candidates.filter(candidate => candidate?.visible), false)
    if (!hits.length || hits[0].distance >= 6) return null
    this.gazeHitDistance = hits[0].distance
    const target = hits[0].object
    if (target === this.helmetModeHitbox) return MODE_GAZE_TARGET
    if (target === this.helmetRespawnButton) return "respawn"
    if (target === this.helmetSurrenderButtons?.accept) return "surrender_accept"
    if (target === this.helmetSurrenderButtons?.seize) return "surrender_seize"
    if (target === this.helmetNavClose) return "nav_close"
    if (target === this.helmetNavRecenter) return "recenter"
    if (target === this.helmetNavFlight) return "hud_flight"
    if (target === this.helmetNavContacts) return "hud_contacts"
    if (target === this.helmetNavSpace) return "hud_space"
    return null
  }

  updateGazeFeedback({target = null, armed = false, progress = 0} = {}) {
    if (!this.gazeReticle || !this.gazeArc) return
    this.gazeReticle.material.color.setHex(target ? 0xffdb8a : 0x81fbc7)
    // Highlight the single mode icon when gaze lands on its one hitbox.
    if (this.helmetModeIcon) {
      const focused = target === MODE_GAZE_TARGET
      this.helmetModeIcon.scale.setScalar(focused ? 1.13 : 1)
      this.helmetModeIcon.material.color.setHex(focused ? 0xffeeb5 : 0xffffff)
    }
    this.gazeArc.visible = Boolean(target && armed && progress > 0)
    if (!this.gazeArc.visible) return
    const clamped = clamp(progress, 0, 1)
    if (Math.abs(clamped - this.lastGazeArcProgress) < 0.03 && clamped < 1) return
    this.lastGazeArcProgress = clamped
    this.gazeArc.geometry.dispose()
    this.gazeArc.geometry = new THREE.RingGeometry(0.032, 0.041, 48, 1,
      -Math.PI / 2, Math.max(0.0001, clamped * Math.PI * 2))
  }

  setHelmetAlignment({eyeGapPx = this.eyeGapPx, eyeSep = this.stereo.eyeSep} = {}) {
    this.eyeGapPx = Math.min(80, Math.max(-160, Math.round(Number(eyeGapPx) || 0)))
    this.stereo.eyeSep = Math.min(0.09, Math.max(0.035, Number(eyeSep) || 0.064))
    this.resize(this.size.width, this.size.height, this.size.dpr)
  }

  setMode(mode) {
    this.mode = mode === "sbs" ? "sbs" : "3d"
    this.camera.focus = this.mode === "sbs" ? SBS_PARALLEL_FOCUS : MONO_FOCUS
    this.resize(this.size.width, this.size.height, this.size.dpr)
  }

  // Optional barrel pre-distortion for phone-headset lenses (beta, off by
  // default). Without it the lenses show pincushion distortion at the edges.
  setLensDistortion(enabled, coefficients) {
    if (!enabled) {
      this.lensDistortion?.dispose()
      this.lensDistortion = null
      return
    }
    if (!this.lensDistortion) this.lensDistortion = new LensDistortionPass(THREE, coefficients)
    else if (coefficients) this.lensDistortion.setCoefficients(coefficients)
  }

  resize(width, height, dpr) {
    this.size = {width: Math.max(1, width), height: Math.max(1, height),
      dpr: Math.max(0.5, Math.min(this.maxPixelRatio, Number(dpr) || 1))}
    this.renderer.setPixelRatio(this.size.dpr)
    this.renderer.setSize(this.size.width, this.size.height, false)
    // StereoCamera.aspect is 1 by default; it takes this camera\'s per-eye
    // aspect directly. Use the actual scissored viewport, including optical gap.
    const layout = stereoViewports(this.size.width, this.size.height, this.eyeGapPx)
    this.camera.aspect = this.mode === "sbs" ? layout.eyeAspect : this.size.width / this.size.height
    this.camera.updateProjectionMatrix()
    const fit = cockpitHudFit(this.camera.aspect, this.camera.fov,
      this.mode === "sbs" ? 0.55 : 0.75)
    if (fit && this.hudPanel && this.dash) {
      this.hudPanel.scale.setScalar(fit.scale)
      this.dash.scale.setScalar(fit.scale)
      // Position the ONE mode symbol below the resized instrument.
      const placement = cockpitModePlacement(fit.scale)
      const pos = placement.icon
      if (this.helmetModeIcon) {
        this.helmetModeIcon.position.set(pos.x, pos.y, pos.z)
      }
      if (this.helmetModeHitbox) {
        this.helmetModeHitbox.position.set(pos.x, pos.y, pos.z + 0.035)
      }
    }
  }

  setCamera(ownShip, {clientLedActive = false} = {}) {
    if (!ownShip) return
    // A stale server navigation destination must never re-point the camera
    // while the pilot is steering locally. The same choice applies to eye
    // offset AND orientation, avoiding an intermittent view-source jump.
    const useDestinationView = cockpitDestinationCamera(ownShip, clientLedActive)
    const pos = toScene(ownShip.render)
    const angle = Number.isFinite(ownShip.angle) ? ownShip.angle : -Math.PI / 2
    // The pilot eye is ship-local too. Rotating this offset with the ship
    // keeps the wing emitters physically anchored after rolls and loops.
    const pose = !useDestinationView &&
      (ownShip.renderOrientation || ownShip.orientation)
    if (pose) {
      const localEye = new THREE.Vector3(0, 2.75, 0).applyQuaternion(
        new THREE.Quaternion(pose.x, pose.y, pose.z, pose.w).normalize()
      )
      this.camera.position.set(pos.x + localEye.x, pos.y + localEye.y,
        pos.z + localEye.z)
    } else {
      this.camera.position.set(pos.x, pos.y + 2.75, pos.z)
    }
    // Ship attitude is authoritative. The atlas autopilot retains its
    // independent destination-heading view.
    const attitude = ownShip.renderAttitude || ownShip.attitude ||
      {yaw: 0, pitch: 0, roll: 0}
    if (!useDestinationView) {
      if (ownShip.renderOrientation || ownShip.orientation) {
        const q = ownShip.renderOrientation || ownShip.orientation
        this.camera.up.set(0, 1, 0)
        this.camera.quaternion.set(q.x, q.y, q.z, q.w).normalize()
        this.camera.updateMatrixWorld(true)
        return
      }
      const {forward, up} = flightBasis(attitude)
      this.camera.up.set(up.x, up.y, up.z)
      this.camera.lookAt(
        pos.x + forward.x * 100,
        pos.y + 2.75 + forward.y * 100,
        pos.z + forward.z * 100,
      )
      this.camera.updateMatrixWorld(true)
      return
    }
    // Atlas autopilot should not inherit the pilot's previous roll.
    this.camera.up.set(0, 1, 0)
    const destination = ownShip.destination ? toScene(ownShip.destination) : null
    const dx = destination ? destination.x - pos.x : 0
    const dy = destination ? destination.y - pos.y : 0
    const dz = destination ? destination.z - pos.z : 0
    if (destination && dx * dx + dy * dy + dz * dz > 0.01) {
      this.camera.lookAt(pos.x + dx, pos.y + 2.75 + dy, pos.z + dz)
    } else {
      this.camera.lookAt(pos.x + Math.cos(angle) * 50, pos.y + 2.0,
        pos.z + Math.sin(angle) * 50)
    }
    this.camera.updateMatrixWorld(true)
  }

  syncShips(client) {
    const active = new Set()
    for (const entity of client.entities.values()) {
      if (entity.id === client.selfId || entity.status === "destroyed") continue
      active.add(entity.id)
      let node = this.nodes.get(entity.id)
      if (!node || node.userData.kind !== entity.kind ||
          node.userData.npcTypeId !== (entity.npcTypeId || null) ||
          node.userData.shipClass !== (entity.shipClass || null)) {
        if (node) {
          this.scene.remove(node)
          disposeMesh(node)
        }
        node = shipModel(entity.kind === "npc", entity.npcTypeId, entity.shipClass)
        node.userData.entityId = entity.id
        node.userData.kind = entity.kind
        node.userData.npcTypeId = entity.npcTypeId || null
        node.userData.shipClass = entity.shipClass || null
        this.scene.add(node)
        this.nodes.set(entity.id, node)
      }
      const pos = toScene(entity.render)
      // Match rendered NPC centre to the server's XYZ collision sphere.
      // Decorative Y offsets previously made the reticle miss real targets.
      node.position.set(pos.x, pos.y, pos.z)
      if (entity.kind === "player" && !entity.destination && entity.orientation) {
        const q = entity.renderOrientation || entity.orientation
        node.quaternion.set(q.x, q.y, q.z, q.w).normalize()
      } else if (entity.kind === "player" && !entity.destination && entity.attitude) {
        const a = entity.renderAttitude || entity.attitude
        node.rotation.set(a.pitch, -a.yaw, a.roll, "YXZ")
      } else if (entity.kind === "npc" &&
        npcVisualClass(entity.npcTypeId, entity.shipClass) !== "generic") {
        node.rotation.y = dartHeadingRotation(entity.angle)
      } else {
        node.rotation.y = -entity.angle
      }
      node.userData.ring.visible = entity.id === client.selectedTargetId
    }
    for (const [id, node] of this.nodes) {
      if (active.has(id)) continue
      this.scene.remove(node)
      disposeMesh(node)
      this.nodes.delete(id)
    }
    this.pickables = [...this.nodes.values()].filter(node => node.userData.kind === "npc")
  }

  // Beams reuse pooled meshes over shared unit geometry. The previous version
  // built and disposed new cylinders, spheres and materials for every beam on
  // every frame, which on a phone means GC stutter during combat.
  beamSlot(index) {
    if (!this.beamPool) {
      this.beamPool = []
      this.beamUnitCylinder = new THREE.CylinderGeometry(1, 1, 1, 8)
      this.beamUnitSphere = new THREE.SphereGeometry(1, 12, 8)
    }
    let slot = this.beamPool[index]
    if (!slot) {
      const additive = () => new THREE.MeshBasicMaterial({
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      })
      slot = {
        core: new THREE.Mesh(this.beamUnitCylinder, additive()),
        glow: new THREE.Mesh(this.beamUnitCylinder, additive()),
        flash: new THREE.Mesh(this.beamUnitSphere, additive()),
      }
      this.beamGroup.add(slot.core, slot.glow, slot.flash)
      this.beamPool[index] = slot
    }
    return slot
  }

  syncBeams(client, time) {
    const up = this.beamUp || (this.beamUp = new THREE.Vector3(0, 1, 0))
    const start = this.beamStart || (this.beamStart = new THREE.Vector3())
    const line = this.beamLine || (this.beamLine = new THREE.Vector3())
    const dir = this.beamDir || (this.beamDir = new THREE.Vector3())
    let used = 0
    for (const beamData of client.beams) {
      if (beamData.expiresAt <= time) continue
      const to = toScene(beamData.to)
      const fraction = clamp((beamData.expiresAt - time) /
        Math.max(1, beamData.expiresAt - beamData.startedAt), 0, 1)
      const laserColor = beamData.hostile ? 0xffa35c : 0xff243d

      // Use the current ship-fixed mesh for the local visual origin only.
      // All remote rays and every shot endpoint stay in world space.
      visualLaserStart(beamData, client.selfId,
        client.entities.has(client.selfId) ? this.cockpitEmitters : null, start)
      line.set(to.x, to.y, to.z).sub(start)
      const length = line.length()
      if (!(length > 1e-6)) continue
      dir.copy(line).divideScalar(length)
      const slot = this.beamSlot(used++)
      for (const [mesh, radius, opacity] of [
        [slot.core, 0.13, fraction], [slot.glow, 0.32, fraction * 0.32],
      ]) {
        mesh.visible = true
        mesh.material.color.setHex(laserColor)
        mesh.material.opacity = opacity
        mesh.position.copy(start).addScaledVector(line, 0.5)
        mesh.quaternion.setFromUnitVectors(up, dir)
        mesh.scale.set(radius, length, radius)
      }
      slot.flash.visible = Boolean(beamData.hit)
      if (beamData.hit) {
        slot.flash.material.color.setHex(beamData.hostile ? 0xffd08d : 0xffe2d8)
        slot.flash.material.opacity = fraction * 0.92
        slot.flash.position.set(to.x, to.y, to.z)
        slot.flash.scale.setScalar(1.1 * (0.9 + (1 - fraction) * 1.7))
      }
    }
    for (let i = used; i < (this.beamPool?.length || 0); i++) {
      const slot = this.beamPool[i]
      slot.core.visible = slot.glow.visible = slot.flash.visible = false
    }
  }

  updateHud(client, time) {
    if (time - this.lastHudAt < 100) return
    this.lastHudAt = time
    const own = client.entities.get(client.selfId)
    const selected = client.entities.get(client.selectedTargetId)
    const surrenderLabel = surrenderedHudLabel(client)
    const ctx = this.hudCanvas.getContext("2d")
    ctx.fillStyle = "#071b2c"
    ctx.fillRect(0, 0, 1024, 256)
    ctx.strokeStyle = "#36c4de"
    ctx.lineWidth = 5
    ctx.strokeRect(8, 8, 1008, 240)
    ctx.fillStyle = "#aaf6ff"
    ctx.font = "bold 36px monospace"
    const altitude = Math.round(own?.render?.z || 0)
    const speed = own?.velocity ? Math.round(Math.hypot(own.velocity.x, own.velocity.y,
      own.velocity.z)) : 0
    const throttle = Math.round((own?.throttle || 0) * 100)
    const mode = own?.flightMode === "newtonian" ? "NF" : "CF"
    ctx.fillText("ALT " + (altitude >= 0 ? "+" : "") + altitude + "   " +
      mode + "   THR " + throttle + "%", 30, 65)
    ctx.font = "30px monospace"
    const hp = own ? Math.round(100 * (own.hull || 0) / Math.max(own.maxHull || 1, 1)) : 0
    const shield = own ? Math.round(100 * (own.shields || 0) / Math.max(own.maxShields || 1, 1)) : 0
    const attitude = orientationTelemetry(
      own?.orientation, own?.attitude || {yaw:0, pitch:0, roll:0}
    )
    const rates = own?.angularVelocity || {yaw:0, pitch:0, roll:0}
    const hdg = ((degrees(attitude.yaw) % 360) + 360) % 360
    ctx.fillText("HDG " + hdg + "  PITCH " + degrees(attitude.pitch) +
      "  ROLL " + degrees(attitude.roll) + "  V " + speed, 30, 135)
    const feedback = client.lastLaserFeedback
    const recent = feedback && time - feedback.at < LASER_FEEDBACK_MS
    ctx.fillStyle = surrenderLabel ? "#81ffaf" : recent ? (feedback.hit ? "#81ffaf" : "#ff9a99") :
      selected ? "#ffbe89" : "#7aa9cb"
    ctx.font = (surrenderLabel || recent) ? "bold 36px monospace" : "30px monospace"
    ctx.fillText(surrenderLabel ? surrenderLabel : recent ? feedback.label :
      selected ? "TARGET " +
        (npcVisualClass(selected.npcTypeId, selected.shipClass) === "generic"
          ? "" : npcVisualClass(selected.npcTypeId, selected.shipClass).toUpperCase() + " ") +
        (selected.displayName || "CONTACT").slice(0, 19) :
      "P/Y/R  " + Math.abs(degrees(rates.pitch)) + " / " +
      Math.abs(degrees(rates.yaw)) + " / " + Math.abs(degrees(rates.roll)) +
      " deg/s", 30, 194)
    const range = targetRange(own, selected)
    const nav = client.navComputer?.solarNavigation
    const flyby = nav?.tactical_encounter ? null : nav?.encounter
    const planetWarning = client.planetaryWarningDisplay
    const hold = client.encounterHold
    const story = client.storyHud?.stereoLine
    // This canvas is a stereo-correct 3D HUD surface shared by both SBS
    // eyes. Render the hazard inside the instrument rather than a flat
    // non-stereoscopic banner that would be uncomfortable in a headset.
    ctx.fillStyle = planetWarning
      ? planetWarning.level === "critical" ? "#ff8f90" : "#ffcf7a"
      : surrenderLabel ? "#81ffaf"
      : hold ? "#fcd34d"
      : flyby ? "#7eead6"
      : range?.inRange === false ? "#ff9b96"
      : !range && story ? "#fcd889" : "#9fc7df"
    ctx.font = "bold 22px monospace"
    ctx.fillText(planetWarning
      ? planetWarning.level.toUpperCase() + " · " + planetWarning.detail
      : surrenderLabel ? "SURRENDER OFFER · ACCEPT OR RETREAT ON LAPTOP"
      : hold ? "CRUISE PAUSED · " + String(hold.call_sign).slice(0, 20) +
        " · HAIL OR RESUME ON LAPTOP"
      : flyby ? "CLOSE PASS · " + String(flyby.call_sign).slice(0, 24) +
        " · HAIL VIA ATLAS"
      : range ? range.label
      : story ? story :
        "LASER " + Math.round(own?.attackRange || 0) + "u  ·  RMB FIRE  ·  T TARGET",
      30, 234)
    this.hudTexture.needsUpdate = true
  }

  updateSteeringLine(steering) {
    const tip = steering ? steeringLineTip(steering, STEERING_LINE_DISTANCE) : null
    const line = this.steeringLine
    if (!line) return
    line.visible = Boolean(tip?.visible)
    this.steeringTip.visible = line.visible
    if (!line.visible) return
    // Stretch the unit tube from the nose point to the tip. Both lie on the
    // z = -distance plane, so the direction is purely sideways/up.
    const direction = this.steeringLineDirection.set(
      tip.x, tip.y, tip.z + STEERING_LINE_DISTANCE)
    const length = direction.length()
    if (length < 1e-6) { line.visible = false; return }
    line.quaternion.setFromUnitVectors(STEERING_LINE_AXIS, direction.divideScalar(length))
    line.scale.set(1, length, 1)
    line.material.opacity = tip.opacity
    this.steeringTip.position.set(tip.x, tip.y, tip.z)
    this.steeringTip.material.opacity = Math.min(1, tip.opacity + 0.1)
  }

  updateSteeringStatus(status) {
    const label = this.steeringStatus
    if (!label) return
    label.visible = typeof status === "string"
    if (!label.visible || status === this.steeringStatusText) return
    this.steeringStatusText = status
    label.material.map?.dispose()
    // First line: stick link state; optional second line: headset perf.
    const [link, ...rest] = status.split("\n")
    label.material.map = cockpitLabel([link, ...rest], {width: 1024, height: 232})
    label.material.needsUpdate = true
  }

  updateDockingCountdown(seconds) {
    const visible = Number.isInteger(seconds) && seconds >= 0
    this.dockingCountdownMesh.visible = visible
    if (!visible || this.lastCountdownNumber === seconds) return
    this.lastCountdownNumber = seconds
    const ctx = this.dockingCountdownCanvas.getContext("2d")
    ctx.clearRect(0, 0, 640, 320)
    ctx.fillStyle = "rgba(2, 25, 19, 0.94)"
    ctx.fillRect(0, 0, 640, 320)
    ctx.strokeStyle = "#75ffb0"
    ctx.lineWidth = 12
    ctx.strokeRect(8, 8, 624, 304)
    ctx.textAlign = "center"
    ctx.fillStyle = "#8cffe0"
    ctx.font = "bold 44px monospace"
    ctx.fillText("GREEN STARBASE", 320, 78)
    ctx.fillStyle = "#f7fff5"
    ctx.font = seconds === 0 ? "bold 66px monospace" : "bold 124px monospace"
    ctx.fillText(seconds === 0 ? "DOCKING…" : String(seconds), 320, 217)
    ctx.fillStyle = "#c5dfce"
    ctx.font = "bold 30px monospace"
    ctx.fillText("HOLD STILL · AUTO DOCK", 320, 287)
    this.dockingCountdownTexture.needsUpdate = true
  }

  render(client, time) {
    const feedback = client.lastLaserFeedback
    const active = feedback && time - feedback.at < LASER_FEEDBACK_MS
    this.sight?.material?.color?.setHex(active ?
      feedback.hit ? 0x79ff9b : 0xff7272 : 0x78e6fc)
    const ownShip = client.entities.get(client.selfId)
    const docked = greenStarbaseInteriorVisible(client)
    this.updateDockingCountdown(docked ? null : client.stationDockingSeconds)
    this.interiorActive = docked
    if (docked) {
      this.hangar.update(client.stationPosition, time, client.stationAttendants)
      // Station camera is an anchored viewpoint inside the actual hangar.
      // The headset still adds its own local, recentered head quaternion.
      if (this.camera.parent !== this.hangarScene) this.hangarScene.add(this.camera)
      const position = client.stationPosition
      const targetX = Number.isFinite(position?.x) ? position.x : 0
      const targetZ = Number.isFinite(position?.z) ? position.z : 43
      const targetYaw = Number.isFinite(position?.yaw) ? position.yaw : 0
      if (!this.stationViewPose) {
        this.stationViewPose = {x: targetX, z: targetZ, yaw: targetYaw}
      } else {
        const dt = this.stationLastFrameAt == null ? 0 :
          Math.max(0, Math.min(100, time - this.stationLastFrameAt))
        const blend = 1 - Math.exp(-dt / 75)
        this.stationViewPose.x += (targetX - this.stationViewPose.x) * blend
        this.stationViewPose.z += (targetZ - this.stationViewPose.z) * blend
        // Shortest angular rotation: no snap when yaw wraps past 180 degrees.
        const diff = Math.atan2(Math.sin(targetYaw - this.stationViewPose.yaw),
          Math.cos(targetYaw - this.stationViewPose.yaw))
        this.stationViewPose.yaw += diff * blend
      }
      this.stationLastFrameAt = time
      this.camera.position.set(this.stationViewPose.x, 2.6, this.stationViewPose.z)
      this.camera.up.set(0, 1, 0)
      // Only the person's camera moves. HMD head rotation applies below.
      this.camera.rotation.set(0, -this.stationViewPose.yaw, 0, "YXZ")
      this.camera.updateMatrixWorld(true)
    } else {
      this.stationViewPose = null
      this.stationLastFrameAt = null
      if (this.camera.parent !== this.scene) this.scene.add(this.camera)
      this.setCamera(ownShip, {
        clientLedActive: Boolean(client.clientLedCameraActiveForTick?.()),
      })
      // Ship-fixed cockpit surfaces stay separate from headset head motion.
      this.cockpitFraming.position.copy(this.camera.position)
      this.cockpitFraming.quaternion.copy(this.camera.quaternion)
    }
    // Headset only: the laptop draws its own SVG line over the canvas.
    this.updateSteeringLine(this.helmetGazeEnabled && !docked
      ? client.steeringDeflection : null)
    this.updateSteeringStatus(this.helmetGazeEnabled && !docked
      ? client.steeringLinkStatus : null)
    if (this.helmetGazeEnabled && this.helmetHeadRotation) {
      this.camera.quaternion.multiply(this.helmetHeadRotation)
      this.camera.updateMatrixWorld(true)
    }
    this.gazeHitDistance = null
    if (this.helmetGazeEnabled && this.onHelmetGaze) {
      // In the station the laptop retains service control. Do not allow
      // invisible cockpit NAV meshes to trigger head-gaze actions.
      this.onHelmetGaze(docked ? null : this.gazeTarget(), time)
    }
    this.placeGazeReticle(this.gazeHitDistance)
    if (this.sight) this.sight.visible = Boolean(ownShip && !docked)
    if (!docked) {
      // Real outer-space rendering is retained unchanged after launch.
      this.stars?.position.copy(this.camera.position)
      const navigation = client.navComputer?.solarNavigation
      this.spaceEnvironment.update(navigation?.space_environment, this.camera, client.mapId)
      this.planetaryBody.update(navigation, this.camera, time, ownShip)
      this.spaceBase.update(client.orbitalBase, this.camera)
      this.greenStarbase.update(navigation, client.mapId)
      this.refineryTraffic.update(client.orbitalBase, this.spaceBase.node,
        this.planetaryBody, navigation?.planetary_view, time, this.camera)
      this.encounterShip.update(navigation?.tactical_encounter ? null : navigation, this.camera)
      this.syncShips(client)
      this.syncBeams(client, time)
      this.updateHud(client, time)
      this.updateHelmetHudPanel(client, time)
    }
    this.stereo.update(this.camera)
    const activeScene = docked ? this.hangarScene : this.scene
    const {width, height} = this.size
    if (this.mode === "sbs") {
      const {left, right} = stereoViewports(width, height, this.eyeGapPx)

      // StereoCamera.update() caches its eye projections. Never permanently
      // modify elements[8] or each frame compounds the previous shift and
      // the headset image scrolls continuously without any input.
      const restore = applyTransientStereoOffset(
        this.stereo.cameraL.projectionMatrix,
        this.stereo.cameraR.projectionMatrix,
        this.eyeGapPx, left.width,
      )
      try {
        // Clear the center strip instead of leaving stale pixels from a prior frame.
        this.renderer.setScissorTest(false)
        this.renderer.clear(true, true, true)
        if (this.lensDistortion) {
          // The lens centre follows the calibrated inward image shift.
          const shift = inwardStereoProjectionOffset(this.eyeGapPx, left.width)
          this.lensDistortion.renderEye(this.renderer, activeScene, this.stereo.cameraL,
            left, this.size.dpr, lensCenterU("left", shift))
          this.lensDistortion.renderEye(this.renderer, activeScene, this.stereo.cameraR,
            right, this.size.dpr, lensCenterU("right", shift))
        } else {
          this.renderer.setScissorTest(true)
          this.renderer.setViewport(left.x, left.y, left.width, left.height)
          this.renderer.setScissor(left.x, left.y, left.width, left.height)
          this.renderer.render(activeScene, this.stereo.cameraL)
          this.renderer.setViewport(right.x, right.y, right.width, right.height)
          this.renderer.setScissor(right.x, right.y, right.width, right.height)
          this.renderer.render(activeScene, this.stereo.cameraR)
        }
      } finally {
        restore()
        this.renderer.setScissorTest(false)
      }
    } else {
      this.renderer.setViewport(0, 0, width, height)
      this.renderer.render(activeScene, this.camera)
    }
  }

  rayFromPointer(pointer, rect) {
    const pos = pointerNdc(pointer, rect, this.mode, this.eyeGapPx)
    if (!pos) return false
    this.camera.updateMatrixWorld(true)
    this.stereo.update(this.camera)
    const camera = pos.eye === "left" ? this.stereo.cameraL : pos.eye === "right" ? this.stereo.cameraR : this.camera
    this.raycaster.setFromCamera(new THREE.Vector2(pos.x, pos.y), camera)
    return true
  }

  selectNpc(pointer, rect) {
    if (this.interiorActive || !this.rayFromPointer(pointer, rect)) return null
    const intersections = this.raycaster.intersectObjects(this.pickables, true)
    for (const intersection of intersections) {
      let node = intersection.object
      while (node && !node.userData.entityId) node = node.parent
      if (node?.userData.kind === "npc") return node.userData.entityId
    }
    return null
  }

  destination(pointer, rect, bounds) {
    if (this.interiorActive || !this.rayFromPointer(pointer, rect)) return null
    const point = this.raycaster.ray.intersectPlane(this.floor, new THREE.Vector3())
    if (!point) return null
    const xy = toWorld(point)
    if (![xy.x, xy.y].every(Number.isFinite)) return null
    return {x: clamp(xy.x, 0, bounds.width), y: clamp(xy.y, 0, bounds.height)}
  }
}
