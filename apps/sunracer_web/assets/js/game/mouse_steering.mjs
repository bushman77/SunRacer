// Full-screen virtual joystick for captured cockpit mouse steering.
//
// Mouse movement does NOT command a turn directly. It moves a persistent
// stick deflection whose range is the whole cockpit view: screen centre is
// neutral, the left/right edges are full yaw and the top/bottom edges are
// full pitch. The deflection stays where the pilot leaves it, exactly like a
// held analog stick, so there is no idle timer, no "did the hand stop?"
// guessing from pointer-event gaps, and irregular WebKitGTK packets cannot
// create stop/turn pulses. To stop turning, the pilot moves back to centre.
//
// The resulting yaw/pitch axes (-1..1) feed the same FlightControls payload
// as before, so Phoenix (authoritative), the client-led camera and the SBS
// relay visual pose all consume one steady command. Throttle, roll and
// weapons remain separate.

// Small neutral zone around the crosshair so "no turn" is easy to find.
export const MOUSE_STEERING_DEAD_ZONE = 0.05
// Response curve exponent: fine aim near centre, fast turns near the edge.
export const MOUSE_STEERING_CURVE = 1.5
// 1.0 = the steering vector tip tracks the physical mouse 1:1 on screen.
export const MOUSE_STEERING_DEFAULT_SENSITIVITY = 1.0
// Fallback span if the cockpit surface has no measurable size yet.
const FALLBACK_SPAN = {width: 1280, height: 720}

const clamp = (value, low, high) => Math.min(high, Math.max(low, value))

// Native clients have their own storage origin. Do not silently disable
// mouse steering on first launch; preserve an explicit opt-out everywhere.
export const enabledMouseSteering = (saved, isNative = false) =>
  saved === "1" || (saved === null && isNative === true)

// Sensitivity scales how far the steering vector moves per mouse pixel.
export const validMouseSensitivity = value => Number.isFinite(value) &&
  value >= 0.4 && value <= 10.0

// Deflection (-1..1 per axis) -> turn command (-1..1 per axis).
export function joystickAxis(deflection) {
  const value = clamp(Number(deflection) || 0, -1, 1)
  const magnitude = Math.abs(value)
  if (magnitude <= MOUSE_STEERING_DEAD_ZONE) return 0
  const scaled = (magnitude - MOUSE_STEERING_DEAD_ZONE) /
    (1 - MOUSE_STEERING_DEAD_ZONE)
  return Math.sign(value) * Math.pow(scaled, MOUSE_STEERING_CURVE)
}

// Screen-space geometry for the faint steering line drawn from the
// crosshair (centre) to the current stick deflection.
export function mouseSteeringVector(deflection, width, height) {
  const w = Number.isFinite(width) && width > 0 ? width : 0
  const h = Number.isFinite(height) && height > 0 ? height : 0
  const dx = clamp(Number(deflection?.x) || 0, -1, 1)
  const dy = clamp(Number(deflection?.y) || 0, -1, 1)
  const magnitude = Math.min(1, Math.hypot(dx, dy))
  const x1 = w / 2
  const y1 = h / 2
  return {
    visible: w > 0 && h > 0 && magnitude > MOUSE_STEERING_DEAD_ZONE,
    x1, y1,
    x2: x1 + dx * x1,
    y2: y1 + dy * y1,
    opacity: 0.15 + magnitude * 0.35,
  }
}

export class MouseSteering {
  constructor({
    sensitivity = MOUSE_STEERING_DEFAULT_SENSITIVITY,
    span = () => FALLBACK_SPAN,
  } = {}) {
    this.sensitivity = validMouseSensitivity(sensitivity)
      ? sensitivity : MOUSE_STEERING_DEFAULT_SENSITIVITY
    this.span = span
    this.x = 0
    this.y = 0
  }

  halfSpan() {
    const size = this.span?.() || FALLBACK_SPAN
    const width = Number.isFinite(size.width) && size.width > 0
      ? size.width : FALLBACK_SPAN.width
    const height = Number.isFinite(size.height) && size.height > 0
      ? size.height : FALLBACK_SPAN.height
    return {x: width / 2, y: height / 2}
  }

  // Raw pointer deltas (pixels) push the persistent stick deflection.
  // Browser Y increases downwards: moving the mouse UP pitches nose UP.
  move(deltaX, deltaY) {
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY) ||
        (deltaX === 0 && deltaY === 0)) return this.axes()
    const half = this.halfSpan()
    this.x = clamp(this.x + deltaX * this.sensitivity / half.x, -1, 1)
    this.y = clamp(this.y + deltaY * this.sensitivity / half.y, -1, 1)
    return this.axes()
  }

  deflection() { return {x: this.x, y: this.y} }

  axes() {
    // 0 - value avoids -0 for a neutral pitch.
    return {yaw: joystickAxis(this.x), pitch: 0 - joystickAxis(this.y)}
  }

  // Recentre the stick: capture loss, Escape, F full-stop, Atlas, etc.
  release() {
    this.x = 0
    this.y = 0
    return this.axes()
  }
}

// ---- SBS headset relay -------------------------------------------------
// The laptop camera's vertical field of view (StereoSpaceView's camera).
export const COCKPIT_VERTICAL_FOV_DEG = 70

// Validated stick deflection for the LAN visual pose. The aspect is the
// laptop cockpit's width/height, so the headset can point its line at the
// SAME world direction the laptop line's tip shows. Returns null if invalid.
export function relaySteering(value) {
  if (!value || typeof value !== "object") return null
  const {x, y, aspect} = value
  if (![x, y, aspect].every(Number.isFinite) ||
      Math.abs(x) > 1 || Math.abs(y) > 1 ||
      aspect < 0.2 || aspect > 5) return null
  return {x, y, aspect}
}

// Ship-local endpoint (cockpit frame: -Z is the nose, +Y up) of the headset
// steering line at `distance`. Matches the laptop's perspective projection:
// a screen-edge deflection points at the edge of the laptop's view.
export function steeringLineTip(steering, distance,
  verticalFovDeg = COCKPIT_VERTICAL_FOV_DEG) {
  const valid = relaySteering(steering)
  if (!valid || !Number.isFinite(distance) || distance <= 0) return null
  const tanV = Math.tan(verticalFovDeg * Math.PI / 360)
  const magnitude = Math.min(1, Math.hypot(valid.x, valid.y))
  return {
    visible: magnitude > MOUSE_STEERING_DEAD_ZONE,
    x: valid.x * tanV * valid.aspect * distance,
    y: -valid.y * tanV * distance,
    z: -distance,
    // Much stronger than the laptop line: it must read through headset optics.
    opacity: 0.55 + magnitude * 0.4,
  }
}
