import assert from "node:assert/strict"
import test from "node:test"
import {toScene, toWorld, pointerNdc, WORLD_SCALE} from "./stereo_math.mjs"

const rect = {left: 10, top: 20, width: 1000, height: 600}

test("existing XY world coordinates roundtrip through 3D presentation", () => {
  assert.ok(WORLD_SCALE > 0)
  const point = {x: 1000, y: 2500}
  const back = toWorld(toScene(point))
  assert.ok(Math.abs(back.x - point.x) < 1e-8)
  assert.ok(Math.abs(back.y - point.y) < 1e-8)
})

test("desktop mode uses the full width", () => {
  assert.deepEqual(pointerNdc({clientX: 510, clientY: 320}, rect), {x: 0, y: 0, eye: "center"})
})

test("SBS keeps left and right eye pointer projections independent", () => {
  assert.deepEqual(pointerNdc({clientX: 260, clientY: 320}, rect, "sbs"), {x: 0, y: 0, eye: "left"})
  assert.deepEqual(pointerNdc({clientX: 760, clientY: 320}, rect, "sbs"), {x: 0, y: 0, eye: "right"})
  assert.deepEqual(pointerNdc({clientX: 10, clientY: 20}, rect, "sbs"), {x: -1, y: 1, eye: "left"})
})

test("SBS picking follows the calibrated eye gap", () => {
  // Positive gap: 100px black strip in the middle belongs to neither eye.
  assert.equal(pointerNdc({clientX: 510, clientY: 320}, rect, "sbs", 100), null)
  assert.deepEqual(pointerNdc({clientX: 235, clientY: 320}, rect, "sbs", 100), {x: 0, y: 0, eye: "left"})
  assert.deepEqual(pointerNdc({clientX: 785, clientY: 320}, rect, "sbs", 100), {x: 0, y: 0, eye: "right"})
  // Negative gap: images are shifted inward by 25px each, so the physical
  // viewport centre maps to the left of the left eye's optical centre.
  const left = pointerNdc({clientX: 260, clientY: 320}, rect, "sbs", -50)
  assert.equal(left.eye, "left")
  assert.ok(Math.abs(left.x - (-0.1)) < 1e-9)
  const right = pointerNdc({clientX: 760, clientY: 320}, rect, "sbs", -50)
  assert.ok(Math.abs(right.x - 0.1) < 1e-9)
})

test("invalid and outside-viewport pointers are rejected", () => {
  assert.equal(pointerNdc({clientX: -10, clientY: 100}, rect), null)
  assert.equal(pointerNdc({clientX: Infinity, clientY: 100}, rect), null)
  assert.equal(pointerNdc({clientX: 20, clientY: 100}, {...rect, width: 0}), null)
})

test("vertical space coordinate is real 3D height without altering atlas plane", () => {
  const start = {x: 1500, y: 3200, z: 0}
  const high = {x: 1500, y: 3200, z: 750}
  const a = toScene(start)
  const b = toScene(high)
  assert.equal(a.x, b.x)
  assert.equal(a.z, b.z)
  assert.ok(b.y > a.y)
  const back = toWorld(b)
  assert.ok(Math.abs(back.z - 750) < 1e-7)
})
