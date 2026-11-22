// Local PRESENTATION only. The laptop can integrate its visual orientation
// continuously from mouse input instead of re-seeding it from delayed EC2
// snapshots every 100ms. The server remains authoritative for true ship
// orientation, position, combat, collision and world state.
import {advanceAngularRate, rotateLocal, MOUSE_TURN_LIMITS, TURN_LIMITS}
  from "./own_ship_prediction.mjs"
import {normalizeOrientation} from "./orientation_interpolation.mjs"

export const LOCAL_CAMERA_MAX_STEP_SECONDS = 0.05
export const LOCAL_CAMERA_INTEGRATION_STEP_SECONDS = 1/120
export const LOCAL_CAMERA_SNAP_DEGREES = 65
const AXES = ["yaw","pitch","roll"]
const clamp = (x,a,b) => Math.max(a,Math.min(b,x))
const finite = x => Number.isFinite(x) ? x : 0

export class ClientLedMouseCamera {
  constructor() { this.reset() }
  reset() {
    this.orientation = null
    this.rates = {yaw:0,pitch:0,roll:0}
  }
  get active() { return this.orientation !== null }
  begin(orientation, angularVelocity = null) {
    this.orientation = normalizeOrientation(orientation)
    if (!this.orientation) { this.reset(); return false }
    for (const axis of AXES) this.rates[axis] = finite(angularVelocity?.[axis])
    return true
  }
  advance(axes, elapsedSeconds, {mouseMode = true} = {}) {
    if (!this.active) return null
    let remaining = clamp(finite(elapsedSeconds),0,LOCAL_CAMERA_MAX_STEP_SECONDS)
    while (remaining > 1e-9) {
      const dt = Math.min(remaining,LOCAL_CAMERA_INTEGRATION_STEP_SECONDS)
      const angle = {yaw:0,pitch:0,roll:0}
      for (const axis of AXES) {
        const mouseAxis = mouseMode && axis !== "roll"
        const command = clamp(finite(axes?.[axis]),-1,1)
        // The same immediate neutral mouse brake as the authoritative
        // simulation: no hidden angular-velocity tail after release.
        const oldRate = mouseAxis && command === 0 ? 0 : this.rates[axis]
        const limits = mouseAxis ? MOUSE_TURN_LIMITS[axis] : TURN_LIMITS[axis]
        const nextRate = advanceAngularRate(oldRate,command,limits,dt)
        angle[axis] = (oldRate+nextRate)*0.5*dt
        this.rates[axis] = nextRate
      }
      this.orientation = rotateLocal(this.orientation,angle)
      remaining -= dt
    }
    return this.orientation
  }
  divergenceDegrees(authoritative) {
    if (!this.active || !authoritative) return null
    const q = normalizeOrientation(authoritative)
    if (!q) return null
    const a = this.orientation
    const dot = Math.abs(a.x*q.x+a.y*q.y+a.z*q.z+a.w*q.w)
    return 2 * Math.acos(clamp(dot,0,1)) * 180 / Math.PI
  }
  shouldSnap(authoritative) {
    const diff=this.divergenceDegrees(authoritative)
    return diff !== null && diff > LOCAL_CAMERA_SNAP_DEGREES
  }
}
