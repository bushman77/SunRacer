import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {DEFAULT_VR_ONLY, headsetRendering, pauseDesktop3D, preferredVrOnly}
  from "./vr_only_rendering.mjs"

const read = path => readFileSync(new URL(path, import.meta.url), "utf8")
const client = read("./client.js")
const control = read("./helmet_control.mjs")
const markup = read("../../../lib/sunracer_web/controllers/game_html/show.html.heex")
const css = read("../../css/app.css")

const live = {connected: true, rendering: true, mode: "combat"}

test("VR-only is opt-out on native client and NEVER triggers from pairing alone", () => {
  assert.equal(DEFAULT_VR_ONLY, true)
  assert.equal(preferredVrOnly(null), true)
  assert.equal(preferredVrOnly("1"), true)
  assert.equal(preferredVrOnly("0"), false)
  assert.equal(headsetRendering(live), true)
  assert.equal(pauseDesktop3D({nativeClient: true, helmetStatus: live}), true)
  assert.equal(pauseDesktop3D({nativeClient: false, helmetStatus: live}), false)
  assert.equal(pauseDesktop3D({nativeClient: true, preferVrOnly: false, helmetStatus: live}), false)
  for (const status of [
    null, {}, {paired: true}, {connected: true, rendering: false, mode: "combat"},
    {connected: false, rendering: true, mode: "combat"},
    {connected: true, rendering: true, mode: "standby"},
  ]) {
    assert.equal(pauseDesktop3D({nativeClient: true, helmetStatus: status}), false)
  }
  assert.equal(pauseDesktop3D({nativeClient: true, helmetStatus: live, atlasOpen: true}), false)
})

test("status updates and disconnects restore desktop view automatically", () => {
  let status = {paired: true, connected: true, rendering: false, mode: "combat"}
  const pause = () => pauseDesktop3D({nativeClient: true, helmetStatus: status})
  assert.equal(pause(), false)
  status = live
  assert.equal(pause(), true)
  status = {paired: true, connected: false, rendering: false, mode: "combat"}
  assert.equal(pause(), false)
  status = {paired: true, connected: true, rendering: true, mode: "standby"}
  assert.equal(pause(), false)
  assert.match(control, /onStatusChange\?\.\(status\)/)
  assert.match(control, /this\.updateStatus\(\{\.\.\.this\.status, connected: false, rendering: false/)
})

test("render suppression only skips WebGL; simulation, mouse and relay keep running", () => {
  assert.match(client, /this\.syncDesktopVrOnly\(\)\s*this\.interpolate\(deltaSeconds\)/)
  assert.match(client, /this\.flightControls\?\.heartbeat\(time\)/)
  assert.match(client, /this\.spaceLaser\?\.update\(time\)/)
  assert.match(client, /this\.minimap\?\.draw\(time\)/)
  assert.match(client, /this\.navComputer\?\.draw\(time\)/)
  assert.match(client, /requestAnimationFrame\(nextTime => this\.frame\(nextTime\)\)/)
  assert.match(client, /if \(this\.desktopVrOnlyActive\) \{\s*this\.desktopVrRenderStats\.skipped\+\+/)
  assert.match(client, /this\.stereoView\.render\(this, time\)/)
  assert.match(client, /this\.beams = this\.beams\.filter/)
  assert.match(client, /this\.sbsRelayWorld\.publish\(state\)/)
})

test("desktop has a reversible cockpit control and a non-intercepting blackout layer", () => {
  assert.equal((markup.match(/id="desktop-vr-render-toggle"/g) || []).length, 1)
  assert.equal((markup.match(/id="desktop-vr-only-overlay"/g) || []).length, 1)
  assert.match(markup, /id="desktop-vr-only-overlay" hidden/)
  assert.match(markup, /pointer-events-none absolute inset-0/)
  assert.match(css, /#desktop-vr-only-overlay\[hidden\] \{ display: none !important; \}/)
  assert.match(css, /data-vr-only-active="true"\] #space-viewport-3d/)
  assert.match(client, /this\.desktopVrOnlyPreferred = !this\.desktopVrOnlyPreferred/)
  assert.match(client, /localStorage\.setItem\(this\.desktopVrOnlyKey,/)
  assert.match(client, /this\.root\.dataset\.vrOnlyActive = String\(active\)/)
  assert.match(client, /button\.setAttribute\("aria-pressed", String\(this\.desktopVrOnlyPreferred\)\)/)
})
