// Tarek Sol's Trade Exchange console. Fed entirely by the server's
// `exchange` view (credits, hold capacity/usage, posted prices). The client
// only ever sends a cargo id and a whole-unit amount; every price, total and
// limit shown here is advisory and re-checked by the server ledger.
import {creditText} from "./station_outfitting_panel.mjs"

// Largest single request the server accepts (Sunracer.Trade.max_units/0).
export const MAX_TRADE_UNITS = 1000

const whole = n => Number.isInteger(n) && n > 0 ? n : 0

export const freeHold = view =>
  Math.max(0, whole(view?.hold?.capacity) - Math.max(0, Number(view?.hold?.used) || 0))

// Most units of `good` the pilot can sell: what is aboard.
export const maxSell = good => Math.min(whole(good?.quantity), MAX_TRADE_UNITS)

// Most units the pilot can buy: limited by credits, free hold and stock.
export function maxBuy(view, good) {
  const price = whole(good?.buy_price)
  if (!price) return 0
  const mass = whole(good?.mass_tonnes) || 1
  const credits = Math.max(0, Number(view?.credits) || 0)
  return Math.min(Math.floor(credits / price), Math.floor(freeHold(view) / mass),
    MAX_TRADE_UNITS)
}

export const clampAmount = (amount, max) =>
  max > 0 ? Math.min(max, Math.max(1, Math.floor(Number(amount) || 1))) : 0

export const holdText = view =>
  "Hold: " + (Number(view?.hold?.used) || 0) + " / " +
  whole(view?.hold?.capacity) + " t"

export function receiptText(receipt) {
  const verb = receipt.action === "bought" ? "Bought" : "Sold"
  return verb + " " + receipt.amount + " × " + receipt.name + " at " +
    creditText(receipt.unit_price) + " = " + creditText(receipt.total) +
    ". Balance: " + creditText(receipt.credits_remaining) + "."
}

const reasonText = reason =>
  String(reason || "unavailable").replaceAll("_", " ")

export class StationTradePanel {
  constructor({root, sell, buy, onClose}) {
    this.root = root
    this.sell = sell
    this.buy = buy
    this.onClose = onClose
    this.opened = false
    this.busy = false
    this.seq = 0
    root?.addEventListener("click", event => this.click(event))
    root?.addEventListener("input", event => this.input(event))
  }

  open(view) {
    if (!this.root || !view) return
    this.data = view
    this.choice = null
    this.amount = 1
    this.busy = false
    this.opened = true
    this.message = "Select cargo to sell from your hold or buy from the exchange."
    this.root.style.display = "flex"
    this.render()
    this.root.querySelector("#station-trade-close")?.focus({preventScroll: true})
  }

  close({restoreDialogue = true} = {}) {
    if (!this.opened) return
    this.opened = false
    this.seq++
    this.busy = false
    this.root.style.display = "none"
    if (restoreDialogue) this.onClose?.()
  }

  selected() {
    return this.data?.goods?.find(good => good.id === this.choice) || null
  }

  choose(id) {
    if (!this.opened || this.busy) return
    this.choice = id
    const good = this.selected()
    this.amount = clampAmount(this.amount, Math.max(maxSell(good), maxBuy(this.data, good)))
    this.message = good ? good.name + " · sells for " + creditText(good.sell_price) +
      (good.buy_price ? " · buy at " + creditText(good.buy_price) : " · not stocked") +
      " per tonne" : "Cargo no longer listed."
    this.render()
  }

  trade(action) {
    const good = this.selected()
    if (!this.opened || this.busy || !good) return
    const max = action === "sell" ? maxSell(good) : maxBuy(this.data, good)
    const amount = clampAmount(this.amount, max)
    if (!amount) return
    const seq = ++this.seq
    this.busy = true
    this.message = (action === "sell" ? "Selling " : "Buying ") + amount + " × " +
      good.name + " through the exchange ledger…"
    this.render()
    const send = action === "sell" ? this.sell : this.buy
    send({cargo_id: good.id, amount}, (ok, result) => {
      if (!this.opened || seq !== this.seq) return
      this.busy = false
      if (ok && result?.exchange && result?.receipt) {
        this.data = result.exchange
        this.message = receiptText(result.receipt)
        if (!this.selected()) this.choice = null
        const next = this.selected()
        this.amount = clampAmount(this.amount,
          Math.max(maxSell(next), maxBuy(this.data, next)))
      } else {
        this.message = "Trade refused: " + reasonText(result?.reason)
      }
      this.render()
    })
  }

  click(event) {
    if (!this.opened) return
    if (event.target?.closest?.("#station-trade-close")) return this.close()
    if (this.busy) return
    if (event.target?.closest?.("#station-trade-sell")) return this.trade("sell")
    if (event.target?.closest?.("#station-trade-buy")) return this.trade("buy")
    const step = event.target?.closest?.("[data-trade-step]")?.dataset.tradeStep
    if (step != null) {
      const good = this.selected()
      const max = Math.max(maxSell(good), maxBuy(this.data, good))
      this.amount = step === "max" ? max : clampAmount(this.amount + Number(step), max)
      return this.render()
    }
    const id = event.target?.closest?.("[data-trade-good]")?.dataset.tradeGood
    if (id != null) this.choose(id)
  }

  input(event) {
    if (!this.opened || event.target?.id !== "station-trade-amount") return
    const good = this.selected()
    this.amount = clampAmount(event.target.value,
      Math.max(maxSell(good), maxBuy(this.data, good)))
    this.renderActions()
  }

  render() {
    if (!this.opened || !this.data) return
    const at = selector => this.root.querySelector(selector)
    at("#station-trade-message").textContent = this.message
    at("#station-trade-credits").textContent = "Credits: " + creditText(this.data.credits)
    at("#station-trade-hold").textContent = holdText(this.data)

    const list = at("#station-trade-goods")
    list.replaceChildren()
    for (const good of this.data.goods || []) {
      const row = document.createElement("button")
      row.type = "button"
      row.dataset.tradeGood = good.id
      row.className = "nav-button grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 " +
        "rounded-lg border px-3 py-2 text-left text-xs " +
        (good.id === this.choice ? "border-emerald-300 bg-emerald-950/70" : "border-cyan-600/40")
      for (const [text, cls] of [
        [good.name, "font-bold"],
        ["aboard " + whole(good.quantity), whole(good.quantity) ? "text-emerald-300" : "text-slate-500"],
        ["sell " + creditText(good.sell_price), "text-amber-200"],
        [good.buy_price ? "buy " + creditText(good.buy_price) : "not stocked",
          good.buy_price ? "text-cyan-200" : "text-slate-500"],
      ]) {
        const cell = document.createElement("span")
        cell.textContent = text
        cell.className = cls
        row.appendChild(cell)
      }
      list.appendChild(row)
    }
    if (!(this.data.goods || []).length) {
      const empty = document.createElement("p")
      empty.textContent = "Nothing aboard to sell, and the exchange has no stock."
      empty.className = "rounded border border-slate-700/60 p-3 text-slate-400"
      list.appendChild(empty)
    }
    this.renderActions()
  }

  renderActions() {
    const at = selector => this.root.querySelector(selector)
    const good = this.selected()
    const sellMax = maxSell(good)
    const buyMax = maxBuy(this.data, good)
    const amountInput = at("#station-trade-amount")
    amountInput.disabled = this.busy || !good || (!sellMax && !buyMax)
    amountInput.max = String(Math.max(sellMax, buyMax, 1))
    if (document.activeElement !== amountInput) amountInput.value = String(this.amount || 1)

    const sell = at("#station-trade-sell")
    const sellAmount = clampAmount(this.amount, sellMax)
    sell.disabled = this.busy || !sellAmount
    sell.textContent = !good ? "Select cargo" : sellAmount
      ? "Sell " + sellAmount + " · +" + creditText(sellAmount * good.sell_price)
      : "Nothing aboard to sell"

    const buy = at("#station-trade-buy")
    const buyAmount = clampAmount(this.amount, buyMax)
    buy.disabled = this.busy || !buyAmount
    buy.textContent = !good ? "Select cargo" : !good.buy_price ? "Not stocked here"
      : buyAmount ? "Buy " + buyAmount + " · −" + creditText(buyAmount * good.buy_price)
        : freeHold(this.data) < (whole(good.mass_tonnes) || 1) ? "Hold full"
          : "Not enough credits"
  }
}
