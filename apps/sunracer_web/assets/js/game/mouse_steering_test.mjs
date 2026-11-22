import test from "node:test"
import assert from "node:assert/strict"
import {
  MouseSteering, mouseSteeringAxes, MOUSE_STEERING_IDLE_MS,
  MOUSE_STEERING_FAST_STOP_MS, MOUSE_STEERING_MIN_STOP_MS,
  MOUSE_STEERING_SAMPLE_MS,
  MOUSE_STEERING_DEFAULT_SENSITIVITY, MOUSE_STEERING_PIXELS_PER_AXIS,
  validMouseSensitivity, enabledMouseSteering, calibratedMouseSensitivity,
  MOUSE_STEERING_JITTER_BAND, MOUSE_STEERING_JITTER_FILTER,
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
  assert.ok(mouseSteeringAxes(2, 0, 10).yaw < 1)
  assert.ok(mouseSteeringAxes(2, 0, 10).yaw > 0.7)
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
  assert.ok(faster <= 0.6 && steady <= 0.6 && steady >= faster)
  now += 8
  const slightSlowdown = mouse.move(1, -1)
  assert.ok(slightSlowdown.yaw > 0.3 && slightSlowdown.yaw < steady,
    "minor same-direction reductions are damped instead of becoming visible jitter")
  assert.equal(slightSlowdown.pitch, 0.3)
  now += 8
  assert.deepEqual(mouse.move(-5, 0), {yaw: -1, pitch: 0})
})

test("continuous 60Hz movement has one bounded neutral after packet silence", () => {
  let now = 1000
  const mouse = new MouseSteering({now: () => now})
  for (let i = 0; i < 8; i++) {
    mouse.move(4, 0)
    now += 16
    assert.equal(mouse.expire(now), null)
  }
  assert.ok(mouse.stopDelayMs() >= MOUSE_STEERING_MIN_STOP_MS)
  assert.ok(mouse.stopDelayMs() <= MOUSE_STEERING_FAST_STOP_MS)
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
  assert.deepEqual(mouse.move(2, 0), {yaw: 0.3, pitch: 0})
  assert.equal(mouse.packetGapMs, null)
  assert.equal(mouse.sensitivity, 1.5)
})

test("equal physical hand speed stays steady across 60, 120, and 30Hz mouse packets", () => {
  let now = 1000
  const mouse = new MouseSteering({now: () => now, sensitivity: 1.5})
  // Same physical velocity: 4px / 16ms == 2px / 8ms == 8px / 32ms.
  const axes = [mouse.move(4, 0).yaw]
  for (const [gap, dx] of [[8, 2], [16, 4], [32, 8], [8, 2], [16, 4]]) {
    now += gap
    axes.push(mouse.move(dx, 0).yaw)
  }
  assert.equal(MOUSE_STEERING_SAMPLE_MS, 16)
  assert.ok(axes.every(axis => Math.abs(axis - 0.6) < 1e-9),
    "steady physical mouse velocity must not cause sawtooth steering")
})

test("a skipped 60Hz pointer event does not trigger an unintended neutral pulse", () => {
  let now = 1000
  const mouse = new MouseSteering({now: () => now})
  mouse.move(4, 0)
  now += 16
  mouse.move(4, 0)
  now += 48  // two mouse packets missed; no intentional stop
  assert.equal(mouse.expire(now), null)
  assert.ok(mouse.axes().yaw > 0)
  now += 1
  mouse.move(12, 0)
  assert.ok(mouse.axes().yaw > 0)
  now += mouse.stopDelayMs()
  assert.deepEqual(mouse.expire(now), {yaw: 0, pitch: 0})
})

test("slowing, reversing and releasing still react immediately", () => {
  let now = 1000
  const mouse = new MouseSteering({now: () => now, sensitivity: 1.5})
  mouse.move(5, -5)
  now += 16
  const slow = mouse.move(1, -1)
  assert.deepEqual(slow, {yaw: 0.15, pitch: 0.15})
  now += 16
  assert.deepEqual(mouse.move(-2, 0), {yaw: -0.3, pitch: 0})
  assert.deepEqual(mouse.release(), {yaw: 0, pitch: 0})
  assert.equal(mouse.expire(now + 100), null)
})

test("high sensitivity does not saturate a one-pixel movement", () => {
  const gentle = mouseSteeringAxes(1, 0, 1.5).yaw
  const high = mouseSteeringAxes(1, 0, 10).yaw
  assert.equal(gentle, 0.15)
  assert.ok(high > gentle && high < 0.4,
    "one pixel at maximum sensitivity must leave precision headroom")
  assert.ok(calibratedMouseSensitivity(10) < 4)
  assert.equal(calibratedMouseSensitivity(1.5), 1.5)
  assert.ok(calibratedMouseSensitivity(10) > calibratedMouseSensitivity(5))
  const low = mouseSteeringAxes(1, 0, 0.4).yaw
  assert.equal(low, 0.04)
})

test("one-pixel packet quantization is damped at high sensitivity without steady input lag", () => {
  let time = 1000
  const sensitivity = 10
  const mouse = new MouseSteering({now: () => time, sensitivity})
  const rawHigh = mouseSteeringAxes(2, 0, sensitivity).yaw
  const rawLow = mouseSteeringAxes(1, 0, sensitivity).yaw
  assert.ok(rawHigh - rawLow < MOUSE_STEERING_JITTER_BAND)
  assert.ok(MOUSE_STEERING_JITTER_FILTER < 0.5)
  mouse.move(2, 0)
  const observed = []
  // Physical hand speed is steady, integer cursor packets alternate 1 and 2px.
  for (let i = 0; i < 30; i++) {
    time += 16
    observed.push(mouse.move(i % 2 ? 2 : 1, 0).yaw)
  }
  const stable = observed.slice(10)
  const span = Math.max(...stable) - Math.min(...stable)
  assert.ok(span < (rawHigh - rawLow) * 0.55,
    "small packet-to-packet changes must not reach the ship as full rate oscillation")
  assert.ok(stable.every(x => x >= rawLow && x <= rawHigh))
})

test("large slowdown, reversal and genuine stop bypass the new jitter filter", () => {
  let time = 1000
  const mouse = new MouseSteering({now: () => time, sensitivity: 10})
  mouse.move(3, 0) // full yaw
  time += 16
  const slow = mouse.move(0.5, 0)
  assert.equal(slow.yaw, mouseSteeringAxes(0.5, 0, 10).yaw)
  time += 16
  const opposite = mouse.move(-2, 0)
  assert.equal(opposite.yaw, mouseSteeringAxes(-2, 0, 10).yaw)
  assert.deepEqual(mouse.release(), {yaw: 0, pitch: 0})
  assert.equal(mouse.expire(time + 300), null)
})

test("one-axis cessation never leaks stale yaw into pitch-only motion", () => {
  let time = 1000
  const mouse = new MouseSteering({now: () => time, sensitivity: 8})
  mouse.move(2, -2)
  time += 16
  const pitchOnly = mouse.move(0, -2)
  assert.equal(pitchOnly.yaw, 0)
  assert.ok(pitchOnly.pitch > 0)
  time += mouse.stopDelayMs()
  assert.deepEqual(mouse.expire(time), {yaw: 0, pitch: 0})
})

test("irregular 70-110ms pointer gaps do not make received movement restart", () => {
  let now=1000
  const mouse=new MouseSteering({now:()=>now,sensitivity:1.5})
  mouse.move(4,0)
  for (const gap of [16,90,16,110,16,70,16]) {
    now+=gap
    if (gap < mouse.stopDelayMs()) assert.equal(mouse.expire(now),null)
    const axes=mouse.move(4,0)
    assert.ok(axes.yaw>0)
    assert.ok(mouse.stopDelayMs()>=MOUSE_STEERING_MIN_STOP_MS)
    assert.ok(mouse.stopDelayMs()<=MOUSE_STEERING_IDLE_MS)
  }
  now+=mouse.stopDelayMs()+1
  assert.deepEqual(mouse.expire(now),{yaw:0,pitch:0})
  assert.equal(mouse.expire(now+100),null)
})

test("explicit capture loss stops instantly regardless of idle grace", () => {
  let now=1000
  const mouse=new MouseSteering({now:()=>now})
  mouse.move(5,0)
  now+=20
  assert.ok(mouse.axes().yaw>0)
  assert.deepEqual(mouse.release(),{yaw:0,pitch:0})
  assert.equal(mouse.expire(now+300),null)
})
