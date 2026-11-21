import test from "node:test"
import assert from "node:assert/strict"
import {helmetPlanetaryNavigation} from "./helmet_planetary_navigation.mjs"

const EMPTY = Object.freeze({
  planetary_view: null, tactical_active: false, status: null, location_id: null,
  green_starbase_nearby: false, starbases: [], origin_position_km: null,
  destination_position_km: null, encounter: null, pending_encounter: null,
})
const nav = fields => ({...EMPTY, ...fields})

function planet(id, stage = "orbital_preview") {
  const radius = 6371
  const angle = 65 * Math.PI / 360
  return {
    body_id: id,
    radius_km: radius,
    visual_distance_km: radius / Math.sin(angle),
    angular_diameter_deg: 65,
    visual_only: true,
    stage,
    planet_center: {x: 100000, y: 200000, z: 0},
  }
}

test("HMD uses the verified planet from the pilot's navigation feed", () => {
  const visual = planet("mars")
  const navigation = helmetPlanetaryNavigation({planetary_view: visual, tactical_active: false})
  assert.deepEqual(navigation, nav({planetary_view: visual}))
  assert.equal(navigation.planetary_view.body_id, "mars")
})

test("HMD clears planets on deep-space transitions and rejects malformed data", () => {
  assert.deepEqual(helmetPlanetaryNavigation(EMPTY),
    EMPTY)
  assert.deepEqual(helmetPlanetaryNavigation({planetary_view: {...planet("venus"),
    visual_distance_km: 1}}), EMPTY)
  assert.deepEqual(helmetPlanetaryNavigation({planetary_view: {
    ...planet("venus"), visual_only: false}}), EMPTY)
  assert.deepEqual(helmetPlanetaryNavigation(null), EMPTY)
})


test("HMD retains only a boolean tactical hint and drops malformed encounters", () => {
  const navigation = helmetPlanetaryNavigation({tactical_active: true,
    encounter: {secret: "not forwarded"}, cargo: ["test"]})
  assert.deepEqual(navigation, nav({tactical_active: true}))
  assert.equal(helmetPlanetaryNavigation({tactical_active: "true"}).tactical_active, false)
})

test("HMD receives Green Starbase and fly-by scenery as visual fields only", () => {
  const site = {x: 10, y: -4, z: 2}
  const navigation = helmetPlanetaryNavigation({
    status: "idle", location_id: null, green_starbase_nearby: true, cargo: [1],
    starbases: [{id: "sol:starbase:green", model: "green_pyramid_starbase_v1",
      site_3d: site, services: {secret: true}}, {id: "broken", site_3d: {x: "?"}}],
    origin_position_km: {x: 0, y: 0, z: 0}, destination_position_km: {x: 9, y: 9, z: 0},
    encounter: {id: "flyby:1", mode: "strategic_flyby", call_sign: "Vesper-02",
      ship_class: "scow", distance_km: 12, relative_position_km: {x: 1, y: 2, z: 0},
      cargo: {secret: true}},
  })
  assert.equal(navigation.status, "idle")
  assert.equal(navigation.green_starbase_nearby, true)
  assert.deepEqual(navigation.starbases,
    [{id: "sol:starbase:green", model: "green_pyramid_starbase_v1", site_3d: site}])
  assert.equal(navigation.encounter.call_sign, "Vesper-02")
  assert.equal("cargo" in navigation.encounter, false)
  assert.equal("cargo" in navigation, false)
})
