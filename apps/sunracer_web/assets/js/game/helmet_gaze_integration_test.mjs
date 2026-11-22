import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const js = name => readFileSync(new URL(name, import.meta.url), "utf8")
const phone = readFileSync(new URL(
  "../../../lib/sunracer_web/controllers/helmet_html/show.html.heex", import.meta.url), "utf8")
const view = js("./stereo_view.js")
const helmet = js("./helmet_client.mjs")
const gaze = js("./helmet_gaze_dwell.mjs")

test("cockpit remains anchored to ship rather than following the HMD head", () => {
  assert.match(view, /this\.cockpitFraming\s*=\s*framing/)
  assert.match(view, /this\.scene\.add\(framing\)/)
  assert.match(view, /this\.cockpitFraming\.position\.copy\(this\.camera\.position\)/)
  assert.match(view, /this\.cockpitFraming\.quaternion\.copy\(this\.camera\.quaternion\)/)
  assert.match(view, /this\.camera\.quaternion\.multiply\(this\.helmetHeadRotation\)/)
  assert.doesNotMatch(view, /this\.camera\.add\(framing\)/)
})

test("helmet has explicit sensor permission, read-only local controls and recenter", () => {
  assert.match(phone, /id="helmet-fullscreen"/)
  assert.match(phone, /id="helmet-relay-result"/)
  assert.doesNotMatch(phone, /id="helmet-relay-test"|id="helmet-relay-url"|id="helmet-relay-submit"/)
  assert.match(phone, /id="helmet-tracking-status"/)
  assert.doesNotMatch(phone, /id="helmet-enable-tracking"|id="helmet-recenter-tracking"/)
  assert.match(helmet, /void this\.headTracking\.startFromGesture\(\)/)
  assert.match(helmet, /new HelmetHeadTracking\(/)
  assert.match(helmet, /new HelmetGazeDwell\(/)
  assert.match(helmet, /this\.view\.setHelmetHeadRotation\(this\.headTracking\.rotation\(time\)\)/)
  assert.match(helmet, /this\.headTracking\.requestRecenter\(\)/)
  assert.match(helmet, /this\.channel\.on\("helmet_recenter"/)
  assert.match(helmet, /this\.root\.addEventListener\("pointerdown", recenterFromScreenTap, true\)/)
  assert.match(helmet, /this\.root\.addEventListener\("click", recenterFromScreenTap, true\)/)
  assert.match(helmet, /this\.recenterFromPilot\(\)/)
  assert.match(helmet, /update\.activated === "nav_open"/)
  assert.match(helmet, /update\.activated === "nav_close"/)
  assert.match(helmet, /update\.activated === "recenter"/)
  assert.match(view, /this\.setHelmetNavOpen\(this\.helmetGazeEnabled && this\.helmetNavOpen\)/)
  assert.match(view, /this\.raycaster\.intersectObjects\(/)
  assert.match(view, /this\.helmetNavRecenter/)
  assert.match(view, /this\.camera\.add\(this\.gazeArc\)/)
  assert.match(gaze, /GAZE_ARM_MS = 1_000/)
  assert.match(gaze, /GAZE_CONFIRM_MS = 800/)
  assert.doesNotMatch(helmet, /channel\.push\("station_dock"|"station_launch"|"flight_controls"/)
})

test("the five-second docking countdown is rendered in both SBS eyes", () => {
  assert.match(view, /this\.updateDockingCountdown\(docked \? null : client\.stationDockingSeconds\)/)
  assert.match(view, /this\.dockingCountdownMesh\.visible = visible/)
  assert.match(view, /this\.dockingCountdownTexture\.needsUpdate = true/)
  assert.match(helmet, /this\.channel\.on\("station_docking_started"/)
  assert.match(helmet, /this\.stationDockingSeconds = this\.docked \? null/)
  assert.doesNotMatch(helmet, /channel\.push\("station_dock"/)
})

test("the SBS viewer receives the immutable kiosk roster without station authority", () => {
  assert.match(helmet, /this\.stationAttendants = Array\.isArray\(map\.station_attendants\)/)
  assert.match(view, /this\.hangar\.update\(client\.stationPosition, time, client\.stationAttendants\)/)
  assert.doesNotMatch(helmet, /channel\.push\("station_talk"/)
})

test("desktop and SBS render the same server-owned walking pose", () => {
  assert.match(view, /const position = client\.stationPosition/)
  // The viewport now interpolates the server-owned walking pose instead of
  // snapping straight to the latest 100-ms network snapshot.
  assert.match(view, /this\.camera\.position\.set\(this\.stationViewPose\.x, 2\.6, this\.stationViewPose\.z\)/)
  assert.match(view, /this\.camera\.rotation\.set\(0, -this\.stationViewPose\.yaw, 0, "YXZ"\)/)
  assert.match(view, /this\.stationViewPose\.x \+= \(targetX - this\.stationViewPose\.x\) \* blend/)
  assert.match(view, /this\.camera\.quaternion\.multiply\(this\.helmetHeadRotation\)/)
  assert.match(helmet, /this\.stationPosition = this\.docked \?/)
  assert.doesNotMatch(helmet, /channel\.push\("station_walk"|"station_look"/)
})

test("the 3D docking hangar is driven by server-replicated state, not an HMD command", () => {
  assert.match(view, /const docked = greenStarbaseInteriorVisible\(client\)/)
  assert.match(view, /const activeScene = docked \? this\.hangarScene : this\.scene/)
  assert.match(view, /this\.camera\.quaternion\.multiply\(this\.helmetHeadRotation\)/)
  assert.match(view, /this\.onHelmetGaze\(docked \? null : this\.gazeTarget\(\), time\)/)
  assert.match(helmet, /this\.docked = pilotDockedInWorld\(map, this\.selfId\)/)
  assert.doesNotMatch(helmet, /channel\.push\("station_dock"|"station_launch"/)
})

test("native desktop starts with ALL headset-only meshes hidden", () => {
  // Three.js treats visible=undefined as visible. Initialize opt-in state
  // BEFORE addCockpit creates/synchronizes its meshes, not afterwards.
  const constructor = view.slice(view.indexOf("constructor(canvas)"), view.indexOf("  addStars()"))
  assert.ok(constructor.indexOf("this.helmetGazeEnabled = false") >= 0)
  assert.ok(constructor.indexOf("this.helmetGazeEnabled = false") <
    constructor.indexOf("this.addCockpit()"))
  assert.ok(constructor.indexOf("this.helmetNavOpen = false") <
    constructor.indexOf("this.addCockpit()"))
  assert.ok(constructor.indexOf("this.helmetHeadRotation = null") <
    constructor.indexOf("this.addCockpit()"))
  for (const mesh of ["navSwitch", "helmetNavPanel", "helmetNavClose",
    "helmetNavRecenter", "gazeReticle", "helmetTrackingHint"]) {
    assert.match(view, new RegExp("this\\." + mesh + "\\.visible =\\s*\\n?\\s*Boolean\\("))
  }
  assert.match(view, /this\.setHelmetNavOpen\(false\)/)
  assert.match(view, /this\.setHelmetHeadRotation\(null\)/)
})

test("the phone renders an accessible NAV target and explains missing gyro", () => {
  assert.match(view, /this\.navSwitch\.position\.set\(1\.24, -0\.68, -2\.46\)/)
  assert.match(view, /new THREE\.PlaneGeometry\(1\.52, 0\.55\)/)
  assert.match(view, /HEAD TRACKING UNAVAILABLE/)
  // Driven by sensor status, not by a momentarily missing pose.
  assert.match(view, /this\.helmetGazeEnabled && this\.helmetTrackingUnavailable/)
  assert.doesNotMatch(view, /this\.helmetGazeEnabled && this\.helmetHeadRotation === null/)
  assert.match(helmet, /setHelmetTrackingUnavailable\(headTrackingUnavailable\(status\)\)/)
})

test("HUD gaze inspects read-only flight, contacts and space pages", () => {
  assert.match(view, /\[this\.navSwitch, this\.hudPanel\]/)
  assert.match(view, /return target === this\.hudPanel \? "hud_inspect"/)
  for (const key of ["hud_inspect", "hud_flight", "hud_contacts", "hud_space"]) {
    assert.ok(helmet.includes('"' + key + '"'))
  }
  for (const key of ["helmetNavFlight", "helmetNavContacts", "helmetNavSpace"]) {
    assert.match(view, new RegExp(key))
  }
  assert.match(view, /updateHelmetHudPanel\(client, time\)/)
  assert.match(view, /this\.helmetNavClose\.position\.set\(0\.58, 0\.66/)
  assert.match(view, /this\.helmetNavRecenter\.position\.set\(-0\.58, 0\.66/)
  assert.doesNotMatch(helmet, /channel\.push\("flight_controls"|"laser_attack"|"station_talk"/)
})

test("the phone SBS meter lives above WebGL in both eyes, independent of gyro", () => {
  assert.match(phone, /id="helmet-bandwidth-sbs"/)
  assert.equal((phone.match(/data-helmet-bandwidth-eye/g) || []).length, 2)
  assert.match(helmet, /renderHelmetBandwidth\(this\.root,/)
  assert.match(helmet, /bandwidthOverlay\.hidden = false/)
  assert.match(helmet, /bandwidthOverlay\.hidden = true/)
  assert.match(helmet, /this\.updateSbsBandwidth\(time\)/)
  assert.match(helmet, /snapshot\(HELMET_BANDWIDTH_HUD\.windowMs\)/)
  assert.doesNotMatch(view, /this\.camera\.add\(this\.helmetBandwidthHud\)/)
  assert.doesNotMatch(view, /updateHelmetBandwidth\(client\.bandwidth, time\)/)
  // The overlay measures an EXISTING channel; no additional connection.
  assert.doesNotMatch(helmet, /new WebSocket\(/)
})

test("compact SBS geometry reduces telemetry and never blocks the NAV hitbox", () => {
  assert.match(view, /this\.mode === "sbs" \? 0\.55 : 0\.75/)
  assert.match(view, /new THREE\.PlaneGeometry\(0\.50, 0\.25\)/)
  assert.match(view, /new THREE\.PlaneGeometry\(1\.52, 0\.55\)/)
  assert.match(view, /new THREE\.PlaneGeometry\(0\.44, 0\.22\)/)
  assert.match(view, /this\.raycaster\.intersectObjects\(/)
})

test("phone has one main VR action; local link tests automatically after QR pairing", () => {
  assert.match(phone, /ENTER VR/)
  assert.doesNotMatch(phone, /TEST LOCAL RELAY|PASTE LINK FROM TAURI/)
  assert.match(phone, /id="helmet-relay-result" hidden/)
  assert.match(helmet, /relayInvitationFromQR\(window\.location\.href\)/)
  assert.match(helmet, /this\.localLink\.prove\(relayInvitation\)/)
  assert.match(phone, /id="helmet-windowed" hidden/)
  assert.doesNotMatch(phone, /ENABLE HEAD TRACKING|RECENTER VIEW|NET · BANDWIDTH/)
  assert.doesNotMatch(phone, /Lens calibration uses|In the cockpit, look right/)
  const controls = helmet.slice(helmet.indexOf("setupImmersiveControls() {"),
    helmet.indexOf("  recenterFromPilot() {"))
  assert.ok(controls.indexOf("this.headTracking.startFromGesture()") >= 0)
  assert.ok(controls.indexOf("this.headTracking.startFromGesture()") <
    controls.indexOf("await this.root.requestFullscreen()"))
  assert.match(helmet, /attachHelmetRelayTest\(this\.root, \{/)
  assert.match(helmet, /onWorld: frame => this\.acceptLocalWorld\(frame\)/)
  assert.match(helmet, /onOffline: \(\) => this\.disableLocalRelay\(\)/)
})

test("LAN world cutover is contingent on valid world state and supports Phoenix fallback", () => {
  assert.match(helmet, /if \(!this\.localRelayActive\)/)
  assert.match(helmet, /this\.channel\.push\("relay_stream_mode", \{mode: "local"\}/)
  assert.match(helmet, /this\.channel\.push\("relay_stream_mode", \{mode: "phoenix"\}/)
  assert.match(helmet, /map\.entities\.some\(e => key\(e\.id\) === this\.selfId\)/)
  assert.match(helmet, /this\.localRelayLastSeen > 10_000/)
  assert.match(helmet, /pilotDockedInWorld\(map, this\.selfId\)/)
  assert.doesNotMatch(helmet, /channel\.push\("flight_controls"|"laser_attack"|"station_talk"/)
})

test("a destroyed pilot can recover by gaze alone", () => {
  const channel = readFileSync(new URL(
    "../../../lib/sunracer_web/channels/helmet_channel.ex", import.meta.url), "utf8")

  // The wreck panel is the only thing selectable: a pilot who has just died
  // must not be able to open the nav panel by looking slightly off-centre.
  assert.match(view, /this\.helmetDestroyed \?\s*\n?\s*\(this\.helmetRespawnArmed \? \[this\.helmetRespawnButton\] : \[\]\)/)
  assert.match(view, /if \(target === this\.helmetRespawnButton\) return "respawn"/)
  assert.match(view, /this\.helmetNavOpen = open === true && !this\.helmetDestroyed/)

  // Client wiring: gaze activation pushes the request, and nothing else does.
  assert.match(helmet, /update\.activated === "respawn"/)
  assert.match(helmet, /old\.push\("respawn", \{\}, 10_000\)/)
  assert.match(helmet, /setHelmetDestroyed/)

  // A held gaze must not fire twice: requestRespawn guards on respawnPending,
  // and helmetRespawnView disarms the target while a request is in flight.
  assert.match(helmet, /if \(this\.respawnPending \|\| this\.channel\?\.state !== "joined"/)

  // Server: scoped to the authenticated viewer, taking nothing from the phone.
  assert.match(channel, /def handle_in\("respawn", _payload,/)
  assert.match(channel, /helmet_role: :viewer, helmet_player_id: player_id/)
  assert.match(channel, /SessionManager\.fetch_player\(SessionManager, player_id\)/)
  assert.match(channel, /World\.respawn\(session\.id\)/)

  // Still no flight, combat or ship commands on this channel.
  assert.doesNotMatch(helmet,
    /channel\.push\("move"|"plot_course"|"fire"|"set_target"|"station_dock"/)
})
