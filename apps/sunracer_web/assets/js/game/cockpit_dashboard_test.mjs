import test from "node:test"
import assert from "node:assert/strict"
import {dashboardModel, dashboardHit, tacticalOpponent} from "./cockpit_dashboard.mjs"

function fixture() {
  const own = {kind: "player", velocity: {x: 3, y: 4, z: 0}, throttle: -0.25,
    target: {x: 0, y: 0}, attackRange: 1080}
  const enemy = {kind: "npc", npcTypeId: "solar-dart-7", displayName: "Corsair-17",
    target: {x: 520, y: 0}, hull: 100, shields: 0, state: "attack"}
  const client = {selfId: 7, player: {pilot: {id: 7}}, entities: new Map([[7, own], [8, enemy]]),
    navComputer: {solarNavigation: {tactical_encounter: {id: "raid", ship_class: "dart", call_sign: "Corsair-17"}}}}
  return {client, enemy}
}

test("tactical panel identifies own Dart, shows range and exposes retreat", () => {
  const {client, enemy} = fixture()
  assert.equal(tacticalOpponent(client), enemy)
  const model = dashboardModel(client)
  assert.equal(model.speed, 5)
  assert.equal(model.throttle, -25)
  assert.match(model.detail, /520\/1080/)
  assert.deepEqual(model.actions.map(a => a.id), ["retreat"])
})

test("verified Dart surrender enables settlement without a target lock", () => {
  const {client, enemy} = fixture()
  enemy.state = "surrendered"
  assert.deepEqual(dashboardModel(client).actions.map(a => a.id), ["accept", "seize"])
  client.tacticalRetreating = true
  assert.deepEqual(dashboardModel(client).actions, [])
})

test("foreign and destroyed targets cannot enable surrender", () => {
  const {client, enemy} = fixture()
  enemy.npcTypeId = "solar-dart-8"
  enemy.state = "surrendered"
  assert.equal(tacticalOpponent(client), null)
  assert.deepEqual(dashboardModel(client).actions.map(a => a.id), ["retreat"])
  enemy.npcTypeId = "solar-dart-7"
  enemy.status = "destroyed"
  assert.equal(tacticalOpponent(client), null)
})

test("physical panel UV resolves only the displayed buttons", () => {
  const {client, enemy} = fixture()
  const uv = (x, y) => ({x: x / 1024, y: 1 - y / 256})
  assert.equal(dashboardHit(dashboardModel(client), uv(800, 210)), "retreat")
  assert.equal(dashboardHit(dashboardModel(client), uv(50, 210)), null)
  enemy.state = "surrendered"
  assert.equal(dashboardHit(dashboardModel(client), uv(50, 210)), "accept")
  assert.equal(dashboardHit(dashboardModel(client), uv(800, 210)), "seize")
  assert.equal(dashboardHit(dashboardModel(client), uv(530, 25)), "navigation")
})

test("headset receives surrender without needing full tactical navigation or desktop actions", () => {
  const model = dashboardModel({helmetSurrender: {surrendered: true, call_sign: "Corsair-17"}})
  assert.equal(model.surrendered, true)
  assert.match(model.line, /CORSAIR-17/)
  assert.deepEqual(model.actions, [])
})
