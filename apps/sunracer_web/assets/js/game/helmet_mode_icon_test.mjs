import {test} from "node:test"
import assert from "node:assert/strict"
import {helmetModeIcon, MODE_GAZE_TARGET} from "./helmet_mode_icon.mjs"

const world = flightMode => new Map([["7", {id: "7", flightMode}]])

test("no icon until the world says which mode the ship is in", () => {
  assert.equal(helmetModeIcon(world(undefined), "7").visible, false)
  assert.equal(helmetModeIcon(world("nonsense"), "7").visible, false)
  assert.equal(helmetModeIcon(undefined, "7").visible, false)
  assert.equal(helmetModeIcon(world("cruise"), null).visible, false)
})

test("cruise offers to cut the assist", () => {
  const icon = helmetModeIcon(world("cruise"), "7")
  assert.equal(icon.visible, true)
  assert.equal(icon.armed, true)
  assert.equal(icon.pending, false)
  assert.equal(icon.mode, "cruise")
  assert.deepEqual(icon.lines, ["CRUISE", "CUT ASSIST"])
})

test("newtonian offers to restore it", () => {
  assert.deepEqual(helmetModeIcon(world("newtonian"), "7").lines,
    ["NEWTONIAN", "RESTORE ASSIST"])
})

test("the icon disarms while a switch is in flight", () => {
  const icon = helmetModeIcon(world("cruise"), "7", {pending: true})
  assert.equal(icon.armed, false)
  assert.equal(icon.pending, true)
  assert.ok(icon.lines.includes("SWITCHING"))
})

test("the label follows the world, never a local guess", () => {
  // Same pilot, server says newtonian: the icon must say so even if a
  // previous dwell asked for the opposite.
  assert.equal(helmetModeIcon(world("newtonian"), "7").mode, "newtonian")
})

test("the gaze target name is stable", () => {
  assert.equal(MODE_GAZE_TARGET, "flight_mode")
})
