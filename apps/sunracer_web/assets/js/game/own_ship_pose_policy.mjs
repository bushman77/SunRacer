// The camera may be extrapolated from authoritative world ticks, but should
// NOT rewind whenever an unrelated control acknowledgement or movement event
// carries another copy of the ship. Critical teleports/respawns still snap.
export function acceptOwnShipPose({existing = false, ownShip = false,
  snapshot = false, worldTick = false} = {}) {
  return !existing || !ownShip || snapshot || worldTick
}
