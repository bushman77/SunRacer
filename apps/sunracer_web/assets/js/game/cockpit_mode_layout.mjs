// SBS cockpit flight controls must follow the actual resized instrument.
// Fixed x/y positions were overlapping the altitude/heading text whenever
// cockpitHudFit() scaled the main HUD to the narrower per-eye viewport.
import {HUD_GEOMETRY} from "./stereo_layout.mjs"

export const COCKPIT_MODE_SIDE = 0.21
export const COCKPIT_MODE_GAP = 0.065

export function cockpitModePlacement(hudScale = 1) {
  const scale = Number.isFinite(hudScale)
    ? Math.max(0.1, Math.min(1, hudScale)) : 1
  const hudBottom = HUD_GEOMETRY.centerY - HUD_GEOMETRY.height * scale / 2
  // Leave a visible gap under the instrument's *actual* lower edge. The
  // panel and buttons have near-identical depth so their projections do not
  // intersect in either stereoscopic eye.
  const y = hudBottom - COCKPIT_MODE_SIDE / 2 - 0.11
  const left = -0.22
  const step = COCKPIT_MODE_SIDE + COCKPIT_MODE_GAP
  const z = -2.36
  return {
    side: COCKPIT_MODE_SIDE,
    hudBottom,
    cruise: {x: left, y, z},
    newtonian: {x: left + step, y, z},
  }
}
