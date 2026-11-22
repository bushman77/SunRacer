import test from "node:test"
import assert from "node:assert/strict"
import {applyOwnShipMovementPreview} from "./own_ship_movement_preview.mjs"

test("own-ship previews update mode and throttle without rewinding camera state", () => {
  const orientation = {x: 0, y: 0.23, z: 0, w: 0.9732}
  const renderOrientation = {x: 0, y: 0.25, z: 0, w: 0.9682}
  const own = {
    id: "own", flightMode: "cruise", throttle: 0.2,
    orientation, renderOrientation,
    authoritativeAt: 1025,
    angularVelocity: {yaw: 1.3, pitch: 0, roll: 0},
    target: {x: 50, y: 40, z: 5},
    render: {x: 51, y: 39, z: 5},
    attitude: {yaw: 0.2, pitch: 0, roll: 0},
  }
  const poseBefore = {
    orientation: own.orientation, renderOrientation: own.renderOrientation,
    angularVelocity: own.angularVelocity, target: own.target, render: own.render,
    attitude: own.attitude, authoritativeAt: own.authoritativeAt,
  }
  for (let i = 0; i < 10; i++) {
    const preview = {
      id: "own", flight_mode: i % 2 ? "cruise" : "newtonian",
      throttle: i / 10,
      orientation: {x: 0, y: -1, z: 0, w: 0},
      angular_velocity: {yaw: 0, pitch: 0, roll: 0},
      position_3d: {x: -500, y: -400, z: -2},
      attitude: {yaw: -3, pitch: 0, roll: 0},
    }
    assert.equal(applyOwnShipMovementPreview(own, preview), true)
    assert.equal(own.flightMode, preview.flight_mode)
    assert.equal(own.throttle, preview.throttle)
    for (const [key, value] of Object.entries(poseBefore)) {
      assert.equal(own[key], value, key + " must never be replaced by a preview")
    }
  }
})

test("invalid previews cannot corrupt local flight metadata", () => {
  const own = {flightMode: "cruise", throttle: 0.5}
  assert.equal(applyOwnShipMovementPreview(null, {throttle: 1}), false)
  assert.equal(applyOwnShipMovementPreview(own, null), false)
  assert.equal(applyOwnShipMovementPreview(own,
    {flight_mode: "unknown", throttle: Infinity}), true)
  assert.deepEqual(own, {flightMode: "cruise", throttle: 0.5})
})

import {readFileSync} from "node:fs"

test("client previews never call upsertEntity for an existing local ship", () => {
  const client = readFileSync(new URL("./client.js", import.meta.url), "utf8")
  assert.match(client, /const ownShip = id === this\.selfId \? this\.entities\.get\(id\) : null/)
  assert.match(client, /if \(ownShip\) \{[\s\S]*?applyOwnShipMovementPreview\(ownShip, entity\)/)
  assert.match(client, /\} else \{\s*this\.upsertEntity\(entity\)/)
  assert.match(client, /for \(const entity of state\.entities\) \{[\s\S]*?this\.upsertEntity\(entity\)/)
})
