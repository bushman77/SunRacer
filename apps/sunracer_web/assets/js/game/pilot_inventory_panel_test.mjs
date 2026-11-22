import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {PilotInventoryPanel, creditLabel, cargoRows, equipmentRows,
  installedRows} from "./pilot_inventory_panel.mjs"

const source = name => readFileSync(new URL(name, import.meta.url), "utf8")

test("inventory displays real cargo stacks, loose gear and installed loadouts", () => {
  const view = {
    cargo: {items: [{id: "medical_supplies", name: "Medical supplies",
      quantity: 3, total_tonnes: 3}, {quantity: 0}]},
    equipment: [{id: "beryl", name: "Beryl", quantity: 2}, {quantity: 0}],
    catalog: [{id: "beryl", name: "Beryl", category: "laser"}],
  }
  assert.equal(creditLabel(25000), "25,000 cr")
  assert.equal(cargoRows(view).length, 1)
  assert.equal(equipmentRows(view).length, 1)
  assert.deepEqual(installedRows(
    {slots: {laser: ["beryl"], generator: [null]}}, view.catalog),
  ["Laser 1: Beryl", "Generator 1: Empty"])
  assert.deepEqual(installedRows(
    {slots: {laser: [null], generator: [null]}}, view.catalog,
    {id: 1, base_damage: 10}),
  ["Laser 1: Garnet · 10 damage (built-in)", "Generator 1: Empty"])
})

test("inventory panel never permits mutable operations or reads client IDs", () => {
  const ui = source("./pilot_inventory_panel.mjs")
  const game = source("./client.js")
  const markup = source("../../../lib/sunracer_web/controllers/game_html/show.html.heex")
  const channel = source("../../../lib/sunracer_web/channels/world_channel.ex")
  assert.match(game, /this\.channel\.push\("pilot_inventory", \{\}, 5000\)/)
  assert.match(channel, /World\.pilot_inventory\(socket\.assigns\.world_session_id\)/)
  assert.doesNotMatch(ui, /station_outfitting_purchase|station_outfitting_fit/)
  assert.match(markup, /id="pilot-inventory-panel"/)
  assert.match(markup, /id="pilot-inventory-cargo"/)
  assert.match(markup, /id="pilot-inventory-equipment"/)
  assert.match(markup, /id="pilot-inventory-configs"/)
  assert.match(markup, /id="nav-inventory-open"/)
  assert.match(markup, /id="cockpit-inventory-open"/)
})

test("panel opens without docking, refreshes on demand and ignores closed replies", () => {
  let delivered
  let opens = 0
  const nodes = new Map([
    ["#pilot-inventory-close", {focus() {}, addEventListener() {}}],
    ["#pilot-inventory-refresh", {disabled: false, addEventListener() {}}],
    ["#pilot-inventory-message", {textContent: ""}],
  ])
  const root = {
    style: {display: "none"},
    querySelector(key) { return nodes.get(key) || null },
  }
  const panel = new PilotInventoryPanel({
    root, fetch: done => { delivered = done }, onOpen: () => opens++,
  })
  panel.open()
  assert.equal(panel.opened, true)
  assert.equal(opens, 1)
  assert.equal(root.style.display, "flex")
  assert.equal(nodes.get("#pilot-inventory-refresh").disabled, true)
  panel.close()
  delivered(true, {credits: 999})
  assert.equal(panel.data, null)
  assert.equal(root.style.display, "none")
  assert.equal(panel.busy, false)
})
