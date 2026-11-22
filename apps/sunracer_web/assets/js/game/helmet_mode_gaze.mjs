// One stable gaze target prevents repeated toggles while the eye stays fixed.
export const MODE_GAZE_TARGET = "flight_mode"

export const nextFlightMode = mode =>
  mode === "cruise" ? "newtonian" : mode === "newtonian" ? "cruise" : null

// Resolve the next mode from the server snapshot, then send its explicit intent.
// The desktop alone sends flight commands.
export const MODE_SELECTION_ACTIONS = Object.freeze({
  cruise: "select_cruise_mode",
  newtonian: "select_newtonian_mode",
})
export const modeSelectionAction = mode => MODE_SELECTION_ACTIONS[mode] || null
