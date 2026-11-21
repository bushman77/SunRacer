import test from "node:test"
import assert from "node:assert/strict"
import {formatBandwidthSnapshot, attachBandwidthPanel} from "./bandwidth_panel.mjs"

test("labels rates as estimates, formats totals and never includes payloads", () => {
  const text = formatBandwidthSnapshot({
    durationSeconds: 30, receivedBytesPerSecond: 2048, sentBytesPerSecond: 512,
    window: {messagesIn: 8, messagesOut: 2}, total: {in: 8192, out: 1024},
    byEvent: {"world/world_delta": {in: 8192, out: 0}},
  })
  assert.match(text, /ESTIMATED JSON PAYLOAD TRAFFIC/)
  assert.match(text, /Server -> device: 2\.00 KiB\/s/)
  assert.match(text, /Device -> server: 0\.50 KiB\/s/)
  assert.match(text, /world\/world_delta/)
  assert.match(text, /Excludes assets, TLS, WebSocket/)
})

test("does not need a console or DOM if a legacy layout lacks the panel", () => {
  assert.doesNotThrow(() => attachBandwidthPanel({querySelector: () => null}, {snapshot(){throw Error("unreachable")}}))
})

test("panel updates only when opened and never prints a game payload", () => {
  const events = new Map()
  const readout = {textContent: ""}
  const panel = {
    open: false,
    querySelector: selector => selector === "[data-bandwidth-readout]" ? readout : null,
    addEventListener: (name, cb) => events.set(name, cb),
    removeEventListener: name => events.delete(name),
  }
  const root = {querySelector: selector => selector === "[data-bandwidth-panel]" ? panel : null}
  const probe = {snapshot: () => ({
    durationSeconds: 1, receivedBytesPerSecond: 0, sentBytesPerSecond: 0,
    window: {messagesIn: 0, messagesOut: 0}, total: {in: 0, out: 0}, byEvent: {},
  })}
  const stop = attachBandwidthPanel(root, probe, 10_000)
  assert.equal(readout.textContent, "")
  panel.open = true
  events.get("toggle")()
  assert.match(readout.textContent, /Awaiting game traffic/)
  stop()
  assert.equal(events.size, 0)
})
