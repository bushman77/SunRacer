import test from "node:test"
import assert from "node:assert/strict"
import {projectSbsRelayWorld, projectLocalVisualPose,
  SbsRelayWorldPublisher, WORLD_INTERVAL_MS, VISUAL_POSE_CARRY_MS} from "./sbs_relay_world.mjs"

const map = () => ({
  map_id: "sol:free_earth", tick: 102, tick_ms: 100,
  socket_token: "NEVER", billing: {credits: 100000},
  boundaries: {width: 20000, height: 12000, account: "HIDDEN"},
  volume: {altitude_min: -1000, altitude_max: 3000},
  entities: [{
    id: 12, kind: "pilot", display_name: "Pilot",
    position_3d: {x: 10, y: 2, z: 3},
    velocity: {x: 1, y: 0, z: 2},
    hull: 90, max_hull: 100,
    inventory: [{id: "valuable"}],
    credential: "VERY_SECRET", wallet: {credits: 1_000_000},
  }, {
    id: 18, kind: "npc", display_name: "Scow",
    position_3d: {x: 12, y: 3, z: 4},
  }],
})

test("LAN snapshot updates favor responsiveness without altering EC2 subscription", () => {
  assert.equal(WORLD_INTERVAL_MS, 32)
  const publisher = new SbsRelayWorldPublisher({invoke: () => null})
  assert.equal(publisher.delay, WORLD_INTERVAL_MS)
  publisher.clear()
})

test("passes only a tightly bounded visual world projection", () => {
  const clean = projectSbsRelayWorld(map())
  assert.equal(clean.map_id, "sol:free_earth")
  assert.equal(clean.tick, 102)
  assert.equal(clean.entities.length, 2)
  assert.deepEqual(clean.entities[0].position_3d, {x: 10, y: 2, z: 3})
  const json = JSON.stringify(clean)
  for (const secret of ["NEVER", "HIDDEN", "VERY_SECRET", "valuable",
    "wallet", "inventory", "billing", "socket_token", "credential"]) {
    assert.equal(json.includes(secret), false, secret)
  }
})

test("malformed ticks, missing entity identity and excess rows fail closed", () => {
  assert.equal(projectSbsRelayWorld(null), null)
  assert.equal(projectSbsRelayWorld({...map(), tick: NaN}), null)
  assert.equal(projectSbsRelayWorld({...map(), entities: [{}]}), null)
  assert.equal(projectSbsRelayWorld({...map(), entities:
    Array.from({length: 257}, (_, id) => ({id, kind: "npc"}))}), null)
})

test("publisher coalesces changes and uses ONLY the local native command", async () => {
  const calls = []
  const publisher = new SbsRelayWorldPublisher({
    invoke: () => async (command, payload) => {calls.push({command, payload})},
    delay: 15,
  })
  publisher.publish(map(), true)
  await new Promise(resolve => setTimeout(resolve, 5))
  assert.equal(calls.length, 1)
  assert.equal(calls[0].command, "publish_sbs_relay_world")
  assert.equal(calls[0].payload.world.tick, 102)
  publisher.publish({...map(), tick: 103})
  publisher.publish({...map(), tick: 104})
  await new Promise(resolve => setTimeout(resolve, 40))
  assert.equal(calls.length, 2)
  assert.equal(calls[1].payload.world.tick, 104)
  publisher.clear()
})

test("local predicted pose is scoped to same authoritative map and strips nonvisual data", () => {
  const input = map()
  const pose = {
    id: 12,
    orientation: {x: 0, y: 0.5, z: 0, w: Math.sqrt(0.75)},
    position_3d: {x: 11, y: 2, z: 3},
    credential: "UNSAFE", inventory: [{part: "private"}],
  }
  const projected = projectSbsRelayWorld(input, pose)
  assert.deepEqual(projected.visual_pose, {
    id: 12, orientation: pose.orientation, position_3d: pose.position_3d,
  })
  assert.equal(JSON.stringify(projected).includes("UNSAFE"), false)
  assert.equal(projectLocalVisualPose(input, {...pose, id: 999}), null)
  assert.equal(projectLocalVisualPose(input, {...pose, orientation: {x: 0, y: 0, z: 0, w: 0}}), null)
  assert.equal(projectLocalVisualPose(input, {...pose, position_3d: {x: Infinity, y: 0, z: 0}}), null)
})

test("coalesced publisher retains latest visual pose without allocating a frame queue", async () => {
  const calls = []
  const p = new SbsRelayWorldPublisher({
    invoke: () => async (_command, {world}) => calls.push(world),
    delay: 10,
  })
  const pose = x => ({id: 12, position_3d: {x, y: 1, z: 1},
    orientation: {x: 0, y: 0, z: 0, w: 1}})
  p.publish(map(), false, pose(1))
  p.publish(map(), false, pose(2))
  p.publish(map(), false, pose(3))
  await new Promise(resolve => setTimeout(resolve, 35))
  assert.equal(calls.length, 1)
  assert.equal(calls[0].visual_pose.position_3d.x, 3)
  p.clear()
})

test("string-normalized local client IDs match numeric authoritative IDs exactly at Rust boundary", () => {
  const input = map()
  const pose = {id: "12", orientation: {x:0, y:0, z:0, w:1},
    position_3d: {x: 1, y: 2, z: 3}}
  const local = projectLocalVisualPose(input, pose)
  assert.equal(local.id, 12)
  assert.equal(projectSbsRelayWorld(input, pose).visual_pose.id, 12)
})

test("a world update without a pose does not strip a fresh cockpit pose", async () => {
  const calls = []
  let now = 1000
  const p = new SbsRelayWorldPublisher({
    invoke: () => async (_command, {world}) => calls.push(world),
    delay: 10, now: () => now,
  })
  const pose = {id: 12, position_3d: {x: 7, y: 1, z: 1},
    orientation: {x: 0, y: 0, z: 0, w: 1}}
  p.publish(map(), false, pose)
  now += 20
  p.publish({...map(), tick: 103})
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(calls.length, 1)
  assert.equal(calls[0].tick, 103)
  assert.equal(calls[0].visual_pose.position_3d.x, 7)
  // Once the cockpit stops publishing poses, they expire.
  now += VISUAL_POSE_CARRY_MS + 1
  p.publish({...map(), tick: 104}, true)
  await new Promise(resolve => setTimeout(resolve, 5))
  assert.equal(calls.at(-1).tick, 104)
  assert.equal(calls.at(-1).visual_pose, undefined)
  // Never carried across a map change.
  p.publish(map(), false, pose)
  p.publish({...map(), map_id: "other-map", tick: 1})
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(calls.at(-1).map_id, "other-map")
  assert.equal(calls.at(-1).visual_pose, undefined)
  // clear() forgets the pose entirely.
  p.publish(map(), false, pose)
  p.clear()
  p.publish({...map(), tick: 105}, true)
  await new Promise(resolve => setTimeout(resolve, 5))
  assert.equal(calls.at(-1).visual_pose, undefined)
})

test("visual pose carries a bounded stick deflection for the headset line", () => {
  const pose = {id: 12, position_3d: {x: 1, y: 1, z: 1},
    orientation: {x: 0, y: 0, z: 0, w: 1}}
  const steered = projectSbsRelayWorld(map(), {...pose,
    steering: {x: -0.5, y: 0.25, aspect: 1.6, secret: "NO"}})
  assert.deepEqual(steered.visual_pose.steering, {x: -0.5, y: 0.25, aspect: 1.6})
  assert.equal(projectSbsRelayWorld(map(), pose).visual_pose.steering, undefined)
  assert.equal(projectSbsRelayWorld(map(), {...pose,
    steering: {x: NaN, y: 0, aspect: 1.6}}).visual_pose.steering, undefined)
})

test("visual pose carries the laptop sample time", () => {
  const pose = {id: 12, position_3d: {x: 1, y: 1, z: 1},
    orientation: {x: 0, y: 0, z: 0, w: 1}}
  assert.equal(projectSbsRelayWorld(map(), {...pose, t: 4567.25}).visual_pose.t, 4567.25)
  assert.equal(projectSbsRelayWorld(map(), {...pose, t: -1}).visual_pose.t, undefined)
  assert.equal(projectSbsRelayWorld(map(), {...pose, t: Infinity}).visual_pose.t, undefined)
})
