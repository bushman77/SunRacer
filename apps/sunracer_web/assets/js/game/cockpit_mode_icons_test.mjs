import test from "node:test"
import assert from "node:assert/strict"
import {paintCockpitModeIcon, COCKPIT_MODE_ICON_SIZE} from "./cockpit_mode_icons.mjs"
import {readFileSync} from "node:fs"

const code = path => readFileSync(new URL(path, import.meta.url), "utf8")
function recordingContext() {
  const calls = []
  const ctx = {calls}
  for (const method of ["save", "restore", "clearRect", "beginPath", "moveTo",
    "lineTo", "quadraticCurveTo", "closePath", "fill", "stroke"]) {
    ctx[method] = (...args) => calls.push({method, args})
  }
  return ctx
}

test("both modes paint a small transparent ship icon, without a green text panel", () => {
  assert.equal(COCKPIT_MODE_ICON_SIZE, 256)
  for (const mode of ["cruise", "newtonian"]) {
    const ctx = recordingContext()
    assert.equal(paintCockpitModeIcon(ctx, {mode, selected: true}), true)
    assert.deepEqual(ctx.calls.find(call => call.method === "clearRect").args,
      [0, 0, 256, 256])
    assert.ok(ctx.calls.filter(call => call.method === "stroke").length >= 3)
    assert.ok(ctx.calls.some(call => call.method === "fill"))
    assert.equal(ctx.calls.some(call => call.method === "quadraticCurveTo"), false,
      "mode control must not draw a rounded green rectangle")
  }
})

test("Cruise uses plume streaks; Newtonian uses opposing forward/reverse arrows", () => {
  const a = recordingContext()
  const b = recordingContext()
  paintCockpitModeIcon(a, {mode: "cruise"})
  paintCockpitModeIcon(b, {mode: "newtonian"})
  const commands = ctx => ctx.calls.map(({method, args}) =>
    method + "(" + args.join(",") + ")").join(" ")
  assert.match(commands(a), /lineTo\(39,128\)/)
  assert.match(commands(b), /lineTo\(177,59\)/)
  assert.match(commands(b), /lineTo\(82,196\)/)
  assert.notEqual(commands(a), commands(b))
  assert.equal(paintCockpitModeIcon(recordingContext(), {mode: "nonsense"}), false)
})

test("3D headset icons replace old flight text pane without changing gaze authority", () => {
  const view = code("./stereo_view.js")
  const client = code("./helmet_client.mjs")
  assert.match(view, /this\.helmetModeIcons = \{\}/)
  assert.match(view, /new THREE\.PlaneGeometry\(initialModePlacement\.side, initialModePlacement\.side\)/)
  assert.match(view, /cockpitModePlacement\(fit\.scale\)/)
  assert.match(view, /map: modeIconTexture\(mode\)/)
  assert.match(view, /this\.helmetModeHitboxes = \{\}/)
  assert.match(view, /new THREE\.PlaneGeometry\(0\.265, 0\.34\)/)
  assert.match(view, /opacity: 0, depthTest: false/)
  assert.match(view, /return modeGazeTarget\(requestedMode\)/)
  assert.doesNotMatch(view, /cockpitLabel\(\["CRUISE"\]/)
  assert.match(client, /old\.push\("helmet_action", \{action\}, 5_000\)/)
})
