// Optional pointer-locked cockpit steering. Mouse input is an impulse on
// server-authoritative yaw/pitch; throttle, roll and weapons remain separate.
//
// Native WebKitGTK pointer events can arrive in irregular bursts. Missing
// one or two packets is not necessarily an intentional stop. Tolerate short
// gaps, then send one neutral after genuine silence. Explicit capture loss
// still calls release() immediately.
export const MOUSE_STEERING_IDLE_MS = 145 // tolerate intermittent native gaps
export const MOUSE_STEERING_FAST_STOP_MS = 95
export const MOUSE_STEERING_MIN_STOP_MS = 95
// Normalize event packet displacement to a consistent 60Hz reference. Without
// this, varying mouse packet rates become visible fluctuations in turn speed.
export const MOUSE_STEERING_SAMPLE_MS = 16
export const MOUSE_STEERING_ACCUMULATE_MS = 45
export const MOUSE_STEERING_FILTER = 0.65
// A tiny up/down difference between adjacent captured mouse packets is not
// necessarily a change of pilot intent, especially at high sensitivity.
// Filter same-direction packet quantization, not reversals or hard stops.
export const MOUSE_STEERING_JITTER_BAND = 0.5
export const MOUSE_STEERING_JITTER_FILTER = 0.38
export const MOUSE_STEERING_HARD_SLOWDOWN_RATIO = 0.4
// New pilots get a responsive baseline; existing saved preferences remain valid.
export const MOUSE_STEERING_DEFAULT_SENSITIVITY = 1.5
// One captured mouse pixel now commands more angular input at every setting.
// The server still clamps actual rotation to a safe mouse-only turn rate.
export const MOUSE_STEERING_PIXELS_PER_AXIS = 10
export const MOUSE_STEERING_PRECISION_KNEE = 1.5

// The old strictly linear 10x setting made ONE pixel command full yaw/pitch.
// Keep the familiar low-end feel; above the knee compress gain so high slider
// settings offer meaningful sub-pixel/slow-aim control instead of quantization
// jumps. The value is a sensitivity setting, not a literal multiplier.
export function calibratedMouseSensitivity(value) {
  const sensitivity = validMouseSensitivity(value) ? value : 1
  return sensitivity <= MOUSE_STEERING_PRECISION_KNEE ? sensitivity :
    MOUSE_STEERING_PRECISION_KNEE +
      Math.log1p(sensitivity - MOUSE_STEERING_PRECISION_KNEE)
}

const clamp = (value, low, high) => Math.min(high, Math.max(low, value))
// Native clients have their own storage origin. Do not silently disable
// mouse steering on first launch; preserve an explicit opt-out everywhere.
export const enabledMouseSteering = (saved, isNative = false) =>
  saved === "1" || (saved === null && isNative === true)

export const validMouseSensitivity = value => Number.isFinite(value) &&
  value >= 0.4 && value <= 10.0

export function mouseSteeringAxes(movementX, movementY, sensitivity = 1) {
  const factor = calibratedMouseSensitivity(sensitivity)
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

  // For a pointer stream at 20-30Hz, one missing packet can exceed 85ms.
  // Increase tolerance without touching explicit mouse-capture release.
  // There is no actual mouse-up event for stopping pointer movement; this
  // idle detector necessarily trades a small stop delay for stable motion.
  stopDelayMs() {
    return this.packetGapMs === null ? MOUSE_STEERING_FAST_STOP_MS :
      clamp(this.packetGapMs * 2.0 + 26,
        MOUSE_STEERING_MIN_STOP_MS, MOUSE_STEERING_IDLE_MS)
  }

  move(deltaX, deltaY) {
    // Zero-delta events must not cancel the current movement or keep
    // resetting the idle clock. Browsers can generate many of these.
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY) ||
        (deltaX === 0 && deltaY === 0)) return this.axes()

    const time = this.now()
    const elapsed = time - this.lastMovementAt
    // With a rate-based server control, "pixels per packet" is NOT a stable
    // velocity: a 120Hz device gives half the delta of a 60Hz device for the
    // same physical motion. Convert to an equivalent 16ms displacement, and
    // bound tiny/long event gaps to avoid burst spikes and stalled motion.
    const packetMs = elapsed > 0 && elapsed < MOUSE_STEERING_IDLE_MS
      ? clamp(elapsed, 8, 50) : MOUSE_STEERING_SAMPLE_MS
    const scale = MOUSE_STEERING_SAMPLE_MS / packetMs
    const {yaw, pitch} = mouseSteeringAxes(
      deltaX * scale, deltaY * scale, this.sensitivity)
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
      // A hard stop or reversal must not pass through any smoothing.
      if (raw === 0 || !adjacent || previous === 0 ||
          Math.sign(previous) !== Math.sign(raw)) return raw
      const reducing = Math.abs(raw) < Math.abs(previous)
      // Deliberately slowing the mouse a lot remains immediate: do not
      // keep steering toward the old target after a clear hand slowdown.
      if (reducing &&
          Math.abs(raw) <= Math.abs(previous) *
            MOUSE_STEERING_HARD_SLOWDOWN_RATIO) return raw
      const change = Math.abs(raw - previous)
      // Symmetric filtering ONLY in the jitter band eliminates the
      // 1px/2px sawtooth at high sensitivity. No extra filtering is
      // applied to large reductions or direction changes.
      const weight = change <= MOUSE_STEERING_JITTER_BAND
        ? MOUSE_STEERING_JITTER_FILTER
        : reducing ? 1 : MOUSE_STEERING_FILTER
      return clamp(previous + (raw - previous) * weight, -1, 1)
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
