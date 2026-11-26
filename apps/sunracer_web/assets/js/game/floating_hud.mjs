// Presentation only. Leave server state, panel visibility and modal ownership
// with their existing controllers. Each pilot has a local desktop layout.
const EDGE = 8
const MIN_WIDTH = 180
const MIN_HEIGHT = 90
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi)
const finite = Number.isFinite

export function fitHudRect(rect, viewport) {
  const maxW = Math.max(1, viewport.width - EDGE * 2)
  const maxH = Math.max(1, viewport.height - EDGE * 2)
  const width = clamp(rect.width, Math.min(MIN_WIDTH, maxW), maxW)
  const height = clamp(rect.height, Math.min(MIN_HEIGHT, maxH), maxH)
  return {width, height,
    x: clamp(rect.x, EDGE, Math.max(EDGE, viewport.width - width - EDGE)),
    y: clamp(rect.y, EDGE, Math.max(EDGE, viewport.height - height - EDGE))}
}

export function readHudRect(value) {
  return value && ["x", "y", "width", "height"].every(k => finite(value[k])) &&
    value.width > 0 && value.height > 0
    ? {x: value.x, y: value.y, width: value.width, height: value.height} : null
}

// Full-screen station/modal wrappers stay intact; only their visible card moves.
export const FLOATING_HUD_PANELS = Object.freeze({
  station: "#starbase-docked-panel > div",
  attendant: "#station-npc-dialogue > div",
  outfitting: "#station-outfitting-panel > div",
  trade: "#station-trade-panel > div",
  inventory: "#pilot-inventory-panel > div",
  dispatch: "#story-dispatch-dialogue > div",
  story: "#story-comms",
  radio: "#story-radio",
  comms: "#global-chat-panel",
  network: "[data-bandwidth-panel]",
  tactical: "#solar-tactical-panel",
  atlasFlight: "#nav-flight-panel",
  atlasTarget: "#nav-target-panel",
  atlasContacts: "#atlas-sensor-contacts",
  headset: "#helmet-panel",
  sector: "#nav-sector-view .nav-console",
})

export class FloatingHud {
  constructor({root, playerId, releaseInput = () => {}, windowTarget = globalThis.window,
    storage, documentTarget = globalThis.document}) {
    Object.assign(this, {root, releaseInput, windowTarget, documentTarget})
    try {this.storage = storage === undefined ? globalThis.localStorage : storage}
    catch {this.storage = null}
    this.key = "sunracer:floating-hud:v1:player:" + String(playerId || "guest")
    this.panels = new Map()
    this.saved = {}
    try {
      const value = JSON.parse(this.storage?.getItem(this.key) || "{}")
      if (value && typeof value === "object") this.saved = value
    } catch {}
  }

  viewport() {
    return {width: this.windowTarget.innerWidth, height: this.windowTarget.innerHeight}
  }

  start() {
    for (const [id, selector] of Object.entries(FLOATING_HUD_PANELS)) {
      const panel = this.root.querySelector(selector)
      if (!panel) continue
      this.panels.set(id, panel)
      const toolbar = this.documentTarget.createElement("div")
      toolbar.className = "floating-hud-tools"
      for (const [action, label, glyph] of [
        ["move", "Move window", "✥"], ["size", "Resize window", "⤡"], ["reset", "Reset window", "↺"]
      ]) {
        const handle = this.documentTarget.createElement("button")
        handle.type = "button"
        handle.textContent = glyph
        handle.title = label
        handle.setAttribute("aria-label", label)
        handle.dataset.hudAction = action
        toolbar.append(handle)
        if (action === "reset") {
          handle.addEventListener("click", () => this.reset(id))
          continue
        }
        handle.addEventListener("pointerdown", event => this.begin(id, action, event))
        handle.addEventListener("pointermove", event => this.move(event))
        handle.addEventListener("pointerup", event => this.finish(event))
        handle.addEventListener("pointercancel", event => this.finish(event))
        handle.addEventListener("lostpointercapture", event => this.finish(event))
        handle.addEventListener("keydown", event => this.keyMove(id, action, event))
      }
      // A details element must keep its summary first.
      if (panel.tagName === "DETAILS") panel.querySelector("summary")?.after(toolbar)
      else panel.prepend(toolbar)
      panel.classList.add("floating-hud-panel")
      panel.addEventListener("pointerdown", event => event.stopPropagation())
      panel.addEventListener("click", event => event.stopPropagation())
      panel.addEventListener("contextmenu", event => event.stopPropagation())
      const saved = readHudRect(this.saved[id])
      if (saved) this.apply(id, saved)
    }
    this.windowTarget.addEventListener("resize", () => {
      for (const [id, value] of Object.entries(this.saved)) {
        const rect = readHudRect(value)
        if (rect && this.panels.has(id)) this.apply(id, rect)
      }
    })
    this.windowTarget.addEventListener("blur", () => this.finish())
    this.documentTarget.addEventListener("visibilitychange", () => {
      if (this.documentTarget.hidden) this.finish()
    })
    for (const selector of ["#nav-hud-reset", "[data-cockpit-reset]"]) {
      this.root.querySelector(selector)?.addEventListener("click", () => this.resetAll())
    }
    return this
  }

  measure(id) {
    const r = this.panels.get(id).getBoundingClientRect()
    return {x: r.left, y: r.top, width: r.width, height: r.height}
  }

  apply(id, requested, {size = true} = {}) {
    const panel = this.panels.get(id)
    const rect = fitHudRect(requested, this.viewport())
    panel.classList.add("floating-hud-positioned")
    panel.style.setProperty("--floating-hud-x", rect.x + "px")
    panel.style.setProperty("--floating-hud-y", rect.y + "px")
    panel.style.setProperty("--floating-hud-width", rect.width + "px")
    if (size) panel.style.setProperty("--floating-hud-height", rect.height + "px")
    return rect
  }

  begin(id, action, event) {
    if (event.button !== 0 || this.drag) return
    event.preventDefault()
    event.stopPropagation()
    this.releaseInput()
    const handle = event.currentTarget
    this.drag = {id, action, handle, pointerId: event.pointerId,
      startX: event.clientX, startY: event.clientY, rect: this.measure(id)}
    try {handle.setPointerCapture(event.pointerId)} catch {}
  }

  move(event) {
    const drag = this.drag
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY
    const r = drag.rect
    const next = drag.action === "move"
      ? {...r, x: r.x + dx, y: r.y + dy}
      : {...r, width: r.width + dx, height: r.height + dy}
    this.saved[drag.id] = this.apply(drag.id, next)
  }

  finish(event) {
    const drag = this.drag
    if (!drag || (event && event.pointerId !== drag.pointerId)) return
    this.drag = null
    try {
      if (drag.handle.hasPointerCapture(drag.pointerId))
        drag.handle.releasePointerCapture(drag.pointerId)
    } catch {}
    this.persist()
  }

  keyMove(id, action, event) {
    const delta = {ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1]}[event.key]
    if (!delta) return
    event.preventDefault()
    event.stopPropagation()
    this.releaseInput()
    const r = this.measure(id), step = event.shiftKey ? 30 : 8
    const dx = delta[0] * step, dy = delta[1] * step
    this.saved[id] = this.apply(id, action === "move"
      ? {...r, x: r.x + dx, y: r.y + dy}
      : {...r, width: r.width + dx, height: r.height + dy})
    this.persist()
  }

  reset(id) {
    const panel = this.panels.get(id)
    if (!panel) return
    if (this.drag?.id === id) this.finish()
    panel.classList.remove("floating-hud-positioned")
    for (const prop of ["x", "y", "width", "height"])
      panel.style.removeProperty("--floating-hud-" + prop)
    delete this.saved[id]
    this.persist()
  }

  resetAll() { for (const id of this.panels.keys()) this.reset(id) }

  persist() {
    try {this.storage?.setItem(this.key, JSON.stringify(this.saved))} catch {}
  }
}
