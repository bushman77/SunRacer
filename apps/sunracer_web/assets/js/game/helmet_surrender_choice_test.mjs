import {test} from "node:test"
import assert from "node:assert/strict"
import {helmetSurrenderChoice, ACCEPT_GAZE_TARGET, SEIZE_GAZE_TARGET,
  DISMISS_GAZE_TARGET} from "./helmet_surrender_choice.mjs"

const yielding = {surrendered: true, call_sign: "Corsair-17"}

test("no prompt without an offered surrender", () => {
  assert.equal(helmetSurrenderChoice(null).open, false)
  assert.equal(helmetSurrenderChoice({surrendered: false}).open, false)
  assert.deepEqual(helmetSurrenderChoice(undefined).lines, [])
})

test("an offered surrender arms both outcomes and a way out", () => {
  const view = helmetSurrenderChoice(yielding)
  assert.equal(view.open, true)
  assert.equal(view.armed, true)
  assert.equal(view.accept, "RELEASE")
  assert.equal(view.seize, "SEIZE HOLD")
  assert.equal(view.dismiss, "KEEP FIRING")
  assert.ok(view.lines[0].startsWith("Corsair-17"))
  assert.ok(view.lines.length <= 2)
})

test("keep firing hides the prompt without touching the server", () => {
  const view = helmetSurrenderChoice(yielding, {dismissed: true})
  assert.equal(view.open, false)
  assert.equal(view.accept, "")
})

test("a request in flight disarms both outcomes", () => {
  const view = helmetSurrenderChoice(yielding, {pending: true})
  assert.equal(view.pending, true)
  assert.equal(view.armed, false)
  assert.equal(view.dismiss, "")
})

test("a refusal re-arms and names the reason", () => {
  const view = helmetSurrenderChoice(yielding, {error: "cargo_hold_full"})
  assert.equal(view.armed, true)
  assert.ok(view.lines.includes("NO ROOM IN THE HOLD"))
})

test("a missing or hostile call sign is rendered safely", () => {
  assert.ok(helmetSurrenderChoice({surrendered: true}).lines[0]
    .startsWith("CONTACT"))
  const long = helmetSurrenderChoice(
    {surrendered: true, call_sign: "x".repeat(99)})
  assert.ok(long.lines[0].length <= 18 + " YIELDS".length)
  const odd = helmetSurrenderChoice(yielding, {error: "a<b>c_42"})
  assert.ok(!/[<>]/.test(odd.lines[1]))
})

test("gaze target names are stable", () => {
  assert.equal(ACCEPT_GAZE_TARGET, "surrender_accept")
  assert.equal(SEIZE_GAZE_TARGET, "surrender_seize")
  assert.equal(DISMISS_GAZE_TARGET, "surrender_dismiss")
})
