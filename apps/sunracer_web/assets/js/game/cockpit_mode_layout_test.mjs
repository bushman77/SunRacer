import test from "node:test"
import assert from "node:assert/strict"
import {cockpitModePlacement, COCKPIT_MODE_SIDE} from "./cockpit_mode_layout.mjs"
import {HUD_GEOMETRY} from "./stereo_layout.mjs"
import {readFileSync} from "node:fs"

const file = p => readFileSync(new URL(p, import.meta.url), "utf8")

test("one icon sits below the scaled SBS cockpit instrument", () => {
  for (const scale of [0.15, 0.3, 0.5, 0.66, 0.85, 1]) {
    const p = cockpitModePlacement(scale)
    const bottom = HUD_GEOMETRY.centerY - HUD_GEOMETRY.height * scale / 2
    assert.equal(p.hudBottom, bottom)
    assert.ok(p.icon.y + p.side / 2 < bottom - 0.10)
    assert.deepEqual(Object.keys(p).sort(), ["hudBottom", "icon", "side"])
    assert.ok(Object.values(p.icon).every(Number.isFinite))
  }
  assert.ok(COCKPIT_MODE_SIDE < 0.275)
})

test("one visible mesh and one hitbox follow the same resized HUD position", () => {
  const view = file("./stereo_view.js")
  assert.match(view, /this\.hudPanel\.scale\.setScalar\(fit\.scale\)/)
  assert.match(view, /const placement = cockpitModePlacement\(fit\.scale\)/)
  assert.match(view, /const pos = placement\.icon/)
  assert.match(view, /this\.helmetModeIcon\.position\.set\(pos\.x, pos\.y, pos\.z\)/)
  assert.match(view, /this\.helmetModeHitbox\.position\.set\(pos\.x, pos\.y, pos\.z \+ 0\.035\)/)
  assert.doesNotMatch(view, /this\.helmetModeIcons = \{\}/)
  assert.doesNotMatch(view, /for \(const mode of \["cruise", "newtonian"\]\)/)
})

test("invalid scale values do not move the single icon out of bounds", () => {
  for (const scale of [null, NaN, Infinity, -30, 80]) {
    const p = cockpitModePlacement(scale)
    assert.ok(Object.values(p.icon).every(Number.isFinite))
  }
})
