// The cruise/Newtonian icon in the headset cockpit. A pilot wearing an HMD
// cannot find the Ctrl+E chord blind, and prologue step 6 now requires the
// mode, so the switch needs a gaze target.
//
// This is an intent only. The label is painted from the authoritative world
// snapshot rather than a local guess, so it cannot drift from the real ship,
// and the laptop is still the only thing that commands flight.

export {MODE_GAZE_TARGET} from "./helmet_mode_gaze.mjs"

export function helmetModeIcon(entities, pilotId, {pending = false} = {}) {
  const mode = entities?.get?.(pilotId)?.flightMode
  const known = mode === "cruise" || mode === "newtonian"
  if (!known) return {visible: false, mode: null, lines: [], armed: false, pending: false}

  if (pending) {
    return {visible: true, mode, armed: false, pending: true,
      lines: [mode === "cruise" ? "CRUISE" : "NEWTONIAN", "SWITCHING"]}
  }

  // Name the current mode first, then what a dwell will do. A pilot glancing
  // down mid-fight needs to read their state before the consequence.
  return {
    visible: true, mode, armed: true, pending: false,
    lines: mode === "cruise"
      ? ["CRUISE", "CUT ASSIST"]
      : ["NEWTONIAN", "RESTORE ASSIST"],
  }
}
