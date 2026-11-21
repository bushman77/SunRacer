import test from "node:test"
import assert from "node:assert/strict"
import {helmetHudLines, HMD_HUD_PAGES} from "./helmet_hud_pages.mjs"

const ship = {
  id: "pilot", throttle: 0.57, velocity: {x: 3, y: 4, z: 0},
  hull: 80, maxHull: 100, shields: 45, maxShields: 90,
}
const npc = {id: "npc-1", kind: "npc", displayName: "SCOW TRADER", status: "active"}
const client = {
  selfId: "pilot", entities: new Map([["pilot", ship], ["npc-1", npc]]),
  navComputer: {solarNavigation: {space_environment: {
    kind: "asteroid_belt", intensity: 0.63, visual_only: true,
  }}},
}

test("gaze menu has strictly local, known read-only pages", () => {
  assert.deepEqual(HMD_HUD_PAGES, ["flight", "contacts", "space"])
  assert.deepEqual(helmetHudLines("flight", client), [
    "FLIGHT / STATUS", "THR 57%  SPD 5", "HULL 80%", "SHIELD 50%",
  ])
  assert.deepEqual(helmetHudLines("space", client), [
    "SPACE / CONDITIONS", "ASTEROID BELT", "INTENSITY 63%", "VISUAL ENVIRONMENT",
  ])
})
test("contacts are display-only and never include the pilot", () => {
  assert.deepEqual(helmetHudLines("contacts", client), [
    "CONTACTS / VIEW", "1 NEARBY VESSEL", "1 SCOW TRADER",
  ])
})
test("missing game state gives a safe, non-throwing readout", () => {
  assert.deepEqual(helmetHudLines("flight", {}), [
    "FLIGHT / STATUS", "THR --  SPD 0", "HULL --", "SHIELD --",
  ])
  assert.deepEqual(helmetHudLines("contacts", {}), [
    "CONTACTS / VIEW", "0 NEARBY VESSELS", "NO CONTACTS", "REPORTED",
  ])
  assert.deepEqual(helmetHudLines("space", {}), [
    "SPACE / CONDITIONS", "UNKNOWN", "INTENSITY --", "VISUAL ENVIRONMENT",
  ])
})
test("contact labels are bounded and scrubbed for canvas presentation", () => {
  const copy = {...client, entities: new Map([
    ["pilot", ship], ["npc-1", {...npc, displayName: "Hello\n" + "z".repeat(250)}],
  ])}
  assert.equal(helmetHudLines("contacts", copy)[2], "1 Hello " + "z".repeat(12))
})
