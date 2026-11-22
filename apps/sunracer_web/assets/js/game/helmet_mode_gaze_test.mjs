import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {modeForGazeTarget, modeGazeTarget, modeSelectionAction}
  from "./helmet_mode_gaze.mjs"
import {cockpitModePlacement} from "./cockpit_mode_layout.mjs"

const source = path => readFileSync(new URL(path, import.meta.url), "utf8")

test("the two ship icons have distinct, explicit authenticated mode intents", () => {
  assert.equal(modeGazeTarget("cruise"), "flight_mode_cruise")
  assert.equal(modeGazeTarget("newtonian"), "flight_mode_newtonian")
  assert.equal(modeForGazeTarget("flight_mode_cruise"), "cruise")
  assert.equal(modeForGazeTarget("flight_mode_newtonian"), "newtonian")
  assert.equal(modeSelectionAction("cruise"), "select_cruise_mode")
  assert.equal(modeSelectionAction("newtonian"), "select_newtonian_mode")
  for (const invalid of [null, undefined, "", "flight_mode", "afterburner", "CRUISE"]) {
    assert.equal(modeForGazeTarget(invalid), null)
    assert.equal(modeGazeTarget(invalid), null)
    assert.equal(modeSelectionAction(invalid), null)
  }
})

test("transparent gaze targets are separate, larger than their visible icons", () => {
  const view = source("./stereo_view.js")
  assert.match(view, /this\.helmetModeHitboxes = \{\}/)
  assert.match(view, /new THREE\.PlaneGeometry\(0\.265, 0\.34\)/)
  assert.match(view, /transparent: true, opacity: 0/)
  assert.match(view, /side: THREE\.DoubleSide/)
  assert.match(view, /Object\.values\(this\.helmetModeHitboxes \|\| \{\}\)/)
  assert.match(view, /this\.helmetModeHitboxes\?\.\[requestedMode\]/)
  assert.match(view, /return modeGazeTarget\(requestedMode\)/)

  for (const scale of [0.2, 0.5, 1]) {
    const p = cockpitModePlacement(scale)
    const delta = p.newtonian.x - p.cruise.x
    assert.ok(delta > 0.265,
      "the selectable hitboxes must not overlap and misidentify the intended mode")
    assert.ok(0.265 > p.side && 0.34 > p.side,
      "head-gaze targets should be larger than visual symbols")
  }
})

test("phone only sends an allowlisted mode intent; laptop owns the flight command", () => {
  const headset = source("./helmet_client.mjs")
  const manager = readFileSync(new URL(
    "../../../lib/sunracer_web/helmet_manager.ex", import.meta.url), "utf8")
  const desktop = source("./client.js")
  assert.match(headset, /requestFlightModeSelection\(mode\)/)
  assert.match(headset, /old\.push\("helmet_action", \{action\}, 5_000\)/)
  assert.match(manager, /@gaze_actions ~w\(toggle_flight_mode select_cruise_mode select_newtonian_mode\)/)
  assert.match(desktop, /this\.flightControls\?\.setMode\("cruise"\)/)
  assert.match(desktop, /this\.flightControls\?\.setMode\("newtonian"\)/)
  assert.doesNotMatch(headset, /channel\.push\("flight_controls"/)
})
