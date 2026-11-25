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
  assert.match(helmet, /this\.stationPosition = this\.docked\s*\?\s*map\.station_avatars\?\.find\(avatar => key\(avatar\.player_id\) === this\.selfId\) \|\| null\s*:\s*null/)
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

test("the phone hides the NAV switch and explains missing gyro", () => {
  assert.doesNotMatch(view, /^\s*framing\.add\(this\.navSwitch\)/m)
  assert.match(view, /new THREE\.PlaneGeometry\(1\.52, 0\.55\)/)
  assert.match(view, /HEAD TRACKING UNAVAILABLE/)
  // Driven by sensor status, not by a momentarily missing pose.
  assert.match(view, /this\.helmetGazeEnabled && this\.helmetTrackingUnavailable/)
  assert.doesNotMatch(view, /this\.helmetGazeEnabled && this\.helmetHeadRotation === null/)
  assert.match(helmet, /setHelmetTrackingUnavailable\(headTrackingUnavailable\(status\)\)/)
})

test("SBS resting gaze exposes only armed surrender and flight mode targets", () => {
  const target = view.slice(view.indexOf("  gazeTarget() {"), view.indexOf("  updateGazeFeedback("))
  assert.match(target, /const surrender = this\.helmetSurrenderArmed \?/)
  assert.match(target, /const mode = this\.helmetModeCurrent \? \[this\.helmetModeHitbox\] : \[\]/)
  assert.match(target, /:\s*\[\.\.\.surrender, \.\.\.mode\]\s*this\.camera\.updateMatrixWorld/)
  assert.doesNotMatch(target, /this\.navSwitch|this\.hudPanel|"hud_inspect"|"nav_open"/)
  assert.doesNotMatch(view, /^\s*framing\.add\(this\.navSwitch\)/m)
  assert.match(target, /candidates\.filter\(candidate => candidate\?\.visible\)/)
  assert.match(target, /return null\s*}/)
  assert.doesNotMatch(helmet, /channel\.push\("flight_controls"|"laser_attack"|"station_talk"/)
})

test("compact SBS geometry reduces telemetry and preserves gaze hit testing", () => {
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

test("a surrendered captain can be released or robbed by gaze", () => {
  const channel = readFileSync(new URL(
    "../../../lib/sunracer_web/channels/helmet_channel.ex", import.meta.url), "utf8")
  const world = readFileSync(new URL(
    "../../../../sunracer/lib/sunracer/world.ex", import.meta.url), "utf8")

  // Mid-fight prompt: additive, never exclusive, and below the sight line so
  // a pilot tracking a target cannot dwell on it by accident.
  assert.match(view, /this\.helmetSurrenderPanel\.position\.set\(0, -0\.44, -2\.44\)/)
  assert.match(view, /\[\.\.\.surrender, \.\.\.mode\]/)
  assert.match(view, /for \(const \[name, x\] of \[\["accept", -0\.58\], \["seize", 0\.0\]\]\)/)
  assert.match(view, /\.\.\.surrender\b/)
  assert.match(view, /if \(target === this\.helmetSurrenderButtons\?\.accept\) return "surrender_accept"/)
  assert.match(view, /if \(target === this\.helmetSurrenderButtons\?\.seize\) return "surrender_seize"/)
  assert.doesNotMatch(view, /return "surrender_dismiss"/)

  // A wreck outranks a surrender prompt: dying closes it.
  assert.match(view, /this\.setHelmetSurrenderChoice\(\{open: false\}\)/)

  // The dismiss gaze action is removed; both remaining choices are server-owned.
  assert.doesNotMatch(helmet, /update\.activated === "surrender_dismiss"/)
  assert.doesNotMatch(helmet, /this\.surrenderDismissed = true/)
  assert.match(helmet, /requestSurrenderOutcome\("solar_accept_surrender"\)/)
  assert.match(helmet, /requestSurrenderOutcome\("solar_seize_cargo"\)/)
  assert.match(helmet, /old\.push\(event, \{\}, 5_000\)/)

  // Server: the phone names no encounter. The session does.
  assert.match(channel, /def handle_in\("solar_accept_surrender", _payload,/)
  assert.match(channel, /def handle_in\("solar_seize_cargo", _payload,/)
  assert.match(channel, /settle_surrender\(socket, player_id, claim_cargo: true\)/)
  assert.match(world, /def settle_surrender_for_player\(player_id, opts/)
  assert.match(world, /SessionManager\.fetch_player\(SessionManager, player_id\)/)
  assert.match(world, /solar_finish_tactical\(session\.id, encounter_id, :surrender, opts\)/)
})

test("the flight mode icon is an intent relayed to the laptop, not a command", () => {
  const channel = readFileSync(new URL(
    "../../../lib/sunracer_web/channels/helmet_channel.ex", import.meta.url), "utf8")
  const manager = readFileSync(new URL(
    "../../../lib/sunracer_web/helmet_manager.ex", import.meta.url), "utf8")
  const control = js("./helmet_control.mjs")
  const laptop = js("./client.js")
  const flight = js("./flight_controls.mjs")

  // The headset asks over its own channel and never sends flight controls.
  assert.match(helmet, /old\.push\("helmet_action", \{action\}, 5_000\)/)
  assert.doesNotMatch(helmet, /channel\.push\("flight_controls"|"laser_attack"/)
  assert.match(view, /this\.helmetModeHitbox = new THREE\.Mesh\(/)
  assert.match(view, /if \(target === this\.helmetModeHitbox\) return MODE_GAZE_TARGET/)
  assert.match(helmet, /nextFlightMode\(this\.entities\.get\(this\.selfId\)\?\.flightMode\)/)

  // The server relays a name from an allowlist, only while in the cockpit.
  assert.match(channel, /def handle_in\("helmet_action", %\{"action" => action\}/)
  assert.match(manager, /@gaze_actions ~w\(toggle_flight_mode select_cruise_mode select_newtonian_mode\)/)
  assert.match(manager, /def gaze_action\(_player_id, _action\), do: \{:error, :unknown_action\}/)
  assert.match(manager, /Map\.get\(state\.modes, player_id\) == :combat/)

  // The laptop applies it through the same control the keyboard drives.
  assert.match(control, /this\.channel\.on\("helmet_gaze_action"/)
  assert.match(laptop, /if \(action === "toggle_flight_mode"\) this\.flightControls\?\.toggleMode\(\)/)
  assert.match(laptop, /if \(action === "select_cruise_mode"\) this\.flightControls\?\.setMode\("cruise"\)/)
  assert.match(laptop, /if \(action === "select_newtonian_mode"\) this\.flightControls\?\.setMode\("newtonian"\)/)
  assert.match(flight, /toggleMode\(\) \{/)
  assert.match(flight, /if \(!event\.repeat\) this\.toggleMode\(\)/)
})
