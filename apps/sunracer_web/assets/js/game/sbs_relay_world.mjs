// Laptop-only, read-only projection of an already authenticated world stream.
// Never send raw Phoenix join replies, player records, credentials, inventory,
// currency, station dialogue or full navigation/contact data to the S21.
const MAX_ENTITIES = 256
const MAX_BYTES = 256 * 1024
// This delay applies only to the laptop -> S21 LAN publisher. It does not
// change the authoritative Phoenix/EC2 tick or create new remote traffic.
// Keep one latest map instead of a queue; prioritize timely HMD frames.
export const WORLD_INTERVAL_MS = 32
const entityScalar = [
  "id", "kind", "npc_type_id", "ship_class", "display_name", "status",
  "angle", "throttle", "flight_mode", "target_id", "hull", "max_hull",
  "shields", "max_shields", "attack_range",
]
const vectorFields = [
  "position", "position_3d", "destination", "destination_3d",
  "orientation", "attitude", "velocity", "angular_velocity",
]
const scalar = value => {
  if (value == null || typeof value === "boolean") return value
  if (typeof value === "number") return Number.isFinite(value) &&
    Math.abs(value) <= 1e12 ? value : undefined
  if (typeof value === "string") return value.slice(0, 96)
  return undefined
}
const object = (value, keys) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const out = {}
  for (const key of keys) {
    const v = scalar(value[key])
    if (v !== undefined) out[key] = v
  }
  return out
}

// Presentation-only own-ship pose; it never updates simulation state or
// changes server-owned entity orientation. It is scoped to the current map.
export function projectLocalVisualPose(map, pose) {
  if (!pose || !map?.entities?.some(entity =>
    entity?.id != null && String(entity.id) === String(pose.id))) return null
  const coordinate = v => Number.isFinite(v) && Math.abs(v) <= 1e12
  const pos = pose.position_3d
  const rotation = pose.orientation
  if (!pos || !rotation ||
      !["x", "y", "z"].every(axis => coordinate(pos[axis])) ||
      !["x", "y", "z", "w"].every(axis => coordinate(rotation[axis]))) return null
  const norm = Math.hypot(rotation.x, rotation.y, rotation.z, rotation.w)
  if (norm < 0.9 || norm > 1.1) return null
  return {
    id: pose.id,
    position_3d: {x: pos.x, y: pos.y, z: pos.z},
    orientation: {
      x: rotation.x / norm, y: rotation.y / norm,
      z: rotation.z / norm, w: rotation.w / norm,
    },
  }
}

export function projectSbsRelayWorld(map, visualPose = null) {
  if (!map || typeof map !== "object" || !Number.isSafeInteger(map.tick) ||
      map.tick < 0 || typeof map.map_id !== "string" ||
      map.map_id.length > 96 || !Array.isArray(map.entities) ||
      map.entities.length > MAX_ENTITIES) return null
  const entities = []
  for (const entity of map.entities) {
    if (!entity || entity.id == null || !entity.kind) return null
    const picked = {}
    for (const key of entityScalar) {
      const value = scalar(entity[key])
      if (value !== undefined) picked[key] = value
    }
    for (const field of vectorFields) {
      const value = object(entity[field], ["x","y","z","w","roll","pitch","yaw"])
      if (value !== undefined) picked[field] = value
    }
    entities.push(picked)
  }
  const result = {
    map_id: map.map_id, tick: map.tick, entities,
  }
  if (Number.isFinite(map.tick_ms)) result.tick_ms = map.tick_ms
  const boundaries = object(map.boundaries, ["width","height","radius"])
  if (boundaries) result.boundaries = boundaries
  const volume = object(map.volume, ["altitude_min","altitude_max"])
  if (volume) result.volume = volume
  if (map.orbital_base) {
    const base = object(map.orbital_base,
      ["id","body_id","refinery_id","model","berth_count"])
    if (base) {
      base.position_3d = object(map.orbital_base.position_3d, ["x","y","z"])
      result.orbital_base = base
    }
  }
  if (Array.isArray(map.docked_pilots)) {
    result.docked_pilots = map.docked_pilots.slice(0, 64)
      .map(scalar).filter(v => v != null)
  }
  if (Array.isArray(map.station_avatars)) {
    result.station_avatars = map.station_avatars.slice(0, 64).map(avatar => {
      const row = object(avatar, ["player_id","heading","room_id","x","y","z"])
      if (!row) return {}
      const position = object(avatar.position, ["x","y","z","room_id"])
      if (position) row.position = position
      return row
    })
  }
  if (Array.isArray(map.station_attendants)) {
    result.station_attendants = map.station_attendants.slice(0, 64)
      .map(npc => object(npc, ["id","name","display_name","room_id",
        "x","y","z","role","station_id"]) || {})
  }
  const visual = projectLocalVisualPose(map, visualPose)
  if (visual) result.visual_pose = visual
  return JSON.stringify(result).length <= MAX_BYTES ? result : null
}

// Coalesces fast Phoenix deltas into one latest map for the single LAN viewer.
// The native process holds one snapshot; it never accumulates an unbounded
// stream queue or opens another world subscription.
export class SbsRelayWorldPublisher {
  constructor({invoke, delay = WORLD_INTERVAL_MS}) {
    this.invoke = invoke
    this.delay = delay
    this.pending = null
    this.timer = null
    this.inFlight = false
  }
  publish(map, immediate = false, visualPose = null) {
    const projected = projectSbsRelayWorld(map, visualPose)
    if (!projected) return
    this.pending = projected
    if (this.timer) return
    if (immediate) void this.flush()
    else this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, this.delay)
  }
  async flush() {
    if (this.inFlight || !this.pending) return
    const invoke = this.invoke?.()
    if (!invoke) { this.pending = null; return }
    const world = this.pending
    this.pending = null
    this.inFlight = true
    try {
      await invoke("publish_sbs_relay_world", {world})
    } catch {
      // LAN forwarding is optional; the Phoenix cockpit remains usable.
    } finally {
      this.inFlight = false
      if (this.pending && !this.timer) {
        this.timer = setTimeout(() => {
          this.timer = null
          void this.flush()
        }, this.delay)
      }
    }
  }
  clear() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.pending = null
  }
}
