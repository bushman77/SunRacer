import {smoothAttitude, angularDelta} from "./attitude_interpolation.mjs"
import {smoothOrientation} from "./orientation_interpolation.mjs"
import {STANDARD_CAMERA_SETTLE_SECONDS} from "./camera_response.mjs"

// Presentation-only smoothing shared by the laptop client and the paired
// headset. The server ticks at ~10 Hz; drawing raw snapshots makes the camera
// step ten times a second, which is the main source of judder in a headset.
// Never feed these render values back into authoritative state.
export const POSITION_SETTLE_SECONDS = 0.085

// Beyond this distance (world units) a new snapshot is a teleport or map
// change, not motion: jump straight to it instead of sweeping across space.
export const SNAP_DISTANCE = 1500

const blendFor = (deltaSeconds, settleSeconds) =>
  1 - Math.exp(-Math.max(0, Number(deltaSeconds) || 0) / Math.max(1e-3, settleSeconds))

// `predicted` optionally replaces the smoothing goal for the pilot's own ship
// (see own_ship_prediction.mjs): {target, orientation, positionSettleSeconds}.
export function smoothEntityPresentation(entity, deltaSeconds,
  settleSeconds = STANDARD_CAMERA_SETTLE_SECONDS, predicted = null) {
  if (!entity?.target) return entity
  const goal = predicted?.target || entity.target
  const goalOrientation = predicted?.orientation || entity.orientation
  const positionBlend = blendFor(deltaSeconds,
    predicted?.positionSettleSeconds ?? POSITION_SETTLE_SECONDS)
  const render = entity.render || {...goal}
  render.x += (goal.x - render.x) * positionBlend
  render.y += (goal.y - render.y) * positionBlend
  render.z = (render.z ?? 0) + ((goal.z ?? 0) - (render.z ?? 0)) * positionBlend
  entity.render = render
  if (entity.attitude) {
    entity.renderAttitude = smoothAttitude(
      entity.renderAttitude || entity.attitude, entity.attitude, deltaSeconds, settleSeconds)
  }
  if (goalOrientation) {
    entity.renderOrientation = smoothOrientation(
      entity.renderOrientation || goalOrientation, goalOrientation,
      deltaSeconds, settleSeconds)
  }
  return entity
}

// Smooth a heading angle along the shortest arc.
export function smoothHeading(current, target, deltaSeconds, settleSeconds = 0.075) {
  if (!Number.isFinite(target)) return current
  if (!Number.isFinite(current)) return target
  return current + angularDelta(current, target) * blendFor(deltaSeconds, settleSeconds)
}

const distance = (a, b) =>
  Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0), (a.z || 0) - (b.z || 0))

// Headset-side upsert: keep one object per entity so render state survives
// between server snapshots. `snap` is used for a fresh authoritative
// snapshot (entering combat / map change).
export function upsertHelmetEntity(entities, raw, key, {snap = false} = {}) {
  const id = key(raw.id)
  const pos = raw.position_3d || raw.position || {x: 0, y: 0, z: 0}
  const target = {x: pos.x || 0, y: pos.y || 0, z: pos.z || 0}
  const destination = raw.destination_3d || raw.destination || null
  const existing = entities.get(id)
  const entity = existing || {id}
  const jump = !existing || snap || !entity.render ||
    distance(entity.render, target) > SNAP_DISTANCE

  Object.assign(entity, {
    kind: raw.kind,
    npcTypeId: raw.npc_type_id,
    shipClass: raw.ship_class || null,
    course: raw.course || null,
    displayName: raw.display_name,
    state: raw.state,
    status: raw.status,
    target,
    destination,
    attitude: raw.attitude,
    orientation: raw.orientation,
    velocity: raw.velocity,
    throttle: raw.throttle,
    flightMode: raw.flight_mode,
    targetId: raw.target_id == null ? null : key(raw.target_id),
    hull: raw.hull,
    maxHull: raw.max_hull,
    shields: raw.shields,
    maxShields: raw.max_shields,
    attackRange: raw.attack_range,
    angularVelocity: raw.angular_velocity,
  })
  entity.targetAngle = Number.isFinite(raw.angle) ? raw.angle : entity.targetAngle ?? 0

  if (jump) {
    entity.render = {...target}
    entity.renderAttitude = raw.attitude ? {...raw.attitude} : null
    entity.renderOrientation = raw.orientation ? {...raw.orientation} : null
    entity.angle = entity.targetAngle
  } else {
    if (!raw.attitude) entity.renderAttitude = null
    if (!raw.orientation) entity.renderOrientation = null
  }
  entities.set(id, entity)
  return entity
}
