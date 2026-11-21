import test from "node:test"
import assert from "node:assert/strict"
import {
  HELMET_BANDWIDTH_HUD, helmetBandwidthRate, helmetBandwidthLines,
  renderHelmetBandwidth,
} from "./helmet_bandwidth_hud.mjs"

test("rates use existing 5s JSON payload estimates; never network or asset claims", () => {
  assert.deepEqual(HELMET_BANDWIDTH_HUD, {windowMs: 5000, refreshMs: 1000})
  assert.equal(helmetBandwidthRate(0), "0 B/s")
  assert.equal(helmetBandwidthRate(756), "756 B/s")
  assert.equal(helmetBandwidthRate(2048), "2.0 KiB/s")
  assert.equal(helmetBandwidthRate(1024 * 1024), "1.00 MiB/s")
  assert.equal(helmetBandwidthRate(-10), "0 B/s")
  assert.equal(helmetBandwidthRate(Infinity), "0 B/s")
  assert.deepEqual(helmetBandwidthLines({
    receivedBytesPerSecond: 2048, sentBytesPerSecond: 756,
  }), [
    "NET / JSON EST.", "RX 2.0 KiB/s", "TX 756 B/s",
    "5s AVG - excl. assets/TLS",
  ])
})

test("renders equal readable RX/TX values in both eyes with textContent", () => {
  const eyes = Array.from({length: 2}, () => {
    const labels = new Map(["[data-net-label]", "[data-net-rx]",
      "[data-net-tx]", "[data-net-note]"].map(x => [x, {textContent: ""}]))
    return {querySelector: x => labels.get(x), labels}
  })
  const root = {querySelectorAll: selector => {
    assert.equal(selector, "[data-helmet-bandwidth-eye]")
    return eyes
  }}
  renderHelmetBandwidth(root, {
    receivedBytesPerSecond: 2048,
    sentBytesPerSecond: 100,
    credential: "private-token",
    entities: [{playerId: "other-private-pilot"}],
  })
  assert.equal(eyes[0].labels.get("[data-net-rx]").textContent, "RX 2.0 KiB/s")
  assert.equal(eyes[0].labels.get("[data-net-tx]").textContent, "TX 100 B/s")
  assert.deepEqual([...eyes[0].labels].map(x => x[1].textContent),
    [...eyes[1].labels].map(x => x[1].textContent))
  assert.equal(JSON.stringify([...eyes.map(x => [...x.labels])]).includes("private-token"), false)
})

test("missing overlay is a no-op; zero values remain visible when connected", () => {
  assert.doesNotThrow(() => renderHelmetBandwidth(null, null))
  assert.doesNotThrow(() => renderHelmetBandwidth({
    querySelectorAll: () => [],
  }, {}))
  assert.equal(helmetBandwidthLines({})[1], "RX 0 B/s")
})
