// Optional pointer-locked cockpit steering. Mouse input is a rate command on
// server-authoritative yaw/pitch; throttle, roll and weapons remain separate.
//
// The command is the mouse's *velocity* averaged over a short sliding window,
// not the size of the last movement event. Replacing the command per event
// made it jump between values on every packet (and depend on the mouse's
// polling rate: 125 Hz and 1000 Hz mice felt completely different), so the
// server's 10 Hz tick sampled noise. Averaging over ~2 frames gives a steady
// command while you move and still stops promptly when your hand stops: once
// no movement remains in the window the command is exactly neutral. There is
// no coasting afterwards.
export const MOUSE_STEERING_WINDOW_MS = 32
// Kept for callers: the stop timer fires once the window has emptied.
export const MOUSE_STEERING_IDLE_MS = MOUSE_STEERING_WINDOW_MS
export const MOUSE_STEERING_DEFAULT_SENSITIVITY = 1
// Mouse speed (px/s, at 1x sensitivity) that commands the full turn rate.
export const MOUSE_FULL_RATE_PX_PER_SEC = 600
const DEADZONE = 0.015

const clamp = (value, low, high) => Math.min(high, Math.max(low, value))
export const validMouseSensitivity = value => Number.isFinite(value) &&
  value >= 0.4 && value <= 6.0

// Convert an average mouse velocity (px/s) to bounded yaw/pitch axes.
export function mouseSteeringAxes(velocityX, velocityY, sensitivity = 1) {
  const factor = validMouseSensitivity(sensitivity) ? sensitivity : 1
  const scale = factor / MOUSE_FULL_RATE_PX_PER_SEC
  const yaw = clamp((Number(velocityX) || 0) * scale, -1, 1)
  // Browser Y increases downwards. Moving mouse UP pitches nose UP.
  const pitch = clamp(-(Number(velocityY) || 0) * scale, -1, 1)
  return {
    yaw: Math.abs(yaw) < DEADZONE ? 0 : yaw,
    pitch: Math.abs(pitch) < DEADZONE ? 0 : pitch,
  }
}

export class MouseSteering {
  constructor({now = () => performance.now(), sensitivity = 1,
               windowMs = MOUSE_STEERING_WINDOW_MS} = {}) {
    this.now = now
    this.sensitivity = validMouseSensitivity(sensitivity) ? sensitivity : 1
    this.windowMs = windowMs
    this.samples = []
    this.yaw = 0
    this.pitch = 0
    this.lastMovementAt = -Infinity
  }

  move(deltaX, deltaY) {
    // Zero-delta events must not extend movement or reset the idle clock.
    // Browsers can generate many of these.
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY) ||
        (deltaX === 0 && deltaY === 0)) return this.axes()

    const time = this.now()
    this.samples.push({time, x: deltaX, y: deltaY})
    this.lastMovementAt = time
    this.recompute(time)
    return this.axes()
  }

  recompute(time) {
    const cutoff = time - this.windowMs
    while (this.samples.length && this.samples[0].time <= cutoff) this.samples.shift()
    if (!this.samples.length) {
      this.yaw = 0
      this.pitch = 0
      return
    }
    let x = 0
    let y = 0
    for (const sample of this.samples) {
      x += sample.x
      y += sample.y
    }
    const seconds = this.windowMs / 1000
    const axes = mouseSteeringAxes(x / seconds, y / seconds, this.sensitivity)
    this.yaw = axes.yaw
    this.pitch = axes.pitch
  }

  axes() { return {yaw: this.yaw, pitch: this.pitch} }

  // Call every frame (and from the stop timer). Returns the new axes when the
  // windowed command changed, otherwise null.
  update(time = this.now()) {
    const before = this.axes()
    this.recompute(time)
    if (before.yaw === this.yaw && before.pitch === this.pitch) return null
    return this.axes()
  }

  // Back-compatible name: also returns any change, including reaching neutral.
  expire(time = this.now()) {
    return this.update(time)
  }

  release() {
    this.samples = []
    this.yaw = 0
    this.pitch = 0
    this.lastMovementAt = -Infinity
    return this.axes()
  }
}
