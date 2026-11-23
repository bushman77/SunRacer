// Three-degree-of-freedom handset head tracking; strictly local to the HMD.
// Euler YXZ and screen-orientation correction follow DeviceOrientationControls,
// then calibration makes the current pose the forward-looking baseline.
// No position, flight input, sensor telemetry or network request is produced.
const RADIANS = Math.PI / 180
const HALF_SQRT = Math.SQRT1_2
const INITIAL = Object.freeze({x: 0, y: 0, z: 0, w: 1})

// Statuses where head tracking genuinely cannot work. Only these may show the
// in-cockpit "HEAD TRACKING UNAVAILABLE" panel. A quiet sensor is NOT one of
// them: browsers only fire deviceorientation when the angle changes, so a
// still head produces no events at all.
const UNAVAILABLE = new Set(["denied", "unsupported", "https-required"])
export const headTrackingUnavailable = status => UNAVAILABLE.has(status)

const product = (a, b) => ({
  x: a.x*b.w + a.w*b.x + a.y*b.z - a.z*b.y,
  y: a.y*b.w + a.w*b.y + a.z*b.x - a.x*b.z,
  z: a.z*b.w + a.w*b.z + a.x*b.y - a.y*b.x,
  w: a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z,
})
const inverseUnit = q => ({x: -q.x, y: -q.y, z: -q.z, w: q.w})

// One-Euro filter for the head pose (Casiez et al. 2012). Phone orientation
// sensors carry constant sub-degree noise and arrive out of step with the
// display; applied raw, the whole headset view shimmered even with the head
// still. The filter smooths hard when the head is still and opens up as the
// head turns, so noise vanishes without adding much lag to real motion.
// Tuned by simulation: +/-0.5 deg sensor noise -> ~0.18 deg frame-to-frame
// (from ~0.9 raw); a 90 deg/s head turn lags ~2.6 deg (~30 ms). Raise
// MIN_CUTOFF/BETA for less lag, lower them for less shimmer.
export const HEAD_FILTER_MIN_CUTOFF_HZ = 1.0
export const HEAD_FILTER_BETA = 0.05 // extra Hz per deg/s of head speed
export const HEAD_FILTER_DERIVATIVE_CUTOFF_HZ = 1.0
const DEGREES = 180 / Math.PI
const smoothingFactor = (cutoffHz, dt) => {
  const tau = 1 / (2 * Math.PI * cutoffHz)
  return 1 / (1 + tau / dt)
}
export const angleBetweenDegrees = (a, b) => 2 * Math.acos(Math.min(1,
  Math.abs(a.x*b.x + a.y*b.y + a.z*b.z + a.w*b.w))) * DEGREES
// Normalized lerp along the short arc; exact enough for per-frame steps.
const nlerp = (a, b, t) => {
  const sign = a.x*b.x + a.y*b.y + a.z*b.z + a.w*b.w < 0 ? -1 : 1
  const q = {x: a.x + (b.x*sign - a.x)*t, y: a.y + (b.y*sign - a.y)*t,
    z: a.z + (b.z*sign - a.z)*t, w: a.w + (b.w*sign - a.w)*t}
  const n = Math.hypot(q.x, q.y, q.z, q.w) || 1
  return {x: q.x/n, y: q.y/n, z: q.z/n, w: q.w/n}
}

export class HeadPoseFilter {
  constructor() { this.reset() }
  reset() {
    this.value = null
    this.previousRaw = null
    this.speed = 0
    this.at = null
  }
  step(raw, time) {
    if (!this.value || !Number.isFinite(time) || this.at === null) {
      this.value = {...raw}
      this.previousRaw = {...raw}
      this.speed = 0
      this.at = time
      return {...this.value}
    }
    const dt = Math.min(0.1, Math.max(0.001, (time - this.at) / 1000))
    this.at = time
    const rawSpeed = angleBetweenDegrees(this.previousRaw, raw) / dt
    this.previousRaw = {...raw}
    this.speed += (rawSpeed - this.speed) *
      smoothingFactor(HEAD_FILTER_DERIVATIVE_CUTOFF_HZ, dt)
    const cutoff = HEAD_FILTER_MIN_CUTOFF_HZ + HEAD_FILTER_BETA * this.speed
    this.value = nlerp(this.value, raw, smoothingFactor(cutoff, dt))
    return {...this.value}
  }
}
const eulerYXZ = (x, y, z) => {
  const c1=Math.cos(x/2), c2=Math.cos(y/2), c3=Math.cos(z/2)
  const s1=Math.sin(x/2), s2=Math.sin(y/2), s3=Math.sin(z/2)
  return {
    x: s1*c2*c3 + c1*s2*s3,
    y: c1*s2*c3 - s1*c2*s3,
    z: c1*c2*s3 - s1*s2*c3,
    w: c1*c2*c3 + s1*s2*s3,
  }
}
export function handsetQuaternion({alpha, beta, gamma}, screenAngle = 0) {
  if (![alpha, beta, gamma, screenAngle].every(Number.isFinite)) return null
  // Convert the device's camera-up convention into Three.js' -Z view axis.
  const q = eulerYXZ(beta*RADIANS, alpha*RADIANS, -gamma*RADIANS)
  const phone = {x: -HALF_SQRT, y: 0, z: 0, w: HALF_SQRT}
  const a = -screenAngle * RADIANS / 2
  return product(product(q, phone), {x: 0, y: 0, z: Math.sin(a), w: Math.cos(a)})
}

export class HelmetHeadTracking {
  constructor({win = typeof window !== "undefined" ? window : null,
               now = () => performance.now(), onStatus = () => {}} = {}) {
    this.win = win
    this.now = now
    this.onStatus = onStatus
    this.enabled = false
    this.status = "off"
    this.last = null
    this.baseline = null
    this.pendingRecenter = false
    this.lastAt = -Infinity
    this.filter = new HeadPoseFilter()
    this.eventCount = 0
    this.onOrientation = event => {
      if (!this.enabled) return
      const screenAngle = Number(this.win?.screen?.orientation?.angle ??
        this.win?.orientation ?? 0)
      const q = handsetQuaternion(event, screenAngle)
      if (!q) return
      this.last = q
      if (!this.baseline || this.pendingRecenter) {
        this.baseline = q
        this.pendingRecenter = false
        // A recenter is a deliberate jump: never smooth across it.
        this.filter.reset()
      }
      this.eventCount++
      this.lastAt = this.now()
      if (this.status !== "tracking") this.setStatus("tracking")
    }
  }

  setStatus(status) {
    this.status = status
    this.onStatus(status)
  }

  // Call directly in a physical tap handler. Android Chrome usually has no
  // requestPermission(); platforms that do must receive its transient gesture.
  async startFromGesture() {
    if (this.enabled) return this.status
    if (!this.win?.isSecureContext) {
      this.setStatus("https-required")
      return this.status
    }
    const api = this.win.DeviceOrientationEvent
    if (!api) {
      this.setStatus("unsupported")
      return this.status
    }
    try {
      if (typeof api.requestPermission === "function") {
        const permission = await api.requestPermission()
        if (permission !== "granted") {
          this.setStatus("denied")
          return this.status
        }
      }
      this.win.addEventListener("deviceorientation", this.onOrientation)
      this.enabled = true
      this.setStatus("waiting")
    } catch (_error) {
      this.setStatus("denied")
    }
    return this.status
  }

  recenter() {
    if (!this.ready()) return false
    this.baseline = {...this.last}
    this.filter.reset()
    return true
  }

  // Recalibrate on the NEXT fresh sensor event, not an old portrait/setup
  // sample. The phone can rotate while entering landscape/fullscreen.
  // Until that event arrives the view looks straight ahead (the pilot asked
  // to recenter); it is never reported as "unavailable".
  requestRecenter() {
    if (!this.enabled) return false
    this.pendingRecenter = true
    return true
  }

  // Ready for gaze selection: a calibrated pose exists. There is deliberately
  // no staleness timeout: a still head sends no sensor events, and treating
  // that as lost tracking flashed the warning panel and snapped the view to
  // straight ahead every time the pilot held still for two seconds.
  ready(_time = this.now()) {
    return this.enabled && this.last !== null && this.baseline !== null &&
      !this.pendingRecenter
  }

  // Relative head pose, held between sensor events. Neutral while waiting
  // for the first sample or a requested recenter. Null only when tracking is
  // not running at all.
  // Unfiltered relative pose (exact sensor geometry).
  rawRotation() {
    if (!this.enabled) return null
    if (!this.ready()) return {...INITIAL}
    return product(inverseUnit(this.baseline), this.last)
  }

  // Filtered relative pose for rendering. Call once per frame: the One-Euro
  // filter is stateful and advances with `time`.
  rotation(time = this.now()) {
    const raw = this.rawRotation()
    if (!raw || !this.ready()) return raw
    return this.filter.step(raw, time)
  }

  stop() {
    if (this.enabled) this.win?.removeEventListener?.("deviceorientation", this.onOrientation)
    this.enabled = false
    this.last = null
    this.baseline = null
    this.pendingRecenter = false
    this.lastAt = -Infinity
    this.filter.reset()
    this.setStatus("off")
  }
}

export const HEAD_NEUTRAL = INITIAL
