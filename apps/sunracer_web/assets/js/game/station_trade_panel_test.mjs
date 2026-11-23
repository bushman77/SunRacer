import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {StationTradePanel, maxSell, maxBuy, freeHold, clampAmount, holdText,
  receiptText, MAX_TRADE_UNITS} from "./station_trade_panel.mjs"

const read = path => readFileSync(new URL(path, import.meta.url), "utf8")

const view = (over = {}) => ({
  credits: 1000,
  hold: {capacity: 4, used: 1},
  goods: [
    {id: "civilian_mail", name: "Civilian mail", mass_tonnes: 1, quantity: 1,
      sell_price: 75, buy_price: null},
    {id: "titanium", name: "Titanium", mass_tonnes: 1, quantity: 0,
      sell_price: 200, buy_price: 260},
  ],
  ...over,
})

test("limits: sell what is aboard, buy within credits and free hold", () => {
  const v = view()
  assert.equal(freeHold(v), 3)
  assert.equal(maxSell(v.goods[0]), 1)
  assert.equal(maxSell(v.goods[1]), 0)
  assert.equal(maxBuy(v, v.goods[1]), 3)                    // hold-limited
  assert.equal(maxBuy({...v, credits: 600}, v.goods[1]), 2) // credit-limited
  assert.equal(maxBuy(v, v.goods[0]), 0)                    // not stocked
  assert.equal(maxBuy({...v, hold: {capacity: 4, used: 4}}, v.goods[1]), 0)
  assert.equal(maxBuy({credits: 1e9, hold: {capacity: 5000, used: 0}},
    {buy_price: 1, mass_tonnes: 1}), MAX_TRADE_UNITS)
  assert.equal(clampAmount(7, 3), 3)
  assert.equal(clampAmount(0, 3), 1)
  assert.equal(clampAmount("2", 3), 2)
  assert.equal(clampAmount(5, 0), 0)
  assert.equal(holdText(v), "Hold: 1 / 4 t")
  assert.equal(receiptText({action: "sold", amount: 2, name: "Dilithium",
    unit_price: 450, total: 900, credits_remaining: 1900}),
  "Sold 2 × Dilithium at 450 cr = 900 cr. Balance: 1,900 cr.")
})

// Minimal DOM stand-in: enough for the panel's render and click handling.
function fakeDom() {
  const make = (tag = "div") => {
    const el = {
      tagName: tag, children: [], dataset: {}, style: {}, textContent: "",
      className: "", disabled: false, value: "", max: "", listeners: {},
      appendChild(child) { child.parent = el; this.children.push(child); return child },
      replaceChildren() { this.children = [] },
      addEventListener(type, fn) { this.listeners[type] = fn },
      focus() {},
      closest(selector) {
        for (let node = el; node; node = node.parent) {
          const match = selector.match(/^\[data-([a-z-]+)\]$/)
          if (match) {
            const key = match[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())
            if (node.dataset[key] !== undefined) return node
          } else if (selector === "#" + node.id) return node
        }
        return null
      },
    }
    return el
  }
  const ids = ["station-trade-close", "station-trade-message", "station-trade-credits",
    "station-trade-hold", "station-trade-goods", "station-trade-amount",
    "station-trade-sell", "station-trade-buy"]
  const root = make("section")
  const byId = {}
  for (const id of ids) {
    byId[id] = make()
    byId[id].id = id
    root.appendChild(byId[id])
  }
  root.querySelector = selector => byId[selector.slice(1)] || null
  globalThis.document = {createElement: make, activeElement: null}
  return {root, byId}
}

test("panel trades by cargo id and amount only, and shows the server receipt", () => {
  const {root, byId} = fakeDom()
  const sent = []
  const panel = new StationTradePanel({
    root,
    sell: (payload, done) => {
      sent.push(["sell", payload])
      done(true, {exchange: view({credits: 1075, hold: {capacity: 4, used: 0},
        goods: [view().goods[1]]}),
      receipt: {action: "sold", amount: 1, name: "Civilian mail", unit_price: 75,
        total: 75, credits_remaining: 1075}})
    },
    buy: (payload, done) => {
      sent.push(["buy", payload])
      done(false, {reason: "insufficient_credits"})
    },
  })
  panel.open(view())
  assert.equal(byId["station-trade-credits"].textContent, "Credits: 1,000 cr")
  assert.equal(byId["station-trade-goods"].children.length, 2)
  assert.equal(byId["station-trade-sell"].disabled, true)

  // Pick the mail row, then sell it.
  const mailRow = byId["station-trade-goods"].children[0]
  root.listeners.click({target: mailRow.children[0]})
  assert.equal(byId["station-trade-sell"].disabled, false)
  assert.match(byId["station-trade-sell"].textContent, /Sell 1 · \+75 cr/)
  assert.equal(byId["station-trade-buy"].textContent, "Not stocked here")
  root.listeners.click({target: byId["station-trade-sell"]})
  assert.deepEqual(sent, [["sell", {cargo_id: "civilian_mail", amount: 1}]])
  assert.match(byId["station-trade-message"].textContent, /^Sold 1 × Civilian mail/)
  assert.equal(byId["station-trade-credits"].textContent, "Credits: 1,075 cr")
  assert.equal(panel.choice, null) // sold out: row gone, selection cleared

  // Titanium: "Max" is limited by free hold (4 t) and credits (4 × 260).
  root.listeners.click({target: byId["station-trade-goods"].children[0]})
  byId["station-trade-amount"].dataset = {}
  root.listeners.click({target: Object.assign(
    {closest: sel => sel === "[data-trade-step]" ? {dataset: {tradeStep: "max"}} : null})})
  assert.equal(panel.amount, 4)
  root.listeners.click({target: byId["station-trade-buy"]})
  assert.deepEqual(sent.at(-1), ["buy", {cargo_id: "titanium", amount: 4}])
  assert.equal(byId["station-trade-message"].textContent,
    "Trade refused: insufficient credits")
})

test("Tarek's console is wired through the channel and closes with the dialogue", () => {
  const client = read("./client.js")
  const markup = read("../../../lib/sunracer_web/controllers/game_html/show.html.heex")
  assert.match(client, /id === "trade" && topic === "console"/)
  assert.match(client, /this\.sendStationOutfitting\("station_trade", \{\}/)
  assert.match(client, /this\.sendStationOutfitting\("station_trade_sell", payload, done\)/)
  assert.match(client, /this\.sendStationOutfitting\("station_trade_buy", payload, done\)/)
  assert.match(client, /this\.tradePanel\?\.close\(\{restoreDialogue: false\}\)/)
  assert.match(client, /: this\.tradePanel\?\.opened \? this\.tradePanel : null/)
  for (const id of ["station-trade-panel", "station-trade-goods", "station-trade-amount",
    "station-trade-sell", "station-trade-buy", "station-trade-credits", "station-trade-hold"]) {
    assert.match(markup, new RegExp('id="' + id + '"'))
  }
  // No price or credit value is ever sent by the client.
  assert.doesNotMatch(read("./station_trade_panel.mjs"), /send\(\{[^}]*price/)
})
