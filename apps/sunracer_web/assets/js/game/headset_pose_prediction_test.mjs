import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {predictVisualPose, HeadsetPoseSmoother, HEADSET_PREDICTION_MAX_SECONDS}
  from "./headset_pose_prediction.mjs"
import {rotateLocal} from "./own_ship_prediction.mjs"
import {smoothOrientation} from "./orientation_interpolation.mjs"
import {VISUAL_POSE_SETTLE_SECONDS, relayRates} from "./local_visual_pose.mjs"

const read = path => readFileSync(new URL(path, import.meta.url), "utf8")
const identity = {x: 0, y: 0, z: 0, w: 1}
const deg = 180 / Math.PI
const angleBetween = (a, b) => {
  const dot = Math.abs(a.x*b.x + a.y*b.y + a.z*b.z + a.w*b.w)
  return 2 * Math.acos(Math.min(1, dot)) * deg
}

// Laptop turning steadily at 60 deg/s; poses sent every 32ms and arriving
// with up to +/-12ms of Wi-Fi jitter. Headset renders at 60 fps.
function simulate(render) {
  const rate = 60 / deg
  let seed = 7
  const jitter = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 24
  // The LAN link is TCP: poses arrive late and bunched, but in order.
  const arrivals = []
  let last = -Infinity
  for (let sent = 0; sent < 2000; sent += 32) {
    last = Math.max(last, sent + 20 + jitter())
    arrivals.push({at: last, sent})
  }
  let latest = null
  let shown = null
  const steps = []
  let next = 0
  for (let t = 200; t < 1800; t += 1000 / 60) {
    while (next < arrivals.length && arrivals[next].at <= t) {
      const a = arrivals[next++]
      latest = {receivedAt: a.at, target: {x: 0, y: 0, z: 0},
        orientation: rotateLocal(identity, {yaw: rate * a.sent / 1000, pitch: 0, roll: 0}),
        rates: {yaw: rate, pitch: 0, roll: 0}}
    }
    const out = render(latest, shown, t)
    if (shown) steps.push(angleBetween(shown, out))
    shown = out
  }
  const mean = steps.reduce((a, b) => a + b, 0) / steps.length
  const worst = Math.max(...steps.map(s => Math.abs(s - mean)))
  return {mean, worst}
}

test("headset view turns evenly between jittery LAN poses", () => {
  const smoother = new HeadsetPoseSmoother()
  const now = simulate((visual, shown, t) =>
    smoother.step(visual, {x: 0, y: 0, z: 0}, t).orientation)
  // Old behaviour: chase each pose with the 25ms settle.
  const old = simulate((visual, shown) => smoothOrientation(shown || visual.orientation,
    visual.orientation, 1 / 60, VISUAL_POSE_SETTLE_SECONDS))
  // 60 deg/s at 60 fps is 1 degree per frame either way...
  assert.ok(Math.abs(now.mean - 1) < 0.05, `mean ${now.mean}`)
  // ...but the old method's per-frame step swung by most of a degree
  // (rotate, stop, jump), while the predicted view stays nearly constant.
  assert.ok(old.worst > 0.6, `old worst ${old.worst}`)
  assert.ok(now.worst < 0.25, `new worst ${now.worst}`)
  assert.ok(now.worst < old.worst / 3)
})

test("prediction extrapolates by body rates and velocity, bounded in time", () => {
  const visual = {receivedAt: 1000, orientation: identity, target: {x: 1, y: 2, z: 3},
    rates: {yaw: 1, pitch: 0, roll: 0}}
  const p = predictVisualPose(visual, {x: 10, y: 0, z: -20}, 1050)
  assert.ok(Math.abs(p.age - 0.05) < 1e-9)
  assert.ok(Math.abs(angleBetween(identity, p.orientation) - 0.05 * deg) < 1e-6)
  assert.deepEqual(p.target, {x: 1.5, y: 2, z: 2})
  const late = predictVisualPose(visual, null, 5000)
  assert.equal(late.age, HEADSET_PREDICTION_MAX_SECONDS)
  // No rates (older laptop build): hold the pose, as before.
  const still = predictVisualPose({...visual, rates: null}, null, 1050)
  assert.deepEqual(still.orientation, identity)
  assert.equal(predictVisualPose(null, null, 1000), null)
})

test("rates are bounded on the LAN boundary", () => {
  assert.deepEqual(relayRates({yaw: 1, pitch: -2, roll: 0, x: 4}), {yaw: 1, pitch: -2, roll: 0})
  assert.equal(relayRates({yaw: 11, pitch: 0, roll: 0}), null)
  assert.equal(relayRates({yaw: 1, pitch: 0}), null)
  assert.equal(relayRates("fast"), null)
})

test("laptop sends the drawn camera's rates; headset uses the smoother", () => {
  const client = read("./client.js")
  assert.match(client, /this\.clientLedCamera\.rates : own\.angularVelocity/)
  assert.match(client, /visual\.rates = \{yaw: rates\.yaw/)
  const helmet = read("./helmet_client.mjs")
  assert.match(helmet, /this\.headsetPose\.step\(visual, entity\.velocity, time\)/)
  assert.match(helmet, /entity\.renderOrientation = pose\.orientation/)
  assert.match(read("./sbs_relay_world.mjs"), /result\.rates = rates/)
})
