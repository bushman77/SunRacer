// Optional pointer-locked cockpit steering. Mouse input is an impulse on
// server-authoritative yaw/pitch; throttle, roll and weapons remain separate.
//
// Pointer events can arrive at irregular intervals (particularly WebKitGTK).
// A 25ms idle cutoff used to send repeated turn/stop/turn commands during
// ordinary movement. Allow a short event gap, then send ONE immediate neutral.
// Keep cross-axis movement independent, and never coast after capture loss.
export const MOUSE_STEERING_IDLE_MS = 85
export const MOUSE_STEERING_ACCUMULATE_MS = 45
export const MOUSE_STEERING_FILTER = 0.65
export const MOUSE_STEERING_DEFAULT_SENSITIVITY = 1

const clamp = (value, low, high) => Math.min(high, Math.max(low, value))
// Native clients have their own storage origin. Do not silently disable
// mouse steering on first launch; preserve an explicit opt-out everywhere.
export const enabledMouseSteering = (saved, isNative = false) =>
  saved === "1" || (saved === null && isNative === true)

export const validMouseSensitivity = value => Number.isFinite(value) &&
  value >= 0.4 && value <= 6.0

export function mouseSteeringAxes(movementX, movementY, sensitivity = 1) {
  const factor = validMouseSensitivity(sensitivity) ? sensitivity : 1
  const yaw = clamp((Number(movementX) || 0) * factor / 11, -1, 1)
  // Browser Y increases downwards. Moving mouse UP pitches nose UP.
  const pitch = clamp(-(Number(movementY) || 0) * factor / 11, -1, 1)
  return {
    yaw: Math.abs(yaw) < 0.015 ? 0 : yaw,
    pitch: Math.abs(pitch) < 0.015 ? 0 : pitch,
  }
}

export class MouseSteering {
  constructor({now = () => performance.now(), sensitivity = 1} = {}) {
    this.now = now
    this.sensitivity = validMouseSensitivity(sensitivity) ? sensitivity : 1
    this.yaw = 0
    this.pitch = 0
    this.lastMovementAt = -Infinity
  }

  move(deltaX, deltaY) {
    // Zero-delta events must not cancel the current movement or keep
    // resetting the idle clock. Browsers can generate many of these.
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY) ||
        (deltaX === 0 && deltaY === 0)) return this.axes()

    const time = this.now()
    const {yaw, pitch} = mouseSteeringAxes(deltaX, deltaY, this.sensitivity)
    const elapsed = time - this.lastMovementAt
    // A delayed mouse event must start a fresh impulse, not resurrect the
    // prior turn after it should have expired.
    if (elapsed >= MOUSE_STEERING_IDLE_MS) {
      this.yaw = 0
      this.pitch = 0
    }
    const adjacent = elapsed >= 0 && elapsed < MOUSE_STEERING_ACCUMULATE_MS
    const smoothAxis = (previous, raw) => {
      // Never retain a turn on an axis that the mouse is no longer moving.
      if (raw === 0) return 0
      // Reverse immediately instead of fighting the new direction.
      if (Math.sign(previous) !== Math.sign(raw) && previous !== 0) return raw
      // Small high-frequency mouse packets still accumulate, but a bounded
      // low-pass filter prevents OS event timing from jerking the turn rate.
      const carried = adjacent ? previous * 0.3 : 0
      const target = clamp(raw + carried, -1, 1)
      return clamp(previous + (target - previous) * MOUSE_STEERING_FILTER, -1, 1)
    }
    this.yaw = smoothAxis(this.yaw, yaw)
    this.pitch = smoothAxis(this.pitch, pitch)
    this.lastMovementAt = time
    return this.axes()
  }

  axes() { return {yaw: this.yaw, pitch: this.pitch} }

  expire(time = this.now()) {
    if (time - this.lastMovementAt < MOUSE_STEERING_IDLE_MS) return null
    if (this.yaw === 0 && this.pitch === 0) return null

    // One hard stop. Do not decay the last command over subsequent frames;
    // that looked like the cursor/ship continued moving after the hand stopped.
    this.yaw = 0
    this.pitch = 0
    return this.axes()
  }

  release() {
    this.yaw = 0
    this.pitch = 0
    this.lastMovementAt = -Infinity
    return this.axes()
  }
}
