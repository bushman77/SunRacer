// Presentation-only choice between the pilot's manually controlled cockpit
// pose and the direction of the last server navigation destination. During
// active pointer-captured steering, stale server destinations must not
// override the locally predicted view.
export function cockpitDestinationCamera(ownShip, clientLedActive = false) {
  return Boolean(ownShip?.destination && !clientLedActive)
}
