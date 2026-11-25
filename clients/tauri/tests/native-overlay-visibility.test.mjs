import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {convertGameMarkup, nativeGameDocument} from "../scripts/native-game-markup.mjs"

const read = path => readFileSync(new URL(path, import.meta.url), "utf8")
const template = read("../../../apps/sunracer_web/lib/sunracer_web/controllers/game_html/show.html.heex")
const css = read("../ui/native_shell.css")
const config = JSON.parse(read("../src-tauri/tauri.conf.json"))

test("native modal defaults are CSP-safe and shared controllers can still open them", () => {
  const html = nativeGameDocument(convertGameMarkup(template))
  assert.doesNotMatch(html, /\bid="starbase-docking-prompt"/)
  assert.match(html, /id="starbase-docking-countdown" hidden/)
  const ids = ["starbase-docked-panel", "station-npc-prompt",
    "station-npc-dialogue", "station-outfitting-panel", "station-trade-panel",
    "story-dispatch-dialogue", "pilot-inventory-panel"]
  for (const id of ids) {
    const tag = html.match(new RegExp('<(?:section|div)\\b[^>]*\\bid="' + id + '"[^>]*>'))?.[0]
    assert.ok(tag, id + " remains in the packaged markup")
    assert.match(tag, /\bdata-native-initially-hidden\b/, id)
    assert.doesNotMatch(tag, /\bstyle=/, id)
  }
  assert.doesNotMatch(html, /\bstyle="display:\s*none\s*;?"/)
  assert.match(html, /<link rel="stylesheet" href="\.\/native_shell\.css">/)
  assert.match(css, /#game-client\s+\[data-native-initially-hidden\]\s*\{\s*display:\s*none\s*;\s*\}/)
  assert.match(config.app.security.csp, /(?:^|;\s*)style-src 'self';/)
  const inventory = read("../../../apps/sunracer_web/assets/js/game/pilot_inventory_panel.mjs")
  assert.match(inventory, /this\.root\.style\.display = "flex"/)
  assert.match(inventory, /this\.root\.style\.display = "none"/)
})
