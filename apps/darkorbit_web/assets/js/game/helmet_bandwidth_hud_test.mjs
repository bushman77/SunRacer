import test from "node:test"
import assert from "node:assert/strict"
import {
  HELMET_BANDWIDTH_HUD, helmetBandwidthLayout,
  helmetBandwidthRate, helmetBandwidthLines, paintHelmetBandwidth,
} from "./helmet_bandwidth_hud.mjs"

test("rate labels use payload bytes per second, with valid values only", () => {
  assert.equal(helmetBandwidthRate(0), "0 B/s")
  assert.equal(helmetBandwidthRate(756), "756 B/s")
  assert.equal(helmetBandwidthRate(2048), "2.0 KiB/s")
  assert.equal(helmetBandwidthRate(1024 * 1024), "1.00 MiB/s")
  assert.equal(helmetBandwidthRate(-10), "0 B/s")
  assert.equal(helmetBandwidthRate(Infinity), "0 B/s")
  const lines = helmetBandwidthLines({
    receivedBytesPerSecond: 2048, sentBytesPerSecond: 756,
  })
  assert.deepEqual(lines, [
    "NET  /  JSON EST.", "RX  2.0 KiB/s", "TX  756 B/s",
    "5s AVG  /  EXCL. ASSETS + TLS",
  ])
})

test("heads-up plane stays in the top-right of each SBS eye for narrow displays", () => {
  for (const aspect of [0.35, 0.55, 0.8, 1.0, 1.1, 1.8]) {
    const layout = helmetBandwidthLayout(aspect)
    assert.ok(layout && layout.scale > 0 && layout.scale <= 1)
    assert.equal(layout.z, -HELMET_BANDWIDTH_HUD.depth)
    const halfHeight = HELMET_BANDWIDTH_HUD.depth * Math.tan(70 * Math.PI / 360)
    const halfWidth = halfHeight * aspect
    const right = layout.x + HELMET_BANDWIDTH_HUD.width * layout.scale / 2
    const left = layout.x - HELMET_BANDWIDTH_HUD.width * layout.scale / 2
    const top = layout.y + HELMET_BANDWIDTH_HUD.height * layout.scale / 2
    const bottom = layout.y - HELMET_BANDWIDTH_HUD.height * layout.scale / 2
    assert.ok(layout.x >= 0 && layout.y > 0)
    assert.ok(right <= halfWidth - HELMET_BANDWIDTH_HUD.margin + 1e-8)
    assert.ok(left >= -halfWidth + HELMET_BANDWIDTH_HUD.margin - 1e-8)
    assert.ok(top <= halfHeight - HELMET_BANDWIDTH_HUD.margin + 1e-8)
    assert.ok(bottom >= -halfHeight + HELMET_BANDWIDTH_HUD.margin - 1e-8)
  }
  assert.equal(helmetBandwidthLayout(0), null)
  assert.equal(helmetBandwidthLayout(NaN), null)
  assert.equal(helmetBandwidthLayout(1, 180), null)
})

test("draws only local rate text and keeps a fixed canvas", () => {
  const calls = []
  const context = {
    clearRect(...args) {calls.push(["clear", ...args])},
    fillRect(...args) {calls.push(["fill", ...args])},
    strokeRect(...args) {calls.push(["stroke", ...args])},
    fillText(...args) {calls.push(["text", ...args])},
  }
  const canvas = {width: 512, height: 256, getContext: () => context}
  const text = paintHelmetBandwidth(canvas, {
    receivedBytesPerSecond: 1024, sentBytesPerSecond: 300,
    token: "should-never-display", entities: [{secret: "also-private"}],
  })
  assert.match(text, /RX  1.0 KiB\/s/)
  assert.match(text, /TX  300 B\/s/)
  assert.equal(calls.filter(call => call[0] === "text").length, 4)
  assert.equal(JSON.stringify(calls).includes("should-never-display"), false)
  assert.equal(JSON.stringify(calls).includes("also-private"), false)
})
