// Paired headset only. A surrendered captain is a decision the pilot has to
// make while flying, and an HMD pilot has no keyboard to make it with. This
// derives the cockpit prompt and the labels on its gaze targets.
//
// Presentation only. The map re-verifies that the opponent is actually
// surrendered before honouring either outcome, so nothing decided here grants
// authority, and "keep firing" never reaches the server at all.

export const ACCEPT_GAZE_TARGET = "surrender_accept"
export const SEIZE_GAZE_TARGET = "surrender_seize"
export const DISMISS_GAZE_TARGET = "surrender_dismiss"

const REASONS = {
  enemy_not_surrendered: "NO SURRENDER TO TAKE",
  invalid_encounter: "ENCOUNTER ALREADY CLOSED",
  session_not_found: "NO FLIGHT SESSION",
  cargo_hold_full: "NO ROOM IN THE HOLD",
  claim_not_found: "NOTHING LEFT TO TAKE",
  timeout: "NO REPLY FROM CONTROL",
}

function reasonLine(reason) {
  if (typeof reason !== "string" || !reason.trim()) return "REFUSED"
  return REASONS[reason] || reason.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").slice(0, 26)
}

function callSign(surrender) {
  const name = surrender?.call_sign
  return typeof name === "string" && name.trim() ? name.trim().slice(0, 18) : "CONTACT"
}

/**
 * @param surrender {surrendered, call_sign} as the server pushes it
 * @param state     {pending, error, dismissed} local request/UI state
 */
export function helmetSurrenderChoice(surrender, {pending = false, error = null,
  dismissed = false} = {}) {
  const offered = surrender?.surrendered === true
  const hidden = {open: false, armed: false, pending: false, lines: [],
    accept: "", seize: "", dismiss: ""}

  if (!offered || dismissed) return hidden

  if (pending) {
    return {open: true, armed: false, pending: true,
      lines: [callSign(surrender) + " YIELDS", "STAND BY"],
      accept: "WORKING", seize: "WORKING", dismiss: ""}
  }

  const lines = error
    ? [callSign(surrender) + " YIELDS", reasonLine(error)]
    : [callSign(surrender) + " YIELDS", "LET THEM GO OR TAKE THE HOLD"]

  return {open: true, armed: true, pending: false, lines,
    accept: "RELEASE", seize: "SEIZE HOLD", dismiss: "KEEP FIRING"}
}
