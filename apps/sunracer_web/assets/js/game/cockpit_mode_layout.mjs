// One SBS flight mode control, placed beneath the actual scaled instrument.
import {HUD_GEOMETRY} from "./stereo_layout.mjs"

export const COCKPIT_MODE_SIDE = 0.21

export function cockpitModePlacement(hudScale = 1) {
  const scale = Number.isFinite(hudScale)
    ? Math.max(0.1, Math.min(1, hudScale)) : 1
  const hudBottom = HUD_GEOMETRY.centerY - HUD_GEOMETRY.height * scale / 2
  return {
    side: COCKPIT_MODE_SIDE,
    hudBottom,
    icon: {
      x: -0.08,
      y: hudBottom - COCKPIT_MODE_SIDE / 2 - 0.11,
      z: -2.36,
    },
  }
}
