import {Socket, Presence} from "phoenix"
import * as THREE from "three"
import {SolarOrrery} from "./solar_orrery.mjs"
import {GlobalChat} from "./global_chat.mjs"
import {
  applyAuthoritativeDamage,
  entityKey,
  healthPercent,
  nearestNpc,
} from "./combat_client.mjs"
import {
  combatKeyIntent,
  gameplayTypingTarget,
  manualLaserPointerIntent,
  desiredEntityAngle,
  hotbarActionActive,
  smoothAngle,
} from "./combat_controls.mjs"
import {CockpitWindowManager} from "./cockpit_window_manager.mjs"
import {advanceCabinPose, canWalkInTransit, cabinRoom, CABIN_START, EMPTY_WALK} from "./ship_cabin.mjs"
import {FloatingHud} from "./floating_hud.mjs"
import {MinimapRenderer} from "./minimap_renderer.mjs"
import {PointerNavigation} from "./pointer_navigation.mjs"
import {StereoSpaceView} from "./stereo_view.js"
import {StoryHud} from "./story_hud.mjs"
import {PilotInventoryPanel} from "./pilot_inventory_panel.mjs"
import {StoryRadio} from "./story_radio.mjs"
import {HelmetControl} from "./helmet_control.mjs"
import {SbsRelayWorldPublisher} from "./sbs_relay_world.mjs"
import {HelmetAlignmentKeyGate} from "./helmet_alignment_keys.mjs"
import {NavigationComputer} from "./navigation_computer.mjs"
import {FlightControls} from "./flight_controls.mjs"
import {flightInputState, FLIGHT_INPUT_LABELS} from "./flight_input_state.mjs"
import {WorldStreamDelta} from "./world_stream_delta.mjs"
import {BandwidthProbe, instrumentPhoenixSocket} from "./bandwidth_probe.mjs"
import {attachBandwidthPanel} from "./bandwidth_panel.mjs"
import {gameSocketEndpoint} from "./socket_endpoint.mjs"
import {
  MouseSteering, validMouseSensitivity, enabledMouseSteering,
  MOUSE_STEERING_DEFAULT_SENSITIVITY, mouseSteeringVector,
} from "./mouse_steering.mjs"
import {smoothAttitude} from "./attitude_interpolation.mjs"
import {smoothOrientation, orientationTelemetry} from "./orientation_interpolation.mjs"
import {SpaceLaserTrigger} from "./space_laser_trigger.mjs"
import {applyLaserBurstDamage, visualLaserRays} from "./laser_burst.mjs"
import {laserFeedback, LASER_FEEDBACK_MS} from "./laser_feedback.mjs"
import {instantLaserPreview,takePreviewForConfirmedShot,
  LOCAL_LASER_MATCH_MS,REMOTE_LASER_DISPLAY_MS} from "./instant_laser_preview.mjs"
import {nextFlightMode, validFlightMode} from "./display_modes.mjs"
import {cameraSettleSeconds, PREDICTED_OWN_SHIP_SETTLE_SECONDS} from "./camera_response.mjs"
import {predictOrientation, predictPosition, InputHistory} from "./own_ship_prediction.mjs"
import {smoothEntityPresentation} from "./entity_smoothing.mjs"
import {applyOwnShipMovementPreview} from "./own_ship_movement_preview.mjs"
import {acceptOwnShipPose} from "./own_ship_pose_policy.mjs"
import {OwnShipCameraReconciler} from "./own_ship_camera_reconciler.mjs"
import {DesktopMouseFrameSampler, DesktopMouseTimingProbe} from "./desktop_mouse_sampling.mjs"
import {ClientLedMouseCamera, preferClientLedCamera} from "./client_led_mouse_camera.mjs"
import {headsetRendering, pauseDesktop3D, preferredVrOnly} from "./vr_only_rendering.mjs"
import {planetaryImpactMessage} from "./planetary_impact.mjs"
import {
  ownPlanetaryWarning, proximityEventWarning, planetaryWarningView,
} from "./planetary_warning.mjs"
import {ownStationWarning, stationWarningView} from "./station_warning.mjs"
import {dockingHoldFromEvent, syncDockingHold, dockingSeconds} from "./starbase_docking_countdown.mjs"
import {StationWalkingControls} from "./station_walking_controls.mjs"
import {nearestStationAttendant} from "./station_attendants.mjs"
import {StationOutfittingPanel} from "./station_outfitting_panel.mjs"
import {StationTradePanel} from "./station_trade_panel.mjs"
import {validOrbitalMapId, shouldEnterOrbitalRegion} from "./orbital_regions.mjs"
import {tacticalEncounterAction, encounterContinueLabel} from "./solar_encounter_actions.mjs"

const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum)
const validDestination = (destination, boundaries) =>
  destination &&
  Number.isFinite(destination.x) &&
  Number.isFinite(destination.y) &&
  destination.x >= 0 &&
  destination.x <= boundaries.width &&
  destination.y >= 0 &&
  destination.y <= boundaries.height
const number = value => new Intl.NumberFormat("en-US", {maximumFractionDigits: 0}).format(value || 0)

class SpaceClient {
  constructor(root) {
    this.root = root
    // Transparent DOM hit surface. Three.js owns the only flight renderer.
    this.canvas = root.querySelector("#space-viewport")
    this.stereoView = null
    this.displayMode = "3d"
    this.mapId = root.dataset.mapId
    this.token = root.dataset.socketToken
    // Per-pilot browser preference, not an authority-bearing network setting.
    this.mouseSteeringKey = "sunracer:mouse-steering:" + root.dataset.layoutPlayerId
    // Virtual-joystick sensitivity (1.0 = steering line tracks the mouse 1:1).
    // A new key: the old per-packet rate sensitivity has a different meaning.
    this.mouseSensitivityKey = "sunracer:mouse-stick-sensitivity:" + root.dataset.layoutPlayerId
    this.mouseSteeringEnabled = enabledMouseSteering(
      localStorage.getItem(this.mouseSteeringKey),
      root.dataset.nativeClient === "true",
    )
    const savedSensitivity = Number(localStorage.getItem(this.mouseSensitivityKey))
    this.mouseSteeringSensitivity = validMouseSensitivity(savedSensitivity)
      ? savedSensitivity : MOUSE_STEERING_DEFAULT_SENSITIVITY
    this.mouseSteering = new MouseSteering({
      sensitivity: this.mouseSteeringSensitivity,
      span: () => ({width: this.canvas?.clientWidth, height: this.canvas?.clientHeight}),
    })
    this.mouseSteeringVector = root.querySelector("#mouse-steering-vector")
    this.mouseFrameSamplingKey = "sunracer:mouse-frame-sampling:" + root.dataset.layoutPlayerId
    this.mouseFrameSamplingEnabled = localStorage.getItem(this.mouseFrameSamplingKey) === "1"
    this.mouseFrameSampler = new DesktopMouseFrameSampler()
    this.clientLedCameraKey = "sunracer:client-led-mouse-camera:" + root.dataset.layoutPlayerId
    this.clientLedCameraEnabled = preferClientLedCamera(
      localStorage.getItem(this.clientLedCameraKey),
      root.dataset.nativeClient === "true")
    this.clientLedCamera = new ClientLedMouseCamera()
    this.clientLedCameraDelta = null
    this.clientLedCameraServerAlert = false
    this.mouseTimingProbe = new DesktopMouseTimingProbe()
    this.lastMouseTimingReport = -Infinity
    this.mouseCaptureLost = false
    this.mouseFallback = false
    this.mouseFallbackPoint = null
    this.helmetAlignmentKeys = new HelmetAlignmentKeyGate()
    this.entities = new Map()
    this.ownShipCameraReconciler = new OwnShipCameraReconciler()
    this.pilots = new Map()
    this.boundaries = {width: 20000, height: 12000}
    this.volume = {altitude_min: -3000, altitude_max: 3000}
    this.selfId = null
    this.planetaryWarningLevel = "clear"
    this.planetaryWarningPlanet = null
    this.stationWarningLevel = "clear"
    this.solarEncounter = null
    this.encounterDisplayedId = null
    this.hailedEncounterId = null
    this.encounterResolving = false
    this.tacticalRetreating = false
    this.player = null
    this.commandDestination = null
    this.selectedTargetId = null
    this.selectedHotbarSlot = 1
    this.worldTick = 0
    this.tickMs = 100
    this.worldStream = null
    this.worldResyncInFlight = false
    this.beams = []
    this.pendingLocalLaserPreviews = []
    this.manualShotSequence = 0
    this.lastLaserFeedback = null
    this.lastFrame = performance.now()
    // Experimental presentation preference. Only actual, server-confirmed
    // SBS rendering on the phone can suppress the laptop's 3D draw call.
    this.desktopVrOnlyKey = "sunracer:vr-only:" + root.dataset.layoutPlayerId
    this.desktopVrOnlyPreferred = preferredVrOnly(localStorage.getItem(this.desktopVrOnlyKey))
    this.desktopVrOnlyActive = false
    this.desktopVrAvailable = false
    this.desktopVrLastPreference = null
    this.desktopVrRenderStats = {rendered: 0, skipped: 0, cpuMs: 0, lastReport: 0}
    this.lastVisualPosePublishedAt = -Infinity
    // Read-only transport estimate; never records credentials or game state.
    this.bandwidth = new BandwidthProbe("desktop-server")
    this.sbsRelayWorld = new SbsRelayWorldPublisher({
      invoke: () => this.root.dataset.nativeClient === "true"
        ? window.__TAURI__?.core?.invoke : null,
    })
    this.docked = false
    this.stationPosition = null
    this.stationPilots = []
    this.stationAttendants = []
    this.stationNpcDialogOpen = false
    this.outfittingPanel = null
    this.tradePanel = null
    this.inventoryPanel = null
    this.stationNpcId = null
    this.stationNpcBusy = false
    this.stationNpcRequestSeq = 0
    this.stationDockingHold = null
    this.stationDockingSeconds = null
    this.lastDockingCountdownLabel = null
    this.respawnPending = false
    this.lastFlightInputState = null
    this.shipWalkPose = null
    this.shipWalkAxes = EMPTY_WALK
    this.manualLaserPointerHeld = false
    this.laserTakeoverPending = false
  }

  flightInputState() {
    const navigation = this.navComputer?.solarNavigation
    return flightInputState({
      atlasOpen: Boolean(this.navComputer?.isOpen),
      docked: this.docked,
      encounterHeld: Boolean(this.solarEncounter || this.dispatchOfferOpen),
      inventoryOpen: Boolean(this.inventoryPanel?.opened),
      cruiseLocked: Boolean(this.inSystemCruise()),
      regionTransferring: Boolean(navigation?.free_flight) &&
        this.mapId !== `sol:free_${this.selfId}`,
      sectorJoined: this.channel?.state === "joined",
      ship: this.entities.get(this.selfId) || null,
    })
  }

  inSystemCruise() {
    const navigation = this.navComputer?.solarNavigation
    return navigation?.status === "traveling" && !navigation?.tactical_encounter &&
      !navigation?.free_flight
  }

  canWalkShip() {
    return canWalkInTransit({
      flightState: this.flightInputState(),
      displayMode: this.displayMode,
      pendingEncounter: Boolean(this.solarEncounter || this.navComputer?.solarNavigation?.pending_encounter),
      headsetActive: headsetRendering(this.helmet?.status),
    })
  }

  toggleShipWalk() {
    if (this.shipWalkPose) {
      this.leaveShipWalk()
      return
    }
    if (!this.canWalkShip()) return
    this.stationWalking?.release()
    this.exitMouseSteering({silent: true})
    this.flightControls?.release({silent: true})
    this.manualLaserPointerHeld = false
    this.spaceLaser?.release()
    this.shipWalkAxes = EMPTY_WALK
    this.shipWalkPose = {...CABIN_START}
    this.root.dataset.shipWalk = "true"
    this.lastFlightInputState = null
    this.updateFlightInputStatus()
    this.canvas.focus({preventScroll: true})
  }

  leaveShipWalk() {
    if (!this.shipWalkPose) return
    this.stationWalking?.release()
    this.shipWalkPose = null
    this.shipWalkAxes = EMPTY_WALK
    delete this.root.dataset.shipWalk
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.()
    this.lastFlightInputState = null
  }

  syncShipWalk() {
    const available = this.canWalkShip()
    if (this.shipWalkPose && !available) this.leaveShipWalk()
    const button = this.root.querySelector("#ship-walk-toggle")
    if (button) button.hidden = !available
  }

  start() {
    if (!this.canvas || !this.root.querySelector("#space-viewport-3d")) {
      this.showError("The 3D flight viewport is missing.")
      return
    }

    for (const type of ["keydown", "keyup"]) {
      window.addEventListener(type, event => this.globalChat?.captureKey(event), true)
    }
    this.cockpit = new CockpitWindowManager({
      root: this.root.querySelector("#cockpit-interface"),
      playerId: this.root.dataset.layoutPlayerId,
    }).start()
    this.floatingHud = new FloatingHud({
      root: this.root,
      playerId: this.root.dataset.layoutPlayerId,
      onShipResize: () => this.cockpit.clampWindow("ship_status"),
      releaseInput: () => {
        this.stationWalking?.release()
        this.flightControls?.release()
        this.exitMouseSteering()
        this.manualLaserPointerHeld = false
        this.spaceLaser?.release()
      },
    }).start()
    this.minimap = new MinimapRenderer({
      canvas: this.root.querySelector("#cockpit-minimap-canvas"),
      getEntities: () => this.entities.values(),
      getBoundaries: () => this.boundaries,
      getSelfId: () => this.selfId,
      getDestination: () => this.commandDestination,
    }).start()
    // Registered before flight handlers so docked WASD never controls the ship.
    this.stationWalking = new StationWalkingControls({
      active: () => (this.docked || Boolean(this.shipWalkPose && this.canWalkShip())) && !this.navComputer?.isOpen &&
        !this.stationNpcDialogOpen && !this.dispatchOfferOpen &&
        !this.inventoryPanel?.opened && !this.globalChat?.editing &&
        this.channel?.state === "joined",
      canvas: this.canvas,
      sendWalk: input => {
        if (this.shipWalkPose) this.shipWalkAxes = input
        else if (this.docked) this.channel?.push("station_walk", input)
      },
      sendLook: input => {
        if (this.shipWalkPose) this.shipWalkPose.yaw += input.delta_yaw
        else if (this.docked) this.channel?.push("station_look", input)
      },
    }).start()
    this.flightControls = new FlightControls({
      active: () => this.flightInputState() === "ready" && !this.globalChat?.editing,
      send: input => this.sendFlightControls(input),
    })
    this.setupMouseSteering()
    this.setupFlightModeButtons()
    this.setupDesktopVrOnlyControl()
    this.root.querySelector("#ship-walk-toggle")?.addEventListener("click", () => this.toggleShipWalk())
    const takeHelm = this.root.querySelector("#cockpit-take-helm")
    takeHelm?.addEventListener("click", () => {
      if (this.shipWalkPose || this.flightInputState() !== "cruise" || takeHelm.disabled) return
      takeHelm.disabled = true
      this.solarEnterFreeFlight((ok, navigation, reason) => {
        takeHelm.disabled = false
        if (ok && navigation) this.applySolarNavigation(navigation)
        else this.showError("Manual helm unavailable: " + (reason || "unknown error"))
      })
    })
    window.addEventListener("keydown", event => {
      // F (full stop) also recentres the virtual joystick; otherwise the
      // next mouse packet would resume the old deflection.
      if (this.flightControls.keyDown(event) && event.code === "KeyF") {
        this.mouseSteering.release()
      }
    })
    window.addEventListener("keyup", event => {
      this.flightControls.keyUp(event)
      this.helmetAlignmentKeys.keyUp(event)
    })
    // Only the cockpit hit canvas owns flight input; menus/Atlas retain
    // ordinary scrolling and right-click behavior.
    this.canvas.addEventListener("wheel", event => this.flightControls.wheel(event),
      {passive: false})
    window.addEventListener("blur", () => {
      this.helmetAlignmentKeys.release()
      this.exitMouseSteering()
      this.flightControls.release()
      this.manualLaserPointerHeld = false
      this.spaceLaser?.release()
    })
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.helmetAlignmentKeys.release()
        this.exitMouseSteering()
        this.flightControls.release()
        this.manualLaserPointerHeld = false
        this.spaceLaser?.release()
      }
    })
    const encounterPanel = this.root.querySelector("#solar-encounter-panel")
    encounterPanel?.addEventListener("click", event => {
      const choice = event.target?.closest?.("[data-encounter-action]")?.dataset.encounterAction
      const encounter = this.solarEncounter
      if (!choice || !encounter || this.encounterResolving) return

      if (choice === "hail") {
        this.encounterMessage("Opening communications…")
        this.solarHail(encounter.contact_id, (ok, communication, reason) => {
          if (this.solarEncounter?.id !== encounter.id) return
          if (!ok) {
            this.encounterMessage("Hail unavailable: " + (reason || "contact out of range") +
              ". You can still resume your course.")
            return
          }
          const manifest = Object.entries(communication.cargo || {})
            .map(([item, count]) => item.replaceAll("_", " ") + ": " + count)
            .join(", ")
          const transcript = Array.isArray(communication.transcript) &&
            communication.transcript.length
            ? communication.transcript.map(line => line.speaker + ": " + line.text).join("\n\n")
            : String(communication.message || "Communications established.")
          this.hailedEncounterId = encounter.id
          this.encounterMessage(transcript +
            (manifest ? "\nManifest: " + manifest : ""))
          this.showSolarEncounter()
        })
      } else if (choice === "engage") {
        this.encounterResolving = true
        this.encounterMessage(encounter.classification === "neutral_flyby"
          ? "Intercepting neutral vessel… Your attack may provoke retaliation."
          : "Entering tactical interception…")
        this.showSolarEncounter()
        this.solarEnterEncounter(encounter.id, (ok, result, reason) => {
          this.encounterResolving = false
          if (ok && result?.navigation) {
            this.applySolarNavigation(result.navigation)
            this.navComputer?.close()
            this.setCombatMessage("Intercept engaged. " +
              (result.enemy?.display_name || "Vessel") +
              " is now in tactical range.")
          } else if (this.solarEncounter?.id === encounter.id) {
            this.encounterMessage("Unable to enter combat: " +
              (reason || "intercept unavailable"))
            this.showSolarEncounter()
          }
        })
      } else if (choice === "continue") {
        this.encounterResolving = true
        this.encounterMessage("Requesting course resumption…")
        this.showSolarEncounter()
        this.solarResolveEncounter(encounter.id, (ok, navigation, reason) => {
          this.encounterResolving = false
          if (ok && navigation) {
            this.applySolarNavigation(navigation)
          } else if (this.solarEncounter?.id === encounter.id) {
            this.encounterMessage("Unable to resume: " + (reason || "relay unavailable"))
            this.showSolarEncounter()
          }
        })
      }
    })
    const tacticalPanel = this.root.querySelector("#solar-tactical-panel")
    tacticalPanel?.addEventListener("click", event => {
      const accept = event.target?.closest?.("[data-solar-tactical-surrender]")
      const seize = event.target?.closest?.("[data-solar-tactical-seize]")
      const retreat = event.target?.closest?.("[data-solar-tactical-retreat]")
      if ((!accept && !seize && !retreat) || this.tacticalRetreating) return
      const tactical = this.navComputer?.solarNavigation?.tactical_encounter
      if (!tactical?.id) return
      this.tacticalRetreating = true
      const message = tacticalPanel.querySelector("[data-solar-tactical-message]")
      if (message) message.textContent = seize
        ? "Seizing permitted cargo under inventory lock…"
        : accept ? "Releasing the surrendered captain…"
        : "Withdrawing from interception…"
      const handler = seize ? this.solarSeizeCargo.bind(this)
        : accept ? this.solarAcceptSurrender.bind(this)
        : this.solarRetreatEncounter.bind(this)
      handler(tactical.id, (ok, navigation, reason, claim) => {
        this.tacticalRetreating = false
        if (ok && navigation) {
          this.applySolarNavigation(navigation)
          this.navComputer?.open()
          const cargo = claim?.cargo || {}
          const contents = Object.entries(cargo)
            .map(([id, count]) => count + "t " + id.replaceAll("_", " "))
            .join(", ")
          this.setCombatMessage(seize
            ? "Cargo seized: " + (contents || "none") +
              " · " + claim.faction_id + " standing " + claim.standing
            : accept ? "Merchant released. SOL voyage resumed."
            : "Interception ended. SOL voyage resumed.")
        } else if (message) {
          message.textContent = "Decision unavailable: " + (reason || "relay error")
        }
        this.showSolarTactical()
      })
      this.showSolarTactical()
    })
    // Modal decisions own keyboard focus. Escape and Atlas toggle cannot
    // dismiss a server-held encounter without a choice.
    window.addEventListener("keydown", event => {
      if (!this.solarEncounter) return
      if (event.key === "Tab") {
        const actions = [...encounterPanel.querySelectorAll(
          '.solar-encounter-eye:first-child [data-encounter-action]')]
          .filter(button => !button.hidden && !button.disabled)
        const index = actions.indexOf(document.activeElement)
        const next = event.shiftKey
          ? actions[(index + actions.length - 1) % actions.length]
          : actions[(index + 1) % actions.length]
        if (next) next.focus({preventScroll: true})
        event.preventDefault()
      } else if (event.key === "Escape" || event.key.toLowerCase() === "m") {
        event.preventDefault()
      }
      event.stopImmediatePropagation()
    }, true)

    this.navComputer = new NavigationComputer({
      createOrrery: (host, actions) => new SolarOrrery(THREE, host, actions, {native: this.root.dataset.nativeClient === "true"}),
      root: this.root.querySelector("#navigation-computer"),
      getEntities: () => this.entities,
      getSelfId: () => this.selfId,
      getBoundaries: () => ({...this.boundaries, ...this.volume}),
      isConnected: () => this.channel?.state === "joined" && Boolean(this.selfId),
      engage: (waypoints, done) => this.plotCourse(waypoints, done),
      halt: done => this.stopNavigation(done),
      solarSetCourse: (bodyId, done) => this.solarSetCourse(bodyId, done),
      solarCancelCourse: done => this.solarCancelCourse(done),
      solarEnterFreeFlight: done => this.solarEnterFreeFlight(done),
      solarResumeCruise: done => this.solarResumeCruise(done),
      solarHail: (contactId, done) => this.solarHail(contactId, done),
      onOpen: () => {
        this.leaveShipWalk()
        this.closeStationNpc({focus: false})
        this.stationWalking?.release()
        this.exitMouseSteering({silent: true})
        this.helmet?.setCombat(false)
        this.navigation?.cancel()
        this.flightControls.release({silent: true})
        this.manualLaserPointerHeld = false
        this.spaceLaser?.release()
      },
      onClose: () => {
        this.updateMouseSteeringStatus()
        this.helmet?.closePanel()
        this.helmet?.setCombat(true)
        this.canvas.focus({preventScroll: true})
      },
    }).start()
    this.root.querySelector("#nav-open")?.addEventListener("click", () => this.navComputer.open())
    this.inventoryPanel = new PilotInventoryPanel({
      root: this.root.querySelector("#pilot-inventory-panel"),
      fetch: done => this.fetchPilotInventory(done),
      onOpen: () => {
        const manualFlight = this.channel?.state === "joined" &&
          !this.navComputer?.isOpen && !this.docked && !this.inSystemCruise()
        const axes = this.flightControls?.axes()
        const turning = Boolean(axes?.yaw || axes?.pitch || axes?.roll)
        this.exitMouseSteering({silent: true})
        this.flightControls?.release({silent: true})
        // Neutralize any held turn before the panel blocks keyboard input.
        // Preserve throttle and never send flight controls during Atlas cruise.
        if (manualFlight && turning) this.sendFlightControls(this.flightControls.payload())
        this.stationWalking?.release()
        this.manualLaserPointerHeld = false
        this.spaceLaser?.release()
      },
    })
    for (const id of ["#nav-inventory-open", "#cockpit-inventory-open"]) {
      this.root.querySelector(id)?.addEventListener("click",
        () => this.togglePilotInventory())
    }
    window.addEventListener("keydown", event => this.handlePilotInventoryKey(event), true)
    window.addEventListener("keydown", event => this.navComputer.handleKey(event))
    this.root.querySelector("#display-mode")?.addEventListener("change", event => this.setDisplayMode(event.target.value))
    window.addEventListener("keydown", event => this.handleDisplayModeKey(event))
    // Capture before ordinary gameplay handlers or browser reload behavior.
    window.addEventListener("keydown", event => this.handleHelmetAlignmentKey(event), true)
    if (!this.setDisplayMode("3d")) return
    this.canvas.addEventListener("pointerdown", () => this.canvas.focus({preventScroll: true}))
    window.addEventListener("resize", () => this.resize())
    this.navigation = new PointerNavigation({
      canvas: this.canvas,
      destinationForPointer: () => null,
      shipPosition: () => this.entities.get(this.selfId)?.target,
      sendDestination: destination => this.sendDestination(destination),
      // In cockpit mode click selects targets; travel is plotted on the atlas.
      interceptPointerDown: pointer => {
        // While pointer-locked, the mouse coordinates are frozen: left-click
        // targets what the ship is pointing at in the center of the cockpit.
        if (document.pointerLockElement === this.canvas) {
          const rect = this.canvas.getBoundingClientRect()
          this.selectTargetAtPointer({
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
          })
        } else {
          this.selectTargetAtPointer(pointer)
        }
        return true
      },
    }).attach()
    this.canvas.addEventListener("pointerdown", event => this.handleLaserPointerDown(event))
    this.canvas.addEventListener("contextmenu", event => {
      if (!this.navComputer?.isOpen) event.preventDefault()
    })
    this.spaceLaser = new SpaceLaserTrigger({
      active: () => this.flightInputState() === "ready",
      worldTick: () => this.worldTick,
      nextAttackTick: () => Number(this.entities.get(this.selfId)?.nextAttackTick) || 0,
      fire: done => this.fireReadyWeapon(done),
    })
    window.addEventListener("pointerup", event => {
      if (event.button === 2) {
        this.manualLaserPointerHeld = false
        this.spaceLaser.release()
      }
    })
    window.addEventListener("pointercancel", () => {
      this.manualLaserPointerHeld = false
      this.spaceLaser.release()
    })
    for (const slot of this.root.querySelectorAll("[data-hotbar-slot]")) {
      slot.addEventListener("click", () => this.activateHotbarSlot(Number(slot.dataset.hotbarSlot)))
    }
    window.addEventListener("keydown", event => this.handleCombatKey(event), true)

    // New sessions begin in the SOL system Atlas, not in the combat
    // cockpit. Initialize all flight/weapon input guards first so the
    // Atlas can safely own focus even before the world socket joins.
    // Closing it hands focus back to the existing 3D / SBS cockpit.
    this.navComputer.open()
    this.root.querySelector("#pilot-respawn-button")?.addEventListener(
      "click", () => this.requestRespawn())
    this.root.querySelector("#starbase-launch")?.addEventListener("click",
      () => this.launchFromStarbase())
    this.outfittingPanel = new StationOutfittingPanel({
      root: this.root.querySelector("#station-outfitting-panel"),
      preview: (payload, done) =>
        this.sendStationOutfitting("station_outfitting_preview", payload, done),
      fit: (payload, done) =>
        this.sendStationOutfitting("station_outfitting_fit", payload, done),
      purchase: (payload, done) =>
        this.sendStationOutfitting("station_outfitting_purchase", payload, done),
      onApplied: response => this.applyStationOutfitting(response),
      onClose: () => {
        if (this.stationNpcDialogOpen && this.stationNpcId === "outfitting" &&
            this.nearbyStationNpc()?.id === "outfitting") {
          const modal = this.root.querySelector("#station-npc-dialogue")
          if (modal) modal.style.display = "flex"
        }
      },
    })
    // Tarek's Trade Exchange sends only a cargo id and whole-unit amount.
    this.tradePanel = new StationTradePanel({
      root: this.root.querySelector("#station-trade-panel"),
      sell: (payload, done) =>
        this.sendStationOutfitting("station_trade_sell", payload, done),
      buy: (payload, done) =>
        this.sendStationOutfitting("station_trade_buy", payload, done),
      onClose: () => {
        if (this.stationNpcDialogOpen && this.stationNpcId === "trade" &&
            this.nearbyStationNpc()?.id === "trade") {
          const modal = this.root.querySelector("#station-npc-dialogue")
          if (modal) modal.style.display = "flex"
        }
      },
    })
    this.root.querySelector("#station-npc-close")?.addEventListener("click",
      () => this.closeStationNpc())
    this.root.querySelector("#station-npc-dialogue")?.addEventListener("click", event => {
      const topic = event.target?.closest?.("[data-station-topic]")?.dataset.stationTopic
      if (topic && this.stationNpcDialogOpen && this.stationNpcId) {
        this.askStationNpc(this.stationNpcId, topic)
      }
    })
    window.addEventListener("keydown", event => this.handleStationNpcKey(event), true)
    attachBandwidthPanel(this.root, this.bandwidth)
    this.connect()
    requestAnimationFrame(time => this.frame(time))
  }

  connect() {
    // For native installed builds the game document is local but the
    // authoritative Channel socket lives at the chosen HTTPS server.
    const endpoint = gameSocketEndpoint(this.root.dataset.serverOrigin)
    this.socket = instrumentPhoenixSocket(
      new Socket(endpoint, {params: () => ({token: this.root.dataset.socketToken})}),
      this.bandwidth,
    )
    window.sunRacerBandwidth = this.bandwidth
    this.socket.onOpen(() => this.setConnection("Relay connected", "online"))
    this.socket.onError(() => this.setConnection("Relay interrupted", "error"))
    this.socket.onClose(() => this.setConnection("Relay offline", "error"))
    this.socket.connect()
    this.globalChat = new GlobalChat({
      root: this.root, socket: this.socket, Presence,
      canOpen: () => !this.solarEncounter && !this.dispatchOfferOpen &&
        !this.stationNpcDialogOpen && !this.inventoryPanel?.opened &&
        !this.outfittingPanel?.opened && !this.tradePanel?.opened &&
        !this.respawnPending && this.displayMode !== "sbs",
      releaseInput: () => {
        this.stationWalking?.release()
        this.flightControls?.release()
        this.exitMouseSteering()
        this.helmetAlignmentKeys?.release()
        this.manualLaserPointerHeld = false
        this.spaceLaser?.release()
      },
    }).start()
    this.helmet = new HelmetControl({
      root: this.root,
      socket: this.socket,
      playerId: this.root.dataset.layoutPlayerId,
      combatActive: !this.navComputer.isOpen,
      publishRelayWorld: () => this.sbsRelayWorld.publish(this.worldStream?.map, true),
      onStatusChange: () => this.syncDesktopVrOnly(),
      // A gaze icon in the headset is an intent, not a command: the laptop
      // applies it through the same FlightControls the keyboard drives.
      onGazeAction: action => {
        if (action === "toggle_flight_mode") this.flightControls?.toggleMode()
        if (action === "select_cruise_mode") this.flightControls?.setMode("cruise")
        if (action === "select_newtonian_mode") this.flightControls?.setMode("newtonian")
      },
    }).start()

    // The HUD tracks a story objective; it cannot accept a mission.
    // Ross offers the consignment in a separate, explicit NPC dialogue.
    this.storyRadio = new StoryRadio(this.root)
    this.storyHud = new StoryHud(this.root, action => {
      if (this.channel?.state !== "joined") return null
      if (action === "contact_dispatch") {
        const request = this.channel.push("story_dispatch_offer", {}, 5000)
        request.receive("ok", reply => this.showDispatcherOffer(reply.offer))
        return request
      }
      return this.channel.push("story_action", {action}, 5000)
    })
    this.root.querySelector("#story-dispatch-accept")?.addEventListener("click",
      () => this.acceptDispatcherOffer())
    this.root.querySelector("#story-dispatch-decline")?.addEventListener("click",
      () => this.closeDispatcherOffer())
    window.addEventListener("keydown", event => {
      if (!this.dispatchOfferOpen) return
      if (event.code === "Escape") this.closeDispatcherOffer()
      if (["Escape", "Space", "KeyW", "KeyA", "KeyS", "KeyD",
           "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    }, true)

    this.joinSector(this.mapId)
  }

  showDispatcherOffer(offer) {
    if (offer?.npc_id !== "helios_dispatch") return
    const panel = this.root.querySelector("#story-dispatch-dialogue")
    if (!panel) return
    this.dispatchOfferOpen = true
    this.root.querySelector("#story-dispatch-name").textContent = offer.name
    this.root.querySelector("#story-dispatch-role").textContent = offer.role
    this.root.querySelector("#story-dispatch-title").textContent = offer.title
    this.root.querySelector("#story-dispatch-text").textContent = offer.message
    this.root.querySelector("#story-dispatch-feedback").textContent = ""
    panel.style.display = "flex"
    this.flightControls?.release({silent: true})
    this.root.querySelector("#story-dispatch-accept")?.focus({preventScroll: true})
  }

  closeDispatcherOffer({clearOffer = true} = {}) {
    if (clearOffer && this.dispatchOfferOpen && this.channel?.state === "joined") {
      this.channel.push("story_dispatch_decline", {}, 2000)
    }
    const panel = this.root.querySelector("#story-dispatch-dialogue")
    if (panel) panel.style.display = "none"
    this.dispatchOfferOpen = false
    this.dispatchOfferBusy = false
    this.canvas?.focus({preventScroll: true})
  }

  acceptDispatcherOffer() {
    if (!this.dispatchOfferOpen || this.dispatchOfferBusy ||
        this.channel?.state !== "joined") return
    this.dispatchOfferBusy = true
    const button = this.root.querySelector("#story-dispatch-accept")
    const feedback = this.root.querySelector("#story-dispatch-feedback")
    if (button) button.disabled = true
    if (feedback) feedback.textContent = "Confirming assignment with Helios dispatch…"
    const done = () => {
      this.dispatchOfferBusy = false
      if (button) button.disabled = false
    }
    this.channel.push("story_dispatch_accept", {}, 5000)
      .receive("ok", reply => {
        done()
        if (reply.story) this.storyHud?.apply(reply.story)
        this.closeDispatcherOffer({clearOffer: false})
      })
      .receive("error", reply => {
        done()
        if (feedback) feedback.textContent = "Dispatch refused: " +
          String(reply?.reason || "unavailable").replaceAll("_", " ")
      })
      .receive("timeout", () => {
        done()
        if (feedback) feedback.textContent = "Helios dispatch did not respond."
      })
  }

  fetchPilotInventory(done) {
    if (this.channel?.state !== "joined") {
      done(false, {reason: "sector_link_unavailable"})
      return
    }
    this.channel.push("pilot_inventory", {}, 5000)
      .receive("ok", response => done(true, response.inventory))
      .receive("error", response => done(false, response))
      .receive("timeout", () => done(false, {reason: "timeout"}))
  }

  togglePilotInventory() {
    if (this.inventoryPanel?.opened) return this.inventoryPanel.close()
    if (this.stationNpcDialogOpen || this.outfittingPanel?.opened ||
        this.tradePanel?.opened ||
        this.dispatchOfferOpen || this.solarEncounter || this.respawnPending) return
    this.inventoryPanel?.open()
  }

  handlePilotInventoryKey(event) {
    if (this.inventoryPanel?.opened) {
      if (event.code === "Escape" || event.code === "KeyI") {
        event.preventDefault()
        event.stopImmediatePropagation()
        if (!event.repeat) this.inventoryPanel.close()
      } else if ([
        "KeyM", "KeyE", "KeyW", "KeyA", "KeyS", "KeyD", "KeyQ",
        "KeyL", "KeyT", "KeyR", "Space", "ArrowUp", "ArrowDown",
        "ArrowLeft", "ArrowRight", "Equal", "Minus",
        "NumpadAdd", "NumpadSubtract",
      ].includes(event.code)) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
      return
    }
    if (event.code !== "KeyI" || event.repeat || event.ctrlKey ||
        event.altKey || event.metaKey || event.target?.isContentEditable ||
        event.target?.closest?.("input,textarea,select,[contenteditable='true']")) return
    if (this.stationNpcDialogOpen || this.outfittingPanel?.opened ||
        this.tradePanel?.opened ||
        this.dispatchOfferOpen || this.solarEncounter || this.respawnPending) return
    event.preventDefault()
    event.stopImmediatePropagation()
    this.togglePilotInventory()
  }

  joinSector(mapId, retry = 0) {
    // Map identity comes from an authenticated region redirect/arrival event,
    // never from browser-provided world coordinates.
    if (!validOrbitalMapId(mapId)) {
      this.showError("Invalid orbital destination map.")
      return
    }

    this.mapId = mapId
    const channel = this.socket.channel(`world:${mapId}`, {stream: "delta_v1"})
    this.channel = channel
    this.atlasPilotRequest = null
    this.stationPilotRequest = null
    this.lastStationPilotPoll = -Infinity
    this.stationPilots = []
    this.lastAtlasPilotPoll = -Infinity
    this.navComputer?.setAtlasPilots([])
    channel.on("world_state", state => {
      if (this.channel !== channel) return
      if (this.worldStream) this.worldStream.reset(state)
      this.applyWorldState(state)
    })
    channel.on("world_delta", delta => {
      if (this.channel !== channel || this.worldResyncInFlight) return
      const map = this.worldStream?.apply(delta)
      if (map) this.applyWorldState(map)
      else this.requestWorldResync()
    })
    channel.on("movement_delta", patch => {
      if (this.channel !== channel || this.worldResyncInFlight) return
      const entity = this.worldStream?.previewEntity(patch)
      if (!entity) return
      const id = entityKey(entity.id)
      const ownShip = id === this.selfId ? this.entities.get(id) : null
      if (ownShip) {
        // Flight-control previews arrive faster than authoritative world ticks.
        // Updating orientation/authoritativeAt here repeatedly rewinds the
        // camera prediction, especially during high-sensitivity mouse turns.
        // Only pilot UI state should change before the next world snapshot.
        applyOwnShipMovementPreview(ownShip, entity)
      } else {
        this.upsertEntity(entity)
      }
    })
    channel.on("solar_navigation_updated", payload => {
      if (String(payload.player_id) === String(this.selfId) && payload.navigation) {
        this.applySolarNavigation(payload.navigation)
      }
    })
    channel.on("world_region_changed", payload => this.switchOrbitalRegion(payload?.map_id))
    channel.on("story_updated", story => {
      if (this.channel !== channel) return
      this.storyStep = story?.step
      this.storyHud?.apply(story)
      this.storyRadio?.receive(story?.scene)
    })
    // Open the pilot's decision at first contact, without waiting for another
    // navigation tick. The authoritative snapshot also restores it on reconnect.
    channel.on("solar_encounter_started", payload => {
      if (String(payload.player_id) === String(this.selfId) && payload.encounter?.id) {
        this.setSolarEncounter(payload.encounter)
      }
    })
    channel.on("movement_started", entity => this.upsertEntity(entity))
    channel.on("entity_joined", entity => this.entityJoined(entity))
    channel.on("entity_left", entity => this.removeEntity(entity.id))
    channel.on("npc_spawned", entity => this.upsertEntity(entity, true))
    channel.on("npc_movement_started", entity => this.upsertEntity(entity))
    channel.on("npc_state_changed", entity => this.upsertEntity(entity))
    channel.on("target_selected", selection => this.targetSelected(selection))
    channel.on("target_cleared", selection => this.targetCleared(selection))
    channel.on("combat_engaged", engagement => this.combatEngaged(engagement))
    channel.on("combat_disengaged", engagement => this.combatDisengaged(engagement))
    channel.on("laser_fired", attack => this.laserFired(attack))
    channel.on("solar_faction_hit", event => {
      const current = this.navComputer?.solarNavigation?.tactical_encounter?.id
      // A delayed message from the previous encounter cannot be mistaken
      // for an offense against the pilot's newly claimed vessel.
      if (current && event.encounter_id && event.encounter_id !== current) return
      const label = this.root.querySelector("#solar-faction-impact")
      const delta = Number(event.delta)
      const contactName = String(event.call_sign || event.contact_id || "Unknown contact")
      if (label) {
        label.hidden = false
        label.textContent = "FACTION HIT · " + contactName + " · " +
          event.faction_id + " · " + (delta > 0 ? "+" : "") + delta +
          " · STANDING " + event.standing
      }
      this.setCombatMessage("Faction penalty for " + contactName +
        " (" + event.faction_id + "): " + event.delta +
        " · STANDING " + event.standing)
    })
    channel.on("entity_destroyed", destruction => this.entityDestroyed(destruction))
    channel.on("planetary_proximity_changed", event => this.planetaryProximityChanged(event))
    channel.on("station_proximity_changed", event => {
      if (entityKey(event.entity_id) === this.selfId) {
        this.applyStationWarning(event.level === "clear" ? null : event)
      }
    })
    channel.on("station_collision", event => {
      if (entityKey(event.entity_id) === this.selfId) {
        const damage = Number(event.damage?.requested_damage) || 0
        const location = event.station_id === "sol:starbase:green" ?
          "GREEN STARBASE CONTACT" : "REFINERY CONTACT"
        this.setCombatMessage(location + " · FLIGHT STOPPED · " + damage + " IMPACT DAMAGE")
        if (event.entity) this.upsertEntity(event.entity, true)
      }
    })
    channel.on("station_docking_started", event => {
      if (entityKey(event.entity_id) === this.selfId && !this.docked) {
        this.stationDockingHold = dockingHoldFromEvent(event, performance.now())
      }
    })
    channel.on("station_docking_cancelled", event => {
      if (entityKey(event.entity_id) === this.selfId) this.clearDockingCountdown()
    })
    channel.on("station_docked", event => {
      if (entityKey(event.entity_id) === this.selfId) this.setDocked(true)
    })
    channel.on("station_launched", event => {
      if (entityKey(event.entity_id) === this.selfId) this.setDocked(false)
    })
    channel.onError(() => {
      if (this.channel === channel) this.setConnection("Sector channel lost", "error")
    })
    channel.onClose(() => {
      if (this.channel === channel && !this.switchingRegion) {
        this.setConnection("Sector channel closed", "error")
      }
    })

    channel.join()
      .receive("ok", response => {
        this.switchingRegion = false
        this.joined(response)
      })
      .receive("error", response => {
        if (this.channel !== channel) return
        if (response.reason === "region_redirect" &&
            response.map_id !== mapId && retry < 2) {
          channel.leave()
          this.joinSector(response.map_id, retry + 1)
          return
        }
        if (response.reason === "already_connected" && this.switchingRegion &&
            retry < 5) {
          // Phoenix may acknowledge leaving before the old session's
          // terminate callback has removed its server-owned registration.
          setTimeout(() => {
            if (this.channel === channel) {
              channel.leave()
              this.joinSector(mapId, retry + 1)
            }
          }, 250)
          return
        }
        this.switchingRegion = false
        const reason = response.reason === "already_connected"
          ? "This pilot already has an active sector connection."
          : `Unable to join sector: ${response.reason || "unknown error"}`
        this.showError(reason)
        this.setConnection("Join rejected", "error")
      })
      .receive("timeout", () => {
        if (this.channel === channel) {
          this.switchingRegion = false
          this.showError("The orbital relay did not answer in time.")
          this.setConnection("Join timeout", "error")
        }
      })
  }

  switchOrbitalRegion(mapId) {
    if (!shouldEnterOrbitalRegion(this.mapId, mapId, this.switchingRegion)) return
    this.switchingRegion = true
    this.setConnection("Entering " + (mapId.startsWith("sol:free_") ?
      "deep-space flight" : mapId + " orbital region"), "online")
    this.exitMouseSteering({silent: true})
    this.flightControls?.release({silent: true})
    this.spaceLaser?.release()
    this.selectedTargetId = null
    this.commandDestination = null
    this.mouseFrameSampler.clear()
    this.clientLedCamera.reset()
    this.ownShipCameraReconciler.reset()
    this.entities.clear()
    this.worldStream = null
    this.worldResyncInFlight = false
    this.beams = []
    this.pendingLocalLaserPreviews = []
    this.setSolarEncounter(null)
    this.applyPlanetaryWarning(null, {announce: false})
    this.applyStationWarning(null, {announce: false})
    this.stereoView?.planetaryBody?.dispose()
    const previous = this.channel
    const enter = () => {
      if (this.channel === previous) this.joinSector(mapId)
    }
    previous.leave().receive("ok", enter).receive("timeout", enter)
  }

  joined(response) {
    // Join replies are not delivered to channel.on listeners.
    this.bandwidth.record("in", "world", "join_ack", response)
    this.mapId = response.map.map_id
    this.clientLedCamera.reset()
    this.ownShipCameraReconciler.reset()
    this.worldStream = response.stream === "delta_v1"
      ? new WorldStreamDelta(response.map) : null
    this.sbsRelayWorld.publish(response.map, true)
    this.worldResyncInFlight = false
    this.root.dataset.mapId = this.mapId
    this.entities.clear()
    this.player = response.player
    if (this.inventoryPanel?.opened) this.inventoryPanel.refresh()
    if (Array.isArray(response.hotbar) && this.root.dataset.nativeClient === "true") {
      this.populateNativeHotbar(response.hotbar)
    }
    this.selfId = entityKey(response.player.pilot.id)
    this.boundaries = response.map.boundaries
    this.volume = response.map.volume || this.volume
    this.worldTick = response.map.tick
    this.tickMs = response.map.tick_ms
    this.navComputer?.setRegion(response.map.region_name, response.map.map_id)
    const minimap = this.root.querySelector("#minimap-title")
    if (minimap) minimap.textContent = response.map.region_name || "Sector Minimap"
    this.pilots = new Map(Object.entries(response.pilots || {}))

    if(response.solar_navigation)this.applySolarNavigation(response.solar_navigation)
    if ("story" in response) {
      this.storyStep = response.story?.step
      this.storyHud?.apply(response.story)
    }
    for (const entity of response.map.entities) this.upsertEntity(entity, true)
    this.applyPlanetaryWarning(ownPlanetaryWarning(response.map, this.selfId))
    this.applyStationWarning(ownStationWarning(response.map, this.selfId))
    this.setDocked(Boolean(response.map.docked_pilots?.some(id =>
      entityKey(id) === this.selfId)))
    this.applyStationPosition(response.map)
    if (!this.docked) this.stationDockingHold = syncDockingHold(
      this.stationDockingHold, response.map, this.selfId, performance.now())
    this.syncOwnCombatState()
    this.respawnPending = false
    this.showRespawnPanel(
      this.entities.get(this.selfId)?.status === "destroyed",
      "Your ship has been destroyed. Respawn in Earth orbit.")

    // Region clocks restart independently; never carry old shot ticks forward.
    this.spaceLaser?.resetForWorld()
    this.pendingLocalLaserPreviews = []
    this.flightControls.resetThrottle()
    // The server may restore a previously saved Newtonian mode on reconnect.
    // Avoid emitting a stale default Cruise command on the next control tick.
    const authoritativeMode = this.entities.get(this.selfId)?.flightMode
    this.flightControls.mode = authoritativeMode === "newtonian" ? "newtonian" : "cruise"
    this.lastFlightModeDisplay = null
    this.populateHud()
    this.setConnection("Authoritative sync", "online")
  }

  requestWorldResync() {
    if (this.worldResyncInFlight || this.channel?.state !== "joined") return
    this.worldResyncInFlight = true
    const channel = this.channel
    const failed = () => {
      if (this.channel !== channel) return
      this.worldResyncInFlight = false
      this.setConnection("World resync failed; reconnecting", "error")
      this.socket.disconnect()
      this.socket.connect()
    }
    channel.push("world_resync", {}, 5000)
      .receive("ok", response => {
        if (this.channel !== channel) return
        this.worldResyncInFlight = false
        this.bandwidth.record("in", "world", "resync_ack", response)
        if (response.map && this.worldStream) {
          this.worldStream.reset(response.map)
          this.applyWorldState(response.map)
        }
      })
      .receive("error", failed)
      .receive("timeout", failed)
  }

  applyWorldState(state) {
    this.sbsRelayWorld.publish({...state, station_pilots: this.stationPilots})
    this.orbitalBase = state.orbital_base || null
    this.boundaries = state.boundaries || this.boundaries
    this.volume = state.volume || this.volume
    this.worldTick = state.tick
    this.tickMs = state.tick_ms || this.tickMs
    const activeIds = new Set()

    for (const entity of state.entities) {
      activeIds.add(entityKey(entity.id))
      this.upsertEntity(entity, false, true)
    }

    for (const id of this.entities.keys()) {
      if (!activeIds.has(id)) this.removeEntity(id)
    }

    this.applyPlanetaryWarning(ownPlanetaryWarning(state, this.selfId))
    this.applyStationWarning(ownStationWarning(state, this.selfId))
    if (Array.isArray(state.docked_pilots)) {
      this.setDocked(state.docked_pilots.some(id => entityKey(id) === this.selfId))
    }
    this.applyStationPosition(state)
    if (!this.docked) this.stationDockingHold = syncDockingHold(
      this.stationDockingHold, state, this.selfId, performance.now())
    this.syncOwnCombatState()
    this.updateCombatHud()
    this.showSolarTactical()
  }

  entityJoined(entity) {
    if (entity.pilot) this.pilots.set(entityKey(entity.player_id), entity.pilot)
    this.upsertEntity(entity)
  }

  upsertEntity(entity, snap = false, fromWorldTick = false) {
    const id = entityKey(entity.id)
    const existing = this.entities.get(id)
    const acceptPose = acceptOwnShipPose({
      existing: Boolean(existing), ownShip: id === this.selfId,
      snapshot: snap, worldTick: fromWorldTick,
    })
    const p3 = entity.position_3d || entity.position
    const target = {x: p3.x, y: p3.y, z: p3.z ?? 0}
    const d3 = entity.destination_3d || entity.destination
    const destination = d3 ? {x: d3.x, y: d3.y, z: d3.z ?? 0} : null
    const route3d = entity.route_waypoints_3d || entity.route_waypoints || []
    const attitude = entity.attitude || {yaw: 0, pitch: 0, roll: 0}
    const orientation = entity.orientation || null
    const velocity = entity.velocity || {x: 0, y: 0, z: 0}

    // Arrival time of this authoritative state: own-ship prediction runs the
    // server's turn rules forward from here until the next update.
    const authoritativeAt = performance.now()
    // Read the continuous, *old* visual goal before replacing its server
    // baseline. This prevents a delayed snapshot from making the camera
    // jump back and accelerate forward again on each 100ms tick.
    const beforeTickVisual = existing && id === this.selfId &&
      fromWorldTick && acceptPose && !snap
      && !this.clientLedCameraActiveForTick()
      ? this.predictOwnShip(existing, authoritativeAt)?.orientation : null

    if (existing) {
      if (acceptPose) {
        existing.authoritativeAt = authoritativeAt
        existing.target = target
        existing.destination = destination
        existing.navigationMode = entity.navigation_mode || "manual"
        existing.routeWaypoints = route3d
        existing.attitude = attitude
        existing.orientation = orientation
        if (orientation && (!existing.renderOrientation || snap)) {
          existing.renderOrientation = {...orientation}
        }
        // A visual orientation is never fed into the authoritative simulation.
        if (!existing.renderAttitude || snap) existing.renderAttitude = {...attitude}
        existing.angularVelocity = entity.angular_velocity || existing.angularVelocity ||
          {yaw: 0, pitch: 0, roll: 0}
        existing.velocity = velocity
      }
      existing.throttle = entity.throttle ?? 0
      existing.flightMode = entity.flight_mode || "cruise"
      existing.speed = entity.speed
      existing.kind = entity.kind || existing.kind
      existing.playerId = entity.player_id == null ? existing.playerId : entityKey(entity.player_id)
      existing.npcTypeId = entity.npc_type_id || existing.npcTypeId
      existing.shipClass = entity.ship_class || existing.shipClass
      if (Number.isFinite(entity.angle)) existing.angle = entity.angle
      existing.course = entity.course || existing.course
      existing.displayName = entity.display_name || existing.displayName
      existing.hull = entity.hull
      existing.maxHull = entity.max_hull
      existing.shields = entity.shields
      existing.maxShields = entity.max_shields
      existing.shieldAbsorption = entity.shield_absorption
      existing.damage = entity.damage
      existing.attackRange = entity.attack_range
      existing.attackCooldownTicks = entity.attack_cooldown_ticks
      existing.nextAttackTick = entity.next_attack_tick
      existing.targetId = entity.target_id == null ? null : entityKey(entity.target_id)
      existing.engagedTargetId = entity.engaged_target_id == null
        ? null
        : entityKey(entity.engaged_target_id)
      existing.state = entity.state
      existing.status = entity.status
      if (acceptPose && destination) {
        existing.navigationAngle = Math.atan2(
          destination.y - existing.render.y,
          destination.x - existing.render.x
        )
      }
      if (snap) existing.render = {...target}
    } else {
      this.entities.set(id, {
        id,
        kind: entity.kind || "player",
        playerId: entity.player_id == null ? null : entityKey(entity.player_id),
        npcTypeId: entity.npc_type_id,
        shipClass: entity.ship_class || null,
        // Trust the server's actual heading where present. Otherwise use
        // a route-derived initial bearing as a visual-only fallback.
        angle: Number.isFinite(entity.angle) ? entity.angle : destination
          ? Math.atan2(destination.y - target.y, destination.x - target.x)
          : -Math.PI / 2,
        course: entity.course || null,
        displayName: entity.display_name,
        render: {...target},
        target,
        authoritativeAt,
        destination,
        navigationMode: entity.navigation_mode || "manual",
        routeWaypoints: route3d,
        attitude,
        renderAttitude: {...attitude},
        orientation,
        renderOrientation: orientation ? {...orientation} : null,
        angularVelocity: entity.angular_velocity || {yaw: 0, pitch: 0, roll: 0},
        velocity,
        throttle: entity.throttle ?? 0,
        flightMode: entity.flight_mode || "cruise",
        speed: entity.speed,
        hull: entity.hull,
        maxHull: entity.max_hull,
        shields: entity.shields,
        maxShields: entity.max_shields,
        shieldAbsorption: entity.shield_absorption,
        damage: entity.damage,
        attackRange: entity.attack_range,
        attackCooldownTicks: entity.attack_cooldown_ticks,
        nextAttackTick: entity.next_attack_tick,
        targetId: entity.target_id == null ? null : entityKey(entity.target_id),
        engagedTargetId: entity.engaged_target_id == null
          ? null
          : entityKey(entity.engaged_target_id),
        state: entity.state,
        status: entity.status,
        navigationAngle: destination
          ? Math.atan2(destination.y - target.y, destination.x - target.x)
          : -Math.PI / 2,
      })
    }

    if (id === this.selfId) {
      // The server retains true orientation/physics, but the cockpit must
      // never be re-aimed by ordinary asynchronous world snapshots while
      // pointer-captured steering is active. A large discrepancy is visible
      // in diagnostic telemetry, NOT a camera snap. Real transitions still
      // reset below; accepting invalid gameplay is never implied.
      if (fromWorldTick && this.clientLedCameraActiveForTick() && orientation) {
        this.clientLedCameraDelta = this.clientLedCamera.divergenceDegrees(orientation)
        this.clientLedCameraServerAlert = this.clientLedCamera.shouldSnap(orientation)
      }
      if (snap || entity.status === "destroyed") {
        this.clientLedCamera.reset()
        this.clientLedCameraServerAlert = false
      }
      if (beforeTickVisual) {
        const freshPredicted = this.predictOwnShip(existing, authoritativeAt,
          {uncorrected: true})?.orientation
        if (this.ownShipCameraReconciler.rebase(
          beforeTickVisual, freshPredicted, authoritativeAt)) {
          this.mouseTimingProbe.correction()
        }
      } else if (fromWorldTick && (snap || existing?.destination)) {
        this.ownShipCameraReconciler.reset()
      }
      this.commandDestination = entity.status !== "destroyed" && validDestination(destination, this.boundaries)
        ? {...destination}
        : null
      this.updateNavigationStatus()
    }
  }

  sendFlightControls(input) {
    if (this.channel?.state !== "joined") return
    this.channel.push("flight_controls", input, 3000)
      .receive("ok", response => {
        if (response.entity) this.upsertEntity(response.entity)
      })
      .receive("error", response => this.showError(`Flight controls rejected: ${response.reason}`))
      .receive("timeout", () => this.showError("Flight control link timed out."))
  }

  refreshStationPilots(time) {
    const channel = this.channel
    if (!this.docked || channel?.state !== "joined") {
      this.stationPilots = []
      this.stationPilotRequest = null
      return
    }
    if (this.stationPilotRequest || time - (this.lastStationPilotPoll ?? -Infinity) < 500) return
    this.lastStationPilotPoll = time
    const token = {}
    this.stationPilotRequest = token
    const finish = avatars => {
      if (this.channel !== channel || this.stationPilotRequest !== token || !this.docked) return
      this.stationPilotRequest = null
      this.stationPilots = Array.isArray(avatars) ? avatars : []
    }
    channel.push("station_pilots", {}, 3000)
      .receive("ok", response => finish(response.avatars))
      .receive("error", () => finish([]))
      .receive("timeout", () => finish([]))
  }

  refreshAtlasPilots(time) {
    const nav = this.navComputer, channel = this.channel
    if (!nav?.isOpen || nav.view !== "system") return
    if (channel?.state !== "joined") {
      if (nav.atlasPilots.length) nav.setAtlasPilots([])
      return
    }
    if (this.atlasPilotRequest || time - (this.lastAtlasPilotPoll ?? -Infinity) < 2000) return
    this.lastAtlasPilotPoll = time
    const token = {}
    this.atlasPilotRequest = token
    const finish = pilots => {
      if (this.channel !== channel || this.atlasPilotRequest !== token) return
      this.atlasPilotRequest = null
      nav.setAtlasPilots(pilots)
    }
    channel.push("atlas_pilots", {}, 5000)
      .receive("ok", response => finish(response.pilots || []))
      .receive("error", () => finish([]))
      .receive("timeout", () => finish([]))
  }

  applySolarNavigation(navigation) {
    const priorEncounterId = this.navComputer?.solarNavigation?.tactical_encounter?.id
    const nextEncounterId = navigation?.tactical_encounter?.id
    const previouslyTactical = Boolean(priorEncounterId)
    // Each penalty belongs to one strategic contact. Never carry a
    // previous vessel's faction banner into a different tactical fight.
    if (priorEncounterId !== nextEncounterId) {
      const impact = this.root.querySelector("#solar-faction-impact")
      if (impact) {
        impact.hidden = true
        impact.textContent = ""
      }
    }
    this.navComputer.setSolarNavigation(navigation)
    this.setSolarEncounter(navigation?.tactical_encounter
      ? null : navigation?.pending_encounter || null)
    this.showSolarTactical()
    if (previouslyTactical && !navigation?.tactical_encounter &&
        navigation?.status === "traveling") {
      this.setCombatMessage("Interception complete. Original SOL course resumed.")
      this.navComputer?.open()
    }
    const body = navigation?.planetary_view
    const planetaryStatus = this.root.querySelector("#planetary-view-status")
    if (planetaryStatus) {
      const valid = body?.visual_only === true &&
        typeof body.body_id === "string" && Number.isFinite(body.angular_diameter_deg)
      planetaryStatus.hidden = !valid
      if (valid) {
        const approach = body.stage === "approach_preview"
        const detail = approach
          ? `APPROACH · ${body.angular_diameter_deg.toFixed(1)}° APPARENT · PREVIEW`
          : "ORBITAL REGION · REAL-RADIUS VIEW · STAGING PHYSICS"
        planetaryStatus.textContent = `SOL · ${body.body_id.toUpperCase()} · ${detail}`
      }
    }
    const active=this.inSystemCruise()
    this.root.dataset.propulsionMode=active?"interplanetary_cruise":"conventional"
    const label=this.root.querySelector("#propulsion-status")
    if(label)label.textContent=navigation?.free_flight?"DEEP SPACE / MANUAL FLIGHT":
      navigation?.pending_encounter?"ENCOUNTER HOLD / CRUISE PAUSED":
      active?"SUBLIGHT CRUISE / FLIGHT LOCKED":"CONVENTIONAL FLIGHT"
    this.syncShipWalk()
    if(active){
      if (!this.shipWalkPose) this.exitMouseSteering({silent: true})
      this.flightControls?.release({silent:true})
      this.spaceLaser?.release()
      this.navigation?.cancel()
    }
  }

  encounterMessage(message) {
    for (const output of this.root.querySelectorAll("[data-encounter-message]")) {
      output.textContent = message
    }
  }

  setSolarEncounter(encounter) {
    const nextId = typeof encounter?.id === "string" ? encounter.id : null
    if (nextId !== this.encounterDisplayedId) {
      this.encounterDisplayedId = nextId
      this.hailedEncounterId = null
      this.encounterResolving = false
      if (nextId) {
        const description = encounter.classification === "hostile_contact"
          ? "Hostile vessel detected. Your course is on hold until you choose to proceed."
          : encounter.classification === "patrol_attention"
            ? "Faction patrol attention. Decide whether to hail or continue."
            : "Neutral traffic detected. Hail, attack, or ignore. The vessel may retaliate if hit."
        this.encounterMessage(description)
      }
    }
    this.solarEncounter = nextId ? encounter : null
    this.showSolarEncounter()
  }

  showSolarEncounter() {
    const panel = this.root.querySelector("#solar-encounter-panel")
    if (!panel) return
    const wasHidden = panel.hidden
    panel.hidden = !this.solarEncounter
    if (this.navComputer?.root) this.navComputer.root.inert = Boolean(this.solarEncounter)
    if (!this.solarEncounter) {
      if (!wasHidden) {
        const focus = this.navComputer?.isOpen
          ? this.navComputer.root.querySelector("#nav-close")
          : this.canvas
        focus?.focus?.({preventScroll: true})
      }
      return
    }

    const encounter = this.solarEncounter
    const status = encounter.classification === "hostile_contact"
      ? "HOSTILE CONTACT"
      : encounter.classification === "patrol_attention"
        ? "PATROL ATTENTION"
        : "NEUTRAL CONTACT"
    for (const title of panel.querySelectorAll("[data-encounter-title]")) {
      title.textContent = String(encounter.call_sign || "Unidentified vessel") +
        " · " + String(encounter.kind || "vessel").replaceAll("_", " ")
    }
    for (const faction of panel.querySelectorAll("[data-encounter-faction]")) {
      faction.textContent = "FACTION / " +
        String(encounter.faction_name || "Unregistered Organization")
    }
    for (const distance of panel.querySelectorAll("[data-encounter-distance]")) {
      distance.textContent = Math.round(encounter.distance_km || 0).toLocaleString("en-US") +
        " game km at detection · " + status + " · " +
        String(encounter.origin_id || "?") + " → " +
        String(encounter.destination_id || "?")
    }
    const tacticalAction = tacticalEncounterAction(encounter.classification)
    for (const button of panel.querySelectorAll("[data-encounter-action]")) {
      if (button.dataset.encounterAction === "engage") {
        button.hidden = !tacticalAction.visible
        button.textContent = tacticalAction.label
      } else if (button.dataset.encounterAction === "continue") {
        button.textContent = encounterContinueLabel(encounter.id, this.hailedEncounterId)
      }
      button.disabled = this.encounterResolving
    }
    if (wasHidden) {
      this.exitMouseSteering({silent: true})
      this.flightControls?.release({silent: true})
      this.spaceLaser?.release()
      panel.querySelector('.solar-encounter-eye:first-child [data-encounter-action="hail"]')
        ?.focus({preventScroll: true})
    }
  }

  showSolarTactical() {
    const panel = this.root.querySelector("#solar-tactical-panel")
    if (!panel) return
    const tactical = this.navComputer?.solarNavigation?.tactical_encounter
    panel.hidden = !tactical
    if (!tactical) {
      this.tacticalRetreating = false
      return
    }
    const label = panel.querySelector("[data-solar-tactical-name]")
    if (label) label.textContent = (tactical.call_sign || "Hostile interception") +
      " · " + (tactical.faction_name || tactical.faction_id || "Unregistered faction")
    const button = panel.querySelector("[data-solar-tactical-retreat]")
    if (button) button.disabled = this.tacticalRetreating

    const surrendered = [...this.entities.values()].some(entity =>
      entity.kind === "npc" &&
      entity.state === "surrendered" &&
      entity.npcTypeId === "solar-scow-" + this.player?.pilot?.id)
    const accept = panel.querySelector("[data-solar-tactical-surrender]")
    const seize = panel.querySelector("[data-solar-tactical-seize]")
    // Only the authoritative world entity's surrender state opens this line.
    // Showing it does not settle combat, claim cargo or change story progress.
    if (surrendered && this.storyStep === 6 &&
        String(tactical.id).includes("corsair-17") &&
        this.surrenderAnnouncedFor !== tactical.id) {
      this.surrenderAnnouncedFor = tactical.id
      this.storyRadio?.receive({
        id: "first_run:corsair_surrender:" + tactical.id,
        lines: [{
          speaker: "Corsair-17",
          channel: "Raider distress / open channel",
          text: "Hold your fire! We've had enough! Our weapons are cold. " +
            "Take the freight, take the navigation records, just let us live."
        }]
      })
    }
    for (const button of [accept, seize]) {
      if (button) {
        button.hidden = !surrendered
        button.disabled = this.tacticalRetreating
      }
    }
    const message = panel.querySelector("[data-solar-tactical-message]")
    if (message && !this.tacticalRetreating) {
      message.textContent = surrendered
        ? "Corsair-17: Hold your fire! We surrender. Release them or seize the cargo (4-tonne hold limits apply)."
        : "Defeat the opposing vessel, accept surrender if offered, or retreat."
    }
  }

  solarEnterEncounter(encounterId, done) {
    if (this.channel?.state !== "joined") return done(false, null, "relay offline")
    this.channel.push("solar_enter_encounter", {encounter_id: encounterId}, 5000)
      .receive("ok", response => done(true, response))
      .receive("error", response => done(false, null, response.reason))
      .receive("timeout", () => done(false, null, "timeout"))
  }

  solarAcceptSurrender(encounterId, done) {
    if (this.channel?.state !== "joined") return done(false, null, "relay offline")
    this.channel.push("solar_accept_surrender", {encounter_id: encounterId}, 5000)
      .receive("ok", response => done(true, response.navigation))
      .receive("error", response => done(false, null, response.reason))
      .receive("timeout", () => done(false, null, "timeout"))
  }

  solarSeizeCargo(encounterId, done) {
    if (this.channel?.state !== "joined") return done(false, null, "relay offline")
    this.channel.push("solar_seize_cargo", {encounter_id: encounterId}, 5000)
      .receive("ok", response => done(true, response.navigation, null, response.claim))
      .receive("error", response => done(false, null, response.reason))
      .receive("timeout", () => done(false, null, "timeout"))
  }

  solarRetreatEncounter(encounterId, done) {
    if (this.channel?.state !== "joined") return done(false, null, "relay offline")
    this.channel.push("solar_retreat_encounter", {encounter_id: encounterId}, 5000)
      .receive("ok", response => done(true, response.navigation))
      .receive("error", response => done(false, null, response.reason))
      .receive("timeout", () => done(false, null, "timeout"))
  }

  solarSetCourse(target, done) {
    if(this.channel?.state!=="joined")return done(false,null,"relay offline")
    const payload=typeof target==="string" ? {body_id:target} : {point:target}
    this.channel.push("solar_set_course",payload,5000)
      .receive("ok",response=>done(true,response.navigation))
      .receive("error",response=>done(false,null,response.reason))
      .receive("timeout",()=>done(false,null,"timeout"))
  }

  solarEnterFreeFlight(done) {
    if(this.channel?.state!=="joined")return done(false,null,"relay offline")
    this.channel.push("solar_enter_free_flight",{},5000)
      .receive("ok",response=>done(true,response.navigation))
      .receive("error",response=>done(false,null,response.reason))
      .receive("timeout",()=>done(false,null,"timeout"))
  }

  solarResumeCruise(done) {
    if(this.channel?.state!=="joined")return done(false,null,"relay offline")
    this.channel.push("solar_resume_cruise",{},5000)
      .receive("ok",response=>done(true,response.navigation))
      .receive("error",response=>done(false,null,response.reason))
      .receive("timeout",()=>done(false,null,"timeout"))
  }

  solarCancelCourse(done) {
    if(this.channel?.state!=="joined")return done(false,null,"relay offline")
    this.channel.push("solar_cancel_course",{},5000)
      .receive("ok",response=>done(true,response.navigation))
      .receive("error",response=>done(false,null,response.reason))
      .receive("timeout",()=>done(false,null,"timeout"))
  }

  solarResolveEncounter(encounterId, done) {
    if (this.channel?.state !== "joined") return done(false, null, "relay offline")
    this.channel.push("solar_resolve_encounter", {
      encounter_id: encounterId, choice: "continue",
    }, 5000)
      .receive("ok", response => done(true, response.navigation))
      .receive("error", response => done(false, null, response.reason))
      .receive("timeout", () => done(false, null, "timeout"))
  }

  solarHail(contactId, done) {
    if (this.channel?.state !== "joined") return done(false, null, "relay offline")
    this.channel.push("solar_hail", {contact_id: contactId}, 3000)
      .receive("ok", response => done(true, response.communication))
      .receive("error", response => done(false, null, response.reason))
      .receive("timeout", () => done(false, null, "timeout"))
  }

  plotCourse(waypoints, done) {
    if (this.channel?.state !== "joined") return done(false, "relay offline")
    this.channel.push("plot_course", {waypoints}, 5000)
      .receive("ok", response => {
        if (response.entity) this.upsertEntity(response.entity)
        this.flightControls.resetThrottle()
        done(true)
      })
      .receive("error", response => done(false, response.reason))
      .receive("timeout", () => done(false, "timeout"))
  }

  stopNavigation(done) {
    if (this.channel?.state !== "joined") return done(false, "relay offline")
    this.channel.push("stop_navigation", {}, 5000)
      .receive("ok", response => {
        if (response.entity) this.upsertEntity(response.entity)
        done(true)
      })
      .receive("error", response => done(false, response.reason))
      .receive("timeout", () => done(false, "timeout"))
  }

  sendDestination(destination) {
    if (this.inSystemCruise()) return false
    if (!validDestination(destination, this.boundaries)) return false
    if (!this.channel || !this.selfId || this.channel.state !== "joined") {
      this.showError("Navigation is unavailable while the sector relay reconnects.")
      return false
    }

    this.channel
      .push("move", destination, 5000)
      .receive("ok", response => {
        if (response.entity) this.upsertEntity(response.entity)
      })
      .receive("error", response => {
        this.showError(`Navigation rejected: ${response.reason}`)
        this.updateNavigationStatus()
      })
      .receive("timeout", () => this.showError("Navigation command timed out."))

    return true
  }

  handleLaserPointerDown(event) {
    if (this.shipWalkPose) return
    const input = this.flightInputState()
    const active = input === "ready"
    const takeover = input === "cruise" && this.inSystemCruise()
    if (!manualLaserPointerIntent(event, active || takeover)) return

    event.preventDefault()
    this.canvas.focus({preventScroll: true})
    this.manualLaserPointerHeld = true
    if (active) {
      this.spaceLaser?.press()
      return
    }

    // Shooting during cruise explicitly requests manual helm. Do not fire in
    // the old sector: the private flight region must join before any shots.
    if (this.laserTakeoverPending) return
    this.laserTakeoverPending = true
    this.setCombatMessage("Pausing SOL cruise and transferring manual helm…")
    this.solarEnterFreeFlight((ok, navigation, reason) => {
      this.laserTakeoverPending = false
      if (ok && navigation) {
        this.applySolarNavigation(navigation)
        this.setCombatMessage("SOL cruise paused. Establishing deep-space combat link…")
      } else {
        this.manualLaserPointerHeld = false
        this.setCombatMessage("Manual laser takeover unavailable: " + (reason || "relay error"))
      }
    })
  }

  selectTargetAtPointer(pointer) {
    if (this.inSystemCruise()) return false
    const rect = this.canvas.getBoundingClientRect()
    const targetId = this.stereoView?.selectNpc(pointer, rect)
    if (!targetId) return false
    this.selectTarget(targetId)
    return true
  }

  handleCombatKey(event) {
    if (this.navComputer?.isOpen) return
    if (this.inSystemCruise()) return
    if (event.defaultPrevented) return
    const intent = combatKeyIntent(event)
    if (!intent) return

    event.preventDefault()
    if (intent.type === "toggle_laser") this.toggleLaserFire()
    if (intent.type === "disengage") this.disengageCombat()
    if (intent.type === "activate_slot") this.activateHotbarSlot(intent.slot)
    if (intent.type === "target_nearest") this.selectNearestTarget()
  }

  selectNearestTarget() {
    const ownShip = this.entities.get(this.selfId)
    const target = nearestNpc(this.entities.values(), ownShip?.target)
    if (target) this.selectTarget(target.id)
    else this.setCombatMessage("No hostile signal in sector telemetry.")
  }

  selectTarget(targetId) {
    if (this.inSystemCruise()) return
    if (!this.channel || !this.selfId) return

    this.channel
      .push("select_target", {target_id: targetId}, 5000)
      .receive("ok", response => this.targetSelected(response.selection))
      .receive("error", response => this.setCombatMessage(`Target rejected: ${response.reason}`))
      .receive("timeout", () => this.setCombatMessage("Targeting command timed out."))
  }

  disengageCombat() {
    if (!this.channel || !this.selfId) return

    this.channel
      .push("disengage_combat", {}, 5000)
      .receive("ok", engagement => {
        this.combatDisengaged(engagement)
        this.targetCleared(engagement)
      })
      .receive("error", response => this.setCombatMessage(`Disengage rejected: ${response.reason}`))
  }

  engageCombat() {
    if (!this.channel || !this.selfId) return
    if (!this.selectedTargetId) {
      this.setCombatMessage("Select an NPC before engaging.")
      return
    }

    this.channel
      .push("engage_combat", {}, 5000)
      .receive("ok", engagement => this.combatEngaged(engagement))
      .receive("error", response => this.setCombatMessage(this.attackError(response.reason)))
      .receive("timeout", () => this.setCombatMessage("Engagement command timed out."))
  }

  fireReadyWeapon(done) {
    if (this.channel?.state !== "joined" || !this.selfId) {
      done(false, "disconnected")
      return
    }

    // Render the pilot's shot immediately from the same local quaternion
    // driving the reticle. This preview never predicts hits or damage.
    const startedAt = performance.now()
    const own = this.entities.get(this.selfId)
    const preview = instantLaserPreview(own, startedAt)
    if (preview.length) {
      this.pendingLocalLaserPreviews =
        this.pendingLocalLaserPreviews.filter(p => startedAt-p.at<=LOCAL_LASER_MATCH_MS)
      this.pendingLocalLaserPreviews.push({at:startedAt})
      this.beams.push(...preview.map(ray => ({
        ...ray,shooterId:this.selfId,hostile:false,
      })))
    }

    // The client supplies the aim seen at the instant of fire, not a target
    // or a claimed hit. Phoenix validates the quaternion/tick against its
    // ship state and determines all collision and damage outcomes.
    const aim = own?.renderOrientation || own?.orientation
    const request = aim && this.worldTick >= 0
      ? {aim_orientation: {...aim}, client_tick: this.worldTick,
          shot_sequence: ++this.manualShotSequence}
      : {}
    this.channel
      .push("fire_ready_weapon", request, 3000)
      .receive("ok", shot => {
        const own = this.entities.get(this.selfId)
        if (own) own.nextAttackTick = shot.next_attack_tick
        this.worldTick = Math.max(this.worldTick, Number(shot.tick) || 0)
        done(true)
      })
      .receive("error", response => {
        this.pendingLocalLaserPreviews =
          this.pendingLocalLaserPreviews.filter(p => p.at !== startedAt)
        this.beams = this.beams.filter(
          beam => !(beam.preview && beam.startedAt === startedAt))
        this.setCombatMessage(this.attackError(response.reason))
        done(false, response.reason)
      })
      .receive("timeout", () => {
        this.pendingLocalLaserPreviews =
          this.pendingLocalLaserPreviews.filter(p => p.at !== startedAt)
        this.beams = this.beams.filter(
          beam => !(beam.preview && beam.startedAt === startedAt))
        this.setCombatMessage("Manual laser command timed out.")
        done(false, "timeout")
      })
  }

  toggleLaserFire() {
    if (!this.channel || !this.selfId) return

    this.channel
      .push("toggle_laser_fire", {}, 5000)
      .receive("ok", engagement => this.applyLaserToggle(engagement))
      .receive("error", response => this.setCombatMessage(this.attackError(response.reason)))
      .receive("timeout", () => this.setCombatMessage("Laser toggle timed out."))
  }

  activateHotbarSlot(slot) {
    if (this.inSystemCruise()) return
    if (!this.channel || !this.selfId || !Number.isInteger(slot)) return

    this.selectedHotbarSlot = slot
    this.updateHotbar()
    this.channel
      .push("activate_action", {slot}, 5000)
      .receive("ok", activation => {
        if (activation.status === "empty") {
          this.setCombatMessage(`Action slot ${slot === 10 ? 0 : slot} is empty.`)
        } else if (activation.engagement) this.applyLaserToggle(activation.engagement)
      })
      .receive("error", response => this.setCombatMessage(this.attackError(response.reason)))
      .receive("timeout", () => this.setCombatMessage("Action activation timed out."))
  }

  targetSelected(selection) {
    if (entityKey(selection.player_id) !== this.selfId) return
    this.selectedTargetId = entityKey(selection.target_id)
    const ownShip = this.entities.get(this.selfId)
    if (ownShip) ownShip.targetId = this.selectedTargetId
    this.setCombatMessage("Target lock confirmed.")
    this.updateCombatHud()
  }

  targetCleared(selection) {
    if (entityKey(selection.player_id) !== this.selfId) return
    this.selectedTargetId = null
    const ownShip = this.entities.get(this.selfId)
    if (ownShip) {
      ownShip.targetId = null
      ownShip.engagedTargetId = null
    }
    this.setCombatMessage("Target lock cleared.")
    this.updateCombatHud()
  }

  combatEngaged(engagement) {
    const player = this.entities.get(entityKey(engagement.player_id))
    if (player) player.engagedTargetId = entityKey(engagement.target_id)
    if (entityKey(engagement.player_id) !== this.selfId) return

    this.selectedTargetId = entityKey(engagement.target_id)
    this.selectHotbarAction(engagement.action_id)
    this.setCombatMessage("X1 laser automatic fire engaged.")
    this.updateCombatHud()
  }

  combatDisengaged(engagement) {
    const player = this.entities.get(entityKey(engagement.player_id))
    if (player) player.engagedTargetId = null
    if (entityKey(engagement.player_id) !== this.selfId) return

    this.setCombatMessage(
      engagement.reason === "laser_toggled_off"
        ? "Laser fire stopped. Target lock retained."
        : "Combat disengaged."
    )
    this.updateCombatHud()
  }

  applyLaserToggle(engagement) {
    if (engagement.active) this.combatEngaged(engagement)
    else this.combatDisengaged(engagement)
  }

  selectHotbarAction(actionId) {
    if (!actionId) return

    const slot = [...this.root.querySelectorAll("[data-hotbar-slot]")]
      .find(element => element.dataset.actionId === String(actionId))

    if (slot) this.selectedHotbarSlot = Number(slot.dataset.hotbarSlot)
  }

  syncOwnCombatState() {
    const ownShip = this.entities.get(this.selfId)
    if (!ownShip) return
    this.selectedTargetId = ownShip.targetId
  }

  laserFired(attack) {
    const attacker = this.entities.get(entityKey(attack.attacker_id))
    const target = this.entities.get(entityKey(attack.target_id))
    applyLaserBurstDamage(this.entities, attack)
    if (attacker) attacker.nextAttackTick = attack.next_attack_tick
    this.worldTick = Math.max(this.worldTick, Number(attack.tick) || 0)

    const startedAt = performance.now()
    const localPreview = entityKey(attack.attacker_id) === this.selfId
      ? takePreviewForConfirmedShot(this.pendingLocalLaserPreviews,startedAt)
      : null
    // The locally aimed manual shot is already visible. A second, delayed
    // world-space beam would appear behind the pointer during a turn.
    // All server hit/miss/damage and feedback are still applied below.
    if (!localPreview) {
      for (const ray of visualLaserRays(attack, attacker, target)) {
        this.beams.push({
          ...ray,
          hostile: attacker?.kind === "npc",
          shooterId: entityKey(attack.attacker_id),
          startedAt,
          expiresAt: startedAt + REMOTE_LASER_DISPLAY_MS,
        })
      }
    }

    if (entityKey(attack.attacker_id) === this.selfId) {
      this.lastLaserFeedback = laserFeedback(attack, this.entities, startedAt)
      const feedback = this.lastLaserFeedback
      this.setCombatMessage(feedback.label + "  " + feedback.detail)
    }

    this.updateCombatHud()
  }

  planetaryProximityChanged(event) {
    const warning = proximityEventWarning(event, this.selfId)
    if (warning !== undefined) this.applyPlanetaryWarning(warning)
  }

  applyPlanetaryWarning(warning, {announce = true} = {}) {
    const view = planetaryWarningView(warning)
    this.planetaryWarningDisplay = view
    const nextLevel = view?.level || "clear"
    const nextPlanet = warning?.planet_id || null
    const changed = nextLevel !== this.planetaryWarningLevel ||
      nextPlanet !== this.planetaryWarningPlanet
    const banner = this.root.querySelector("#planetary-proximity-warning")
    const announcement = this.root.querySelector("#planetary-proximity-announcement")

    if (banner) {
      banner.hidden = !view
      banner.dataset.level = nextLevel
      banner.classList.toggle("border-rose-400/80", nextLevel === "critical")
      banner.classList.toggle("bg-rose-950/95", nextLevel === "critical")
      banner.classList.toggle("border-amber-400/60", nextLevel === "caution")
      banner.classList.toggle("bg-amber-950/85", nextLevel === "caution")
    }
    if (view) {
      const title = this.root.querySelector("#planetary-proximity-level")
      const detail = this.root.querySelector("#planetary-proximity-detail")
      if (title) {
        title.textContent = view.label
        title.classList.toggle("text-rose-100", view.level === "critical")
        title.classList.toggle("text-amber-100", view.level === "caution")
      }
      if (detail) detail.textContent = view.detail
    }

    if (announce && changed && announcement) {
      announcement.textContent = view?.announcement || "Planetary collision clearance restored."
    }

    this.planetaryWarningLevel = nextLevel
    this.planetaryWarningPlanet = nextPlanet
  }

  launchFromStarbase() {
    if (!this.docked || this.channel?.state !== "joined") return
    const feedback = this.root.querySelector("#starbase-launch-feedback")
    if (feedback) feedback.textContent = "Opening launch corridor…"
    this.channel.push("station_launch", {}, 5000)
      .receive("ok", response => {
        if (response.entity) this.upsertEntity(response.entity, true)
        this.setDocked(false)
        this.setCombatMessage("GREEN STARBASE · LAUNCH COMPLETE")
      })
      .receive("error", response => {
        if (feedback) feedback.textContent = "Launch rejected: " + response.reason
      })
      .receive("timeout", () => {
        if (feedback) feedback.textContent = "Launch request timed out."
      })
  }

  setDocked(docked) {
    if (!docked) this.closeStationNpc({focus: false})
    const wasDocked = this.docked
    if (wasDocked && !docked) this.stationWalking?.release()
    this.docked = Boolean(docked)
    if (this.docked) this.clientLedCamera.reset()
    if (!this.docked) {
      this.stationPosition = null
      this.stationPilots = []
      this.stationPilotRequest = null
      this.lastStationPilotPoll = -Infinity
    }
    if (this.docked) this.clearDockingCountdown()
    const panel = this.root.querySelector("#starbase-docked-panel")
    if (panel) panel.style.display = this.docked ? "grid" : "none"
    if (this.docked) {
      if (!wasDocked) {
        // Force the local cockpit/hangar viewport to the foreground on a
        // fresh docking event OR when a parked pilot reconnects.
        this.navComputer?.close()
      }
    }
    if (this.docked && !wasDocked) {
      this.exitMouseSteering({silent: true})
      this.flightControls?.release({silent: true})
      this.spaceLaser?.release()
      this.navigation?.cancel()
    }
  }

  applyStationPosition(map) {
    if (Array.isArray(map.station_attendants)) {
      this.stationAttendants = map.station_attendants
    }
    const pose = map.station_avatars?.find(
      avatar => entityKey(avatar.player_id) === this.selfId)
    this.stationPosition = this.docked && pose || null
    const display = this.root.querySelector("#starbase-current-room")
    if (display) {
      const names = {
        main_hangar: "Main Hangar", airlock: "Access Airlock",
        concourse: "Station Concourse", repair_bay: "Repair Facility",
        trade_exchange: "Trade Exchange", outfitting: "Equipment & Outfitting",
        resupply: "Resupply", mission_office: "Mission Office",
        communications: "Communications & Personnel",
      }
      display.textContent = "Current area: " +
        (names[this.stationPosition?.room_id] || "Main Hangar")
    }
    if (this.stationNpcDialogOpen &&
        this.nearbyStationNpc()?.id !== this.stationNpcId) {
      this.closeStationNpc({focus: false})
    }
    this.updateStationNpcPrompt()
  }

  nearbyStationNpc() {
    return this.docked ?
      nearestStationAttendant(this.stationPosition, this.stationAttendants) : null
  }

  updateStationNpcPrompt() {
    const prompt = this.root.querySelector("#station-npc-prompt")
    if (!prompt) return
    const npc = !this.stationNpcDialogOpen && !this.navComputer?.isOpen &&
      this.channel?.state === "joined" && this.nearbyStationNpc()
    prompt.style.display = npc ? "block" : "none"
    if (npc) {
      const label = this.root.querySelector("#station-npc-prompt-name")
      if (label) label.textContent = npc.name + " · " + npc.role
    }
  }

  handleStationNpcKey(event) {
    const panel = this.outfittingPanel?.opened ? this.outfittingPanel
      : this.tradePanel?.opened ? this.tradePanel : null
    if (panel) {
      if (event.code === "Escape") panel.close()
      if (["Escape", "KeyW", "KeyA", "KeyS", "KeyD",
           "ArrowLeft", "ArrowRight", "KeyM", "KeyE"].includes(event.code)) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
      return
    }
    if (this.stationNpcDialogOpen) {
      if (event.code === "Escape") {
        event.preventDefault()
        event.stopImmediatePropagation()
        this.closeStationNpc()
      } else if (["KeyW", "KeyA", "KeyS", "KeyD",
                  "ArrowLeft", "ArrowRight", "KeyM", "KeyE"].includes(event.code)) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
      return
    }
    if (event.code !== "KeyE" || event.repeat || !this.docked ||
        this.navComputer?.isOpen || this.channel?.state !== "joined" ||
        event.target?.closest?.("input,textarea,select,button,[contenteditable='true']")) return
    const npc = this.nearbyStationNpc()
    if (!npc) return
    event.preventDefault()
    event.stopImmediatePropagation()
    this.askStationNpc(npc.id, "greeting")
  }

  askStationNpc(id, topic) {
    if (!this.docked || this.stationNpcBusy || this.channel?.state !== "joined" ||
        this.nearbyStationNpc()?.id !== id) return
    if (id === "outfitting" && topic === "console") {
      this.openStationOutfitting()
      return
    }
    if (id === "trade" && topic === "console") {
      this.openStationTrade()
      return
    }
    const fresh = !this.stationNpcDialogOpen
    if (fresh) {
      this.stationNpcDialogOpen = true
      this.stationNpcId = id
      this.stationWalking?.release()
      if (document.pointerLockElement === this.canvas) document.exitPointerLock?.()
      const modal = this.root.querySelector("#station-npc-dialogue")
      if (modal) modal.style.display = "flex"
      const message = this.root.querySelector("#station-npc-message")
      if (message) message.textContent = "Opening station communications…"
      this.root.querySelector("#station-npc-options")?.replaceChildren()
      this.root.querySelector("#station-npc-close")?.focus({preventScroll: true})
      this.updateStationNpcPrompt()
    }
    this.stationNpcBusy = true
    const seq = ++this.stationNpcRequestSeq
    // Service operations are distinct from read-only NPC dialogue.
    const repair = id === "repair" && topic === "repair"
    this.channel.push(repair ? "station_repair" : "station_talk",
      repair ? {} : {attendant_id: id, topic}, 5000)
      .receive("ok", response => {
        if (!this.stationNpcDialogOpen || seq !== this.stationNpcRequestSeq) return
        this.stationNpcBusy = false
        if (this.nearbyStationNpc()?.id !== id) {
          this.closeStationNpc({focus: false})
          return
        }
        this.showStationNpcResponse(response)
      })
      .receive("error", reply => {
        if (!this.stationNpcDialogOpen || seq !== this.stationNpcRequestSeq) return
        this.stationNpcBusy = false
        const node = this.root.querySelector("#station-npc-message")
        if (node) node.textContent = "Contact unavailable: " +
          String(reply?.reason || "unknown error").replaceAll("_", " ")
      })
      .receive("timeout", () => {
        if (!this.stationNpcDialogOpen || seq !== this.stationNpcRequestSeq) return
        this.stationNpcBusy = false
        const node = this.root.querySelector("#station-npc-message")
        if (node) node.textContent = "Station communications timed out."
      })
  }

  sendStationOutfitting(event, payload, done) {
    if (this.channel?.state !== "joined" || !this.docked) {
      done(false, {reason: "not_docked"})
      return
    }
    this.channel.push(event, payload, 8000)
      .receive("ok", response => done(true, response))
      .receive("error", response => done(false, response))
      .receive("timeout", () => done(false, {reason: "timeout"}))
  }

  openStationOutfitting() {
    if (this.stationNpcBusy || this.stationNpcId !== "outfitting" ||
        this.nearbyStationNpc()?.id !== "outfitting") return
    this.stationNpcBusy = true
    this.sendStationOutfitting("station_outfitting", {}, (ok, response) => {
      this.stationNpcBusy = false
      if (!this.stationNpcDialogOpen || this.stationNpcId !== "outfitting") return
      if (!ok) {
        const message = this.root.querySelector("#station-npc-message")
        if (message) message.textContent = "Outfitting unavailable: " +
          String(response?.reason || "unknown error").replaceAll("_", " ")
        return
      }
      this.root.querySelector("#station-npc-dialogue").style.display = "none"
      this.outfittingPanel?.open(response.outfitting)
    })
  }

  openStationTrade() {
    if (this.stationNpcBusy || this.stationNpcId !== "trade" ||
        this.nearbyStationNpc()?.id !== "trade") return
    this.stationNpcBusy = true
    this.sendStationOutfitting("station_trade", {}, (ok, response) => {
      this.stationNpcBusy = false
      if (!this.stationNpcDialogOpen || this.stationNpcId !== "trade") return
      if (!ok) {
        const message = this.root.querySelector("#station-npc-message")
        if (message) message.textContent = "Trade Exchange unavailable: " +
          String(response?.reason || "unknown error").replaceAll("_", " ")
        return
      }
      this.root.querySelector("#station-npc-dialogue").style.display = "none"
      this.tradePanel?.open(response.exchange)
    })
  }

  applyStationOutfitting(response) {
    if (!response?.player) return
    this.player = response.player
    this.populateHud()
    if (response.combat) {
      const c = response.combat
      this.text("#hud-hp", String(c.hull) + " / " + String(c.max_hull))
      this.text("#hud-shields", String(c.shields) + " / " + String(c.max_shields))
      this.setWidth("#hud-hp-bar", healthPercent(c.hull, c.max_hull))
      this.setWidth("#hud-shield-bar", healthPercent(c.shields, c.max_shields))
    }
  }

  showStationNpcResponse(response) {
    const name = this.root.querySelector("#station-npc-name")
    const role = this.root.querySelector("#station-npc-role")
    const message = this.root.querySelector("#station-npc-message")
    const choices = this.root.querySelector("#station-npc-options")
    if (name) name.textContent = String(response.name || "Station Attendant")
    if (role) role.textContent = String(response.role || "Service Desk")
    if (message) message.textContent = String(response.message || "")
    if (!choices) return
    choices.replaceChildren()
    for (const option of response.topics || []) {
      if (typeof option.id !== "string" || typeof option.label !== "string") continue
      const button = document.createElement("button")
      button.type = "button"
      button.className = "nav-button rounded-lg border border-emerald-600/60 px-3 py-2 text-left text-sm"
      button.dataset.stationTopic = option.id
      button.textContent = option.label
      choices.appendChild(button)
    }
  }

  closeStationNpc({focus = true} = {}) {
    this.outfittingPanel?.close({restoreDialogue: false})
    this.tradePanel?.close({restoreDialogue: false})
    if (!this.stationNpcDialogOpen) return
    this.stationNpcDialogOpen = false
    this.stationNpcBusy = false
    this.stationNpcId = null
    this.stationNpcRequestSeq++
    const modal = this.root.querySelector("#station-npc-dialogue")
    if (modal) modal.style.display = "none"
    this.stationWalking?.release()
    this.updateStationNpcPrompt()
    if (focus) this.canvas?.focus({preventScroll: true})
  }

  clearDockingCountdown() {
    this.stationDockingHold = null
    this.stationDockingSeconds = null
    this.lastDockingCountdownLabel = null
    const overlay = this.root.querySelector("#starbase-docking-countdown")
    if (overlay) overlay.hidden = true
  }

  updateDockingCountdown(time) {
    const seconds = this.docked ? null : dockingSeconds(this.stationDockingHold, time)
    this.stationDockingSeconds = seconds
    const overlay = this.root.querySelector("#starbase-docking-countdown")
    if (overlay) overlay.hidden = seconds === null || Boolean(this.navComputer?.isOpen)
    if (this.lastDockingCountdownLabel === seconds) return
    this.lastDockingCountdownLabel = seconds
    const number = this.root.querySelector("#starbase-docking-seconds")
    if (number) number.textContent = seconds === 0 ? "SECURING" : String(seconds)
  }

  applyStationWarning(warning, {announce = true} = {}) {
    const view = stationWarningView(warning)
    const nextLevel = view?.level || "clear"
    const changed = nextLevel !== this.stationWarningLevel
    const banner = this.root.querySelector("#station-proximity-warning")
    const announcement = this.root.querySelector("#station-proximity-announcement")

    if (banner) {
      banner.hidden = !view
      banner.dataset.level = nextLevel
    }
    if (view) {
      const title = this.root.querySelector("#station-proximity-level")
      const detail = this.root.querySelector("#station-proximity-detail")
      if (title) title.textContent = view.label
      if (detail) detail.textContent = view.detail
    }
    if (announce && changed && announcement) {
      announcement.textContent = view?.announcement || "Station clearance restored."
    }
    this.stationWarningLevel = nextLevel
  }

  showRespawnPanel(visible, message = "") {
    const panel = this.root.querySelector("#pilot-respawn-panel")
    if (!panel) return
    panel.hidden = !visible
    const detail = this.root.querySelector("#pilot-respawn-message")
    if (detail && visible) detail.textContent = message ||
      "Your ship has been destroyed. Respawn in Earth orbit."
    const button = this.root.querySelector("#pilot-respawn-button")
    if (button) button.disabled = this.respawnPending
  }

  requestRespawn() {
    if (this.respawnPending || this.channel?.state !== "joined" ||
        this.entities.get(this.selfId)?.status !== "destroyed") return

    this.respawnPending = true
    this.showRespawnPanel(true, "Requesting an Earth-orbit recovery…")
    const old = this.channel

    const failed = reason => {
      if (this.channel !== old) return
      this.respawnPending = false
      this.showRespawnPanel(true, "Respawn unavailable: " + reason)
    }

    old.push("respawn", {}, 10_000)
      .receive("ok", ({map_id: mapId}) => {
        if (this.channel !== old) return
        if (!validOrbitalMapId(mapId)) return failed("Invalid server region")

        this.setConnection("Returning to Earth orbit", "online")
        this.exitMouseSteering({silent: true})
        this.flightControls?.release({silent: true})
        this.spaceLaser?.release()
        this.navigation?.cancel()
        this.showRespawnPanel(false)
        this.selectedTargetId = null
        this.commandDestination = null
        this.entities.clear()
        this.worldStream = null
        this.worldResyncInFlight = false
        this.beams = []
        this.setSolarEncounter(null)
        this.applyPlanetaryWarning(null, {announce: false})
        this.applyStationWarning(null, {announce: false})
        this.stereoView?.planetaryBody?.dispose()
        this.switchingRegion = true

        const rejoin = () => {
          if (this.channel === old) this.joinSector(mapId)
        }
        old.leave().receive("ok", rejoin).receive("timeout", rejoin)
      })
      .receive("error", response => failed(response.reason || "server rejected recovery"))
      .receive("timeout", () => failed("sector link timed out"))
  }

  entityDestroyed(destruction) {
    const id = entityKey(destruction.entity.id)
    const isNpc = destruction.entity.kind === "npc"
    const impact = planetaryImpactMessage(destruction)
    if (isNpc) this.removeEntity(id)
    else this.upsertEntity(destruction.entity, true)
    if (this.selectedTargetId === id) this.selectedTargetId = null

    const label = impact ||
      (isNpc ? "Hostile destroyed. Respawn telemetry queued." : "Ship destroyed.")
    this.setCombatMessage(label)
    if (id === this.selfId) {
      // Only the authoritative world server may resurrect a hull.
      this.exitMouseSteering({silent: true})
      this.applyPlanetaryWarning(null, {announce: false})
      this.applyStationWarning(null, {announce: false})
      this.showRespawnPanel(true, impact ||
        "Ship destroyed. Use Respawn at Earth to restore flight.")
    }
    this.updateCombatHud()
  }

  removeEntity(id) {
    const key = entityKey(id)
    this.entities.delete(key)
    if (this.selectedTargetId === key) this.selectedTargetId = null
    for (const entity of this.entities.values()) {
      if (entity.targetId === key) entity.targetId = null
      if (entity.engagedTargetId === key) entity.engagedTargetId = null
    }
  }

  attackError(reason) {
    const messages = {
      no_target: "Select an NPC before engaging.",
      target_not_found: "The selected target is no longer active.",
      out_of_range: "Target is outside laser range. Navigate closer.",
      weapon_cooldown: "Laser is recharging.",
      attacker_destroyed: "Destroyed ships cannot fire.",
      weapon_unarmed: "No server-authorized weapon is available.",
    }
    return messages[reason] || `Laser rejected: ${reason}`
  }

  frame(time) {
    const deltaSeconds = Math.min((time - this.lastFrame) / 1000, 0.1)
    this.lastFrame = time
    this.mouseTimingProbe.frame(time)
    // In the opt-in experiment, one 60Hz-ish draw uses all the mouse deltas
    // received since the preceding frame. The server command cap is unchanged.
    if (this.mouseFrameSamplingEnabled) {
      const packet = this.mouseFrameSampler.drain()
      if (packet) {
        // Two real opposite-direction events can cancel inside one draw
        // frame. A zero-sum batch is not an intentional pointer release.
        if (packet.dx !== 0 || packet.dy !== 0) {
          this.applyDesktopMouseDelta(packet.dx, packet.dy, time)
        }
      }
    }
    // Virtual joystick: the deflection persists until the pilot moves back
    // to centre, so there is no idle-timer stop to expire here.
    this.drawMouseSteeringVector()
    // Suppress only laptop WebGL draws. Input, world prediction, physics
    // commands, LAN relay and the RAF simulation heartbeat keep running.
    this.globalChat?.syncAvailability()
    this.syncDesktopVrOnly()
    this.interpolate(deltaSeconds)
    // Publish the same locally predicted cockpit pose that desktop draws.
    // Only the authenticated Rust LAN link receives it; Phoenix never does.
    this.publishOwnVisualPose(time)
    this.syncShipWalk()
    this.stationWalking?.frame(time)
    if (this.shipWalkPose) {
      this.shipWalkPose = advanceCabinPose(this.shipWalkPose, this.shipWalkAxes, deltaSeconds)
      this.text("#ship-walk-room", cabinRoom(this.shipWalkPose.z))
    }
    this.updateDockingCountdown(time)
    this.flightControls?.heartbeat(time)
    this.updateFlightInputStatus()
    if (this.manualLaserPointerHeld && this.flightInputState() === "ready") {
      this.spaceLaser?.press()
    }
    this.spaceLaser?.update(time)
    this.draw(time)
    this.minimap?.draw(time)
    this.refreshStationPilots(time)
    this.refreshAtlasPilots(time)
    this.navComputer?.draw(time)
    this.updateCoordinates()
    this.updateCombatHud()
    this.updateDesktopMouseTiming(time)
    requestAnimationFrame(nextTime => this.frame(nextTime))
  }

  interpolate(deltaSeconds) {
    const positionBlend = 1 - Math.exp(-deltaSeconds / 0.085)
    const pointerLocked = this.mouseSteeringEnabled &&
      (document.pointerLockElement === this.canvas || this.mouseFallback)
    const own = this.entities.get(this.selfId)
    // A delayed destination from an older server tick must not cause a
    // one-frame switch back to the authoritative camera after taking helm.
    // flightInputState("ready") already gates local manual steering.
    const localCameraActive = this.clientLedMouseCameraActive() &&
      Boolean(own?.orientation)
    if (localCameraActive) {
      if (!this.clientLedCamera.active) {
        this.clientLedCamera.begin(
          own.renderOrientation || own.orientation, own.angularVelocity)
      }
      this.clientLedCamera.advance(this.flightControls.axes(), deltaSeconds,
        {mouseMode: this.flightControls.mouseMode})
      // Keep the local camera from drifting away from Phoenix's orientation.
      // Unbounded drift made the SBS headset jitter more and more the longer
      // the mouse stayed captured (Esc + recapture reset it).
      if (Number.isFinite(own.authoritativeAt)) {
        const sinceTick = Math.max(0, (performance.now() - own.authoritativeAt) / 1000)
        const reference = predictOrientation(own.orientation, own.angularVelocity,
          this.flightInputHistory?.entries.length
            ? this.flightInputHistory.since(own.authoritativeAt)
            : this.flightControls.axes(),
          {mouseMode: this.flightControls.mouseMode, seconds: sinceTick})
        this.clientLedCamera.correctToward(reference, deltaSeconds)
      }
    } else if (this.clientLedCamera.active) {
      this.clientLedCamera.reset()
    }
    const now = performance.now()
    // Record what the pilot is commanding so prediction can replay it.
    if (!this.flightInputHistory) this.flightInputHistory = new InputHistory()
    if (this.flightControls?.active()) {
      this.flightInputHistory.record(now, this.flightControls.axes())
    } else {
      this.flightInputHistory.clear()
    }

    for (const entity of this.entities.values()) {
      const predicted = this.predictOwnShip(entity, now)
      if (predicted) {
        smoothEntityPresentation(entity, deltaSeconds,
          PREDICTED_OWN_SHIP_SETTLE_SECONDS, predicted)
        if (localCameraActive && entity.id === this.selfId &&
            this.clientLedCamera.active) {
          // The pilot's view must follow LOCAL input immediately. Applying
          // another 45ms camera settle would recreate perceived latency.
          entity.renderOrientation = {...this.clientLedCamera.orientation}
        }
        continue
      }
      // The local pointer-lock camera should not trail far behind the last
      // server orientation when the user releases the mouse. Remote players
      // and keyboard-only flight retain the original 85ms smoothing.
      const cameraSettle = cameraSettleSeconds({
        ownShip: entity.id === this.selfId,
        pointerLocked,
      })
      entity.render.x += (entity.target.x - entity.render.x) * positionBlend
      entity.render.y += (entity.target.y - entity.render.y) * positionBlend
      entity.render.z = (entity.render.z ?? 0) +
        ((entity.target.z ?? 0) - (entity.render.z ?? 0)) * positionBlend
      if (entity.attitude) {
        entity.renderAttitude = smoothAttitude(
          entity.renderAttitude || entity.attitude,
          entity.attitude,
          deltaSeconds,
          cameraSettle
        )
      }
      if (entity.orientation) {
        entity.renderOrientation = smoothOrientation(
          entity.renderOrientation || entity.orientation,
          entity.orientation, deltaSeconds, cameraSettle
        )
      }
    }

    // Keep the local camera's quaternion as the final presentation pose even
    // if a transient legacy navigation condition skipped prediction this
    // frame. Never overwrite the server's authoritative orientation.
    if (localCameraActive && own && this.clientLedCamera.active) {
      own.renderOrientation = {...this.clientLedCamera.orientation}
    }

    const rotationBlend = 1 - Math.exp(-deltaSeconds / 0.075)
    for (const entity of this.entities.values()) {
      entity.angle = smoothAngle(
        entity.angle,
        desiredEntityAngle(entity, this.entities),
        rotationBlend
      )
    }

  }

  // Manual flight only: run the server's own turn rules forward from the last
  // authoritative update, replaying the pilot's recorded input, so the camera
  // moves every frame instead of every 100 ms server tick. Presentation only;
  // each new update restarts the prediction from server state.
  predictOwnShip(entity, now, {uncorrected = false} = {}) {
    if (entity.id !== this.selfId ||
        (entity.destination && !this.clientLedCameraActiveForTick()) ||
        !entity.orientation || !Number.isFinite(entity.authoritativeAt) ||
        !this.flightControls?.active()) return null
    const seconds = Math.max(0, (now - entity.authoritativeAt) / 1000)
    // Body rates of the prediction at this instant (keyboard/uncaptured
    // path). Relayed to the SBS headset instead of the server's last-tick
    // rate, which is stale while a key turn is still ramping up or down.
    const predictedRates = uncorrected ? null : (entity.predictedRates ||= {})
    if (predictedRates) entity.predictedRatesAt = now
    const predictedOrientation = this.clientLedCameraActiveForTick()
      ? this.clientLedCamera.orientation
      : predictOrientation(entity.orientation,
      entity.angularVelocity,
      this.flightInputHistory?.entries.length
        ? this.flightInputHistory.since(entity.authoritativeAt)
        : this.flightControls.axes(),
      {mouseMode: this.flightControls.mouseMode, seconds, ratesOut: predictedRates})
    return {
      orientation: uncorrected || this.clientLedCameraActiveForTick()
        ? predictedOrientation :
        this.ownShipCameraReconciler.apply(predictedOrientation, now),
      target: predictPosition(entity.target, entity.velocity, seconds),
      positionSettleSeconds: PREDICTED_OWN_SHIP_SETTLE_SECONDS,
    }
  }

  clientLedMouseCameraActive() {
    return this.clientLedCameraEnabled && this.mouseSteeringEnabled &&
      (document.pointerLockElement === this.canvas || this.mouseFallback) &&
      Boolean(this.flightControls?.active()) &&
      this.flightControls?.mouseMode === true && !this.docked &&
      !this.navComputer?.isOpen
  }

  clientLedCameraActiveForTick() {
    return this.clientLedMouseCameraActive() && this.clientLedCamera.active
  }

  setupDesktopVrOnlyControl() {
    const button = this.root.querySelector("#desktop-vr-render-toggle")
    button?.addEventListener("click", () => {
      this.desktopVrOnlyPreferred = !this.desktopVrOnlyPreferred
      localStorage.setItem(this.desktopVrOnlyKey,
        this.desktopVrOnlyPreferred ? "1" : "0")
      this.syncDesktopVrOnly()
    })
    this.syncDesktopVrOnly()
  }

  syncDesktopVrOnly() {
    const status = this.helmet?.status
    const available = this.root.dataset.nativeClient === "true" &&
      headsetRendering(status)
    const active = pauseDesktop3D({
      nativeClient: this.root.dataset.nativeClient === "true",
      preferVrOnly: this.desktopVrOnlyPreferred,
      helmetStatus: status,
      atlasOpen: Boolean(this.navComputer?.isOpen),
    })
    if (this.desktopVrOnlyActive === active &&
        this.desktopVrAvailable === available &&
        this.desktopVrLastPreference === this.desktopVrOnlyPreferred) return

    this.desktopVrOnlyActive = active
    this.desktopVrAvailable = available
    this.desktopVrLastPreference = this.desktopVrOnlyPreferred
    this.root.dataset.vrOnlyActive = String(active)
    const overlay = this.root.querySelector("#desktop-vr-only-overlay")
    if (overlay) overlay.hidden = !active
    const button = this.root.querySelector("#desktop-vr-render-toggle")
    if (button) {
      button.hidden = !available
      button.setAttribute("aria-pressed", String(this.desktopVrOnlyPreferred))
      button.textContent = this.desktopVrOnlyPreferred ? "DESKTOP 3D OFF" : "BOTH VIEWS"
      button.title = this.desktopVrOnlyPreferred
        ? "Show both views while the headset renders (VR performance experiment)"
        : "Pause desktop 3D while the headset renders (VR performance experiment)"
    }
  }

  updateDesktopVrRenderStats(time) {
    const stats = this.desktopVrRenderStats
    if (time - stats.lastReport < 1000) return
    stats.lastReport = time
    const label = this.root.querySelector("#desktop-vr-render-stats")
    if (!label || !this.desktopVrOnlyActive) return
    const mean = stats.rendered > 0
      ? (stats.cpuMs / stats.rendered).toFixed(2) : "—"
    label.textContent = "3D draws skipped: " + stats.skipped +
      " · previous desktop draw JS avg: " + mean + " ms"
  }

  publishOwnVisualPose(time) {
    if (this.root.dataset.nativeClient !== "true" ||
        !this.helmet?.status?.rendering || this.navComputer?.isOpen ||
        this.docked || time - this.lastVisualPosePublishedAt < 32 ||
        !this.worldStream?.map || !this.selfId) return
    const own = this.entities.get(this.selfId)
    if (!own || !own.render || !own.renderOrientation) return
    this.lastVisualPosePublishedAt = time
    const visual = {
      id: own.id,
      orientation: own.renderOrientation || own.orientation,
      position_3d: own.render || own.target,
      // Laptop-clock sample time: the LAN publisher may send this 0-30ms
      // later; the headset uses it to cancel that and Wi-Fi jitter.
      t: time,
    }
    // Body rates of the pose actually drawn, so the headset can keep turning
    // smoothly between LAN poses instead of stepping at the relay rate.
    const rates = this.clientLedCameraActiveForTick()
      ? this.clientLedCamera.rates
      : this.flightControls?.active() && own.predictedRates?.yaw !== undefined &&
          time - (own.predictedRatesAt ?? -Infinity) < 100
        ? own.predictedRates : own.angularVelocity
    if (rates) visual.rates = {yaw: rates.yaw, pitch: rates.pitch, roll: rates.roll}
    const steering = this.mouseSteeringRelay()
    if (steering) {
      visual.steering = steering
      this.lastSteeringRelayAt = time
    }
    this.sbsRelayWorld.publish(this.worldStream.map, false, visual)
  }

  draw(time) {
    // A missing WebGL renderer must never silently bring back Classic 2D.
    if (!this.stereoView) return

    if (this.desktopVrOnlyActive) {
      this.desktopVrRenderStats.skipped++
    } else {
      const drawStarted = performance.now()
      this.stereoView.render(this, time)
      this.desktopVrRenderStats.rendered++
      this.desktopVrRenderStats.cpuMs += performance.now() - drawStarted
    }
    // The experiment still advances presentation timers and HUD feedback.
    this.updateDesktopVrRenderStats(time)
    this.beams = this.beams.filter(beam => beam.expiresAt > time)
    const feedback = this.lastLaserFeedback
    const element = this.root.querySelector("#laser-hit-confirmation")
    if (element) {
      const active = feedback && time - feedback.at < LASER_FEEDBACK_MS
      element.classList.toggle("hidden", !active)
      if (active) {
        element.textContent = feedback.label
        element.classList.toggle("text-emerald-200", feedback.hit)
        element.classList.toggle("text-rose-200", !feedback.hit)
        element.classList.toggle("border-emerald-400/50", feedback.hit)
        element.classList.toggle("border-rose-400/50", !feedback.hit)
      }
    }
  }

  // The browser page renders hotbar slots in HEEx. The installed client
  // instead receives the same authoritative action catalog on Channel join.
  populateNativeHotbar(hotbar) {
    for (const entry of hotbar) {
      const slot = this.root.querySelector('[data-hotbar-slot="' + entry.slot + '"]')
      if (!slot) continue
      const action = entry.action
      if (action) {
        slot.dataset.actionId = action.id
        slot.dataset.actionType = action.type
        slot.dataset.activationMode = action.activation_mode
      } else {
        delete slot.dataset.actionId
        delete slot.dataset.actionType
        delete slot.dataset.activationMode
      }
      const label = slot.querySelector("[data-hotbar-label]")
      if (label) label.textContent = action?.label || "Empty"
      slot.setAttribute("aria-label", action ? entry.key + " " + action.label : entry.key + " Empty")
      slot.classList.toggle("hotbar-slot-empty", !action)
    }
  }

  populateHud() {
    const {pilot, ship, stats, configuration} = this.player
    this.text("#atlas-pilot-name", pilot.pilot_name)
    this.text("#atlas-pilot-ship", ship.name)
    this.text("#atlas-pilot-config", `C-${configuration.number}`)
    this.text("#hud-hp", `${number(stats.hit_points)} / ${number(stats.hit_points)}`)
    this.text("#hud-shields", `${number(stats.shields)} / ${number(stats.shields)}`)
    this.text("#hud-speed", "—")
    this.root.querySelector("#hud-hp-bar").style.width = "100%"
    this.root.querySelector("#hud-shield-bar").style.width = stats.shields > 0 ? "100%" : "0%"

  }

  setupFlightModeButtons() {
    const button = this.root.querySelector("[data-flight-mode-toggle]")
    button?.addEventListener("click", () => {
      if (!this.flightControls?.active()) return
      const mode = this.entities.get(this.selfId)?.flightMode
      if (mode !== "cruise" && mode !== "newtonian") return
      // Select the opposite of authoritative mode, not an unconfirmed guess.
      this.flightControls.setMode(mode === "cruise" ? "newtonian" : "cruise")
    })
    this.syncFlightModeButtons()
  }

  syncFlightModeButtons(mode = this.entities.get(this.selfId)?.flightMode) {
    const button = this.root.querySelector("[data-flight-mode-toggle]")
    if (!button) return
    const enabled = this.flightControls?.active() === true
    const currentMode = mode === "cruise" || mode === "newtonian" ? mode : null
    const signature = String(currentMode) + ":" + enabled
    if (signature === this.lastFlightModeDisplay) return
    this.lastFlightModeDisplay = signature
    button.disabled = !enabled || !currentMode
    button.setAttribute("aria-pressed", String(currentMode === "newtonian"))
    if (currentMode) {
      button.title = currentMode === "cruise"
        ? "Cruise · activate for Newtonian (Ctrl+E)"
        : "Newtonian · activate for Cruise (Ctrl+E)"
      button.setAttribute("aria-label", currentMode === "cruise"
        ? "Cruise flight mode; activate for Newtonian"
        : "Newtonian flight mode; activate for Cruise")
    }
    for (const icon of button.querySelectorAll("[data-mode-icon]")) {
      icon.hidden = icon.dataset.modeIcon !== (currentMode || "cruise")
    }
  }

  updateCoordinates() {
    const ownShip = this.entities.get(this.selfId)
    this.syncFlightModeButtons(ownShip?.flightMode)
    if (!ownShip) return
    this.text("#hud-flight-mode", (ownShip.flightMode || "cruise").toUpperCase())
    this.text("#hud-throttle", `${Math.round((ownShip.throttle || 0) * 100)}%`)
    const v = ownShip.velocity || {x: 0, y: 0, z: 0}
    const speed = `${Math.round(Math.hypot(v.x, v.y, v.z))} u/s`
    this.text("#hud-speed", speed)
    this.text("#hud-actual-speed", speed)
    const a = orientationTelemetry(
      ownShip.orientation, ownShip.attitude || {yaw: 0, pitch: 0, roll: 0}
    )
    const deg = radians => Math.round(radians * 180 / Math.PI)
    this.text("#hud-heading", `${(deg(a.yaw) + 360) % 360}°`)
    this.text("#hud-pitch", `${deg(a.pitch)}°`)
    this.text("#hud-roll", `${deg(a.roll)}°`)
    const r = ownShip.angularVelocity || {yaw: 0, pitch: 0, roll: 0}
    this.text("#hud-turn-rates",
      `${Math.round(Math.abs(deg(r.pitch)))} / ${Math.round(Math.abs(deg(r.yaw)))} / ${Math.round(Math.abs(deg(r.roll)))} °/s`)
    const input = this.flightControls?.axes().pitch || 0
    this.text("#hud-pitch-input", input < 0 ? "DOWN" : input > 0 ? "UP" : "—")
  }

  updateNavigationStatus() {
    const ownShip = this.entities.get(this.selfId)
    let status = "Awaiting sector link"

    if (ownShip?.status === "destroyed") {
      status = "Navigation unavailable"
    } else if (this.commandDestination) {
      status = `Course locked · ${number(this.commandDestination.x)} / ${number(this.commandDestination.y)} / ${number(this.commandDestination.z)}`
    } else if (ownShip) {
      status = "Press M for atlas navigation"
    }

    this.text("#minimap-navigation-status", status)
  }

  updateCombatHud() {
    const ownShip = this.entities.get(this.selfId)
    if (ownShip) {
      this.text("#hud-hp", `${number(ownShip.hull)} / ${number(ownShip.maxHull)}`)
      this.text("#hud-shields", `${number(ownShip.shields)} / ${number(ownShip.maxShields)}`)
      this.setWidth("#hud-hp-bar", healthPercent(ownShip.hull, ownShip.maxHull))
      this.setWidth("#hud-shield-bar", healthPercent(ownShip.shields, ownShip.maxShields))
    }

    this.updateHotbar()
  }

  updateHotbar() {
    const ownShip = this.entities.get(this.selfId)
    const engaged = Boolean(ownShip?.engagedTargetId)
    const nextAttackTick = Number(ownShip?.nextAttackTick) || 0
    const cooldownTicks = Math.max(1, Number(ownShip?.attackCooldownTicks) || 1)
    const remainingTicks = Math.max(0, nextAttackTick - this.worldTick)
    const cooldownPercent = Math.min(100, remainingTicks / cooldownTicks * 100)

    for (const slot of this.root.querySelectorAll("[data-hotbar-slot]")) {
      const slotNumber = Number(slot.dataset.hotbarSlot)
      const hasAction = slot.dataset.actionId != null
      const action = {
        type: slot.dataset.actionType,
        activationMode: slot.dataset.activationMode,
      }
      const active = hasAction && hotbarActionActive(action, engaged)
      const coolingDown = hasAction && action.type === "ammunition" && remainingTicks > 0
      slot.classList.toggle("is-selected", slotNumber === this.selectedHotbarSlot)
      slot.classList.toggle("is-active", active)
      slot.classList.toggle("is-cooling-down", coolingDown)
      slot.setAttribute("aria-pressed", active ? "true" : "false")

      const cooldown = slot.querySelector("[data-hotbar-cooldown]")
      if (cooldown) cooldown.style.height = `${coolingDown ? cooldownPercent : 0}%`
    }

    this.text("#hotbar-mode", engaged ? "AUTOFIRE" : "STANDBY")
  }

  setWidth(selector, percentage) {
    const element = this.root.querySelector(selector)
    if (element) element.style.width = `${percentage}%`
  }

  setCombatMessage(message) {
    this.text("#combat-status", message)
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.stereoView?.resize(rect.width, rect.height, dpr)
  }

  updateFlightInputStatus() {
    const state = this.flightInputState()
    if (state === this.lastFlightInputState) return
    this.lastFlightInputState = state
    this.root.dataset.flightInputState = state
    const panel = this.root.querySelector("#cockpit-flight-input-status")
    if (!panel) return
    panel.hidden = state === "ready" || state === "atlas"
    if (panel.hidden) return
    const label = this.root.querySelector("#cockpit-flight-input-reason")
    if (label) label.textContent = this.shipWalkPose
      ? "AUTOPILOT ACTIVE · WALKING ABOARD"
      : FLIGHT_INPUT_LABELS[state] || "FLIGHT INPUT PAUSED"
    const takeHelm = this.root.querySelector("#cockpit-take-helm")
    if (takeHelm) takeHelm.hidden = state !== "cruise" || Boolean(this.shipWalkPose)
    const walk = this.root.querySelector("#ship-walk-toggle")
    if (walk) walk.textContent = this.shipWalkPose ? "RETURN TO COCKPIT" : "WALK AROUND SHIP"
    const hint = this.root.querySelector("#ship-walk-hint")
    if (hint) hint.hidden = !this.shipWalkPose
  }

  // Faint line from the crosshair to the virtual-joystick deflection.
  // Laptop SVG only; the headset draws its own copy from mouseSteeringRelay().
  mouseSteeringCaptured() {
    return this.mouseSteeringEnabled &&
      (document.pointerLockElement === this.canvas || this.mouseFallback) &&
      Boolean(this.flightControls?.active()) && !this.navComputer?.isOpen
  }

  // Stick deflection for the SBS headset line, or null when not steering.
  // Presentation only: it rides the LAN visual pose, never Phoenix.
  mouseSteeringRelay() {
    const width = this.canvas?.clientWidth
    const height = this.canvas?.clientHeight
    if (!this.mouseSteeringCaptured() || !(width > 0) || !(height > 0)) return null
    const {x, y} = this.mouseSteering.deflection()
    return {x, y, aspect: width / height}
  }

  drawMouseSteeringVector() {
    const svg = this.mouseSteeringVector
    if (!svg) return
    const captured = this.mouseSteeringCaptured()
    const vector = mouseSteeringVector(this.mouseSteering.deflection(),
      this.canvas?.clientWidth, this.canvas?.clientHeight)
    const show = captured && vector.visible
    // SVG elements have no .hidden property; toggle the attribute itself.
    if (svg.hasAttribute("hidden") === show) svg.toggleAttribute("hidden", !show)
    if (!show) return
    const line = svg.querySelector("#mouse-steering-vector-line")
    const gradient = svg.querySelector("#mouse-steering-vector-gradient")
    const stop = svg.querySelector("#mouse-steering-vector-tip")
    for (const node of [line, gradient]) {
      node?.setAttribute("x1", vector.x1)
      node?.setAttribute("y1", vector.y1)
      node?.setAttribute("x2", vector.x2)
      node?.setAttribute("y2", vector.y2)
    }
    stop?.setAttribute("stop-opacity", vector.opacity.toFixed(3))
  }

  enableNativeMouseFallback() {
    if (this.root.dataset.nativeClient !== "true" ||
        !this.mouseSteeringEnabled || !this.flightControls?.active()) return false
    this.mouseFallback = true
    this.mouseFallbackPoint = null
    this.mouseCaptureLost = false
    this.flightControls.setMouseMode(true)
    this.updateMouseSteeringStatus()
    return true
  }

  setupMouseSteering() {
    // Both cockpit and Atlas use one saved setting and update each other's
    // controls immediately. The server enforces the final angular rate cap.
    const toggles = ["#nav-mouse-steering", "#cockpit-mouse-steering"]
      .map(id => this.root.querySelector(id)).filter(Boolean)
    const sliders = ["#nav-mouse-sensitivity", "#cockpit-mouse-sensitivity"]
      .map(id => this.root.querySelector(id)).filter(Boolean)
    const outputs = ["#nav-mouse-sensitivity-value", "#cockpit-mouse-sensitivity-value"]
      .map(id => this.root.querySelector(id)).filter(Boolean)
    const syncSensitivity = () => {
      for (const slider of sliders) {
        slider.value = String(Math.round(this.mouseSteeringSensitivity * 100))
      }
      for (const output of outputs) {
        output.textContent = this.mouseSteeringSensitivity.toFixed(1) + " / 10"
      }
    }
    for (const toggle of toggles) toggle.checked = this.mouseSteeringEnabled
    syncSensitivity()
    const localCamera = this.root.querySelector("#cockpit-client-led-mouse-camera")
    if (localCamera) {
      localCamera.checked = this.clientLedCameraEnabled
      localCamera.addEventListener("change", () => {
        this.clientLedCameraEnabled = localCamera.checked
        localStorage.setItem(this.clientLedCameraKey, localCamera.checked ? "1" : "0")
        this.clientLedCamera.reset()
        this.ownShipCameraReconciler.reset()
      })
    }
    const frameSampling = this.root.querySelector("#cockpit-mouse-frame-sampling")
    if (frameSampling) {
      frameSampling.checked = this.mouseFrameSamplingEnabled
      frameSampling.addEventListener("change", () => {
        this.mouseFrameSamplingEnabled = frameSampling.checked
        localStorage.setItem(this.mouseFrameSamplingKey, frameSampling.checked ? "1" : "0")
        this.mouseFrameSampler.clear()
        this.mouseSteering.release()
        this.flightControls?.setMouseSteering({yaw:0,pitch:0})
        this.flightInputHistory?.record(performance.now(), this.flightControls.axes())
      })
    }
    for (const slider of sliders) slider.addEventListener("input", () => {
      const sensitivity = Number(slider.value) / 100
      if (!validMouseSensitivity(sensitivity)) return
      this.mouseSteeringSensitivity = sensitivity
      this.mouseSteering.sensitivity = sensitivity
      localStorage.setItem(this.mouseSensitivityKey, String(sensitivity))
      syncSensitivity()
    })
    for (const toggle of toggles) toggle.addEventListener("change", () => {
      this.mouseSteeringEnabled = toggle.checked
      localStorage.setItem(this.mouseSteeringKey, toggle.checked ? "1" : "0")
      for (const other of toggles) other.checked = this.mouseSteeringEnabled
      if (!toggle.checked) this.exitMouseSteering({silent: this.navComputer?.isOpen})
      this.updateMouseSteeringStatus()
    })

    this.canvas.addEventListener("pointerdown", event => {
      if (!this.mouseSteeringEnabled || event.button !== 0 ||
          document.pointerLockElement === this.canvas ||
          this.navComputer?.isOpen || this.inSystemCruise() ||
          !this.flightControls.active()) return

      // A direct cockpit click is required by the browser for pointer lock.
      // Consume this FIRST click so it never selects a target accidentally.
      event.preventDefault()
      event.stopImmediatePropagation()
      this.canvas.focus({preventScroll: true})
      if (!this.canvas.requestPointerLock) {
        if (!this.enableNativeMouseFallback()) {
          this.mouseSteeringMessage("Pointer lock unavailable; keyboard steering remains active.")
        }
        return
      }
      try {
        this.mouseCaptureLost = false
        const request = this.canvas.requestPointerLock()
        request?.catch?.(() => {
          if (!this.enableNativeMouseFallback()) {
            this.mouseSteeringMessage("Mouse capture was denied. Click the cockpit to retry.")
          }
        })
        // Some Linux webviews neither reject nor dispatch pointerlockerror.
        // Fall back to bounded hover deltas only in the native client.
        window.setTimeout(() => {
          if (document.pointerLockElement !== this.canvas) this.enableNativeMouseFallback()
        }, 450)
      } catch (_error) {
        if (!this.enableNativeMouseFallback()) {
          this.mouseSteeringMessage("Mouse capture unavailable; keyboard steering remains active.")
        }
      }
    }, true)

    document.addEventListener("mousemove", event => {
      if (!this.mouseSteeringEnabled || this.navComputer?.isOpen ||
          this.inSystemCruise() || !this.flightControls.active()) return
      const captured = document.pointerLockElement === this.canvas
      if (!captured && (!this.mouseFallback || event.target !== this.canvas)) return
      let dx = event.movementX
      let dy = event.movementY
      if (!captured) {
        // Unlocked WebKit mousemove deltas are not consistently populated.
        // Use bounded cursor displacement with a fresh first-point baseline.
        const point = {x: event.clientX, y: event.clientY}
        if (!this.mouseFallbackPoint) {
          this.mouseFallbackPoint = point
          return
        }
        dx = point.x - this.mouseFallbackPoint.x
        dy = point.y - this.mouseFallbackPoint.y
        this.mouseFallbackPoint = point
      }
      // Zero-delta browser events must not extend steering beyond the
      // last physical movement. In particular, do not restart the timer.
      if (!Number.isFinite(dx) || !Number.isFinite(dy) ||
          (dx === 0 && dy === 0)) return
      const receivedAt = performance.now()
      this.mouseTimingProbe.mouse(receivedAt)
      if (this.mouseFrameSamplingEnabled) {
        this.mouseFrameSampler.push(dx, dy)
      } else {
        this.applyDesktopMouseDelta(dx, dy, receivedAt)
      }
    })
    this.canvas.addEventListener("mouseleave", () => {
      if (!this.mouseFallback) return
      // The fallback never keeps steering after the cursor leaves the deck.
      this.exitMouseSteering()
    })
    document.addEventListener("pointerlockchange", () => {
      const pointerLocked = this.mouseSteeringEnabled &&
        document.pointerLockElement === this.canvas
      if (pointerLocked) {
        this.mouseFallback = false
        this.mouseFallbackPoint = null
      }
      const captured = pointerLocked || this.mouseFallback
      if (captured) {
        this.mouseCaptureLost = false
      } else if (this.mouseSteeringEnabled && !this.navComputer?.isOpen &&
                 !this.inSystemCruise()) {
        // A lost pointer lock is an actual input pause, not a lost setting.
        // The browser requires another physical click before recapturing.
        this.mouseCaptureLost = true
      }
      // Use the faster mouse-only angular rate profile on the server ONLY
      // during pointer capture, reverting when the cursor is released.
      if (!captured) {
        this.clientLedCamera.reset()
        this.mouseFrameSampler.clear()
        this.mouseSteering.release()
        this.flightControls.clearMouseSteering({silent: true})
      }
      this.flightControls.setMouseMode(captured, {
        silent: Boolean(this.navComputer?.isOpen || this.inSystemCruise()),
      })
      this.updateMouseSteeringStatus()
    })
    document.addEventListener("pointerlockerror", () => {
      if (!this.enableNativeMouseFallback()) {
        this.mouseSteeringMessage("Mouse capture failed. Try clicking the cockpit again.")
      }
    })

    // Escape first releases the cursor rather than accidentally disengaging
    // combat; M still opens Atlas, which releases the mouse automatically.
    window.addEventListener("keydown", event => {
      if (event.code !== "Escape" ||
          (document.pointerLockElement !== this.canvas && !this.mouseFallback)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      this.exitMouseSteering()
    }, true)
    this.updateMouseSteeringStatus()
  }

  applyDesktopMouseDelta(dx, dy, time = performance.now()) {
    const axes = this.mouseSteering.move(dx, dy)
    this.flightControls.setMouseSteering(axes)
    this.flightInputHistory?.record(time, this.flightControls.axes())
  }

  updateDesktopMouseTiming(time) {
    if (time - this.lastMouseTimingReport < 1000) return
    this.lastMouseTimingReport = time
    // Refresh the SBS stick-link note once a second while steering.
    if (this.mouseSteeringCaptured()) this.updateMouseSteeringStatus()
    const stats = this.mouseTimingProbe.summary()
    const panel = this.root.querySelector("#cockpit-mouse-jitter-metrics")
    if (!panel) return
    const fmt = n => n ? n.toFixed(1) + "ms" : "—"
    const captured = document.pointerLockElement === this.canvas
      ? "POINTER LOCK" : this.mouseFallback ? "NATIVE FALLBACK" : "NOT CAPTURED"
    panel.textContent = (this.mouseFrameSamplingEnabled ? "FRAME-SAMPLED" : "EVENT-DRIVEN") +
      " · " + captured + " · mouse gap p95 " + fmt(stats.mouseP95Ms) +
      " · frame gap p95 " + fmt(stats.frameP95Ms) +
      " · server camera corrections " + stats.serverCorrections + "/s" +
      (this.clientLedCameraEnabled ? " · CLIENT CAMERA" +
        (Number.isFinite(this.clientLedCameraDelta)
          ? " · server diff " + this.clientLedCameraDelta.toFixed(1) + "°"
          : "") +
        (this.clientLedCameraServerAlert ? " · LARGE DESYNC (VIEW UNCHANGED)" : "")
        : "")
  }

  mouseSteeringMessage(message) {
    const node = this.root.querySelector("#cockpit-mouse-steering-status")
    if (!node || !this.mouseSteeringEnabled) return
    node.hidden = false
    node.textContent = message
  }

  updateMouseSteeringStatus() {
    const node = this.root.querySelector("#cockpit-mouse-steering-status")
    if (!node) return
    node.hidden = !this.mouseSteeringEnabled || Boolean(this.navComputer?.isOpen)
    if (node.hidden) return
    const captured = document.pointerLockElement === this.canvas || this.mouseFallback
    // Whether the headset steering line is being fed right now.
    const sbs = this.root.dataset.nativeClient !== "true" ? "" :
      performance.now() - (this.lastSteeringRelayAt ?? -Infinity) < 500
        ? " · SBS STICK SENT"
        : this.helmet?.status?.rendering ? " · SBS STICK NOT SENT"
          : " · SBS HEADSET NOT RENDERING"
    node.textContent = this.mouseFallback
      ? "MOUSE STEERING ACTIVE · NATIVE FALLBACK · ESC RELEASES" + sbs
      : captured
        ? "MOUSE STEERING ACTIVE · MOVE TO PITCH/YAW · ESC RELEASES" + sbs
      : this.mouseCaptureLost
        ? "MOUSE STEERING PAUSED · CLICK COCKPIT TO RESUME"
        : "MOUSE STEERING ENABLED · CLICK COCKPIT TO CAPTURE"
  }

  exitMouseSteering({silent = false} = {}) {
    this.clientLedCamera.reset()
    this.mouseFrameSampler.clear()
    this.mouseFallback = false
    this.mouseFallbackPoint = null
    this.mouseSteering.release()
    this.flightControls?.clearMouseSteering({silent: true})
    this.flightControls?.setMouseMode(false, {silent})
    if (this.flightControls) {
      this.flightInputHistory?.record(performance.now(), this.flightControls.axes())
    }
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.()
    this.updateMouseSteeringStatus()
  }

  handleHelmetAlignmentKey(event) {
    // Reserve calibration shortcuts in cockpit mode, whether or not the
    // headset is already rendering. Arrow keys must never scroll the DOM.
    // No change is emitted for OS key-repeat, duplicates, text fields,
    // Atlas input, or a suspended/closed cockpit.
    const action = this.helmetAlignmentKeys.keyDown(event, {
      active: !this.navComputer?.isOpen && !this.solarEncounter,
      typing: gameplayTypingTarget(event.target),
    })
    if (!action.reserved) return
    event.preventDefault()
    event.stopPropagation()

    if (action.intent && this.helmet?.canAdjustAlignment())
      this.helmet.adjustAlignment(action.intent.axis, action.intent.direction)
  }

  handleDisplayModeKey(event) {
    // When the mouse owns flight steering, ignore accidental V presses that
    // would switch the cockpit view mid-maneuver. The header view selector and
    // V shortcut still work once the mouse is released with Escape.
    if (this.mouseSteeringEnabled && document.pointerLockElement === this.canvas &&
        (event.code === "KeyV" || event.key?.toLowerCase() === "v")) {
      event.preventDefault()
      return
    }
    if (event.defaultPrevented || this.navComputer?.isOpen) return
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.key.toLowerCase() !== "v") return
    const element = event.target
    if (element?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element?.tagName)) return
    event.preventDefault()
    this.setDisplayMode(nextFlightMode(this.displayMode))
  }

  setDisplayMode(mode) {
    if (!validFlightMode(mode)) return false
    if (mode !== "3d") this.leaveShipWalk()
    if (!this.stereoView) {
      try {
        this.stereoView = new StereoSpaceView(this.root.querySelector("#space-viewport-3d"))
      } catch (_error) {
        this.showError("WebGL is required for the 3D cockpit. Check browser GPU support.")
        const select = this.root.querySelector("#display-mode")
        if (select) select.value = "3d"
        return false
      }
    }
    this.navigation?.cancel()
    this.displayMode = mode
    this.root.dataset.displayMode = mode
    const select = this.root.querySelector("#display-mode")
    if (select) select.value = mode
    this.stereoView.setMode(mode)
    this.resize()
    return true
  }

  setConnection(label, state) {
    this.text("#connection-status", label)
    this.text("#atlas-connection-status", label)
    const atlas = this.root.querySelector("#atlas-connection-status")
    if (atlas) atlas.dataset.state = state
    const indicator = this.root.querySelector("#connection-indicator")
    indicator.className = state === "online"
      ? "size-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.8)]"
      : "size-1.5 rounded-full bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.8)]"
  }

  showError(message) {
    const element = this.root.querySelector("#game-error")
    element.textContent = message
    element.classList.remove("hidden")
    window.clearTimeout(this.errorTimer)
    this.errorTimer = window.setTimeout(() => element.classList.add("hidden"), 6000)
  }

  text(selector, value) {
    const element = this.root.querySelector(selector)
    if (element) element.textContent = value
  }
}

export const startGameClient = () => {
  const root = document.querySelector("#game-client")
  if (root) new SpaceClient(root).start()
}
