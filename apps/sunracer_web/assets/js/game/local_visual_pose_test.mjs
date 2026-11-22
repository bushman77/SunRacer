import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {localVisualPose, freshLocalVisualPose,
  VISUAL_POSE_MAX_AGE_MS, VISUAL_POSE_SETTLE_SECONDS} from "./local_visual_pose.mjs"

const read = path => readFileSync(new URL(path, import.meta.url), "utf8")
const map = {map_id: "sol:free_10", tick: 25,
  entities: [{id: 10, kind: "pilot"}, {id: 11, kind: "npc"}],
  visual_pose: {id: 10, orientation: {x: 0, y: 0, z: 0, w: 1},
    position_3d: {x: 10, y: 20, z: 30}}}

test("visual pose is bounded to paired own ship and live map only", () => {
  const pose = localVisualPose(map, "10", 1000)
  assert.equal(pose.mapId, "sol:free_10")
  assert.deepEqual(pose.target, {x: 10, y: 20, z: 30})
  assert.deepEqual(pose.orientation, {x: 0, y: 0, z: 0, w: 1})
  assert.equal(localVisualPose(map, "11", 1000), null)
  assert.equal(localVisualPose({...map, visual_pose: {...map.visual_pose, id: 45}}, "45", 1000), null)
  assert.equal(localVisualPose({...map, visual_pose: {...map.visual_pose,
    orientation: {x:0, y:0, z:0, w:0}}}, "10", 1000), null)
  assert.equal(localVisualPose({...map, visual_pose: {...map.visual_pose,
    position_3d: {x: Infinity, y: 0, z: 0}}}, "10", 1000), null)
  assert.equal(localVisualPose({...map, visual_pose: null}, "10", 1000), null)
  assert.equal(freshLocalVisualPose(pose, "sol:free_10", "10", 1000), pose)
  assert.equal(freshLocalVisualPose(pose, "sol:free_10", "10", 1150), pose)
  assert.equal(freshLocalVisualPose(pose, "sol:free_10", "10", 1151), null)
  assert.equal(freshLocalVisualPose(pose, "sol:free_11", "10", 1100), null)
  assert.equal(freshLocalVisualPose(pose, "sol:free_10", "11", 1100), null)
  assert.ok(VISUAL_POSE_SETTLE_SECONDS < 0.045)
  assert.equal(VISUAL_POSE_MAX_AGE_MS, 150)
})

test("laptop publishes current predicted view, even while WebGL draws are paused", () => {
  const client = read("./client.js")
  const flight = client.slice(client.indexOf("  frame(time) {"), client.indexOf("  interpolate(deltaSeconds) {"))
  assert.match(flight, /this\.interpolate\(deltaSeconds\)/)
  assert.match(flight, /this\.publishOwnVisualPose\(time\)/)
  assert.ok(flight.indexOf("this.interpolate(deltaSeconds)") < flight.indexOf("this.publishOwnVisualPose(time)"))
  assert.match(client, /orientation: own\.renderOrientation \|\| own\.orientation/)
  assert.match(client, /position_3d: own\.render \|\| own\.target/)
  assert.match(client, /this\.sbsRelayWorld\.publish\(this\.worldStream\.map, false, visual\)/)
  assert.match(client, /this\.desktopVrOnlyActive/)
})

test("phone follows LAN-only pose without mutating server-owned entity fields", () => {
  const phone = read("./helmet_client.mjs")
  assert.match(phone, /this\.localVisualPose = localVisualPose\(map, this\.selfId, performance\.now\(\)\) \|\|/)
  assert.match(phone, /freshLocalVisualPose\(this\.localVisualPose, this\.mapId, this\.selfId, time\)/)
  assert.match(phone, /smoothEntityPresentation\(entity, deltaSeconds,/)
  assert.match(phone, /if \(visual && entity\.id === this\.selfId && !this\.docked\)/)
  assert.match(phone, /\{orientation: visual\.orientation, target: visual\.target,/)
  assert.match(phone, /this\.localVisualPose = null/)
  assert.match(phone, /this\.disableLocalRelay\(\)/)
  assert.doesNotMatch(phone, /entity\.orientation = visual\.orientation/)
  assert.doesNotMatch(phone, /entity\.target = visual\.target/)
})
