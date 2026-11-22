// "First Run" prologue comms card (laptop cockpit) and its one-line stereo
// HUD summary. The server owns every step: this module only renders the
// story snapshot it receives and sends the choices the prompt offers.

const ALLOWED_ACTIONS = new Set(["contact_dispatch", "skip", "resume"])

const text = (value, fallback = "") =>
  typeof value === "string" && value.trim() !== "" ? value : fallback

// Pure view model, shared by the DOM card and the stereo HUD line.
export function storyHudModel(story) {
  if (!story || typeof story !== "object") {
    return {visible: false, resumeVisible: false, stereoLine: null}
  }

  if (story.skipped) {
    return {visible: false, resumeVisible: !story.complete, stereoLine: null}
  }

  const prompt = story.prompt && typeof story.prompt === "object" ? story.prompt : null
  if (!prompt) return {visible: false, resumeVisible: false, stereoLine: null}

  const total = Number.isInteger(story.total_steps) ? story.total_steps : 9
  const step = Number.isInteger(story.step) ? story.step : 1
  const action = prompt.action && ALLOWED_ACTIONS.has(prompt.action.id)
    ? {id: prompt.action.id, label: text(prompt.action.label, "Continue")}
    : null
  const checks = Array.isArray(prompt.checks)
    ? prompt.checks
        .filter(check => check && typeof check.label === "string")
        .map(check => ({label: check.label, done: check.done === true}))
    : []
  const objective = text(prompt.objective)

  return {
    visible: true,
    resumeVisible: false,
    complete: story.complete === true,
    stepLabel: story.complete ? "FIRST RUN · COMPLETE" : `FIRST RUN · ${step} / ${total}`,
    speaker: text(prompt.speaker, "Comms"),
    station: text(prompt.station),
    text: text(prompt.text),
    objective,
    checks,
    action,
    canSkip: story.complete !== true,
    license: story.license === true,
    reward: story.reward && Number.isInteger(story.reward.credits)
      ? `+${story.reward.credits} credits · Helios courier license`
      : null,
    stereoLine: objective
      ? (story.complete ? "STORY · " : "OBJ · ") + objective.toUpperCase().slice(0, 58)
      : null,
  }
}

// Minimal DOM controller for #story-comms. `send(action)` must return a
// Phoenix push (with .receive) or a Promise-like; failures show feedback.
export class StoryHud {
  constructor(root, send) {
    this.root = root
    this.send = send
    this.model = storyHudModel(null)
    this.collapsed = false
    this.busy = false
    this.node = id => root?.querySelector?.(id)
    this.node("#story-comms-action")?.addEventListener("click", () =>
      this.choose(this.model.action?.id))
    this.node("#story-comms-skip")?.addEventListener("click", () => this.choose("skip"))
    this.node("#story-comms-resume")?.addEventListener("click", () => this.choose("resume"))
    this.node("#story-comms-collapse")?.addEventListener("click", () => {
      this.collapsed = !this.collapsed
      this.render()
    })
  }

  get stereoLine() {
    return this.model.stereoLine
  }

  apply(story) {
    this.model = storyHudModel(story)
    this.render()
  }

  choose(action) {
    if (!ALLOWED_ACTIONS.has(action) || this.busy || typeof this.send !== "function") return
    this.busy = true
    this.feedback("Transmitting…")
    const push = this.send(action)
    const done = (ok, reply) => {
      this.busy = false
      if (ok && reply?.story) this.apply(reply.story)
      this.feedback(ok ? "" : "Comms: " +
        String(reply?.reason || "no answer").replaceAll("_", " "))
    }
    if (push?.receive) {
      push.receive("ok", reply => done(true, reply))
        .receive("error", reply => done(false, reply))
        .receive("timeout", () => done(false, {reason: "timed_out"}))
    } else {
      this.busy = false
    }
  }

  feedback(message) {
    const node = this.node("#story-comms-feedback")
    if (node) node.textContent = message
  }

  render() {
    const card = this.node("#story-comms")
    const resume = this.node("#story-comms-resume")
    const model = this.model
    if (resume) resume.hidden = !model.resumeVisible
    if (!card) return
    card.hidden = !model.visible
    if (!model.visible) return

    const set = (id, value) => {
      const node = this.node(id)
      if (node) node.textContent = value || ""
    }
    set("#story-comms-step", model.stepLabel)
    set("#story-comms-speaker", model.speaker)
    set("#story-comms-station", model.station)
    set("#story-comms-text", model.text)
    set("#story-comms-objective", model.objective)
    set("#story-comms-reward", model.reward)

    const body = this.node("#story-comms-body")
    if (body) body.hidden = this.collapsed
    const collapse = this.node("#story-comms-collapse")
    if (collapse) {
      collapse.setAttribute("aria-expanded", String(!this.collapsed))
      collapse.textContent = this.collapsed ? "+" : "–"
    }

    const list = this.node("#story-comms-checks")
    if (list && typeof document !== "undefined") {
      list.replaceChildren(...model.checks.map(check => {
        const item = document.createElement("li")
        item.dataset.done = String(check.done)
        item.textContent = (check.done ? "✓ " : "○ ") + check.label
        return item
      }))
    }

    const action = this.node("#story-comms-action")
    if (action) {
      action.hidden = !model.action
      action.textContent = model.action?.label || ""
    }
    const skip = this.node("#story-comms-skip")
    if (skip) skip.hidden = !model.canSkip
    const reward = this.node("#story-comms-reward")
    if (reward) reward.hidden = !model.reward
  }
}
