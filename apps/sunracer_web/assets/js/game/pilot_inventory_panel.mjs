// Read-only personal inventory view. The server owns identity, counts,
// cargo capacity, credits and equipped slots; no mutation actions exist here.
const text = value => String(value ?? "")
export const creditLabel = value =>
  Number(value || 0).toLocaleString("en-CA") + " cr"

export const cargoRows = inventory =>
  (inventory?.cargo?.items || []).filter(item =>
    Number.isInteger(item.quantity) && item.quantity > 0)

export const equipmentRows = inventory =>
  (inventory?.equipment || []).filter(item =>
    Number.isInteger(item.quantity) && item.quantity > 0)

const prettyId = id => text(id).replaceAll("_", " ").toUpperCase()

export function installedRows(config, catalog = []) {
  const byId = new Map(catalog.map(item => [item.id, item.name]))
  const laser = (config?.slots?.laser || []).map((id, i) =>
    "Laser " + (i + 1) + ": " + (id ? byId.get(id) || prettyId(id) : "Empty"))
  const generator = (config?.slots?.generator || []).map((id, i) =>
    "Generator " + (i + 1) + ": " + (id ? byId.get(id) || prettyId(id) : "Empty"))
  return [...laser, ...generator]
}

const row = label => {
  const li = document.createElement("li")
  li.className = "rounded-lg border border-slate-800/85 bg-slate-900/65 px-3 py-2 text-slate-200"
  li.textContent = label
  return li
}

export class PilotInventoryPanel {
  constructor({root, fetch, onOpen} = {}) {
    this.root = root
    this.fetch = fetch
    this.onOpen = onOpen
    this.opened = false
    this.busy = false
    this.seq = 0
    this.data = null
    root?.querySelector("#pilot-inventory-close")?.addEventListener("click", () => this.close())
    root?.querySelector("#pilot-inventory-refresh")?.addEventListener("click",
      () => this.refresh())
  }

  open() {
    if (!this.root || this.opened) return
    this.previousFocus = typeof document !== "undefined" ? document.activeElement : null
    this.opened = true
    this.root.style.display = "flex"
    this.onOpen?.()
    this.root.querySelector("#pilot-inventory-close")?.focus({preventScroll: true})
    this.refresh()
  }

  close() {
    if (!this.opened) return
    this.opened = false
    this.seq++
    this.busy = false
    this.root.style.display = "none"
    if (this.previousFocus?.isConnected) {
      this.previousFocus.focus?.({preventScroll: true})
    }
    this.previousFocus = null
  }

  refresh() {
    if (!this.opened || this.busy || typeof this.fetch !== "function") return
    const seq = ++this.seq
    this.busy = true
    this.status("Reading authenticated cargo and equipment…")
    const button = this.root.querySelector("#pilot-inventory-refresh")
    if (button) button.disabled = true
    this.fetch((ok, reply) => {
      if (!this.opened || seq !== this.seq) return
      this.busy = false
      if (button) button.disabled = false
      if (ok && reply && typeof reply === "object") {
        this.data = reply
        this.render()
        this.status("Inventory synchronized · read-only")
      } else {
        this.status("Inventory unavailable: " +
          text(reply?.reason || "link error").replaceAll("_", " "))
      }
    })
  }

  status(message) {
    const label = this.root?.querySelector("#pilot-inventory-message")
    if (label) label.textContent = message
  }

  render() {
    if (!this.data || !this.root) return
    const view = this.data
    const target = selector => this.root.querySelector(selector)
    const write = (selector, value) => {
      const node = target(selector)
      if (node) node.textContent = text(value)
    }
    write("#pilot-inventory-ship", view.ship?.name || "Active ship")
    write("#pilot-inventory-credits", creditLabel(view.credits))
    write("#pilot-inventory-capacity",
      (view.cargo?.used_tonnes || 0) + " / " +
      (view.cargo?.capacity_tonnes || 0) + " t")
    write("#pilot-inventory-active", "Configuration " + view.active_configuration)

    const items = (selector, entries, format, empty) => {
      const list = target(selector)
      if (!list) return
      const rows = entries.map(entry => row(format(entry)))
      list.replaceChildren(...(rows.length ? rows : [row(empty)]))
    }
    items("#pilot-inventory-cargo", cargoRows(view),
      item => item.name + " · " + item.quantity + " units · " +
        item.total_tonnes + " t", "Cargo hold is empty")
    items("#pilot-inventory-equipment", equipmentRows(view),
      item => item.name + " · x" + item.quantity, "No uninstalled equipment")

    const configs = target("#pilot-inventory-configs")
    if (configs) {
      const elements = (view.configurations || []).map(config => {
        const section = document.createElement("section")
        section.className = "rounded-xl border border-slate-700/70 bg-slate-900/65 p-3"
        const title = document.createElement("h4")
        title.className = "text-sm font-bold text-cyan-200"
        title.textContent = "Config " + config.number +
          (config.active ? " · ACTIVE" : " · SAVED")
        section.appendChild(title)
        const ul = document.createElement("ul")
        ul.className = "mt-2 grid gap-1 text-xs"
        ul.replaceChildren(...installedRows(config, view.catalog).map(row))
        section.appendChild(ul)
        return section
      })
      configs.replaceChildren(...elements)
    }
  }
}
