// Each SBS cockpit ship symbol selects an explicit propulsion mode.
// Server relays intent to the authorized desktop pilot, never flight controls.
export const MODE_GAZE_TARGETS = Object.freeze({
  cruise: "flight_mode_cruise",
  newtonian: "flight_mode_newtonian",
})
export const MODE_SELECTION_ACTIONS = Object.freeze({
  cruise: "select_cruise_mode",
  newtonian: "select_newtonian_mode",
})
export const modeGazeTarget = mode => MODE_GAZE_TARGETS[mode] || null
export const modeSelectionAction = mode => MODE_SELECTION_ACTIONS[mode] || null
export const modeForGazeTarget = target => {
  if (target === MODE_GAZE_TARGETS.cruise) return "cruise"
  if (target === MODE_GAZE_TARGETS.newtonian) return "newtonian"
  return null
}
