import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {acceptOwnShipPose} from "./own_ship_pose_policy.mjs"

const read = name => readFileSync(new URL(name, import.meta.url), "utf8")

test("only an authoritative world tick or forced snap restarts own-ship prediction", () => {
  assert.equal(acceptOwnShipPose({existing: true, ownShip: true}), false)
  assert.equal(acceptOwnShipPose({existing: true, ownShip: true, worldTick: true}), true)
  assert.equal(acceptOwnShipPose({existing: true, ownShip: true, snapshot: true}), true)
  assert.equal(acceptOwnShipPose({existing: false, ownShip: true}), true)
  assert.equal(acceptOwnShipPose({existing: true, ownShip: false}), true)
})

test("world-state ticks update own-ship pose, ordinary event/ack snapshots do not", () => {
  const client = read("./client.js")
  assert.match(client, /this\.upsertEntity\(entity, false, true\)/)
  assert.match(client, /upsertEntity\(entity, snap = false, fromWorldTick = false\)/)
  assert.match(client, /const acceptPose = acceptOwnShipPose\(/)
  assert.match(client, /if \(acceptPose\) \{\s*existing\.authoritativeAt = authoritativeAt/)
  assert.match(client, /if \(acceptPose\) \{[\s\S]*?existing\.angularVelocity/)
  assert.match(client, /if \(acceptPose\) \{[\s\S]*?existing\.velocity = velocity/)
  assert.match(client, /if \(acceptPose && destination\)/)
  assert.match(client, /if \(snap\) existing\.render = \{\.\.\.target\}/)
  assert.match(client, /if \(response\.entity\) this\.upsertEntity\(response\.entity\)/)
  assert.match(client, /this\.flightInputHistory\?\.record\(performance\.now\(\), this\.flightControls\.axes\(\)\)/)
})
