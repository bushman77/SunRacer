import {test} from "node:test"
import assert from "node:assert/strict"
import {helmetRespawnView, RESPAWN_GAZE_TARGET}
  from "./helmet_respawn_view.mjs"

const world = (status) => new Map([["7", {id: "7", status}]])

test("a live pilot sees no recovery panel", () => {
  const view = helmetRespawnView(world("alive"), "7")
  assert.equal(view.destroyed, false)
  assert.deepEqual(view.lines, [])
  assert.equal(view.button, "")
})

test("an unknown pilot id never shows the panel", () => {
  assert.equal(helmetRespawnView(world("destroyed"), null).destroyed, false)
  assert.equal(helmetRespawnView(undefined, "7").destroyed, false)
  // Someone else's wreck is not the viewer's death.
  assert.equal(helmetRespawnView(world("destroyed"), "9").destroyed, false)
})

test("a destroyed pilot gets an armed recovery target", () => {
  const view = helmetRespawnView(world("destroyed"), "7")
  assert.equal(view.destroyed, true)
  assert.equal(view.armed, true)
  assert.equal(view.pending, false)
  assert.equal(view.button, "RECOVER AT EARTH")
  assert.equal(view.lines[0], "SHIP DESTROYED")
  // cockpitLabel sizes its font by line count; keep the panel readable.
  assert.ok(view.lines.length <= 3)
})

test("a request in flight disarms the target so a held gaze cannot resend", () => {
  const view = helmetRespawnView(world("destroyed"), "7", {pending: true})
  assert.equal(view.pending, true)
  assert.equal(view.armed, false)
  assert.equal(view.button, "WORKING")
})

test("a refusal re-arms the target and names the reason", () => {
  const view = helmetRespawnView(world("destroyed"), "7",
    {error: "ship_not_destroyed"})
  assert.equal(view.armed, true)
  assert.equal(view.button, "TRY AGAIN")
  assert.ok(view.lines.includes("HULL IS INTACT"))
})

test("an unmapped reason is still rendered safely", () => {
  const view = helmetRespawnView(world("destroyed"), "7",
    {error: "weird_<thing>_42"})
  assert.ok(view.lines[2].length <= 24)
  assert.ok(!/[<>]/.test(view.lines[2]))
})

test("the gaze target name is stable", () => {
  assert.equal(RESPAWN_GAZE_TARGET, "respawn")
})
