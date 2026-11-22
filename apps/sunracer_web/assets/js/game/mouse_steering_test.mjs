import test from "node:test"
import assert from "node:assert/strict"
import {
  MouseSteering, mouseSteeringAxes, MOUSE_STEERING_IDLE_MS,
  MOUSE_STEERING_FAST_STOP_MS, MOUSE_STEERING_MIN_STOP_MS,
  MOUSE_STEERING_DEFAULT_SENSITIVITY, MOUSE_STEERING_PIXELS_PER_AXIS,
  validMouseSensitivity, enabledMouseSteering,
} from "./mouse_steering.mjs"

test("preserve native mouse-on default and saved opt out", () => {
  assert.equal(enabledMouseSteering(null, true), true)
  assert.equal(enabledMouseSteering(null, false), false)
  assert.equal(enabledMouseSteering("0", true), false)
  assert.equal(enabledMouseSteering("1", false), true)
})

test("precise mouse mapping, adjustable sensitivity, and bounded axes", () => {
  assert.equal(MOUSE_STEERING_DEFAULT_SENSITIVITY, 1.5)
  assert.equal(MOUSE_STEERING_PIXELS_PER_AXIS, 10)
  assert.equal(mouseSteeringAxes(2, -2).yaw, 0.2)
  assert.deepEqual(mouseSteeringAxes(10, -10), {yaw: 1, pitch: 1})
  assert.deepEqual(mouseSteeringAxes(-10, 10), {yaw: -1, pitch: -1})
  assert.deepEqual(mouseSteeringAxes(0, 0), {yaw: 0, pitch: 0})
  assert.deepEqual(mouseSteeringAxes(2000, -2000), {yaw: 1, pitch: 1})
  assert.equal(mouseSteeringAxes(7, 0, 2).yaw, 1)
  assert.ok(Math.abs(mouseSteeringAxes(5.5, 0, 0.4).yaw - 0.22) < 1e-10)
  assert.equal(mouseSteeringAxes(2, 0, 10).yaw, 1)
  assert.equal(mouseSteeringAxes(5.5, 0, Infinity).yaw, 0.55)
  assert.equal(validMouseSensitivity(10), true)
  assert.equal(validMouseSensitivity(10.1), false)
  assert.equal(validMouseSensitivity(0.39), false)
})

test("mouse filter smooths acceleration but never amplifies or delays slowdown", () => {
  let now = 1000
  const mouse = new MouseSteering({now: () => now})
  const first = mouse.move(1, 0).yaw
  now += 8
  const faster = mouse.move(2, 0).yaw
  now += 8
  const steady = mouse.move(2, 0).yaw
  assert.ok(first > 0 && first < faster)
  assert.ok(faster <= 0.2 && steady <= 0.2 && steady >= faster)
  now += 8
  assert.deepEqual(mouse.move(1, -1), {yaw: 0.1, pitch: 0.1})
  now += 8
  assert.deepEqual(mouse.move(-5, 0), {yaw: -0.5, pitch: 0})
})

test("continuous 60Hz movement stops promptly instead of coasting 85ms", () => {
  let now = 1000
  const mouse = new MouseSteering({now: () => now})
  for (let i = 0; i < 8; i++) {
    mouse.move(4, 0)
    now += 16
    assert.equal(mouse.expire(now), null)
  }
  assert.ok(mouse.stopDelayMs() >= MOUSE_STEERING_MIN_STOP_MS)
  assert.ok(mouse.stopDelayMs() < 40)
  now = mouse.lastMovementAt + mouse.stopDelayMs() - 1
  assert.equal(mouse.expire(now), null)
  now += 1
  assert.deepEqual(mouse.expire(now), {yaw: 0, pitch: 0})
  assert.equal(mouse.expire(now + 100), null)
})

test("30Hz and 20Hz intermittent packets still turn continuously", () => {
  for (const gap of [33, 50]) {
    let now = 1000
    const mouse = new MouseSteering({now: () => now})
    mouse.move(3, 0)
    now += gap
    mouse.move(3, 0)
    assert.ok(mouse.stopDelayMs() > gap)
    for (let i = 0; i < 5; i++) {
      now += gap
      assert.equal(mouse.expire(now), null)
      mouse.move(3, 0)
    }
    now += mouse.stopDelayMs()
    assert.deepEqual(mouse.expire(now), {yaw: 0, pitch: 0})
  }
})

test("first movement stops quickly; synthetic zero-deltas cannot extend it", () => {
  let now = 1000
  const mouse = new MouseSteering({now: () => now})
  mouse.move(5, 0)
  assert.equal(mouse.stopDelayMs(), MOUSE_STEERING_FAST_STOP_MS)
  now += MOUSE_STEERING_FAST_STOP_MS - 1
  mouse.move(0, 0)
  assert.equal(mouse.expire(now), null)
  now += 1
  assert.deepEqual(mouse.expire(now), {yaw: 0, pitch: 0})
})

test("native pointer loss and long gaps reset both steering and cadence", () => {
  let now = 1000
  const mouse = new MouseSteering({now: () => now, sensitivity: 1.5})
  mouse.move(5, 0)
  now += 8
  mouse.move(5, 0)
  assert.ok(mouse.packetGapMs !== null)
  assert.deepEqual(mouse.release(), {yaw: 0, pitch: 0})
  assert.equal(mouse.packetGapMs, null)
  assert.equal(mouse.expire(now + 100), null)
  mouse.move(5, 0)
  now += MOUSE_STEERING_IDLE_MS + 1
  assert.deepEqual(mouse.move(2, 0), {yaw: 0.2, pitch: 0})
  assert.equal(mouse.packetGapMs, null)
  assert.equal(mouse.sensitivity, 1.5)
})
