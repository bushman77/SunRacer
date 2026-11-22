import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {
  advanceAngularRate, predictAxisAngle, predictOrientation, predictPosition,
  fromAngles, MOUSE_TURN_LIMITS, TURN_LIMITS, MAX_PREDICTION_SECONDS, InputHistory,
} from "./own_ship_prediction.mjs"
import {rotateVector} from "./orientation_interpolation.mjs"

const rad = d => d * Math.PI / 180
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`)
const identity = {x: 0, y: 0, z: 0, w: 1}

test("turn rule matches the server: accelerate, cap, brake on reversal", () => {
  const limits = TURN_LIMITS.yaw
  close(advanceAngularRate(0, 1, limits, 0.1), rad(limits.acceleration) * 0.1)
  close(advanceAngularRate(rad(44), 1, limits, 0.1), rad(44))
  close(advanceAngularRate(rad(20), -1, limits, 0.1), rad(20) - rad(limits.braking) * 0.1)
  assert.equal(advanceAngularRate(1e-12, 0, limits, 0.1), 0)
})

test("a ship already at full rate keeps turning at that rate between ticks", () => {
  const rate = rad(MOUSE_TURN_LIMITS.yaw.speed)
  close(predictAxisAngle(rate, 1, MOUSE_TURN_LIMITS.yaw, 0.05, {mouseAxis: true}), rate * 0.05)
})

test("a neutral mouse axis stops at once, like the server (no coasting)", () => {
  assert.equal(predictAxisAngle(rad(90), 0, MOUSE_TURN_LIMITS.yaw, 0.1, {mouseAxis: true}), 0)
  // Keyboard axes brake instead, also like the server.
  assert.ok(predictAxisAngle(rad(40), 0, TURN_LIMITS.yaw, 0.1) > 0)
})

test("prediction never runs past the cap if snapshots stall", () => {
  const rate = rad(40)
  close(predictAxisAngle(rate, 1, TURN_LIMITS.yaw, 5), predictAxisAngle(rate, 1, TURN_LIMITS.yaw,
    MAX_PREDICTION_SECONDS))
})

test("positive yaw turns the nose right (east), positive pitch raises it", () => {
  const right = rotateVector(fromAngles({yaw: rad(90)}), {x: 0, y: 0, z: -1})
  close(right.x, 1)
  const up = rotateVector(fromAngles({pitch: rad(90)}), {x: 0, y: 0, z: -1})
  close(up.y, 1)
})

test("predicted orientation advances smoothly with elapsed time", () => {
  const rates = {yaw: rad(60), pitch: 0, roll: 0}
  const input = {yaw: 1, pitch: 0, roll: 0}
  const at = s => predictOrientation(identity, rates, input, {mouseMode: true, seconds: s})
  const nose = s => rotateVector(at(s), {x: 0, y: 0, z: -1}).x
  assert.ok(nose(0.02) > 0)
  assert.ok(nose(0.05) > nose(0.02))
  assert.ok(nose(0.09) > nose(0.05))
  assert.equal(at(0), identity)
})

test("no input and no rotation leaves the authoritative orientation untouched", () => {
  const q = {x: 0, y: 0.2, z: 0, w: Math.sqrt(1 - 0.04)}
  assert.equal(predictOrientation(q, {yaw: 0, pitch: 0, roll: 0},
    {yaw: 0, pitch: 0, roll: 0}, {seconds: 0.08}), q)
})

test("position extrapolates along velocity, capped", () => {
  assert.deepEqual(predictPosition({x: 0, y: 0, z: 0}, {x: 100, y: -50, z: 10}, 0.1),
    {x: 10, y: -5, z: 1})
  const far = predictPosition({x: 0, y: 0, z: 0}, {x: 100, y: 0, z: 0}, 9)
  close(far.x, 100 * MAX_PREDICTION_SECONDS)
})

test("stopping mid-tick keeps the turn already made instead of snapping back", () => {
  const history = new InputHistory()
  history.record(1000, {yaw: 1, pitch: 0, roll: 0})   // turning at snapshot
  history.record(1050, {yaw: 0, pitch: 0, roll: 0})   // hand stops 50 ms later
  const rates = {yaw: rad(100), pitch: 0, roll: 0}     // full mouse rate
  const opts = s => ({mouseMode: true, seconds: s})
  const noseX = q => rotateVector(q, {x: 0, y: 0, z: -1}).x
  const atStop = noseX(predictOrientation(identity, rates, history.since(1000), opts(0.05)))
  const later = noseX(predictOrientation(identity, rates, history.since(1000), opts(0.09)))
  assert.ok(atStop > 0)
  close(later, atStop)          // held, not rewound to the snapshot
  // The old constant-input behaviour would have rewound to zero.
  assert.equal(noseX(predictOrientation(identity, rates, {yaw: 0, pitch: 0, roll: 0},
    opts(0.09))), 0)
})

test("input history returns the input in effect at a time and stays bounded", () => {
  const history = new InputHistory({keepMs: 100})
  history.record(0, {yaw: 0.5})
  history.record(0, {yaw: 0.5})     // unchanged: not recorded twice
  history.record(40, {yaw: -1})
  assert.equal(history.entries.length, 2)
  assert.equal(history.at(10).yaw, 0.5)
  assert.equal(history.at(45).yaw, -1)
  for (let t = 50; t < 1000; t += 10) history.record(t, {yaw: t % 20 ? 1 : 0})
  assert.ok(history.entries.length <= 12)
  assert.equal(history.at(995).yaw, history.entries.at(-1).input.yaw)
})

test("client mouse prediction exactly matches server mouse turning and braking limits", () => {
  assert.deepEqual(MOUSE_TURN_LIMITS, {
    yaw: {speed: 150, acceleration: 420, braking: 540},
    pitch: {speed: 135, acceleration: 380, braking: 500},
  })
  const source = readFileSync(new URL(
    "../../../../core/lib/core/world/flight_dynamics.ex", import.meta.url), "utf8")
  assert.match(source, /yaw: %\{speed: 150\.0, acceleration: 420\.0, braking: 540\.0\}/)
  assert.match(source, /pitch: %\{speed: 135\.0, acceleration: 380\.0, braking: 500\.0\}/)
})

test("input history timestamps physical movement and neutral without late replay", () => {
  const history = new InputHistory()
  history.record(1000, {yaw: 0, pitch: 0, roll: 0})
  history.record(1009, {yaw: 0.4, pitch: 0, roll: 0})
  history.record(1039, {yaw: 0, pitch: 0, roll: 0})
  assert.equal(history.at(1008).yaw, 0)
  assert.equal(history.at(1009).yaw, 0.4)
  assert.equal(history.at(1039).yaw, 0)
  const stopped = predictOrientation(identity, {yaw: 0, pitch: 0, roll: 0},
    history.since(1000), {mouseMode: true, seconds: 0.12})
  const held = predictOrientation(identity, {yaw: 0, pitch: 0, roll: 0},
    history.since(1000), {mouseMode: true, seconds: 0.05})
  close(rotateVector(stopped, {x: 0, y: 0, z: -1}).x,
    rotateVector(held, {x: 0, y: 0, z: -1}).x)
})
