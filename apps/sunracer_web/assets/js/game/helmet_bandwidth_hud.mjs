// Read-only phone-side bandwidth formatting. Counts are JSON payload estimates:
 // static assets, TLS, WebSocket framing and retransmits are excluded.
export const HELMET_BANDWIDTH_HUD = Object.freeze({
  windowMs: 5_000,
  refreshMs: 1_000,
})

export function helmetBandwidthRate(bytesPerSecond) {
  const value = Number.isFinite(bytesPerSecond) && bytesPerSecond > 0
    ? bytesPerSecond : 0
  if (value >= 1024 * 1024) return (value / (1024 * 1024)).toFixed(2) + " MiB/s"
  if (value >= 1024) return (value / 1024).toFixed(1) + " KiB/s"
  return Math.round(value) + " B/s"
}

export function helmetBandwidthLines(snapshot) {
  return [
    "NET / JSON EST.",
    "RX " + helmetBandwidthRate(snapshot?.receivedBytesPerSecond),
    "TX " + helmetBandwidthRate(snapshot?.sentBytesPerSecond),
    "5s AVG - excl. assets/TLS",
  ]
}

export function renderHelmetBandwidth(root, snapshot) {
  const lines = helmetBandwidthLines(snapshot)
  const copies = root?.querySelectorAll?.("[data-helmet-bandwidth-eye]") || []
  for (const eye of copies) {
    const title = eye.querySelector("[data-net-label]")
    const rx = eye.querySelector("[data-net-rx]")
    const tx = eye.querySelector("[data-net-tx]")
    const note = eye.querySelector("[data-net-note]")
    if (title) title.textContent = lines[0]
    if (rx) rx.textContent = lines[1]
    if (tx) tx.textContent = lines[2]
    if (note) note.textContent = lines[3]
  }
}
