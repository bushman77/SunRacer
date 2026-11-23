// Headset (SBS) own-ship pose between LAN visual-pose updates.
//
// The laptop relays its cockpit pose roughly every 32 ms, with Wi-Fi arrival
// jitter on top. Chasing each pose with a short settle made the headset view
// rotate, stop, and jump again on every update: invisible on the ship-fixed
// cockpit, but a visible judder of the stars and scenery while turning.
//
// Instead, keep rotating at the laptop camera's own body rates (and moving
// at the ship's velocity) from the moment each pose arrived, so the goal
// moves continuously every frame. When the next pose lands, the small
// prediction error is removed over a short window by the same visual
// reconciler the laptop uses, never as a jump. Presentation only.
import {rotateLocal, predictPosition} from "./own_ship_prediction.mjs"
import {OwnShipCameraReconciler} from "./own_ship_camera_reconciler.mjs"

// Never extrapolate further than the headset's own pose freshness window.
export const HEADSET_PREDICTION_MAX_SECONDS = 0.15
// Poses carry the laptop's sample time (`sampledAt`, laptop clock). The
// laptop->phone clock offset is estimated as the MINIMUM of
// (arrival - sampledAt) over recent poses: the fastest deliveries bound the
// true offset, so the variable LAN-publisher delay and Wi-Fi jitter cancel
// instead of turning into a wobble while turning.
export const HEADSET_CLOCK_WINDOW = 90

export class ClockOffsetEstimator {
  constructor(size = HEADSET_CLOCK_WINDOW) {
    this.size = size
    this.samples = []
  }
  reset() { this.samples = [] }
  add(receivedAt, sampledAt) {
    if (!Number.isFinite(receivedAt) || !Number.isFinite(sampledAt)) return
    this.samples.push(receivedAt - sampledAt)
    if (this.samples.length > this.size) this.samples.shift()
  }
  get offset() {
    return this.samples.length ? Math.min(...this.samples) : null
  }
}

export function predictVisualPose(visual, velocity, now) {
  if (!visual?.orientation || !visual.target || !Number.isFinite(now)) return null
  // `poseTime` (phone clock) when the laptop sampled it; else arrival time.
  const at = Number.isFinite(visual.poseTime) ? visual.poseTime : visual.receivedAt
  const age = Math.max(0, Math.min(HEADSET_PREDICTION_MAX_SECONDS,
    (now - at) / 1000)) || 0
  const rates = visual.rates
  const orientation = rates && age > 0
    ? rotateLocal(visual.orientation,
      {yaw: rates.yaw * age, pitch: rates.pitch * age, roll: rates.roll * age})
    : {...visual.orientation}
  return {orientation, target: predictPosition(visual.target, velocity, age), age}
}

export class HeadsetPoseSmoother {
  constructor() { this.reset() }

  reset() {
    this.reconciler = new OwnShipCameraReconciler()
    this.previous = null
    this.clock = new ClockOffsetEstimator()
  }

  // Phone-clock time at which the laptop sampled this pose, if known.
  timed(visual) {
    const offset = this.clock.offset
    if (!Number.isFinite(visual.sampledAt) || offset === null) return visual
    const poseTime = visual.sampledAt + offset
    // Never in the future (clock offset is a lower bound on arrival delay).
    return {...visual, poseTime: Math.min(poseTime, visual.receivedAt)}
  }

  get lastReceivedAt() { return this.previous?.receivedAt ?? null }

  step(rawVisual, velocity, now) {
    if (!rawVisual) return null
    const fresh = rawVisual.receivedAt !== this.previous?.receivedAt
    if (fresh) this.clock.add(rawVisual.receivedAt, rawVisual.sampledAt)
    const visual = fresh || !this.previous ? this.timed(rawVisual) : this.previous
    const predicted = predictVisualPose(visual, velocity, now)
    if (!predicted) return null
    if (this.previous && fresh) {
      // Hand off from where the OLD pose's prediction puts the view at this
      // same instant (with its remaining correction), not from last frame's
      // view, which would freeze one frame per pose. Large differences
      // (teleports) snap at once inside the reconciler.
      const before = predictVisualPose(this.previous, velocity, now)
      if (before) {
        this.reconciler.rebase(this.reconciler.apply(before.orientation, now),
          predicted.orientation, now)
      }
    }
    this.previous = visual
    return {
      orientation: this.reconciler.apply(predicted.orientation, now),
      target: predicted.target,
    }
  }
}
