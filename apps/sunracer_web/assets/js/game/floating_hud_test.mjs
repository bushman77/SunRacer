import test from "node:test"
import assert from "node:assert/strict"
import {fitHudRect, readHudRect, FLOATING_HUD_PANELS} from "./floating_hud.mjs"

test("drag and resize stay inside the viewport", () => {
  assert.deepEqual(fitHudRect({x: 999, y: -20, width: 300, height: 200},
    {width: 800, height: 600}), {x: 492, y: 8, width: 300, height: 200})
  assert.deepEqual(fitHudRect({x: 40, y: 60, width: 900, height: 800},
    {width: 400, height: 300}), {x: 8, y: 8, width: 384, height: 284})
  assert.deepEqual(fitHudRect({x: 8, y: 8, width: -4, height: -2},
    {width: 100, height: 80}), {x: 8, y: 8, width: 84, height: 64})
})
test("invalid local preferences are ignored", () => {
  for (const bad of [null, {}, {x: 0, y: 0, width: -1, height: 5},
    {x: "12", y: 0, width: 200, height: 100}]) assert.equal(readHudRect(bad), null)
  assert.deepEqual(readHudRect({x: 0,y: 2,width: 200,height: 100, hidden: true}),
    {x: 0,y: 2,width: 200,height: 100})
})
test("station and inventory move their card rather than the modal wrapper", () => {
  assert.equal(FLOATING_HUD_PANELS.station, "#starbase-docked-panel > div")
  assert.equal(FLOATING_HUD_PANELS.inventory, "#pilot-inventory-panel > div")
  assert.equal(FLOATING_HUD_PANELS.comms, "#global-chat-panel")
})
