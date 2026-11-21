import test from "node:test"
import assert from "node:assert/strict"
import {
  distortedSampleUv, lensCenterU, parseLensCoefficients, DEFAULT_LENS_COEFFICIENTS,
} from "./lens_distortion.mjs"
import {inwardStereoProjectionOffset} from "./stereo_viewport.mjs"

const k = DEFAULT_LENS_COEFFICIENTS

test("the lens centre is unchanged and edges sample further out (barrel)", () => {
  assert.deepEqual(distortedSampleUv(0.5, 0.5, 0.5, 1.07, k), {u: 0.5, v: 0.5})
  const edge = distortedSampleUv(0.5, 0.9, 0.5, 1.07, k)
  assert.ok(edge.v > 0.9)
  assert.equal(distortedSampleUv(0.5, 0.999, 0.5, 1.07, k), null)
})

test("zero coefficients are an identity mapping", () => {
  const flat = {k1: 0, k2: 0}
  const p = distortedSampleUv(0.2, 0.7, 0.5, 1.2, flat)
  assert.ok(Math.abs(p.u - 0.2) < 1e-12 && Math.abs(p.v - 0.7) < 1e-12)
})

test("lens centre follows the calibrated inward image shift", () => {
  const shift = inwardStereoProjectionOffset(-50, 500)
  assert.ok(Math.abs(lensCenterU("left", shift) - 0.55) < 1e-12)
  assert.ok(Math.abs(lensCenterU("right", shift) - 0.45) < 1e-12)
  assert.equal(lensCenterU("left", 0), 0.5)
})

test("per-headset coefficients parse safely", () => {
  assert.deepEqual(parseLensCoefficients("0.3, 0.1"), {k1: 0.3, k2: 0.1})
  assert.deepEqual(parseLensCoefficients("abc"), {...k})
  assert.deepEqual(parseLensCoefficients("5,0"), {...k})
  assert.deepEqual(parseLensCoefficients(null), {...k})
})
