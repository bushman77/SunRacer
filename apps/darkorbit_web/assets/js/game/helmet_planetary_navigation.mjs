import {planetaryRenderSpec} from "./planetary_view.mjs"

const finiteCoord = c => c && typeof c === "object" &&
  [c.x, c.y, c.z ?? 0].every(Number.isFinite)

const visualEncounter = e => e && typeof e === "object" && typeof e.id === "string"
  ? {
      id: e.id,
      mode: e.mode,
      call_sign: typeof e.call_sign === "string" ? e.call_sign : "CONTACT",
      ship_class: e.ship_class,
      relative_position_km: finiteCoord(e.relative_position_km) ? e.relative_position_km : null,
      distance_km: e.distance_km,
    }
  : null

// Helmet receives only visual metadata. Never treat it as simulation state
// or accept a caller-provided planet on the viewer socket. The extra fields
// are exactly what GreenStarbaseVisual / EncounterShipVisual / the HUD read,
// so the phone draws the same scenery as the laptop's SBS view.
export function helmetPlanetaryNavigation(payload) {
  const view = payload?.planetary_view
  return {
    planetary_view: planetaryRenderSpec(view) ? view : null,
    tactical_active: payload?.tactical_active === true,
    status: typeof payload?.status === "string" ? payload.status : null,
    location_id: payload?.location_id ?? null,
    green_starbase_nearby: payload?.green_starbase_nearby === true,
    starbases: Array.isArray(payload?.starbases)
      ? payload.starbases.filter(base => base && typeof base.id === "string" &&
          finiteCoord(base.site_3d))
          .map(base => ({id: base.id, model: base.model, site_3d: base.site_3d}))
      : [],
    origin_position_km: finiteCoord(payload?.origin_position_km)
      ? payload.origin_position_km : null,
    destination_position_km: finiteCoord(payload?.destination_position_km)
      ? payload.destination_position_km : null,
    encounter: visualEncounter(payload?.encounter),
    pending_encounter: visualEncounter(payload?.pending_encounter),
  }
}
