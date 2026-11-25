import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

test("launcher provides direct recovery before launching or signing in", () => {
  const html = readFileSync(new URL("../ui/index.html", import.meta.url), "utf8")
  const js = readFileSync(new URL("../ui/launcher.mjs", import.meta.url), "utf8")
  assert.match(html, /<button type="button" id="reset-password" class="secondary">Reset password<\/button>/)
  assert.match(js, /resetPassword\.addEventListener\("click", \(\) => navigateTo\(passwordResetUrl\)\)/)
})
