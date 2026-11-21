// Read-only, stereo-correct bandwidth indicator for the paired phone.
// Rates estimate JSON payloads on the phone's Phoenix Channel, not actual
// interface or EC2-billed bytes. No extra sockets, polling, or telemetry.
export const HELMET_BANDWIDTH_HUD = Object.freeze({
  width: 1.18,
  height: 0.58,
  depth: 2.25,
  margin: 0.16,
  windowMs: 5_000,
  refreshMs: 1_000,
})

export function helmetBandwidthLayout(aspect, fovDegrees = 70) {
  if (!Number.isFinite(aspect) || aspect <= 0 ||
      !Number.isFinite(fovDegrees) || fovDegrees <= 0 || fovDegrees >= 180) {
    return null
  }
  const {width, height, depth, margin} = HELMET_BANDWIDTH_HUD
  const halfHeight = depth * Math.tan(fovDegrees * Math.PI / 360)
  const halfWidth = halfHeight * aspect
  const scale = Math.min(1, (2 * halfWidth - 2 * margin) / width,
    (2 * halfHeight - 2 * margin) / height)
  if (!Number.isFinite(scale) || scale <= 0) return null
  return {
    x: halfWidth - margin - width * scale / 2,
    y: halfHeight - margin - height * scale / 2,
    z: -depth,
    scale,
  }
}

export function helmetBandwidthRate(bytesPerSecond) {
  const value = Number.isFinite(bytesPerSecond) && bytesPerSecond > 0
    ? bytesPerSecond : 0
  if (value >= 1024 * 1024) return (value / (1024 * 1024)).toFixed(2) + " MiB/s"
  if (value >= 1024) return (value / 1024).toFixed(1) + " KiB/s"
  return Math.round(value) + " B/s"
}

export function helmetBandwidthLines(snapshot) {
  return [
    "NET  /  JSON EST.",
    "RX  " + helmetBandwidthRate(snapshot?.receivedBytesPerSecond),
    "TX  " + helmetBandwidthRate(snapshot?.sentBytesPerSecond),
    "5s AVG  /  EXCL. ASSETS + TLS",
  ]
}

// Draw a single texture; Three.js projects it in each eye independently.
// The bitmap never includes game state, credentials, contact data or tokens.
export function paintHelmetBandwidth(canvas, snapshot) {
  const ctx = canvas.getContext("2d")
  const lines = helmetBandwidthLines(snapshot)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = "rgba(2, 16, 27, 0.88)"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = "#6ce4ee"
  ctx.lineWidth = 6
  ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10)
  ctx.textAlign = "left"
  ctx.fillStyle = "#80efdd"
  ctx.font = "bold 30px monospace"
  ctx.fillText(lines[0], 22, 48)
  ctx.font = "bold 46px monospace"
  ctx.fillStyle = "#d1fff9"
  ctx.fillText(lines[1], 22, 116, canvas.width - 44)
  ctx.fillStyle = "#a7d8ff"
  ctx.fillText(lines[2], 22, 176, canvas.width - 44)
  ctx.font = "21px monospace"
  ctx.fillStyle = "#a1b5bb"
  ctx.fillText(lines[3], 22, 220, canvas.width - 44)
  return lines.join("\n")
}
