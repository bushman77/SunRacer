const FIELDS = [
  ["hit_points", "Hull capacity"], ["shields", "Shield capacity"],
  ["damage", "Laser damage"], ["speed", "Top speed"],
  ["shield_absorption", "Shield absorption"], ["shield_regeneration", "Shield recharge"],
]

export const fittingCandidates = (items, kind) => (items || []).filter(item =>
  item.quantity > 0 && (kind === "laser" ? item.category === "laser" :
    ["shield", "generator"].includes(item.category)))

export const affordable = (balance, price) =>
  Number.isInteger(balance) && Number.isInteger(price) && price > 0 && balance >= price

export const creditText = credits => Number(credits || 0).toLocaleString("en-CA") + " cr"

export const installedItem = (config, kind, index) =>
  config?.slots?.[kind]?.[index] ?? null

const value = (field, amount) => field === "shield_absorption" ?
  Math.round(Number(amount || 0) * 100) + "%" : String(Number(amount || 0))

export const fittingStatRows = (before, after) => FIELDS.map(([field, name]) => ({
  name, before: value(field, before?.[field]), after: value(field, after?.[field]),
  changed: before?.[field] !== after?.[field],
}))

const add = (root, label, cls = "") => {
  const el = document.createElement("div")
  el.textContent = label
  el.className = cls
  root.appendChild(el)
  return el
}

const button = (root, label, dataset, active = false) => {
  const el = document.createElement("button")
  el.type = "button"
  el.textContent = label
  el.className = "nav-button rounded-lg border px-3 py-2 text-left text-xs " +
    (active ? "border-emerald-300 bg-emerald-950/70" : "border-cyan-600/40")
  for (const [key, val] of Object.entries(dataset)) el.dataset[key] = String(val)
  root.appendChild(el)
  return el
}

export class StationOutfittingPanel {
  constructor({root, preview, fit, purchase, onApplied, onClose}) {
    this.root = root
    this.preview = preview
    this.fit = fit
    this.purchase = purchase
    this.onApplied = onApplied
    this.onClose = onClose
    this.opened = false
    this.seq = 0
    this.busy = false
    root?.addEventListener("click", event => this.click(event))
  }

  open(view) {
    if (!this.root || !view) return
    this.data = view
    this.config = view.active_configuration
    this.kind = "laser"
    this.slot = 0
    this.chosen = undefined
    this.proposed = null
    this.shopChoice = null
    this.busy = false
    this.opened = true
    this.message = "Select a hardpoint and owned equipment."
    this.root.style.display = "flex"
    this.render()
    this.root.querySelector("#station-outfitting-close")?.focus({preventScroll: true})
  }

  close({restoreDialogue = true} = {}) {
    if (!this.opened) return
    this.opened = false
    this.seq++
    this.busy = false
    this.root.style.display = "none"
    if (restoreDialogue) this.onClose?.()
  }

  current() {
    return this.data?.configurations?.find(x => x.number === this.config)
  }

  selection() {
    return {config: this.config, kind: this.kind, slot: this.slot, item_id: this.chosen}
  }

  selectItem(item) {
    if (!this.opened || this.busy) return
    this.chosen = item
    this.proposed = null
    this.busy = true
    this.shopChoice = null
    this.message = "Checking inventory, hardpoint and ship statistics…"
    const seq = ++this.seq
    this.render()
    this.preview(this.selection(), (ok, result) => {
      if (!this.opened || seq !== this.seq) return
      this.busy = false
      this.proposed = ok ? result?.preview : null
      this.message = ok ? "Review this preview before installing." :
        "Preview rejected: " + String(result?.reason || "unavailable").replaceAll("_", " ")
      this.render()
    })
  }

  chooseShop(item_id) {
    if (!this.opened || this.busy) return
    this.shopChoice = this.data.shop?.find(item => item.id === item_id) || null
    this.chosen = undefined
    this.proposed = null
    this.message = this.shopChoice
      ? this.shopChoice.name + " · " + creditText(this.shopChoice.price) +
        " · Purchasing adds one to inventory. Installation is a separate action."
      : "Item no longer offered."
    this.render()
  }

  buy() {
    if (!this.opened || this.busy || !this.shopChoice ||
        !affordable(this.data.credits, this.shopChoice.price)) return
    const seq = ++this.seq
    const item_id = this.shopChoice.id
    this.busy = true
    this.message = "Confirming purchase with Green Starbase accounts…"
    this.render()
    this.purchase({item_id}, (ok, result) => {
      if (!this.opened || seq !== this.seq) return
      this.busy = false
      this.shopChoice = null
      if (ok && result?.outfitting && result?.receipt) {
        this.data = result.outfitting
        this.message = "Purchased " + result.receipt.name + " for " +
          creditText(result.receipt.price) + ". Remaining balance: " +
          creditText(result.receipt.credits_remaining) + ". Choose the item above to install."
      } else {
        this.message = "Purchase rejected: " +
          String(result?.reason || "unavailable").replaceAll("_", " ")
      }
      this.render()
    })
  }

  apply() {
    if (!this.opened || this.busy || !this.proposed) return
    const seq = ++this.seq
    this.busy = true
    this.message = "Saving the authenticated fitting transaction…"
    this.render()
    this.fit(this.selection(), (ok, result) => {
      if (!this.opened || seq !== this.seq) return
      this.busy = false
      if (ok && result?.outfitting) {
        this.data = result.outfitting
        this.proposed = null
        this.chosen = undefined
        this.message = "Equipment fitted. Inventory and live ship statistics updated."
        this.onApplied?.(result)
      } else {
        this.proposed = null
        this.chosen = undefined
        this.message = "Fitting rejected: " +
          String(result?.reason || "unavailable").replaceAll("_", " ")
      }
      this.render()
    })
  }

  click(event) {
    if (!this.opened) return
    if (event.target?.closest?.("#station-outfitting-close")) return this.close()
    if (event.target?.closest?.("#station-outfitting-apply")) return this.apply()
    if (event.target?.closest?.("#station-outfitting-buy")) return this.buy()
    if (this.busy) return
    const config = event.target?.closest?.("[data-outfit-config]")?.dataset.outfitConfig
    if (config != null) {
      this.config = Number(config)
      this.kind = "laser"
      this.slot = 0
      this.chosen = undefined
      this.proposed = null
      this.shopChoice = null
      return this.render()
    }
    const chosenSlot = event.target?.closest?.("[data-outfit-slot]")
    if (chosenSlot) {
      this.kind = chosenSlot.dataset.outfitKind
      this.slot = Number(chosenSlot.dataset.outfitSlot)
      this.chosen = undefined
      this.proposed = null
      this.shopChoice = null
      return this.render()
    }
    const sale = event.target?.closest?.("[data-outfit-shop]")?.dataset.outfitShop
    if (sale != null) return this.chooseShop(sale)
    const item = event.target?.closest?.("[data-outfit-item]")?.dataset.outfitItem
    if (item != null) this.selectItem(item === "__remove__" ? null : item)
  }

  render() {
    if (!this.opened || !this.data) return
    const config = this.current()
    if (!config) return
    const at = selector => this.root.querySelector(selector)
    at("#station-outfitting-ship").textContent = this.data.ship.name + " · " +
      this.data.ship.laser_slots + " laser / " +
      this.data.ship.generator_slots + " generator hardpoints"
    at("#station-outfitting-message").textContent = this.message
    at("#station-outfitting-credits").textContent =
      "Credits: " + creditText(this.data.credits)

    const configs = at("#station-outfitting-configs")
    configs.replaceChildren()
    for (const entry of this.data.configurations) {
      button(configs, "Configuration " + entry.number +
        (entry.active ? " · ACTIVE" : " · SAVED"),
        {outfitConfig: entry.number}, entry.number === this.config)
    }

    const stats = at("#station-outfitting-stats")
    stats.replaceChildren()
    for (const row of fittingStatRows(config.stats, config.stats)) {
      add(stats, row.name + ": " + row.before,
        "rounded border border-slate-700/60 bg-slate-900/70 p-2")
    }

    const slots = at("#station-outfitting-slots")
    slots.replaceChildren()
    for (const kind of ["laser", "generator"]) {
      for (const [index, installed] of (config.slots?.[kind] || []).entries()) {
        button(slots, (kind === "laser" ? "Laser " : "Generator ") +
          (index + 1) + " · " + (installed ||
            (kind === "laser" ? "Built-in Garnet" : "Empty")),
          {outfitKind: kind, outfitSlot: index},
          kind === this.kind && index === this.slot)
      }
    }

    const items = at("#station-outfitting-items")
    items.replaceChildren()
    const installed = installedItem(config, this.kind, this.slot)
    if (installed) button(items, "Remove " + installed,
      {outfitItem: "__remove__"}, this.chosen === null)
    const candidates = fittingCandidates(this.data.inventory, this.kind)
    for (const item of candidates) {
      button(items, "Install " + item.name + " · owned: " + item.quantity,
        {outfitItem: item.id}, this.chosen === item.id)
    }
    if (!installed && candidates.length === 0)
      add(items, "No compatible items owned. Browse the shop below.",
        "rounded border border-slate-700/60 p-3 text-slate-400")

    const stock = at("#station-outfitting-stock")
    stock.replaceChildren()
    for (const item of fittingCandidates(
      (this.data.shop || []).map(x => ({...x, quantity: 1})), this.kind)) {
      const details = this.kind === "laser"
        ? item.damage + " damage"
        : item.shields > 0
          ? item.shields + " shields · " +
            Math.round(item.shield_absorption * 100) + "% absorption"
          : "+" + item.speed + " speed"
      button(stock, item.name + " · " + details + " · " +
        creditText(item.price) + (affordable(this.data.credits, item.price)
          ? "" : " · SAVE UP"),
        {outfitShop: item.id}, this.shopChoice?.id === item.id)
    }

    const buy = at("#station-outfitting-buy")
    buy.disabled = this.busy || !this.shopChoice ||
      !affordable(this.data.credits, this.shopChoice.price)
    buy.textContent = this.shopChoice
      ? "Confirm purchase · " + creditText(this.shopChoice.price)
      : "Select equipment to purchase"

    const preview = at("#station-outfitting-preview")
    preview.replaceChildren()
    if (this.proposed) {
      for (const row of fittingStatRows(this.proposed.before, this.proposed.after)) {
        add(preview, row.name + ": " + row.before + " → " + row.after +
          (row.changed ? " · CHANGED" : ""),
          row.changed ? "text-emerald-300" : "text-slate-400")
      }
    } else {
      add(preview, this.busy ? "Verifying equipment selection…" :
        "Choose an owned item or remove fitted equipment to see the stat preview.")
    }

    const apply = at("#station-outfitting-apply")
    apply.disabled = this.busy || !this.proposed
    apply.textContent = this.chosen === null ?
      "Confirm removal" : "Confirm installation"
  }
}
