// Captured cockpit mouse steering. Each browser pointer event contributes
// displacement to a stable turn-intent window; Phoenix still owns orientation,
// position, physics and combat. Throttle, roll and weapons remain separate.
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
// Like a held keyboard key, the latest yaw/pitch intention stays constant
// between input updates. Aggregate raw pixels over 40ms rather than turning
// every irregular WebKitGTK packet into a new angular-rate command.
export const MOUSE_STEERING_INTENT_MS = 40
export const MOUSE_STEERING_ACCUMULATE_MS = 45
export const MOUSE_STEERING_FILTER = 0.65
// A tiny up/down difference between adjacent captured mouse packets is not
// necessarily a change of pilot intent, especially at high sensitivity.
// Filter same-direction packet quantization, not reversals or hard stops.
export const MOUSE_STEERING_JITTER_BAND = 0.5
export const MOUSE_STEERING_JITTER_FILTER = 0.38
// Integer mouse events often report only one component of an ongoing
// diagonal movement. Do not turn a single zero-component packet into a
// stop/restart command. Sustained movement on the other axis still releases
// the inactive axis promptly.
export const MOUSE_STEERING_AXIS_GAP_MS = 36
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
    this.lastAxisMotionAt = {yaw: -Infinity, pitch: -Infinity}
    this.lastIntentAt = -Infinity
    this.pendingDx = 0
    this.pendingDy = 0
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
    // Browser-native pointer packets can be irregular, integer-quantized and
    // even single-axis during continuous diagonal motion. They are samples
    // of hand movement, NOT independent ship turn commands.
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY) ||
        (deltaX === 0 && deltaY === 0)) return this.axes()

    const time = this.now()
    const elapsed = time - this.lastMovementAt
    const newStream = elapsed < 0 || elapsed >= MOUSE_STEERING_IDLE_MS
    if (newStream) {
      this.yaw = 0
      this.pitch = 0
      this.packetGapMs = null
      this.lastAxisMotionAt = {yaw: -Infinity, pitch: -Infinity}
      this.lastIntentAt = -Infinity
      this.pendingDx = 0
      this.pendingDy = 0
    } else {
      this.packetGapMs = this.packetGapMs === null ? elapsed :
        elapsed > this.packetGapMs ? elapsed :
          this.packetGapMs * 0.65 + elapsed * 0.35
    }
    this.lastMovementAt = time
    if (deltaX !== 0) this.lastAxisMotionAt.yaw = time
    if (deltaY !== 0) this.lastAxisMotionAt.pitch = time

    const first = this.lastIntentAt === -Infinity
    // A real, substantial direction reversal gets an immediate command.
    // Small opposite-pixel quantization is aggregated before judging intent.
    const reverseYaw = !first && Math.abs(deltaX) >= 2 &&
      this.yaw !== 0 && Math.sign(deltaX) !== Math.sign(this.yaw)
    const reversePitch = !first && Math.abs(deltaY) >= 2 &&
      this.pitch !== 0 && Math.sign(-deltaY) !== Math.sign(this.pitch)
    this.pendingDx += deltaX
    this.pendingDy += deltaY
    const duration = time - this.lastIntentAt
    if (!first && !reverseYaw && !reversePitch &&
        duration < MOUSE_STEERING_INTENT_MS) return this.axes()

    // Normalize ALL pixels accumulated since the previous command to the
    // same 16ms reference. Event frequency no longer changes turn strength.
    // First packet and significant reversals respond immediately.
    const packetMs = elapsed > 0 && elapsed < MOUSE_STEERING_IDLE_MS
      ? clamp(elapsed, 8, 50) : MOUSE_STEERING_SAMPLE_MS
    const scale = first || reverseYaw || reversePitch
      ? MOUSE_STEERING_SAMPLE_MS / packetMs
      : MOUSE_STEERING_SAMPLE_MS / Math.max(MOUSE_STEERING_SAMPLE_MS, duration)
    const dx = reverseYaw || reversePitch ? deltaX : this.pendingDx
    const dy = reverseYaw || reversePitch ? deltaY : this.pendingDy
    const raw = mouseSteeringAxes(dx * scale, dy * scale, this.sensitivity)
    this.pendingDx = 0
    this.pendingDy = 0
    this.lastIntentAt = time

    const settle = (axis, value) => {
      const previous = this[axis]
      if (value === 0) {
        // No component in a window is not necessarily a stopped axis:
        // continuous diagonal mouse input may alternate X-only/Y-only.
        return time - this.lastAxisMotionAt[axis] <= MOUSE_STEERING_AXIS_GAP_MS
          ? previous : 0
      }
      // Never filter an actual reversal or substantial slowdown.
      if (!previous || Math.sign(value) !== Math.sign(previous) ||
          Math.abs(value) <= Math.abs(previous) * MOUSE_STEERING_HARD_SLOWDOWN_RATIO) {
        return value
      }
      const change = Math.abs(value - previous)
      const weight = change <= MOUSE_STEERING_JITTER_BAND
        ? MOUSE_STEERING_JITTER_FILTER : MOUSE_STEERING_FILTER
      return clamp(previous + (value - previous) * weight, -1, 1)
    }
    this.yaw = settle("yaw", raw.yaw)
    this.pitch = settle("pitch", raw.pitch)
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
    this.lastAxisMotionAt = {yaw: -Infinity, pitch: -Infinity}
    this.lastIntentAt = -Infinity
    this.pendingDx = 0
    this.pendingDy = 0
    return this.axes()
  }

  release() {
    this.yaw = 0
    this.pitch = 0
    this.lastMovementAt = -Infinity
    this.packetGapMs = null
    this.lastAxisMotionAt = {yaw: -Infinity, pitch: -Infinity}
    this.lastIntentAt = -Infinity
    this.pendingDx = 0
    this.pendingDy = 0
    return this.axes()
  }
}
