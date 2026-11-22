// A high-rate movement_delta is a preview, NOT a new own-ship pose snapshot.
// For the local pilot, authoritative position, orientation, angular velocity
// and authoritativeAt update only from world_state / world_delta. Replacing
// these on every preview restarts camera prediction and produces visible
// rewind/catch-up jitter at high mouse sensitivities.
export function applyOwnShipMovementPreview(ownShip, preview) {
  if (!ownShip || !preview) return false
  if (preview.flight_mode === "cruise" || preview.flight_mode === "newtonian") {
    ownShip.flightMode = preview.flight_mode
  }
  if (Number.isFinite(preview.throttle)) ownShip.throttle = preview.throttle
  return true
}
