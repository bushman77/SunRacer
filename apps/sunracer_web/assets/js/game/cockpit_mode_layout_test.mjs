import test from "node:test"
import assert from "node:assert/strict"
import {cockpitModePlacement, COCKPIT_MODE_SIDE, COCKPIT_MODE_GAP} from "./cockpit_mode_layout.mjs"
import {HUD_GEOMETRY} from "./stereo_layout.mjs"
import {readFileSync} from "node:fs"

const file = p => readFileSync(new URL(p, import.meta.url), "utf8")

test("both ship buttons sit BELOW the actual scaled stereo instrument", () => {
  for (const scale of [0.15, 0.3, 0.5, 0.66, 0.85, 1]) {
    const p = cockpitModePlacement(scale)
    const bottom = HUD_GEOMETRY.centerY - HUD_GEOMETRY.height * scale / 2
    assert.equal(p.hudBottom, bottom)
    assert.ok(p.cruise.y + p.side / 2 < bottom - 0.10,
      "Cruise must not cover altitude or heading")
    assert.ok(p.newtonian.y + p.side / 2 < bottom - 0.10,
      "Newtonian must not cover ALT / HDG")
    assert.equal(p.cruise.y, p.newtonian.y)
    assert.ok(p.cruise.x + p.side / 2 + COCKPIT_MODE_GAP / 2 <
      p.newtonian.x - p.side / 2 + COCKPIT_MODE_GAP / 2,
      "mode buttons must be distinct, not overlapping")
    assert.equal(p.cruise.z, p.newtonian.z)
  }
  assert.ok(COCKPIT_MODE_SIDE < 0.275, "keep the controls smaller than the previous version")
})

test("resize repositions physical 3D icons to match scaled cockpit HUD", () => {
  const view = file("./stereo_view.js")
  assert.match(view, /this\.hudPanel\.scale\.setScalar\(fit\.scale\)/)
  assert.match(view, /const placement = cockpitModePlacement\(fit\.scale\)/)
  assert.match(view, /button\.position\.set\(pos\.x, pos\.y, pos\.z\)/)
  assert.doesNotMatch(view, /button\.position\.set\(x, -0\.52, -2\.36\)/)
  assert.match(view, /const inactiveMode = this\.helmetModeCurrent === "cruise"/)
  assert.match(view, /this\.helmetModeHitboxes\?\.\[mode\]/)
  assert.match(view, /hitbox\.position\.set\(pos\.x, pos\.y, pos\.z \+ 0\.035\)/)
  assert.doesNotMatch(view, /const inactiveMode = this\.helmetModeCurrent/)
})

test("invalid fit values don't scatter cockpit controls out of sight", () => {
  for (const scale of [null, NaN, Infinity, -30, 80]) {
    const p = cockpitModePlacement(scale)
    assert.ok(Object.values(p.cruise).every(Number.isFinite))
    assert.ok(Object.values(p.newtonian).every(Number.isFinite))
  }
})
