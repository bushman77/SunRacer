// Paired headset only. A pilot wearing an HMD cannot find the keyboard, so
// death has to be recoverable by gaze alone: this derives the panel the
// stereo view paints and the label on its single gaze target.
//
// Presentation only. The server re-verifies destruction from the map before
// it honours any recovery, so nothing decided here grants authority.

export const RESPAWN_GAZE_TARGET = "respawn"

const REASONS = {
  ship_not_destroyed: "HULL IS INTACT",
  session_not_found: "NO FLIGHT SESSION",
  world_unavailable: "WORLD UNAVAILABLE",
  read_only_or_invalid_command: "HEADSET REFUSED",
  timeout: "NO REPLY FROM CONTROL",
}

function reasonLine(reason) {
  if (typeof reason !== "string" || !reason.trim()) return "RECOVERY REFUSED"
  return REASONS[reason] || reason.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").slice(0, 24)
}

/**
 * @param entities Map of id -> entity, as helmet_client keeps them
 * @param pilotId  the viewer's own entity id, or null before it is known
 * @param state    {pending, error} from the in-flight recovery request
 */
export function helmetRespawnView(entities, pilotId, {pending = false, error = null} = {}) {
  const destroyed = pilotId != null &&
    entities?.get?.(pilotId)?.status === "destroyed"

  if (!destroyed) {
    return {destroyed: false, pending: false, lines: [], button: "", armed: false}
  }

  if (pending) {
    return {
      destroyed: true, pending: true, armed: false,
      lines: ["SHIP DESTROYED", "RECOVERY REQUESTED", "STAND BY"],
      button: "WORKING",
    }
  }

  if (error) {
    return {
      destroyed: true, pending: false, armed: true,
      lines: ["SHIP DESTROYED", "RECOVERY FAILED", reasonLine(error)],
      button: "TRY AGAIN",
    }
  }

  return {
    destroyed: true, pending: false, armed: true,
    lines: ["SHIP DESTROYED", "HULL GONE, BEACON AWAY", "HOLD YOUR GAZE BELOW"],
    button: "RECOVER AT EARTH",
  }
}
