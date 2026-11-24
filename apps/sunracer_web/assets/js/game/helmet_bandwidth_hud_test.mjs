import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

test("neither SBS eye displays the network bandwidth card", () => {
  const template = readFileSync(new URL(
    "../../../lib/sunracer_web/controllers/helmet_html/show.html.heex", import.meta.url), "utf8")
  const view = readFileSync(new URL("./stereo_view.js", import.meta.url), "utf8")
  assert.doesNotMatch(view, /helmetBandwidthHud|updateHelmetBandwidth/)
  assert.match(template, /id="helmet-viewport"/)
  assert.doesNotMatch(template, /helmet-bandwidth-sbs|data-helmet-bandwidth-eye|NET \/ JSON EST/)
})
