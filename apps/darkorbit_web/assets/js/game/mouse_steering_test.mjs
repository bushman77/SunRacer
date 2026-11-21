import test from "node:test"
import assert from "node:assert/strict"
import {
  MouseSteering, mouseSteeringAxes, MOUSE_STEERING_IDLE_MS, MOUSE_STEERING_WINDOW_MS,
  MOUSE_FULL_RATE_PX_PER_SEC, validMouseSensitivity,
} from "./mouse_steering.mjs"

const FULL = MOUSE_FULL_RATE_PX_PER_SEC
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`)

// Feed a steady hand movement: `pxPerSec` split into events every `everyMs`.
function sweep(mouse, clock, {pxPerSec, everyMs, durationMs, axis = "x"}) {
  const px = pxPerSec * everyMs / 1000
  let last
  for (let t = 0; t < durationMs; t += everyMs) {
    clock.time += everyMs
    last = axis === "x" ? mouse.move(px, 0) : mouse.move(0, px)
  }
  return last
}

test("velocity maps to bounded axes; sensitivity remains 0.4x-6x", () => {
  assert.deepEqual(mouseSteeringAxes(FULL / 2, -FULL / 2), {yaw: 0.5, pitch: 0.5})
  assert.deepEqual(mouseSteeringAxes(-FULL / 2, FULL / 2), {yaw: -0.5, pitch: -0.5})
  assert.deepEqual(mouseSteeringAxes(0, 0), {yaw: 0, pitch: 0})
  assert.deepEqual(mouseSteeringAxes(FULL * 10, -FULL * 10), {yaw: 1, pitch: 1})
  assert.equal(mouseSteeringAxes(FULL / 2, 0, 2).yaw, 1)
  close(mouseSteeringAxes(FULL / 2, 0, 0.4).yaw, 0.2)
  assert.equal(mouseSteeringAxes(FULL / 2, 0, Infinity).yaw, 0.5)
  assert.equal(mouseSteeringAxes(FULL / 2, 0, 100).yaw, 0.5)
  assert.equal(validMouseSensitivity(6.0), true)
  assert.equal(validMouseSensitivity(6.1), false)
  assert.equal(validMouseSensitivity(0.39), false)
})

test("a steady hand gives a steady command, whatever the mouse polling rate", () => {
  const results = []
  for (const everyMs of [1, 2, 8]) {   // 1000 Hz, 500 Hz, 125 Hz mice
    const clock = {time: 1000}
    const mouse = new MouseSteering({now: () => clock.time})
    const axes = sweep(mouse, clock, {pxPerSec: 300, everyMs, durationMs: 200})
    results.push(axes.yaw)
  }
  for (const yaw of results) close(yaw, 300 / FULL, 0.03)
})

test("the command does not jump between events during continuous motion", () => {
  const clock = {time: 1000}
  const mouse = new MouseSteering({now: () => clock.time})
  sweep(mouse, clock, {pxPerSec: 300, everyMs: 8, durationMs: 100})
  const seen = []
  for (let i = 0; i < 20; i++) {
    clock.time += 8
    seen.push(mouse.move(2.4, 0).yaw)
  }
  const spread = Math.max(...seen) - Math.min(...seen)
  assert.ok(spread < 0.05, `spread ${spread}`)
})

test("stopping reaches exact neutral within the short window, then stays there", () => {
  assert.ok(MOUSE_STEERING_IDLE_MS === MOUSE_STEERING_WINDOW_MS)
  assert.ok(MOUSE_STEERING_WINDOW_MS < 34)
  const clock = {time: 1000}
  const mouse = new MouseSteering({now: () => clock.time})
  sweep(mouse, clock, {pxPerSec: 400, everyMs: 8, durationMs: 120})
  const stoppedAt = clock.time
  assert.ok(mouse.axes().yaw > 0)
  assert.deepEqual(mouse.update(stoppedAt + MOUSE_STEERING_WINDOW_MS), {yaw: 0, pitch: 0})
  assert.equal(mouse.update(stoppedAt + 1000), null)
  assert.deepEqual(mouse.axes(), {yaw: 0, pitch: 0})
})

test("zero-delta browser events cannot extend turning", () => {
  const clock = {time: 1000}
  const mouse = new MouseSteering({now: () => clock.time})
  mouse.move(10, 0)
  clock.time += MOUSE_STEERING_WINDOW_MS - 1
  mouse.move(0, 0)
  clock.time += 1
  assert.deepEqual(mouse.update(clock.time), {yaw: 0, pitch: 0})
})

test("moving only one axis does not keep the other axis turning", () => {
  const clock = {time: 1000}
  const mouse = new MouseSteering({now: () => clock.time})
  sweep(mouse, clock, {pxPerSec: 400, everyMs: 8, durationMs: 80})
  sweep(mouse, clock, {pxPerSec: 400, everyMs: 8, durationMs: 80, axis: "y"})
  assert.equal(mouse.axes().yaw, 0)
  assert.ok(mouse.axes().pitch < 0)   // mouse down -> nose down
})

test("reversing direction follows the new movement within one window", () => {
  const clock = {time: 1000}
  const mouse = new MouseSteering({now: () => clock.time})
  sweep(mouse, clock, {pxPerSec: 400, everyMs: 8, durationMs: 80})
  const axes = sweep(mouse, clock, {pxPerSec: -400, everyMs: 8, durationMs: 48})
  assert.ok(axes.yaw < 0)
})

test("release clears input immediately and keeps the chosen sensitivity", () => {
  const clock = {time: 1000}
  const mouse = new MouseSteering({now: () => clock.time, sensitivity: 1.5})
  sweep(mouse, clock, {pxPerSec: 200, everyMs: 8, durationMs: 80})
  assert.ok(mouse.axes().yaw > 0)
  assert.deepEqual(mouse.release(), {yaw: 0, pitch: 0})
  assert.equal(mouse.sensitivity, 1.5)
  assert.equal(mouse.update(clock.time), null)
})
