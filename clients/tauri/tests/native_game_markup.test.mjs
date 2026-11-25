import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {convertGameMarkup, nativeGameDocument} from "../scripts/native-game-markup.mjs"

const template = readFileSync(new URL("../../../apps/sunracer_web/lib/sunracer_web/controllers/game_html/show.html.heex", import.meta.url), "utf8")
const markup = convertGameMarkup(template)
const document = nativeGameDocument(markup)

test("standalone markup contains the real Atlas and 3D/SBS cockpit", () => {
  for (const id of ["game-client", "space-viewport-3d", "navigation-computer",
    "nav-solar-chart", "display-mode", "action-hotbar", "pilot-logout-form",
    "nav-helmet-open", "helmet-panel", "helmet-host", "helmet-qr",
    "helmet-relay-mini", "helmet-relay-status", "helmet-relay-check",
    "helmet-relay-reconnect", "helmet-relay-qr",
    "pilot-respawn-panel", "pilot-respawn-message", "pilot-respawn-button"]) {
    assert.match(document, new RegExp('id="' + id + '"'))
  }
  assert.match(document, /data-native-client="true"/)
  assert.match(document, /data-server-origin=""/)
  assert.match(document, /native_game.css/)
  assert.match(document, /native_bootstrap.mjs/)
  assert.match(document, /native-login-form/)
  assert.match(document, /data-bandwidth-panel/)
  assert.match(document, /data-bandwidth-readout/)
})

test("native game includes an initially hidden Earth recovery overlay", () => {
  assert.match(markup, /id="pilot-respawn-panel" hidden/)
  assert.match(markup, /RESPAWN AT EARTH/)
  assert.match(markup, /id="pilot-respawn-button" type="button"/)
})

test("native renderer has exactly ten server-populated hotbar placeholders", () => {
  for (let slot = 1; slot <= 10; slot++) {
    assert.match(markup, new RegExp('id="hotbar-slot-' + slot + '"'))
  }
  assert.equal((markup.match(/data-hotbar-slot="/g) || []).length, 10)
  assert.equal((markup.match(/data-hotbar-label/g) || []).length, 10)
})

test("no EEx expressions, server forms or remote asset links remain", () => {
  assert.doesNotMatch(document, /<%|<\.icon|<\.form|<\/\.form|{\@|{~p/)
  assert.doesNotMatch(document, /href="\/equipment"/)
  assert.doesNotMatch(document, /src="https?:\/\//)
})

test("native bootstrap uses authenticated API without persisting pilot tokens", () => {
  const js = readFileSync(new URL("../ui/native_bootstrap.mjs", import.meta.url), "utf8")
  assert.match(js, /\/api\/native\/login/)
  assert.match(js, /\/api\/native\/refresh/)
  assert.match(js, /\/api\/native\/logout/)
  assert.match(js, /nativePostJson/)
  assert.match(js, /import\("\.\/native_game\.js"\)/)
  assert.doesNotMatch(js, /localStorage\.setItem\(.*token/)
})

test("native markup generation is identical with Windows CRLF and Unix LF", () => {
  const unix = template.replace(/\r\n?/g, "\n")
  assert.equal(convertGameMarkup(unix.replace(/\n/g, "\r\n")), markup)
})

test("native login offers hosted account recovery on selected server", () => {
  assert.match(document, /id="native-password-reset"/)
  const js = readFileSync(new URL("../ui/native_bootstrap.mjs", import.meta.url), "utf8")
  assert.match(js, /passwordResetUrl\(origin\)/)
})

test("native sign-in shares the SpaceNova title screen and retains its auth contract", () => {
  assert.match(document, /<title>SpaceNova — Standalone Game<\/title>/)
  assert.match(document, /href="\.\/spacenova-home\.css"/)
  assert.match(document, /id="native-login" class="native-login nova-title-screen"/)
  assert.match(document, /class="nova-wordmark">Space<span>Nova<\/span>/)
  assert.match(document, /id="native-login-submit" class="nova-button nova-button-primary" type="submit"/)
  for (const id of ["native-login", "native-login-form", "native-username",
    "native-password", "native-login-submit", "native-login-error",
    "native-server-name", "native-password-reset"]) {
    assert.equal((document.match(new RegExp('id="' + id + '"', "g")) ?? []).length, 1, id)
  }
  assert.match(document, /id="native-password" type="password" name="password" autocomplete="current-password"/)
  assert.match(document, /href="\.\/index\.html">← Return to launcher/)
  assert.match(document, /id="game-client" hidden/)
  assert.doesNotMatch(document, /SUNRACER \/ SECURE UPLINK/)
  const css = readFileSync(new URL("../ui/native_shell.css", import.meta.url), "utf8")
  assert.match(css, /background:rgb\(3 9 20 \/ 80%\)/)
  assert.match(css, /\.native-login\[hidden\],#game-client\[hidden\],#native-login-error\[hidden\] \{display:none!important\}/)
})

test("packaged Atlas retains organized command controls and native logout", () => {
  for (const id of ["atlas-settings","atlas-profile","atlas-missions","atlas-contacts-open",
    "atlas-connection-status","atlas-diagnostics-open","nav-helmet-open","nav-inventory-open"]) {
    assert.equal((document.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,id)
  }
  assert.match(document, /SPACE<span>NOVA<\/span>/)
  assert.match(document, /type="submit" form="pilot-logout-form"/)
  assert.match(document, /<form id="pilot-logout-form"/)
  assert.match(document, /data-native-equipment/)
})

test("native package contains both strategic map renderers and real toolbar SVGs",()=>{
  for(const id of ["nav-orrery","nav-orrery-mode","nav-flat-mode","nav-orrery-reset","nav-solar-chart"]){
    assert.equal((document.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,id)
  }
  assert.match(document, /id="nav-orrery"[^>]*hidden/)
  assert.match(document, /<svg class="size-5" viewBox="0 0 24 24"/)
})
