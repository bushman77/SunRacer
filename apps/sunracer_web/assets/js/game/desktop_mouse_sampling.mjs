// Desktop input experiment. The browser pushes mouse events; no extra
// polling timer exists. Coalesce high-frequency packets at the draw boundary.
export class DesktopMouseFrameSampler {
  constructor() { this.clear() }
  push(dx, dy) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return
    this.dx += dx
    this.dy += dy
    this.events++
  }
  drain() {
    if (!this.events) return null
    const packet = {dx: this.dx, dy: this.dy, events: this.events}
    this.clear()
    return packet
  }
  clear() { this.dx = 0; this.dy = 0; this.events = 0 }
}

const percentile95 = items => {
  if (!items.length) return 0
  const sorted = [...items].sort((a,b) => a-b)
  return sorted[Math.ceil(0.95 * sorted.length)-1]
}
export class DesktopMouseTimingProbe {
  constructor() {
    this.lastMouse = null
    this.lastFrame = null
    this.mouseGaps = []
    this.frameGaps = []
    this.corrections = 0
  }
  mouse(now) {
    if (!Number.isFinite(now)) return
    if (this.lastMouse !== null && now > this.lastMouse) this.keep(this.mouseGaps, now-this.lastMouse)
    this.lastMouse = now
  }
  frame(now) {
    if (!Number.isFinite(now)) return
    if (this.lastFrame !== null && now > this.lastFrame) this.keep(this.frameGaps, now-this.lastFrame)
    this.lastFrame = now
  }
  correction() { this.corrections++ }
  keep(list,value) {
    list.push(value)
    if (list.length>240) list.shift()
  }
  summary() {
    const result = {
      mouseP95Ms: percentile95(this.mouseGaps),
      frameP95Ms: percentile95(this.frameGaps),
      serverCorrections: this.corrections,
    }
    this.mouseGaps = []
    this.frameGaps = []
    this.corrections = 0
    return result
  }
}
