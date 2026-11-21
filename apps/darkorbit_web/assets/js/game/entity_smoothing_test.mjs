import test from "node:test"
import assert from "node:assert/strict"
import {
  smoothEntityPresentation, smoothHeading, upsertHelmetEntity, SNAP_DISTANCE,
} from "./entity_smoothing.mjs"

const key = value => String(value)
const raw = (x, extra = {}) => ({
  id: 7, kind: "player", position_3d: {x, y: 0, z: 0},
  orientation: {x: 0, y: 0, z: 0, w: 1}, angle: 0, ...extra,
})

test("headset keeps one entity object so render state survives snapshots", () => {
  const entities = new Map()
  const first = upsertHelmetEntity(entities, raw(0), key, {snap: true})
  const second = upsertHelmetEntity(entities, raw(30), key)
  assert.equal(first, second)
  assert.deepEqual(second.target, {x: 30, y: 0, z: 0})
  // Not snapped: render still at the previous position until smoothed.
  assert.equal(second.render.x, 0)
})

test("render position eases toward the latest server tick instead of jumping", () => {
  const entities = new Map()
  const entity = upsertHelmetEntity(entities, raw(0), key, {snap: true})
  upsertHelmetEntity(entities, raw(100), key)
  smoothEntityPresentation(entity, 1 / 60)
  assert.ok(entity.render.x > 0 && entity.render.x < 100)
  for (let i = 0; i < 120; i++) smoothEntityPresentation(entity, 1 / 60)
  assert.ok(Math.abs(entity.render.x - 100) < 1e-3)
})

test("fresh snapshots and teleports snap instead of sweeping across space", () => {
  const entities = new Map()
  upsertHelmetEntity(entities, raw(0), key, {snap: true})
  const far = upsertHelmetEntity(entities, raw(SNAP_DISTANCE + 10), key)
  assert.equal(far.render.x, SNAP_DISTANCE + 10)
  const snapped = upsertHelmetEntity(entities, raw(5), key, {snap: true})
  assert.equal(snapped.render.x, 5)
})

test("orientation is smoothed too, not copied raw", () => {
  const entities = new Map()
  const entity = upsertHelmetEntity(entities, raw(0), key, {snap: true})
  const turned = {x: 0, y: Math.sin(Math.PI / 4), z: 0, w: Math.cos(Math.PI / 4)}
  upsertHelmetEntity(entities, raw(0, {orientation: turned}), key)
  smoothEntityPresentation(entity, 1 / 60)
  assert.ok(entity.renderOrientation.y > 0 && entity.renderOrientation.y < turned.y)
})

test("heading smoothing takes the short way around", () => {
  const next = smoothHeading(3.1, -3.1, 1)
  assert.ok(Math.abs(next) > 3.1)
})

test("own-ship prediction replaces the smoothing goal without touching server state", () => {
  const entities = new Map()
  const entity = upsertHelmetEntity(entities, raw(0), key, {snap: true})
  const predictedOrientation = {x: 0, y: 0.1, z: 0, w: Math.sqrt(0.99)}
  for (let i = 0; i < 60; i++) {
    smoothEntityPresentation(entity, 1 / 60, 0.045, {
      target: {x: 12, y: 0, z: 0}, orientation: predictedOrientation,
      positionSettleSeconds: 0.045,
    })
  }
  assert.ok(Math.abs(entity.render.x - 12) < 1e-3)
  assert.ok(Math.abs(entity.renderOrientation.y - 0.1) < 1e-3)
  assert.deepEqual(entity.target, {x: 0, y: 0, z: 0})
  assert.deepEqual(entity.orientation, {x: 0, y: 0, z: 0, w: 1})
})
