// Presentation-only prediction of the pilot's OWN ship between server ticks.
//
// The server simulates at 10 Hz. Smoothing alone either shows each 100 ms
// orientation step (short settle, as pointer-lock used) or lags far behind the
// mouse (long settle). Instead the client runs the server's own turn rules
// (Core.World.FlightDynamics.advance_angular_rate) forward from the last
// authoritative orientation, using the pilot's current local input. Every
// new snapshot replaces the starting point, so prediction never accumulates:
// the server stays authoritative and the camera just stops stepping.
//
// Keep these limits in sync with @turn_limits / @mouse_turn_limits in
// apps/core/lib/core/world/flight_dynamics.ex (degrees/s and degrees/s^2).
export const TURN_LIMITS = Object.freeze({
  yaw: {speed: 44, acceleration: 95, braking: 145},
  pitch: {speed: 38, acceleration: 80, braking: 135},
  roll: {speed: 56, acceleration: 110, braking: 165},
})
export const MOUSE_TURN_LIMITS = Object.freeze({
  yaw: {speed: 100, acceleration: 280, braking: 360},
  pitch: {speed: 88, acceleration: 240, braking: 320},
})
// Never extrapolate further than this past the last snapshot. If ticks stall
// the camera holds rather than spinning on.
export const MAX_PREDICTION_SECONDS = 0.2
const STEP_SECONDS = 1 / 120
const AXES = ["yaw", "pitch", "roll"]
const rad = degrees => degrees * Math.PI / 180

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback

// Server rule for one axis over `dt`.
export function advanceAngularRate(current, input, limits, dt) {
  const desired = input * rad(limits.speed)
  const acceleration = input === 0 || current * input < 0
    ? limits.braking : limits.acceleration
  const maxDelta = rad(acceleration) * dt
  const next = current + Math.max(-maxDelta, Math.min(maxDelta, desired - current))
  return Math.abs(next) < 1e-10 ? 0 : next
}

// Angle turned on one axis after `seconds`, starting at `rate` (rad/s).
export function predictAxisAngle(rate, input, limits, seconds, {mouseAxis = false} = {}) {
  let current = finite(rate)
  const command = Math.max(-1, Math.min(1, finite(input)))
  // Server: a neutral mouse axis stops turning immediately, no braking tail.
  if (mouseAxis && command === 0) return 0
  let remaining = Math.max(0, Math.min(MAX_PREDICTION_SECONDS, finite(seconds)))
  let angle = 0
  while (remaining > 1e-9) {
    const dt = Math.min(STEP_SECONDS, remaining)
    const next = advanceAngularRate(current, command, limits, dt)
    angle += (current + next) * 0.5 * dt
    current = next
    remaining -= dt
  }
  return angle
}

const multiply = (a, b) => ({
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
})

const axisAngle = (x, y, z, angle) => {
  const s = Math.sin(angle / 2)
  return {x: x * s, y: y * s, z: z * s, w: Math.cos(angle / 2)}
}

const normalize = q => {
  const n = Math.hypot(q.x, q.y, q.z, q.w)
  return n > 0 ? {x: q.x / n, y: q.y / n, z: q.z / n, w: q.w / n} : {x: 0, y: 0, z: 0, w: 1}
}

// Mirrors Core.World.Orientation.from_angles/1 and rotate_local/2.
export function fromAngles({yaw = 0, pitch = 0, roll = 0}) {
  return normalize(multiply(multiply(axisAngle(0, -1, 0, yaw), axisAngle(1, 0, 0, pitch)),
    axisAngle(0, 0, 1, roll)))
}

export function rotateLocal(orientation, angles) {
  return normalize(multiply(orientation, fromAngles(angles)))
}

// Predict the own ship's orientation `seconds` after `orientation` was
// received with body rates `angularVelocity` (rad/s).
//
// `input` is either a constant {yaw, pitch, roll} or a function of the
// seconds elapsed since the snapshot returning the input that was in effect
// then (see InputHistory). Replaying the real history matters when you stop:
// the ship keeps the turn it made before the stop instead of snapping back
// to the last snapshot and jumping forward again.
export function predictOrientation(orientation, angularVelocity, input,
  {mouseMode = false, seconds = 0} = {}) {
  if (!orientation) return orientation
  const inputAt = typeof input === "function" ? input : () => input
  const rates = {}
  const angles = {yaw: 0, pitch: 0, roll: 0}
  for (const axis of AXES) rates[axis] = finite(angularVelocity?.[axis])
  let elapsed = 0
  const total = Math.max(0, Math.min(MAX_PREDICTION_SECONDS, finite(seconds)))
  while (total - elapsed > 1e-9) {
    const dt = Math.min(STEP_SECONDS, total - elapsed)
    const command = inputAt(elapsed) || {}
    for (const axis of AXES) {
      const mouseAxis = mouseMode && axis !== "roll"
      const value = Math.max(-1, Math.min(1, finite(command[axis])))
      if (mouseAxis && value === 0) {
        // Server: a neutral mouse axis stops turning at once, no braking tail.
        rates[axis] = 0
        continue
      }
      const limits = mouseAxis ? MOUSE_TURN_LIMITS[axis] : TURN_LIMITS[axis]
      const next = advanceAngularRate(rates[axis], value, limits, dt)
      angles[axis] += (rates[axis] + next) * 0.5 * dt
      rates[axis] = next
    }
    elapsed += dt
  }
  if (!angles.yaw && !angles.pitch && !angles.roll) return orientation
  return rotateLocal(normalize(orientation), angles)
}

// Short record of the pilot's local flight input over time.
export class InputHistory {
  constructor({keepMs = 1000} = {}) {
    this.keepMs = keepMs
    this.entries = []
  }

  record(time, axes) {
    const input = {yaw: finite(axes?.yaw), pitch: finite(axes?.pitch), roll: finite(axes?.roll)}
    const last = this.entries[this.entries.length - 1]
    if (!last || last.input.yaw !== input.yaw || last.input.pitch !== input.pitch ||
        last.input.roll !== input.roll) {
      this.entries.push({time, input})
    }
    // Keep the newest entry older than the window: it is the input in
    // effect at the window's start.
    while (this.entries.length > 1 && this.entries[1].time <= time - this.keepMs) {
      this.entries.shift()
    }
  }

  // Input in effect at absolute time `time`.
  at(time) {
    let found = this.entries[0]?.input || {yaw: 0, pitch: 0, roll: 0}
    for (const entry of this.entries) {
      if (entry.time > time) break
      found = entry.input
    }
    return found
  }

  // Function of seconds-since-`startTime`, for predictOrientation.
  since(startTime) {
    return seconds => this.at(startTime + seconds * 1000)
  }

  clear() { this.entries = [] }
}

// Straight-line position extrapolation (world units/s) for the same window.
export function predictPosition(position, velocity, seconds) {
  if (!position) return position
  const s = Math.max(0, Math.min(MAX_PREDICTION_SECONDS, finite(seconds)))
  return {
    x: position.x + finite(velocity?.x) * s,
    y: position.y + finite(velocity?.y) * s,
    z: (position.z ?? 0) + finite(velocity?.z) * s,
  }
}
