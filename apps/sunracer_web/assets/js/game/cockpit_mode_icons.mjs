// Ship silhouettes for the actual Three.js/SBS cockpit flight controls.
// This is a transparent canvas texture, not a glowing full-size HUD panel.
// No images, network access or DOM input required; the headset chooses its
// current mode from server-authoritative state.
export const COCKPIT_MODE_ICON_SIZE = 256

export function paintCockpitModeIcon(ctx, {mode, selected = false, pending = false} = {}) {
  if (!ctx || (mode !== "cruise" && mode !== "newtonian")) return false
  const n = COCKPIT_MODE_ICON_SIZE
  ctx.save()
  ctx.clearRect(0, 0, n, n)

  // Compact rounded control surface with a thin outline, rather than the
  // generic high-contrast green rectangle formerly used for every HMD label.
  ctx.beginPath()
  ctx.moveTo(66, 24)
  ctx.lineTo(190, 24)
  ctx.quadraticCurveTo(232, 24, 232, 66)
  ctx.lineTo(232, 190)
  ctx.quadraticCurveTo(232, 232, 190, 232)
  ctx.lineTo(66, 232)
  ctx.quadraticCurveTo(24, 232, 24, 190)
  ctx.lineTo(24, 66)
  ctx.quadraticCurveTo(24, 24, 66, 24)
  ctx.closePath()
  ctx.fillStyle = selected ? "rgba(20,83,45,0.35)" : "rgba(3,12,26,0.25)"
  ctx.fill()
  ctx.strokeStyle = pending ? "#efc987" : selected ? "#62ebb0" : "#54899e"
  ctx.lineWidth = selected ? 9 : 6
  ctx.stroke()

  // Both buttons are recognizably the same right-facing ship.
  ctx.beginPath()
  ctx.moveTo(104, 88)
  ctx.lineTo(188, 128)
  ctx.lineTo(104, 168)
  ctx.lineTo(122, 140)
  ctx.lineTo(78, 128)
  ctx.lineTo(122, 116)
  ctx.closePath()
  ctx.fillStyle = selected ? "#d8ffe9" : "#b1d8ed"
  ctx.fill()
  ctx.lineWidth = 5
  ctx.strokeStyle = selected ? "#64e6b0" : "#71a9ca"
  ctx.stroke()

  ctx.strokeStyle = selected ? "#b0ffda" : "#8bbbd6"
  ctx.lineWidth = 9
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  if (mode === "cruise") {
    // Three plume streaks behind the vessel point away from its tail.
    for (const [startX, y, finishX] of [
      [78, 108, 49], [74, 128, 39], [78, 148, 49],
    ]) {
      ctx.beginPath()
      ctx.moveTo(startX, y)
      ctx.lineTo(finishX, y)
      ctx.stroke()
    }
  } else {
    // Independent forward and reverse vectors: real Newtonian momentum.
    // The arrows flank the ship vertically so neither covers its silhouette.
    ctx.beginPath()
    ctx.moveTo(82, 59)
    ctx.lineTo(177, 59)
    ctx.moveTo(157, 42)
    ctx.lineTo(178, 59)
    ctx.lineTo(157, 76)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(177, 196)
    ctx.lineTo(82, 196)
    ctx.moveTo(102, 179)
    ctx.lineTo(81, 196)
    ctx.lineTo(102, 213)
    ctx.stroke()
  }
  ctx.restore()
  return true
}
