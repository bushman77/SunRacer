import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {
  MouseSteering, joystickAxis, mouseSteeringVector,
  MOUSE_STEERING_DEAD_ZONE, MOUSE_STEERING_CURVE,
  MOUSE_STEERING_DEFAULT_SENSITIVITY,
  validMouseSensitivity, enabledMouseSteering,
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
  // Never part of the SBS relay projection.
  assert.doesNotMatch(read("./sbs_relay_world.mjs"), /steering/i)
})
