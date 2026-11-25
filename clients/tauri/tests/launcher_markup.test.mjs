import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

const html = readFileSync(new URL("../ui/index.html", import.meta.url), "utf8")
const css = readFileSync(new URL("../ui/launcher.css", import.meta.url), "utf8")

test("the desktop launcher uses the shared HUD layout", () => {
  assert.match(html, /class="launcher-stage"/)
  assert.match(html, /class="launcher-rail"/)
  assert.match(html, /class="launcher-briefing"/)
  assert.match(html, /class="launcher-console"/)
  assert.match(css, /\.launcher-stage/)
  assert.match(css, /\.launcher-commandbar/)
})

test("all connection controls are preserved for the launcher controller", () => {
  for (const id of ["connect-form", "server-url", "use-local", "register-pilot", "visit-home", "error", "networking-open", "networking-panel", "proxy-mode", "proxy-host", "proxy-port", "networking-form", "probe-native-server", "probe-result"]) {
    assert.equal((html.match(new RegExp('id="' + id + '"', "g")) ?? []).length, 1, id)
  }
  assert.match(html, /type="submit"/)
  assert.match(html, /https:\/\/sunracer\.ddns\.net/)
  assert.match(html, /http:\/\/127\.0\.0\.1:4000/)
})

test("only the local launcher includes native networking commands", () => {
  const js = readFileSync(new URL("../ui/networking.mjs", import.meta.url), "utf8")
  assert.match(js, /get_network_settings/)
  assert.match(js, /save_network_settings/)
  assert.match(js, /restart_client/)
  assert.doesNotMatch(js, /danger_accept_invalid_certs|ignore_certificate_errors/)
})

test("Launch game opens local HTML, not the server-hosted /play page", () => {
  const js = readFileSync(new URL("../ui/launcher.mjs", import.meta.url), "utf8")
  assert.match(js, /window\.location\.assign\("\.\/game\.html"\)/)
  assert.doesNotMatch(js, /navigateTo\(gameUrl\)/)
})

test("native proxy controls live in the compact top-left settings menu", () => {
  assert.match(html, /id="networking-open"[^>]*aria-expanded="false"[^>]*aria-controls="networking-panel"/)
  assert.match(html, /id="networking-panel"[^>]*hidden/)
  assert.match(html, /<details id="native-network-settings">/)
  assert.match(html, /<option value="system">System network settings<\/option>/)
  assert.match(html, /<option value="socks5">Manual SOCKS5 proxy<\/option>/)
  assert.match(css, /\.networking-panel \{[\s\S]*?width:max-content;/)
  assert.match(css, /background:rgb\(3 9 20 \/ 80%\)/)
})

test("native proxy capabilities remain restricted to bundled pages", () => {
  const config = JSON.parse(readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"))
  const capability = config.app.security.capabilities.find(value => value.identifier === "local-networking-settings")
  assert.equal(capability.local, true)
  assert.deepEqual(capability.windows, ["main"])
  assert.equal(capability.remote, undefined)
  for (const permission of ["allow-get-network-settings", "allow-save-network-settings", "allow-restart-client"]) {
    assert.ok(capability.permissions.includes(permission))
  }
})
