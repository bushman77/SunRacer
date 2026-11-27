// One-time radio dialogue delivered with an authoritative story_updated event.
// No player decisions are sent from this panel; it is an optional transcript.
export const validScene = scene => {
  if (typeof scene?.id !== "string" || !["first_run:", "leaked_routes:"].some(prefix => scene.id.startsWith(prefix)) ||
      !Array.isArray(scene.lines) || scene.lines.length === 0 ||
      scene.lines.length > 6) return false
  return scene.lines.every(line =>
    typeof line?.speaker === "string" && line.speaker.length <= 90 &&
    typeof line?.channel === "string" && line.channel.length <= 100 &&
    typeof line?.text === "string" && line.text.length <= 900)
}

export class StoryRadio {
  constructor(root) {
    this.root = root
    this.panel = root?.querySelector("#story-radio")
    this.queue = []
    this.current = null
    this.lineIndex = 0
    this.panel?.querySelector("#story-radio-next")?.addEventListener("click", () => this.next())
    this.panel?.querySelector("#story-radio-dismiss")?.addEventListener("click",
      () => this.dismiss())
  }

  receive(scene) {
    if (!validScene(scene)) return
    this.queue.push(scene)
    if (!this.current) this.advance()
  }

  advance() {
    this.current = this.queue.shift() || null
    this.lineIndex = 0
    this.render()
  }

  next() {
    if (!this.current) return
    this.lineIndex++
    if (this.lineIndex >= this.current.lines.length) this.advance()
    else this.render()
  }

  dismiss() {
    // Dismiss only the current scene, not later server-verified story beats.
    this.advance()
  }

  render() {
    if (!this.panel) return
    this.panel.hidden = !this.current
    if (!this.current) return
    const line = this.current.lines[this.lineIndex]
    const text = (id, value) => {
      const element = this.panel.querySelector(id)
      if (element) element.textContent = value
    }
    text("#story-radio-channel", line.channel)
    text("#story-radio-speaker", line.speaker)
    text("#story-radio-text", line.text)
    text("#story-radio-progress",
      "Transmission " + (this.lineIndex + 1) + " of " + this.current.lines.length)
    const button = this.panel.querySelector("#story-radio-next")
    if (button) button.textContent =
      this.lineIndex < this.current.lines.length - 1 ? "Next transmission" : "Acknowledged"
  }
}
