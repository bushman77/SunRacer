// Presentation-only experiment. This never changes flight authority, head pose,
// world-state delivery or the game's input/heartbeat simulation loop.
export const DEFAULT_VR_ONLY = true

export function headsetRendering(status) {
  return status?.connected === true && status?.rendering === true &&
    status?.mode === "combat"
}

export function pauseDesktop3D({nativeClient = false, preferVrOnly = DEFAULT_VR_ONLY,
  helmetStatus = null, atlasOpen = false} = {}) {
  return nativeClient === true && preferVrOnly === true &&
    headsetRendering(helmetStatus) && atlasOpen !== true
}

// Browser preference is optional and scoped by pilot; opt-out persists across
// reloads so tests can switch between VR-only and dual-view consistently.
export function preferredVrOnly(value) { return value !== "0" }
