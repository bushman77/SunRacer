// A compact, optional on-screen readout for packaged Tauri and phone browsers.
// Never present raw messages, player IDs or credentials.
const rate = bytes => (bytes / 1024).toFixed(2) + " KiB/s"
const size = bytes => bytes >= 1024 ? (bytes / 1024).toFixed(1) + " KiB" : bytes + " B"

export function formatBandwidthSnapshot(snapshot) {
  const rows = Object.entries(snapshot.byEvent || {})
    .sort((a, b) => (b[1].in + b[1].out) - (a[1].in + a[1].out))
    .slice(0, 6)
    .map(([event, values]) =>
      event + ": " + size(values.in) + " down / " + size(values.out) + " up")
  return [
    "ESTIMATED JSON PAYLOAD TRAFFIC",
    "Last " + snapshot.durationSeconds.toFixed(0) + " seconds",
    "Server -> device: " + rate(snapshot.receivedBytesPerSecond),
    "Device -> server: " + rate(snapshot.sentBytesPerSecond),
    "Messages: " + snapshot.window.messagesIn + " in / " + snapshot.window.messagesOut + " out",
    "Since launch: " + size(snapshot.total.in) + " in / " + size(snapshot.total.out) + " out",
    "",
    "LARGEST EVENTS (TOTAL):",
    ...(rows.length ? rows : ["Awaiting game traffic..."]),
    "",
    "Excludes assets, TLS, WebSocket and network overhead.",
  ].join("\n")
}

export function attachBandwidthPanel(root, probe, intervalMs = 1000) {
  const panel = root?.querySelector?.("[data-bandwidth-panel]")
  const readout = panel?.querySelector("[data-bandwidth-readout]")
  if (!panel || !readout) return () => {}
  const update = () => {
    if (panel.open) readout.textContent = formatBandwidthSnapshot(probe.snapshot())
  }
  panel.addEventListener("toggle", update)
  const timer = setInterval(update, intervalMs)
  update()
  return () => {
    clearInterval(timer)
    panel.removeEventListener("toggle", update)
  }
}
