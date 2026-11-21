import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {WorldStreamDelta} from "./world_stream_delta.mjs"

const read = path => readFileSync(new URL(path, import.meta.url), "utf8")
const server = read("../../../lib/sunracer_web/channels/helmet_channel.ex")
const client = read("./helmet_client.mjs")

test("the authenticated helmet uses the desktop delta protocol, not recurring full snapshots", () => {
  assert.match(server, /WorldStreamPolicy\.project\(map, old, socket\.assigns\.helmet_player_id\)/)
  assert.match(server, /WorldStreamDelta\.between\(old, projected\)/)
  assert.match(server, /WorldStreamPolicy\.transmit\?\(delta, map\.tick_ms\)/)
  assert.match(server, /push\(socket, "world_delta", delta\)/)
  assert.doesNotMatch(server, /push\(socket, "world_state", map\)/)
  assert.match(client, /new WorldStreamDelta\(map\)/)
  assert.match(client, /this\.channel\.on\("world_delta"/)
  assert.match(client, /this\.worldStream\.apply\(delta\)/)
  assert.match(client, /this\.requestHelmetResync\(\)/)
  assert.match(server, /def handle_in\("helmet_resync"/)
  assert.match(server, /World\.region_for_player\(player_id\)/)
})

test("a phone reconstructs changing vessel state without another complete world map", () => {
  const snapshot = {
    tick: 50, tick_ms: 100, map_id: "1-1",
    entities: [{id: 42, kind: "player", throttle: 0, hull: 100},
      {id: 71, kind: "npc", state: "idle"}],
    station_attendants: [],
  }
  const stream = new WorldStreamDelta(snapshot)
  const next = stream.apply({
    base_tick: 50, tick: 52,
    entities: [{id: 42, throttle: 0.5}],
    removed: [71], changes: {},
  })
  assert.ok(next)
  assert.equal(next.entities.length, 1)
  assert.equal(next.entities[0].kind, "player")
  assert.equal(next.entities[0].throttle, 0.5)
  assert.equal(next.entities[0].hull, 100)
  const before = stream.map
  assert.equal(stream.apply({
    base_tick: 50, tick: 55, entities: [], removed: [], changes: {},
  }), null)
  assert.equal(stream.map, before, "missed baseline must trigger resync, not corrupt state")
  const idle = stream.apply({
    base_tick: 52, tick: 62, entities: [], removed: [], changes: {},
  })
  assert.equal(idle.tick, 62)
  assert.equal(idle.entities[0].hull, 100)
})

test("snapshot reset recovers from a gap or region transition", () => {
  const stream = new WorldStreamDelta({
    tick: 90, map_id: "1-1", entities: [{id: "a", kind: "player"}],
  })
  assert.equal(stream.apply({
    base_tick: 88, tick: 91, entities: [], removed: [], changes: {},
  }), null)
  stream.reset({tick: 3, map_id: "sol:mars",
    entities: [{id: "b", kind: "player"}]})
  assert.equal(stream.apply({
    base_tick: 3, tick: 4, entities: [{id: "b", throttle: 0.75}],
    removed: [], changes: {},
  }).entities[0].throttle, 0.75)
  assert.equal(stream.map.map_id, "sol:mars")
})
