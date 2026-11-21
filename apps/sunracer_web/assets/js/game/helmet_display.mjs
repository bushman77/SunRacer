// Phone-headset display defaults. Pure so they can be regression-tested.

// Galaxy S21: 2400 px across ~144 mm, so each half-screen centre sits ~72 mm
// from the other at zero gap. Typical phone-headset lenses are 60-64 mm apart.
// -48 CSS px (about -144 device px, ~8.6 mm) is a closer first guess than the
// old +8, which pushed the images further apart. Calibration still overrides.
export const HELMET_DEFAULT_GAP_PX = -48

// The lenses magnify every rendered pixel. The old 1.5 cap rendered the S21
// at roughly half its native resolution, blurring the cockpit HUD text.
export const HELMET_DEFAULT_MAX_DPR = 2
export const HELMET_MIN_DPR = 1
export const HELMET_MAX_DPR = 3

export function helmetMaxPixelRatio(stored) {
  const value = Number(stored)
  if (stored === null || stored === undefined || stored === "" || !Number.isFinite(value)) {
    return HELMET_DEFAULT_MAX_DPR
  }
  return Math.min(HELMET_MAX_DPR, Math.max(HELMET_MIN_DPR, value))
}
