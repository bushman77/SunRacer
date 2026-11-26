// One chat subscription per authenticated game socket, independent of world regions.
export const CHAT_LIMIT = 100

export class GlobalChat {
  constructor({root, socket, canOpen = () => true, releaseInput = () => {}}) {
    this.root = root
    this.socket = socket
    this.canOpen = canOpen
    this.releaseInput = releaseInput
    this.panel = root.querySelector("#global-chat-panel")
    this.toggle = root.querySelector("#global-chat-toggle")
    this.input = root.querySelector("#global-chat-input")
    this.send = root.querySelector("#global-chat-send")
    this.log = root.querySelector("#global-chat-log")
    this.status = root.querySelector("#global-chat-status")
    this.unread = root.querySelector("#global-chat-unread")
    this.count = 0
    this.online = false
    this.pending = false
  }

  start() {
    if (!this.panel || !this.toggle || !this.input || !this.log || !this.send) return this
    this.toggle.addEventListener("click", () => this.panel.hidden ? this.open() : this.close())
    this.root.querySelector("#global-chat-close")?.addEventListener("click", () => this.close())
    this.panel.addEventListener("focusin", () => this.releaseInput())
    this.root.querySelector("#global-chat-form")?.addEventListener("submit", event => {
      event.preventDefault()
      this.submit()
    })
    this.channel = this.socket.channel("chat:global", {})
    this.channel.on("chat_message", message => this.append(message))
    this.channel.onError(() => this.connection(false, "Reconnecting…"))
    this.channel.onClose(() => this.connection(false, "Chat offline"))
    this.channel.join()
      .receive("ok", () => this.connection(true, "Connected"))
      .receive("error", () => this.connection(false, "Chat unavailable on this server"))
      .receive("timeout", () => this.connection(false, "Chat connection timed out"))
    return this
  }

  connection(online, label) {
    this.online = online
    if (this.status) this.status.textContent = label
    this.syncSend()
  }

  syncSend() { if (this.send) this.send.disabled = !this.online || this.pending }

  open() {
    if (!this.canOpen() || !this.panel) return
    this.releaseInput()
    this.panel.hidden = false
    this.toggle.setAttribute("aria-expanded", "true")
    this.count = 0
    this.updateUnread()
    this.log.scrollTop = this.log.scrollHeight
    this.input.focus({preventScroll: true})
  }

  close({focus = true} = {}) {
    if (!this.panel || this.panel.hidden) return
    this.panel.hidden = true
    this.toggle.setAttribute("aria-expanded", "false")
    if (focus) this.toggle.focus({preventScroll: true})
    else if (this.panel.contains(document.activeElement)) document.activeElement.blur()
  }

  get editing() {
    return Boolean(this.panel && !this.panel.hidden && this.panel.contains(document.activeElement))
  }

  // Registered before flight/NPC/Atlas keyboard capture listeners. Preserve
  // normal input editing and IME; own Enter and Escape only inside chat.
  captureKey(event) {
    if (!this.panel || this.panel.hidden ||
        !this.panel.contains(event.target)) return
    if (event.type === "keydown" && !event.isComposing) {
      if (event.code === "Escape") {
        event.preventDefault()
        this.close()
      } else if (event.key === "Enter" && event.target === this.input) {
        event.preventDefault()
        if (!event.repeat) this.submit()
      }
    }
    event.stopImmediatePropagation()
  }

  updateUnread() {
    if (!this.unread) return
    this.unread.hidden = this.count === 0
    this.unread.textContent = this.count > 99 ? "99+" : String(this.count)
  }

  append(message) {
    if (typeof message?.pilot_name !== "string" || typeof message?.text !== "string") return
    const follow = this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight < 32
    const row = document.createElement("div")
    const name = document.createElement("strong")
    const content = document.createElement("span")
    name.textContent = message.pilot_name
    content.textContent = message.text
    row.className = "global-chat-message"
    row.append(name, content)
    this.log.append(row)
    while (this.log.children.length > CHAT_LIMIT) this.log.firstElementChild.remove()
    if (follow) this.log.scrollTop = this.log.scrollHeight
    if (this.panel.hidden) {
      this.count = Math.min(100, this.count + 1)
      this.updateUnread()
    }
  }

  submit() {
    if (!this.online || this.pending || !this.canOpen()) return
    const text = this.input.value.trim()
    if (!text) return
    this.pending = true
    this.syncSend()
    const finish = (label) => {
      this.pending = false
      this.status.textContent = this.online ? label : "Chat offline"
      this.syncSend()
    }
    this.channel.push("send_message", {text}, 5000)
      .receive("ok", () => {
        if (this.input.value.trim() === text) this.input.value = ""
        finish("Connected")
      })
      .receive("error", response => finish(response.reason === "rate_limited"
        ? "Slow down · 4 messages per 10 seconds" : "Message rejected"))
      .receive("timeout", () => finish("Delivery unconfirmed"))
  }

  syncAvailability() {
    if (!this.toggle) return
    const available = this.canOpen()
    this.toggle.hidden = !available
    if (!available) this.close({focus:false})
  }
}
