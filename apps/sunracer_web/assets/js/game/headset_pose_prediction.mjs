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

export function predictVisualPose(visual, velocity, now) {
  if (!visual?.orientation || !visual.target || !Number.isFinite(now)) return null
  const age = Math.max(0, Math.min(HEADSET_PREDICTION_MAX_SECONDS,
    (now - visual.receivedAt) / 1000)) || 0
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
  }

  get lastReceivedAt() { return this.previous?.receivedAt ?? null }

  step(visual, velocity, now) {
    const predicted = predictVisualPose(visual, velocity, now)
    if (!predicted) return null
    if (this.previous && visual.receivedAt !== this.previous.receivedAt) {
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
