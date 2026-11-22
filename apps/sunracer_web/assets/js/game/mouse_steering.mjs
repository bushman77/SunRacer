// Optional pointer-locked cockpit steering. Mouse input is an impulse on
// server-authoritative yaw/pitch; throttle, roll and weapons remain separate.
//
// Pointer events can arrive at irregular intervals (particularly WebKitGTK).
// A 25ms idle cutoff used to send repeated turn/stop/turn commands during
// ordinary movement. Allow a short event gap, then send ONE immediate neutral.
// Keep cross-axis movement independent, and never coast after capture loss.
export const MOUSE_STEERING_IDLE_MS = 85 // hard ceiling for slow native webviews
export const MOUSE_STEERING_FAST_STOP_MS = 36
export const MOUSE_STEERING_MIN_STOP_MS = 30
export const MOUSE_STEERING_ACCUMULATE_MS = 45
export const MOUSE_STEERING_FILTER = 0.65
// New pilots get a responsive baseline; existing saved preferences remain valid.
export const MOUSE_STEERING_DEFAULT_SENSITIVITY = 1.5
// One captured mouse pixel now commands more angular input at every setting.
// The server still clamps actual rotation to a safe mouse-only turn rate.
export const MOUSE_STEERING_PIXELS_PER_AXIS = 10

const clamp = (value, low, high) => Math.min(high, Math.max(low, value))
// Native clients have their own storage origin. Do not silently disable
// mouse steering on first launch; preserve an explicit opt-out everywhere.
export const enabledMouseSteering = (saved, isNative = false) =>
  saved === "1" || (saved === null && isNative === true)

export const validMouseSensitivity = value => Number.isFinite(value) &&
  value >= 0.4 && value <= 10.0

export function mouseSteeringAxes(movementX, movementY, sensitivity = 1) {
  const factor = validMouseSensitivity(sensitivity) ? sensitivity : 1
  const yaw = clamp((Number(movementX) || 0) * factor / MOUSE_STEERING_PIXELS_PER_AXIS, -1, 1)
  // Browser Y increases downwards. Moving mouse UP pitches nose UP.
  const pitch = clamp(-(Number(movementY) || 0) * factor / MOUSE_STEERING_PIXELS_PER_AXIS, -1, 1)
  return {
    yaw: Math.abs(yaw) < 0.015 ? 0 : yaw,
    pitch: Math.abs(pitch) < 0.015 ? 0 : pitch,
  }
}

export class MouseSteering {
  constructor({now = () => performance.now(), sensitivity = MOUSE_STEERING_DEFAULT_SENSITIVITY} = {}) {
    this.now = now
    this.sensitivity = validMouseSensitivity(sensitivity) ? sensitivity : 1
    this.yaw = 0
    this.pitch = 0
    this.lastMovementAt = -Infinity
    this.packetGapMs = null
  }

  // Adapt stop timing to real packet cadence instead of always holding full
  // angular velocity for 85ms after the pilot stops moving.
  stopDelayMs() {
    return this.packetGapMs === null ? MOUSE_STEERING_FAST_STOP_MS :
      clamp(this.packetGapMs * 1.35 + 12,
        MOUSE_STEERING_MIN_STOP_MS, MOUSE_STEERING_IDLE_MS)
  }

  move(deltaX, deltaY) {
    // Zero-delta events must not cancel the current movement or keep
    // resetting the idle clock. Browsers can generate many of these.
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY) ||
        (deltaX === 0 && deltaY === 0)) return this.axes()

    const time = this.now()
    const {yaw, pitch} = mouseSteeringAxes(deltaX, deltaY, this.sensitivity)
    const elapsed = time - this.lastMovementAt
    if (elapsed < 0 || elapsed >= MOUSE_STEERING_IDLE_MS) {
      this.yaw = 0
      this.pitch = 0
      this.packetGapMs = null
    } else {
      // Widen immediately for slower 30Hz/20Hz pointer packets, but shorten
      // gradually when event timing fluctuates to avoid turning chatter.
      this.packetGapMs = this.packetGapMs === null ? elapsed :
        elapsed > this.packetGapMs ? elapsed :
          this.packetGapMs * 0.65 + elapsed * 0.35
    }
    const adjacent = elapsed >= 0 && elapsed < MOUSE_STEERING_ACCUMULATE_MS
    const smoothAxis = (previous, raw) => {
      // Delayed low-pass reductions are a source of overshoot: a smaller or
      // reversed mouse movement must immediately reduce/flip turn command.
      if (raw === 0 || !adjacent || previous === 0 ||
          Math.sign(previous) !== Math.sign(raw) ||
          Math.abs(raw) <= Math.abs(previous)) return raw
      return clamp(previous + (raw - previous) * MOUSE_STEERING_FILTER, -1, 1)
    }
    this.yaw = smoothAxis(this.yaw, yaw)
    this.pitch = smoothAxis(this.pitch, pitch)
    this.lastMovementAt = time
    return this.axes()
  }

  axes() { return {yaw: this.yaw, pitch: this.pitch} }

  expire(time = this.now()) {
    // Allow for floating-point time subtraction at the exact deadline.
    if (time - this.lastMovementAt + 1e-6 < this.stopDelayMs()) return null
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
    this.packetGapMs = null
    return this.axes()
  }
}
