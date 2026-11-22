import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {fittingCandidates, installedItem, fittingStatRows} from "./station_outfitting_panel.mjs"

test("fitting picker excludes incompatible and unowned equipment", () => {
  const items = [
    {id: "beryl", category: "laser", quantity: 1},
    {id: "g1", category: "generator", quantity: 0},
    {id: "sg1", category: "shield", quantity: 2},
  ]
  assert.deepEqual(fittingCandidates(items, "laser").map(x => x.id), ["beryl"])
  assert.deepEqual(fittingCandidates(items, "generator").map(x => x.id), ["sg1"])
  assert.equal(installedItem({slots: {laser: [null], generator: ["sg1"]}}, "generator", 0), "sg1")
})

test("preview includes shield and weapon deltas without assuming an improvement", () => {
  const rows = fittingStatRows(
    {hit_points: 300, shields: 0, damage: 10, speed: 320, shield_absorption: 0},
    {hit_points: 300, shields: 1000, damage: 10, speed: 320, shield_absorption: 0.4})
  assert.equal(rows.find(x => x.name === "Shield absorption").after, "40%")
  assert.equal(rows.find(x => x.name === "Shield capacity").changed, true)
  assert.equal(rows.find(x => x.name === "Laser damage").changed, false)
})

test("in-game outfitting only sends selections, not statistics", () => {
  const client = readFileSync(new URL("./client.js", import.meta.url), "utf8")
  const html = readFileSync(new URL(
    "../../../lib/sunracer_web/controllers/game_html/show.html.heex", import.meta.url),
  "utf8")
  assert.match(client, /this\.sendStationOutfitting\("station_outfitting_fit", payload, done\)/)
  assert.match(client, /id === "outfitting" && topic === "console"/)
  assert.match(html, /id="station-outfitting-panel"/)
  assert.match(html, /id="station-outfitting-preview"/)
})
