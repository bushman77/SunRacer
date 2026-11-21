import test from "node:test"
import assert from "node:assert/strict"
import {
  MouseSteering, mouseSteeringAxes, MOUSE_STEERING_IDLE_MS,
  validMouseSensitivity, enabledMouseSteering,
} from "./mouse_steering.mjs"

test("native defaults to mouse flight without overriding saved preference", () => {
  assert.equal(enabledMouseSteering(null, true), true)
  assert.equal(enabledMouseSteering(null, false), false)
  assert.equal(enabledMouseSteering("0", true), false)
  assert.equal(enabledMouseSteering("1", true), true)
  assert.equal(enabledMouseSteering("1", false), true)
})

test("mouse yaw/pitch control remains bounded and sensitivity remains 0.4x-6x", () => {
  assert.deepEqual(mouseSteeringAxes(5.5, -5.5), {yaw: 0.5, pitch: 0.5})
  assert.deepEqual(mouseSteeringAxes(-5.5, 5.5), {yaw: -0.5, pitch: -0.5})
  assert.deepEqual(mouseSteeringAxes(0, 0), {yaw: 0, pitch: 0})
  assert.deepEqual(mouseSteeringAxes(2000, -2000), {yaw: 1, pitch: 1})
  assert.deepEqual(mouseSteeringAxes(-2000, 2000), {yaw: -1, pitch: -1})
  assert.equal(mouseSteeringAxes(5.5, 0, 2).yaw, 1)
  assert.equal(mouseSteeringAxes(5.5, 0, 0.4).yaw, 0.2)
  assert.equal(mouseSteeringAxes(2, 0, 6).yaw, 1)
  assert.equal(mouseSteeringAxes(5.5, 0, Infinity).yaw, 0.5)
  assert.equal(mouseSteeringAxes(5.5, 0, 100).yaw, 0.5)
  assert.equal(validMouseSensitivity(6.0), true)
  assert.equal(validMouseSensitivity(6.1), false)
  assert.equal(validMouseSensitivity(0.39), false)
})

test("irregular small movements accumulate smoothly without turn-rate spikes", () => {
  let time = 1000
  const mouse = new MouseSteering({now: () => time})
  const steps = [8, 31, 12, 38, 17, 8]
  const values = [mouse.move(1, 0).yaw]
  for (const elapsed of steps) {
    time += elapsed
    values.push(mouse.move(1, 0).yaw)
  }
  assert.ok(values.every(v => v > 0 && v < 0.3))
  assert.ok(values[1] > values[0])
  assert.ok(values.every((v, i) => i === 0 || Math.abs(v - values[i - 1]) < 0.075),
    "uneven browser events should not create abrupt yaw changes")
})

test("normal mouse event gaps do not alternate turning and neutral", () => {
  let time = 1000
  const mouse = new MouseSteering({now: () => time})
  const started = mouse.move(11, -5.5)
  assert.ok(started.yaw > 0 && started.pitch > 0)
  time += 35
  assert.equal(mouse.expire(time), null, "35ms event gap stays active")
  time += 25
  assert.equal(mouse.expire(time), null, "60ms event gap stays active")
  time += MOUSE_STEERING_IDLE_MS - 61
  assert.equal(mouse.expire(time), null)
  time += 1
  assert.deepEqual(mouse.expire(time), {yaw: 0, pitch: 0},
    "at idle cutoff, issue one immediate neutral command")
  time += 1000
  assert.equal(mouse.expire(time), null)
  assert.deepEqual(mouse.axes(), {yaw: 0, pitch: 0})
})

test("zero-delta browser events do not extend the idle timer", () => {
  let time = 1000
  const mouse = new MouseSteering({now: () => time})
  mouse.move(11, -5.5)
  time += MOUSE_STEERING_IDLE_MS - 1
  assert.deepEqual(mouse.move(0, 0), mouse.axes())
  assert.equal(mouse.expire(time), null)
  time += 1
  assert.deepEqual(mouse.expire(time), {yaw: 0, pitch: 0})
})

test("one-axis motion clears the other steering axis immediately", () => {
  let time = 1000
  const mouse = new MouseSteering({now: () => time})
  mouse.move(11, -5.5)
  time += 8
  const vertical = mouse.move(0, -5.5)
  assert.equal(vertical.yaw, 0)
  assert.ok(vertical.pitch > 0)
  time += 8
  const horizontal = mouse.move(-5.5, 0)
  assert.ok(horizontal.yaw < 0)
  assert.equal(horizontal.pitch, 0)
})

test("direction reversal never waits for the low-pass filter", () => {
  let time = 1000
  const mouse = new MouseSteering({now: () => time})
  mouse.move(11, -11)
  time += 8
  const reversed = mouse.move(-5.5, 5.5)
  assert.ok(reversed.yaw < 0 && reversed.pitch < 0)
  assert.equal(reversed.yaw, -0.5)
  assert.equal(reversed.pitch, -0.5)
  time += MOUSE_STEERING_IDLE_MS
  assert.deepEqual(mouse.expire(time), {yaw: 0, pitch: 0})
})

test("release neutralizes steering instantly, keeping chosen sensitivity", () => {
  let time = 1000
  const mouse = new MouseSteering({now: () => time, sensitivity: 1.5})
  mouse.move(5.5, 0)
  assert.ok(mouse.axes().yaw > 0 && mouse.axes().yaw < 0.75)
  assert.deepEqual(mouse.release(), {yaw: 0, pitch: 0})
  assert.equal(mouse.sensitivity, 1.5)
  assert.equal(mouse.expire(time + 500), null)
})

test("a delayed event cannot resurrect an old steering impulse", () => {
  let time = 1000
  const mouse = new MouseSteering({now: () => time})
  const initial = mouse.move(5.5, 0)
  time += 8
  const adjacent = mouse.move(5.5, 0)
  assert.ok(adjacent.yaw > initial.yaw)
  time += MOUSE_STEERING_IDLE_MS + 1
  const fresh = mouse.move(5.5, 0)
  assert.ok(fresh.yaw < adjacent.yaw)
  assert.ok(fresh.yaw > 0)
  time += MOUSE_STEERING_IDLE_MS
  assert.deepEqual(mouse.expire(time), {yaw: 0, pitch: 0})
})

test("stop window spans normal 30–60Hz mouse event intervals, never coasts after expiry", () => {
  assert.ok(MOUSE_STEERING_IDLE_MS >= 50)
  assert.ok(MOUSE_STEERING_IDLE_MS <= 100)
  let time = 2000
  const mouse = new MouseSteering({now: () => time})
  for (const gap of [16, 33, 32, 16]) {
    mouse.move(8, 0)
    time += gap
    assert.equal(mouse.expire(time), null, "active turn should not chatter")
  }
  time += MOUSE_STEERING_IDLE_MS
  assert.deepEqual(mouse.expire(time), {yaw: 0, pitch: 0})
  assert.equal(mouse.expire(time + 5), null)
})
