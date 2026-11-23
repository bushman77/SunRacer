import {relaySteering} from "./mouse_steering.mjs"
// Only the current, authenticated LAN world's own-ship visual pose is used
// for headset presentation. Phoenix continues to own all entity state.
export const VISUAL_POSE_MAX_AGE_MS = 150
export const VISUAL_POSE_SETTLE_SECONDS = 0.025

const validVector = (o, keys) => Boolean(o && keys.every(
  key => Number.isFinite(o[key]) && Math.abs(o[key]) <= 1e12))

export function localVisualPose(map, selfId, receivedAt) {
  const pose = map?.visual_pose
  const id = pose?.id
  if (!pose || id == null || selfId == null ||
      String(id) !== String(selfId) ||
      typeof map?.map_id !== "string" ||
      !map.entities?.some(e => String(e.id) === String(id)) ||
      !validVector(pose.position_3d, ["x", "y", "z"]) ||
      !validVector(pose.orientation, ["x", "y", "z", "w"])) return null
  const q = pose.orientation
  const norm = Math.hypot(q.x, q.y, q.z, q.w)
  if (norm < 0.9 || norm > 1.1 || !Number.isFinite(receivedAt)) return null
  return {mapId: map.map_id, id: String(id), receivedAt,
    target: {...pose.position_3d},
    orientation: {x: q.x/norm, y: q.y/norm, z: q.z/norm, w: q.w/norm},
    // Laptop virtual-joystick deflection for the headset line (or null).
    steering: relaySteering(pose.steering)}
}

export function freshLocalVisualPose(stored, mapId, selfId, now) {
  if (!stored || String(stored.id) !== String(selfId) ||
      stored.mapId !== mapId || !Number.isFinite(now) ||
      now < stored.receivedAt ||
      now - stored.receivedAt > VISUAL_POSE_MAX_AGE_MS) return null
  return stored
}
