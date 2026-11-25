import {applyAuthoritativeDamage, entityKey} from "./combat_client.mjs"
import {toScene} from "./stereo_math.mjs"

// Two wing rays may hit two different NPCs. Apply only the final entity
// states sent by the server, never infer or simulate damage in the browser.
export function applyLaserBurstDamage(entities, attack) {
  if (Array.isArray(attack?.hits)) {
    let count = 0
    for (const impact of attack.hits) {
      const target = entities.get(entityKey(impact.target_id))
      if (target && applyAuthoritativeDamage(target, impact.target)) count++
    }
    return count
  }

  const target = entities.get(entityKey(attack?.target_id))
  return attack?.hit !== false && applyAuthoritativeDamage(target, attack?.target) ? 1 : 0
}

export function visualLaserRays(attack, attacker, target) {
  const rays = Array.isArray(attack?.beams) && attack.beams.length
    ? attack.beams
    : [{
      from: attack?.from || attacker?.render,
      to: attack?.to || target?.render,
      hit: attack?.hit !== false && Boolean(target),
    }]
  return rays.filter(ray => ray?.from && ray?.to).map(ray => ({
    from: {...ray.from},
    to: {...ray.to},
    side: ray.side || null,
    hit: Boolean(ray.hit),
  }))
}

// Rendering only. A pilot sees the cockpit at its latest interpolated pose,
// not the pose used when the shot was emitted. Anchor only the local pilot's
// named wing rays to the actual visible muzzle meshes. Keep the shot's world
// endpoint (and hit information) unchanged; never use this for collision.
export function visualLaserStart(ray, selfId, emitters, out) {
  const local = selfId != null && ray.shooterId === selfId
  const emitter = local && (ray.side === "left" || ray.side === "right")
    ? emitters?.[ray.side] : null
  if (emitter) return emitter.getWorldPosition(out)
  const from = toScene(ray.from)
  return out.set(from.x, from.y, from.z)
}
