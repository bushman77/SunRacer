// Authoritative XYZ space. Game XY maps onto Three.js XZ; altitude Z maps to Three.js Y.
export const WORLD_SCALE = 0.06

export const toScene = ({x, y, z = 0}) => ({
  x: x * WORLD_SCALE, y: z * WORLD_SCALE, z: y * WORLD_SCALE,
})

export const toWorld = ({x, y = 0, z}) => ({
  x: x / WORLD_SCALE, y: z / WORLD_SCALE, z: y / WORLD_SCALE,
})

// Stereo coordinates are relative to the selected eye viewport of an SBS
// display. `gapPx` is the same signed centre alignment StereoSpaceView uses:
// positive values reserve a black centre strip (no eye there), negative
// values shift each eye's projection inward, so undo that shift here or
// clicks land beside what the pilot sees.
export function pointerNdc(pointer, rect, mode = "3d", gapPx = 0) {
  if (!(rect?.width > 0) || !(rect?.height > 0)) return null
  const px = pointer.clientX - rect.left
  const py = pointer.clientY - rect.top
  let x = px / rect.width
  const y = py / rect.height
  if (![x, y].every(Number.isFinite) || x < 0 || x > 1 || y < 0 || y > 1) return null
  let eye = "center"
  let shift = 0
  if (mode === "sbs") {
    const signed = Number(gapPx) || 0
    const gap = Math.max(0, Math.min(signed, rect.width - 2))
    const eyeWidth = (rect.width - gap) / 2
    if (px < eyeWidth) {
      eye = "left"
      x = px / eyeWidth
    } else if (px >= eyeWidth + gap) {
      eye = "right"
      x = (px - eyeWidth - gap) / eyeWidth
    } else {
      return null
    }
    // Matches inwardStereoProjectionOffset(): left content moved right.
    const inward = Math.max(0, -signed) / eyeWidth
    shift = eye === "left" ? -inward : inward
  }
  return {x: x * 2 - 1 + shift, y: 1 - y * 2, eye}
}
