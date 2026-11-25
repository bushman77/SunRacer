import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {
  MouseSteering, joystickAxis, mouseSteeringVector,
  MOUSE_STEERING_DEAD_ZONE, MOUSE_STEERING_CURVE,
  MOUSE_STEERING_DEFAULT_SENSITIVITY,
  validMouseSensitivity, enabledMouseSteering,
  relaySteering, steeringLineTip, COCKPIT_VERTICAL_FOV_DEG,
} from "./mouse_steering.mjs"
import {FlightControls} from "./flight_controls.mjs"

const read = path => readFileSync(new URL(path, import.meta.url), "utf8")
const screen = (width = 1000, height = 600) => () => ({width, height})
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`)

test("native default and saved opt-out are preserved", () => {
  assert.equal(enabledMouseSteering(null, true), true)
  assert.equal(enabledMouseSteering(null, false), false)
  assert.equal(enabledMouseSteering("0", true), false)
  assert.equal(enabledMouseSteering("1", false), true)
})

test("sensitivity range and 1:1 default", () => {
  assert.equal(MOUSE_STEERING_DEFAULT_SENSITIVITY, 1.0)
  assert.equal(validMouseSensitivity(0.4), true)
  assert.equal(validMouseSensitivity(10), true)
  assert.equal(validMouseSensitivity(10.1), false)
  assert.equal(validMouseSensitivity(0.39), false)
  assert.equal(validMouseSensitivity(NaN), false)
})

test("stick curve has a centre dead zone, is odd, and reaches full at the edge", () => {
  assert.equal(joystickAxis(0), 0)
  assert.equal(joystickAxis(MOUSE_STEERING_DEAD_ZONE), 0)
  assert.equal(joystickAxis(-MOUSE_STEERING_DEAD_ZONE), 0)
  assert.equal(joystickAxis(1), 1)
  assert.equal(joystickAxis(-1), -1)
  assert.equal(joystickAxis(5), 1)
  near(joystickAxis(-0.5), -joystickAxis(0.5))
  const half = Math.pow((0.5 - MOUSE_STEERING_DEAD_ZONE) /
    (1 - MOUSE_STEERING_DEAD_ZONE), MOUSE_STEERING_CURVE)
  near(joystickAxis(0.5), half)
  // Fine aim near centre: half deflection is well under half turn rate.
  assert.ok(joystickAxis(0.5) < 0.5)
  assert.ok(joystickAxis(0.9) > joystickAxis(0.5))
})

test("the whole screen is the stick: half-width of travel is full yaw", () => {
  const stick = new MouseSteering({span: screen(1000, 600)})
  stick.move(250, 0)
  near(stick.deflection().x, 0.5)
  stick.move(250, 0)
  assert.deepEqual(stick.axes(), {yaw: 1, pitch: 0})
  stick.move(5000, 0)
  assert.equal(stick.deflection().x, 1)
  stick.move(-1000, 0)
  assert.equal(stick.deflection().x, -1)
  assert.equal(stick.axes().yaw, -1)
})

test("mouse up pitches nose up and uses the vertical half-span", () => {
  const stick = new MouseSteering({span: screen(1000, 600)})
  stick.move(0, -300)
  assert.equal(stick.deflection().y, -1)
  assert.deepEqual(stick.axes(), {yaw: 0, pitch: 1})
  stick.move(0, 600)
  assert.deepEqual(stick.axes(), {yaw: 0, pitch: -1})
})

test("deflection persists with no events: no idle timer can stop the turn", () => {
  const stick = new MouseSteering({span: screen()})
  const turning = stick.move(300, 0)
  assert.ok(turning.yaw > 0)
  // Nothing time-based exists any more; reading axes later is unchanged.
  assert.equal(typeof stick.expire, "undefined")
  assert.equal(typeof stick.stopDelayMs, "undefined")
  assert.deepEqual(stick.axes(), turning)
  // Zero and invalid packets do not move or stop the stick.
  assert.deepEqual(stick.move(0, 0), turning)
  assert.deepEqual(stick.move(NaN, 4), turning)
})

test("irregular packet timing and splitting give the identical command", () => {
  const a = new MouseSteering({span: screen()})
  const b = new MouseSteering({span: screen()})
  a.move(120, -45)
  for (const [dx, dy] of [[1, 0], [0, -1], [40, -20], [0, 0], [79, -24]]) b.move(dx, dy)
  assert.deepEqual(a.axes(), b.axes())
})

test("single-axis packets during a diagonal do not release the other axis", () => {
  const stick = new MouseSteering({span: screen()})
  stick.move(200, -200)
  const before = stick.axes()
  stick.move(3, 0)
  assert.ok(stick.axes().pitch === before.pitch && stick.axes().pitch > 0)
})

test("moving back to centre stops; release recentres", () => {
  const stick = new MouseSteering({span: screen()})
  stick.move(300, 120)
  stick.move(-300, -120)
  assert.deepEqual(stick.axes(), {yaw: 0, pitch: 0})
  stick.move(400, 0)
  assert.deepEqual(stick.release(), {yaw: 0, pitch: 0})
  assert.deepEqual(stick.deflection(), {x: 0, y: 0})
})

test("sensitivity scales travel; unmeasured surfaces use a fallback span", () => {
  const fast = new MouseSteering({sensitivity: 2, span: screen(1000, 600)})
  fast.move(125, 0)
  near(fast.deflection().x, 0.5)
  const unsized = new MouseSteering({span: () => ({width: 0, height: undefined})})
  unsized.move(320, 0)
  near(unsized.deflection().x, 0.5)
  assert.equal(new MouseSteering({sensitivity: 99}).sensitivity, 1)
})

test("steering vector starts at the crosshair and ends at the deflection", () => {
  const v = mouseSteeringVector({x: 0.5, y: -1}, 800, 400)
  assert.equal(v.visible, true)
  assert.equal(v.x1, 400)
  assert.equal(v.y1, 200)
  assert.equal(v.x2, 600)
  assert.equal(v.y2, 0)
  near(v.opacity, 0.15 + 0.35)
  assert.equal(mouseSteeringVector({x: 0.01, y: 0}, 800, 400).visible, false)
  assert.equal(mouseSteeringVector({x: 0.5, y: 0}, 0, 400).visible, false)
  assert.ok(mouseSteeringVector({x: 0.2, y: 0}, 800, 400).opacity <
    mouseSteeringVector({x: 0.8, y: 0}, 800, 400).opacity)
})

test("a held deflection reaches Phoenix as a steady FlightControls command", () => {
  let now = 1000
  const sent = []
  const flight = new FlightControls({send: x => sent.push(x), now: () => now})
  flight.setMouseMode(true)
  const stick = new MouseSteering({span: screen()})
  flight.setMouseSteering(stick.move(400, -150))
  const command = sent.at(-1)
  assert.equal(command.mouse_steering, true)
  assert.ok(command.yaw > 0 && command.pitch > 0)
  // Hand still for a second: only keep-alive heartbeats, never a neutral.
  for (let i = 0; i < 60; i++) { now += 16; flight.heartbeat(now) }
  assert.ok(sent.length > 1)
  for (const payload of sent.slice(1)) {
    assert.equal(payload.yaw, command.yaw)
    assert.equal(payload.pitch, command.pitch)
  }
})

test("client wiring: no idle stop, F recentres, line is presentation-only", () => {
  const client = read("./client.js")
  const markup = read("../../../lib/sunracer_web/controllers/game_html/show.html.heex")
  assert.doesNotMatch(client, /scheduleMouseStop|mouseIdleTimer|mouseSteering\.expire/)
  assert.match(client, /event\.code === "KeyF"\) \{\n\s+this\.mouseSteering\.release\(\)/)
  assert.match(client, /span: \(\) => \(\{width: this\.canvas\?\.clientWidth/)
  assert.match(client, /"sunracer:mouse-stick-sensitivity:"/)
  assert.match(client, /this\.drawMouseSteeringVector\(\)/)
  assert.match(markup, /<svg id="mouse-steering-vector" hidden/)
  assert.match(markup, /id="mouse-steering-vector-line"/)
  // Only the presentation deflection rides the LAN pose, never Phoenix.
  assert.match(client, /if \(steering\) \{\n\s+visual\.steering = steering/)
  assert.doesNotMatch(read("./flight_controls.mjs"), /aspect/)
})

test("relay steering accepts only bounded deflection and aspect", () => {
  assert.deepEqual(relaySteering({x: 0.3, y: -1, aspect: 1.78, extra: 1}),
    {x: 0.3, y: -1, aspect: 1.78})
  for (const bad of [null, "left", {x: 1.01, y: 0, aspect: 1},
    {x: 0, y: 0, aspect: 0.1}, {x: 0, y: 0, aspect: 6}, {x: 0, y: NaN, aspect: 1}]) {
    assert.equal(relaySteering(bad), null)
  }
})

test("headset line tip points where the laptop line tip points", () => {
  const tanV = Math.tan(COCKPIT_VERTICAL_FOV_DEG * Math.PI / 360)
  const edge = steeringLineTip({x: 1, y: 0, aspect: 2}, 60)
  near(edge.x, tanV * 2 * 60)
  near(edge.y, 0)
  assert.equal(edge.z, -60)
  // Laptop screen top (y = -1, mouse up) is the top of the vertical FOV.
  const up = steeringLineTip({x: 0, y: -1, aspect: 1.5}, 10)
  near(up.y, tanV * 10)
  assert.equal(up.visible, true)
  assert.equal(steeringLineTip({x: 0.01, y: 0, aspect: 1.5}, 10).visible, false)
  assert.equal(steeringLineTip(null, 10), null)
  assert.ok(steeringLineTip({x: 0.9, y: 0, aspect: 1}, 10).opacity >
    steeringLineTip({x: 0.2, y: 0, aspect: 1}, 10).opacity)
})

test("headset draws the ship-fixed line only in SBS gaze mode", () => {
  const view = read("./stereo_view.js")
  assert.match(view, /new THREE\.PerspectiveCamera\(COCKPIT_VERTICAL_FOV_DEG/)
  assert.match(view, /framing\.add\(this\.steeringLine\)/)
  assert.match(view, /this\.updateSteeringLine\(this\.helmetGazeEnabled && !docked/)
})

test("end to end: laptop stick reaches the headset line through the LAN pose", async () => {
  const {projectSbsRelayWorld} = await import("./sbs_relay_world.mjs")
  const {localVisualPose} = await import("./local_visual_pose.mjs")
  const stick = new MouseSteering({span: screen(1600, 900)})
  stick.move(480, -180)
  const map = {map_id: "sol:free_1", tick: 9, entities: [{id: 7, kind: "player"}]}
  const relay = projectSbsRelayWorld(map, {id: 7,
    position_3d: {x: 1, y: 2, z: 3}, orientation: {x: 0, y: 0, z: 0, w: 1},
    steering: {...stick.deflection(), aspect: 1600 / 900}})
  // The Rust relay forwards JSON; the phone parses it back.
  const onPhone = localVisualPose(JSON.parse(JSON.stringify(relay)), "7", 1000)
  const tip = steeringLineTip(onPhone.steering, 60)
  assert.equal(tip.visible, true)
  assert.ok(tip.x > 0 && tip.y > 0, "right and up on the laptop is right and up in the headset")
})

test("stick-link diagnostics remain available without the SBS overlay", () => {
  const helmet = read("./helmet_client.mjs")
  for (const state of ["NO LAN RELAY", "NO LAPTOP POSE", "LAPTOP NOT SENDING STICK"]) {
    assert.match(helmet, new RegExp(state))
  }
  const view = read("./stereo_view.js")
  assert.doesNotMatch(view, /^\s*framing\.add\(this\.steeringStatus\)/m)
  assert.doesNotMatch(view, /"STICK LINE: " \+ link/)
  assert.match(view, /cockpitLabel\(\[link, \.\.\.rest\]/)
  // Second line: once-a-second headset frame rate / slow frames / sensor rate.
  assert.match(helmet, /" FPS · "/)
  assert.match(helmet, /this\.measureHeadsetPerformance\(time\)/)
  const client = read("./client.js")
  assert.match(client, /SBS STICK SENT/)
  assert.match(client, /SBS HEADSET NOT RENDERING/)
})
