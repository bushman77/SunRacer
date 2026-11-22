import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {MODE_GAZE_TARGET, nextFlightMode, modeSelectionAction}
  from "./helmet_mode_gaze.mjs"
import {HelmetGazeDwell} from "./helmet_gaze_dwell.mjs"
import {cockpitModePlacement} from "./cockpit_mode_layout.mjs"

const source = path => readFileSync(new URL(path, import.meta.url), "utf8")

test("one stable gaze target toggles from the authoritative flight mode", () => {
  assert.equal(MODE_GAZE_TARGET, "flight_mode")
  assert.equal(nextFlightMode("cruise"), "newtonian")
  assert.equal(nextFlightMode("newtonian"), "cruise")
  assert.equal(nextFlightMode(null), null)
  assert.equal(nextFlightMode("unknown"), null)
  assert.equal(modeSelectionAction("cruise"), "select_cruise_mode")
  assert.equal(modeSelectionAction("newtonian"), "select_newtonian_mode")
  assert.equal(modeSelectionAction(null), null)
})

test("one 3D ship symbol and one larger invisible gaze target", () => {
  const view = source("./stereo_view.js")
  assert.match(view, /this\.helmetModeIcon = new THREE\.Mesh\(/)
  assert.match(view, /this\.helmetModeHitbox = new THREE\.Mesh\(/)
  assert.match(view, /new THREE\.PlaneGeometry\(0\.265, 0\.34\)/)
  assert.match(view, /transparent: true, opacity: 0/)
  assert.match(view, /side: THREE\.DoubleSide/)
  assert.match(view, /this\.helmetModeHitbox\.visible = Boolean\(this\.helmetModeCurrent\)/)
  assert.match(view, /if \(target === this\.helmetModeHitbox\) return MODE_GAZE_TARGET/)
  assert.doesNotMatch(view, /this\.helmetModeHitboxes = \{\}/)
  for (const scale of [0.2, 0.5, 1]) {
    const p = cockpitModePlacement(scale)
    assert.ok(0.265 > p.side && 0.34 > p.side)
  }
})

test("one continuous gaze cannot automatically toggle the icon twice", () => {
  const gaze = new HelmetGazeDwell({armMs: 10, confirmMs: 10})
  gaze.update(MODE_GAZE_TARGET, 0)
  assert.equal(gaze.update(MODE_GAZE_TARGET, 20).activated, MODE_GAZE_TARGET)
  assert.equal(gaze.update(MODE_GAZE_TARGET, 40).activated, null)
  gaze.update(null, 50)
  gaze.update(MODE_GAZE_TARGET, 60)
  assert.equal(gaze.update(MODE_GAZE_TARGET, 80).activated, MODE_GAZE_TARGET)
})

test("headset still relays explicit authenticated intent to the desktop", () => {
  const headset = source("./helmet_client.mjs")
  const manager = readFileSync(new URL(
    "../../../lib/sunracer_web/helmet_manager.ex", import.meta.url), "utf8")
  const desktop = source("./client.js")
  assert.match(headset, /update\.activated === MODE_GAZE_TARGET/)
  assert.match(headset, /nextFlightMode\(this\.entities\.get\(this\.selfId\)\?\.flightMode\)/)
  assert.match(headset, /old\.push\("helmet_action", \{action\}, 5_000\)/)
  assert.match(manager, /@gaze_actions ~w\(toggle_flight_mode select_cruise_mode select_newtonian_mode\)/)
  assert.match(desktop, /this\.flightControls\?\.setMode\("cruise"\)/)
  assert.match(desktop, /this\.flightControls\?\.setMode\("newtonian"\)/)
  assert.doesNotMatch(headset, /channel\.push\("flight_controls"/)
})
