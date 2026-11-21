import test from "node:test"
import assert from "node:assert/strict"
import {headTrackingUnavailable, HelmetHeadTracking, handsetQuaternion} from "./helmet_head_tracking.mjs"

const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance)

test("Euler/device quaternion stays unit length and screen orientation changes it", () => {
  const q = handsetQuaternion({alpha: 35, beta: 20, gamma: -8}, 90)
  assert.ok(q)
  near(Math.hypot(q.x, q.y, q.z, q.w), 1)
  assert.notDeepEqual(q, handsetQuaternion({alpha: 35, beta: 20, gamma: -8}, 0))
  assert.equal(handsetQuaternion({alpha: NaN, beta: 0, gamma: 0}), null)
})

function fakePhone({secure = true, hasSensor = true, permission = null} = {}) {
  const listeners = new Map()
  const win = {
    isSecureContext: secure,
    screen: {orientation: {angle: 90}},
    DeviceOrientationEvent: hasSensor ? (permission === null ? function Event(){} :
      {requestPermission: () => permission}) : undefined,
    addEventListener: (name, cb) => listeners.set(name, cb),
    removeEventListener: name => listeners.delete(name),
  }
  return {win, emit: data => listeners.get("deviceorientation")?.(data),
    hasListener: () => listeners.has("deviceorientation")}
}

test("requires a secure sensor-capable phone; denied permission is safe", async () => {
  for (const opts of [{secure: false}, {hasSensor: false},
    {permission: Promise.resolve("denied")}]) {
    const phone = fakePhone(opts)
    const tracking = new HelmetHeadTracking({win: phone.win})
    await tracking.startFromGesture()
    assert.equal(tracking.ready(), false)
    assert.equal(phone.hasListener(), false)
  }
})

test("calibrates present head direction, tracks relative yaw, recenters, holds when still", async () => {
  let time = 100
  const phone = fakePhone()
  const status = []
  const tracking = new HelmetHeadTracking({
    win: phone.win, now: () => time, onStatus: state => status.push(state),
  })
  assert.equal(await tracking.startFromGesture(), "waiting")
  phone.emit({alpha: 15, beta: 30, gamma: 0})
  assert.equal(tracking.status, "tracking")
  const neutral = tracking.rotation()
  near(neutral.x, 0)
  near(neutral.y, 0)
  near(neutral.z, 0)
  near(neutral.w, 1)
  time = 200
  phone.emit({alpha: 50, beta: 30, gamma: 0})
  const rotation = tracking.rotation()
  assert.ok(Math.abs(rotation.y) + Math.abs(rotation.x) + Math.abs(rotation.z) > 0.05)
  near(Math.hypot(rotation.x, rotation.y, rotation.z, rotation.w), 1)
  assert.ok(tracking.recenter())
  const recentered = tracking.rotation()
  near(recentered.x, 0)
  near(recentered.y, 0)
  near(recentered.z, 0)
  near(recentered.w, 1)
  // A still head sends no sensor events. The pose is held, never dropped:
  // dropping it flashed the warning panel and snapped the view forward.
  const held = tracking.rotation(60_000)
  near(held.w, 1)
  assert.equal(tracking.ready(60_000), true)
  // After a "center" command the view looks straight ahead (not "lost")
  // until the next fresh sample becomes the new neutral pose.
  time = 2_301
  phone.emit({alpha: 64, beta: 30, gamma: 0})
  assert.ok(Math.abs(tracking.rotation().w) < 1 - 1e-6)
  assert.equal(tracking.requestRecenter(), true)
  const waiting = tracking.rotation()
  near(waiting.x, 0)
  near(waiting.y, 0)
  near(waiting.z, 0)
  near(waiting.w, 1)
  assert.equal(tracking.ready(), false)
  phone.emit({alpha: 71, beta: 30, gamma: 0})
  const fresh = tracking.rotation()
  near(fresh.x, 0)
  near(fresh.y, 0)
  near(fresh.z, 0)
  near(fresh.w, 1)
  time = 2_310
  phone.emit({alpha: 79, beta: 30, gamma: 0})
  const moved = tracking.rotation()
  // In landscape orientation a heading change rotates about a mixture of
  // local axes, not necessarily Y. Check the physical 8-degree rotation,
  // independent of screen orientation or Euler-axis convention.
  near(Math.hypot(moved.x, moved.y, moved.z), Math.sin(4 * Math.PI / 180))
  near(2 * Math.acos(Math.min(1, Math.abs(moved.w))), 8 * Math.PI / 180)
  tracking.stop()
  assert.equal(phone.hasListener(), false)
  assert.equal(tracking.rotation(), null)
  assert.deepEqual(status, ["waiting", "tracking", "off"])
})

test("only a real sensor failure counts as unavailable", () => {
  for (const status of ["denied", "unsupported", "https-required"]) {
    assert.equal(headTrackingUnavailable(status), true)
  }
  for (const status of ["off", "waiting", "tracking", "recentered"]) {
    assert.equal(headTrackingUnavailable(status), false)
  }
})
