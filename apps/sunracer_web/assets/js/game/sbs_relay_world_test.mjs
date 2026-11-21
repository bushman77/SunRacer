import test from "node:test"
import assert from "node:assert/strict"
import {projectSbsRelayWorld, SbsRelayWorldPublisher, WORLD_INTERVAL_MS} from "./sbs_relay_world.mjs"

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
  assert.equal(WORLD_INTERVAL_MS, 60)
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
