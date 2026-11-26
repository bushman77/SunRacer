import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

const client = readFileSync(new URL("./client.js", import.meta.url), "utf8")
const view = readFileSync(new URL("./stereo_view.js", import.meta.url), "utf8")

test("dashboard and steering capture share one ordered capture handler", () => {
  const setup = client.slice(client.indexOf("  setupMouseSteering() {"),
    client.indexOf("  applyDesktopMouseDelta("))
  const hit = setup.indexOf("this.stereoView?.dashboardPointer(")
  const capture = setup.indexOf("this.canvas.requestPointerLock()")
  assert.ok(hit >= 0 && capture > hit)
  assert.match(setup, /if \(hit\) \{\s*consume\(\)\s*this\.exitMouseSteering\(\)\s*if \(hit\.action\) this\.dashboardCommand\(hit\.action\)\s*return/)
  assert.equal((client.match(/this\.stereoView\?\.dashboardPointer\(/g) || []).length, 1)
  assert.match(view, /return hit \? \{action: dashboardHit\(this\.dashboardModel, hit\.uv\)\} : null/)
})

test("captured steering can release without recapture on the same pointer event", () => {
  assert.match(client, /event\.button === 1 && \(locked \|\| this\.mouseFallback\)\) \{\s*consume\(\)\s*this\.exitMouseSteering\(\)\s*return/)
})

test("explicit release invalidates pending native fallback", () => {
  assert.match(client, /exitMouseSteering\(\{silent = false\} = \{\}\) \{\s*this\.mouseCaptureRequested = false\s*this\.mouseCaptureAttempt\+\+/)
  assert.match(client, /attempt !== this\.mouseCaptureAttempt \|\| !this\.mouseCaptureRequested/)
  assert.match(client, /if \(!current\(\) \|\| document\.pointerLockElement === this\.canvas\) return/)
})
