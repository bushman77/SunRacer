// Preserve the cockpit's predicted orientation when a delayed authoritative
// world tick replaces the prediction baseline. Without this handoff the
// target briefly rewinds every tick, then catches up (visible at 10 Hz).
// This is a small, short-lived VISUAL offset; Phoenix retains flight authority.
export const CAMERA_REBASE_DURATION_MS = 130
export const CAMERA_REBASE_MAX_DEGREES = 25

const identity = {x: 0, y: 0, z: 0, w: 1}
const clamp = (n, a, b) => Math.max(a, Math.min(b, n))
const finiteQuat = q => q && ["x", "y", "z", "w"].every(
  key => Number.isFinite(q[key]))
const normalize = q => {
  if (!finiteQuat(q)) return null
  const n = Math.hypot(q.x, q.y, q.z, q.w)
  return n > 1e-6
    ? {x:q.x/n,y:q.y/n,z:q.z/n,w:q.w/n} : null
}
const conjugate = q => ({x:-q.x,y:-q.y,z:-q.z,w:q.w})
const multiply = (a,b) => ({
  x:a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y,
  y:a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x,
  z:a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w,
  w:a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z,
})

// Only modest deviations are smoothed: teleports, dock transitions and
// actual large authority corrections must be visible immediately.
export class OwnShipCameraReconciler {
  constructor() { this.reset() }
  reset() { this.correction = null; this.receivedAt = -Infinity }

  rebase(previousVisual, authoritativeGoal, time) {
    const oldQ = normalize(previousVisual)
    const fresh = normalize(authoritativeGoal)
    if (!oldQ || !fresh || !Number.isFinite(time)) {
      this.reset()
      return false
    }
    let delta = normalize(multiply(oldQ, conjugate(fresh)))
    if (!delta) { this.reset(); return false }
    if (delta.w < 0) delta = {x:-delta.x,y:-delta.y,z:-delta.z,w:-delta.w}
    const degrees = 2 * Math.acos(clamp(delta.w, -1, 1)) * 180 / Math.PI
    if (degrees > CAMERA_REBASE_MAX_DEGREES || degrees < 0.0001) {
      this.reset()
      return false
    }
    this.correction = delta
    this.receivedAt = time
    return true
  }

  apply(goal, now) {
    if (!this.correction || !Number.isFinite(now)) return goal
    const elapsed = now - this.receivedAt
    if (elapsed < 0 || elapsed >= CAMERA_REBASE_DURATION_MS) {
      this.reset()
      return goal
    }
    // Smoothstep removes the offset continuously. Rebase against this visual
    // goal at each new tick, so there is never a one-frame 10Hz rewind.
    const t = clamp(elapsed / CAMERA_REBASE_DURATION_MS, 0, 1)
    const fade = 1 - t*t*(3 - 2*t)
    const o = this.correction
    const offset = normalize({
      x:o.x*fade,y:o.y*fade,z:o.z*fade,w:1+(o.w-1)*fade,
    })
    const q = normalize(goal)
    return offset && q ? normalize(multiply(offset,q)) : goal
  }
}
