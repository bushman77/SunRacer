import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {OwnShipCameraReconciler, CAMERA_REBASE_DURATION_MS,
  CAMERA_REBASE_MAX_DEGREES} from "./own_ship_camera_reconciler.mjs"
import {fromAngles} from "./own_ship_prediction.mjs"

const yaw = degrees => fromAngles({yaw: degrees*Math.PI/180})
const samePose = (a,b,epsilon=1e-6) => {
  const dot=Math.abs(a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w)
  assert.ok(Math.abs(dot-1)<epsilon, "orientation discontinuity: "+dot)
}
test("a new server tick cannot jerk the current predicted camera backward", () => {
  const bridge = new OwnShipCameraReconciler()
  const previous = yaw(15)
  const delayedTick = yaw(9)
  assert.equal(bridge.rebase(previous, delayedTick, 1000), true)
  samePose(bridge.apply(delayedTick,1000),previous)
  const mid=bridge.apply(delayedTick,1000+CAMERA_REBASE_DURATION_MS/2)
  assert.ok(mid)
  samePose(bridge.apply(delayedTick,1000+CAMERA_REBASE_DURATION_MS),delayedTick)
})
test("back-to-back ticks retain continuity while corrections are in progress", () => {
  const bridge=new OwnShipCameraReconciler()
  bridge.rebase(yaw(10),yaw(6),1000)
  const before = bridge.apply(yaw(21),1090)
  bridge.rebase(before,yaw(17),1090)
  const after = bridge.apply(yaw(17),1090)
  samePose(before,after)
  samePose(bridge.apply(yaw(18),1090+CAMERA_REBASE_DURATION_MS),yaw(18))
})
test("never suppress large authority corrections or discontinuous transitions", () => {
  const bridge=new OwnShipCameraReconciler()
  assert.ok(CAMERA_REBASE_MAX_DEGREES < 35)
  assert.equal(bridge.rebase(yaw(5),yaw(100),1000),false)
  samePose(bridge.apply(yaw(100),1000),yaw(100))
  assert.equal(bridge.rebase(yaw(10),yaw(7),1200),true)
  bridge.reset()
  samePose(bridge.apply(yaw(7),1200),yaw(7))
  assert.equal(bridge.rebase(null,yaw(10),1200),false)
  assert.equal(bridge.rebase(yaw(10),yaw(8),Number.NaN),false)
})
test("desktop applies reconciliation to predicted pose, not server-owned state", () => {
  const client=readFileSync(new URL("./client.js",import.meta.url),"utf8")
  assert.match(client,/this\.ownShipCameraReconciler = new OwnShipCameraReconciler\(\)/)
  assert.match(client,/this\.ownShipCameraReconciler\.reset\(\)/)
  assert.match(client,/const beforeTickVisual =/)
  assert.match(client,/this\.ownShipCameraReconciler\.rebase\(/)
  assert.match(client,/this\.ownShipCameraReconciler\.apply\(predictedOrientation, now\)/)
  assert.match(client,/this\.upsertEntity\(entity, false, true\)/)
  assert.match(client,/this\.sbsRelayWorld\.publish\(this\.worldStream\.map, false, visual\)/)
})
