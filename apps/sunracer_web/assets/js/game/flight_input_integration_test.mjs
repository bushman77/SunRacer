import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

const client = readFileSync(new URL("./client.js", import.meta.url), "utf8")
const markup = readFileSync(new URL(
  "../../../lib/sunracer_web/controllers/game_html/show.html.heex", import.meta.url),
"utf8")

test("single ship icon toggles authoritative cruise and Newtonian", () => {
  assert.match(markup, /id="flight-mode-toggle" class="flight-mode-toggle"/)
  assert.match(markup, /id="flight-mode-toggle-button" data-flight-mode-toggle/)
  assert.doesNotMatch(markup, /id="flight-mode-cruise"|id="flight-mode-newtonian"/)
  assert.match(client, /this\.flightControls\.setMode\(mode === "cruise" \? "newtonian" : "cruise"\)/)
  assert.match(client, /syncFlightModeButtons\(mode = this\.entities\.get\(this\.selfId\)\?\.flightMode\)/)
  assert.match(client, /button\.setAttribute\("aria-pressed"/)
})

test("keyboard and mouse share a single authoritative flight gate", () => {
  assert.match(client, /active: \(\) => this\.flightInputState\(\) === "ready"/)
  assert.match(client, /flightInputState\(\) \{[\s\S]*?sectorJoined:/)
})

test("Atlas and cockpit share a persistent live-adjustable 0.4x to 10x mouse sensitivity", () => {
  assert.match(client, /"#nav-mouse-sensitivity", "#cockpit-mouse-sensitivity"/)
  assert.match(client, /"#nav-mouse-steering", "#cockpit-mouse-steering"/)
  assert.match(client, /localStorage\.setItem\(this\.mouseSensitivityKey, String\(sensitivity\)\)/)
  assert.match(markup, /id="cockpit-mouse-sensitivity" type="range" min="40" max="1000"/)
  assert.match(markup, /id="nav-mouse-sensitivity" type="range" min="40" max="1000"/)
})

test("native fallback mouse impulses must stop even without pointer lock", () => {
  assert.match(client, /document\.pointerLockElement !== this\.canvas && !this\.mouseFallback/)
  assert.match(client, /document\.pointerLockElement === this\.canvas \|\| this\.mouseFallback/)
})

test("cockpit shows an explicit manual helm takeover instead of silently altering cruise", () => {
  assert.match(markup, /id="cockpit-flight-input-status"/)
  assert.match(markup, /id="cockpit-take-helm"/)
  assert.match(client, /this\.solarEnterFreeFlight\(\(ok, navigation, reason\) =>/)
})

test("laser hold during cruise transfers manual helm before firing in the new region", () => {
  assert.match(client, /const takeover = input === "cruise" && this\.inSystemCruise\(\)/)
  assert.match(client, /this\.laserTakeoverPending = true[\s\S]*?this\.solarEnterFreeFlight\(/)
  assert.match(client, /this\.manualLaserPointerHeld && this\.flightInputState\(\) === "ready"/)
  assert.match(client, /regionTransferring: Boolean\(navigation\?\.free_flight\)/)
  assert.match(client, /this\.spaceLaser\?\.resetForWorld\(\)/)
})
