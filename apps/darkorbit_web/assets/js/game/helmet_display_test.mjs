import test from "node:test"
import assert from "node:assert/strict"
import {helmetMaxPixelRatio, HELMET_DEFAULT_GAP_PX, HELMET_DEFAULT_MAX_DPR} from "./helmet_display.mjs"
import {HELMET_GAP_MIN, HELMET_GAP_MAX} from "./helmet_alignment.mjs"

test("first-run gap shifts images inward and stays inside calibration limits", () => {
  assert.ok(HELMET_DEFAULT_GAP_PX < 0)
  assert.ok(HELMET_DEFAULT_GAP_PX >= HELMET_GAP_MIN && HELMET_DEFAULT_GAP_PX <= HELMET_GAP_MAX)
})

test("headset render resolution defaults above the old 1.5 cap and is bounded", () => {
  assert.equal(helmetMaxPixelRatio(null), HELMET_DEFAULT_MAX_DPR)
  assert.ok(HELMET_DEFAULT_MAX_DPR > 1.5)
  assert.equal(helmetMaxPixelRatio("2.5"), 2.5)
  assert.equal(helmetMaxPixelRatio("9"), 3)
  assert.equal(helmetMaxPixelRatio("0.2"), 1)
  assert.equal(helmetMaxPixelRatio("nope"), HELMET_DEFAULT_MAX_DPR)
})
