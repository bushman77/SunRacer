// Presentation-only camera response tuning. The server remains the sole owner
// of ship orientation; this only controls how quickly frames catch up to the
// latest authoritative quaternion after input updates.
export const STANDARD_CAMERA_SETTLE_SECONDS = 0.085
// Fast enough to follow the server's ship heading without exposing every
// 100ms network tick or 25ms command update as visible camera vibration.
export const POINTER_LOCK_CAMERA_SETTLE_SECONDS = 0.05
// The own ship is predicted between ticks (own_ship_prediction.mjs), so the
// camera follows a continuous goal; this settle only absorbs the small
// correction when each authoritative update lands.
export const PREDICTED_OWN_SHIP_SETTLE_SECONDS = 0.045

export const cameraSettleSeconds = ({ownShip = false, pointerLocked = false} = {}) =>
  ownShip && pointerLocked
    ? POINTER_LOCK_CAMERA_SETTLE_SECONDS
    : STANDARD_CAMERA_SETTLE_SECONDS
