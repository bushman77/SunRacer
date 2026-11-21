import QRCode from "qrcode"
import {chooseHelmetOrigin, helmetPairingOrigin} from "./helmet_network.mjs"
import {relayQRUrl} from "./helmet_relay_test.mjs"

// The Atlas owns enrollment; the cockpit owns the headset's operating mode.
export class HelmetControl {
  constructor({root, socket, playerId, combatActive, publishRelayWorld = () => {}}) {
    this.root = root
    this.socket = socket
    this.playerId = playerId
    this.combatActive = combatActive
    this.publishRelayWorld = publishRelayWorld
    this.panel = root.querySelector("#helmet-panel")
    this.status = {paired: false, connected: false, rendering: false}
    this.code = null
    this.open = false
    this.hostEdited = false
    this.relayUrl = null
    this.relayStatus = "LOCAL LINK / NOT TESTED"
    this.relayPoll = null
    this.relayVerified = false
    this.relayReconnectQRReady = false
  }

  nativeRelayInvoke() {
    // Tauri's local-only IPC capability authorizes the calling game.html
    // origin. Phoenix-served pages never acquire this capability.
    return this.root.dataset.nativeClient === "true"
      ? window.__TAURI__?.core?.invoke : null
  }

  renderRelayStatus() {
    const panel = this.root.querySelector("#helmet-relay-mini")
    const label = this.root.querySelector("#helmet-relay-status")
    const check = this.root.querySelector("#helmet-relay-check")
    const available = Boolean(this.nativeRelayInvoke())
    if (panel) panel.hidden = !available
    if (label) label.textContent = this.relayStatus
    if (check) check.hidden = !available || !this.status.connected
    const reconnect = this.root.querySelector("#helmet-relay-reconnect")
    if (reconnect) reconnect.hidden =
      !available || !this.status.paired || !this.relayUrl ||
      !this.relayReconnectQRReady || this.relayVerified
  }

  async checkRelay() {
    const invoke = this.nativeRelayInvoke()
    if (!invoke || !this.open) return
    try {
      const state = await invoke("sbs_relay_probe_status")
      if (state.verified) {
        this.relayVerified = true
        const kib = Math.round((state.bytes_served || 0) / 1024)
        this.relayStatus = state.frames_served > 0
          ? "LOCAL LINK / STREAMING · " + kib + " KiB LAN"
          : "LOCAL LINK / VERIFIED"
      } else if (state.running) {
        this.relayStatus = "LOCAL LINK / AWAITING PHONE"
      } else if (this.relayUrl) {
        this.relayStatus = "LOCAL LINK / NOT CONNECTED"
      }
    } catch (error) {
      this.relayStatus = "LOCAL LINK / " + String(error).slice(0, 90)
    }
    this.renderRelayStatus()
  }

  async prepareRelayQR(code) {
    const invoke = this.nativeRelayInvoke()
    this.relayUrl = null
    this.relayVerified = false
    this.relayReconnectQRReady = false
    if (!invoke) return this.drawQR() // Browser-only game retains Phoenix QR.
    this.relayStatus = "LOCAL LINK / PREPARING"
    this.renderRelayStatus()
    try {
      // Replace a previous single-use challenge, never keep multiple
      // active pairing tokens. This is only called after opening PILOT HMD.
      await invoke("stop_sbs_relay_probe")
      const invitation = await invoke("start_sbs_relay_probe")
      if (!this.open || this.code !== code) {
        await invoke("stop_sbs_relay_probe")
        return
      }
      this.relayUrl = invitation.url
      // Seed the current authoritative desktop snapshot immediately. A
      // stationary pilot must not wait for another changing delta tick.
      this.publishRelayWorld()
      this.relayStatus = "LOCAL LINK / AWAITING PHONE"
    } catch (error) {
      // Never break the existing authenticated Phoenix QR enrollment.
      this.relayStatus = "LOCAL LINK / UNAVAILABLE (" + String(error).slice(0, 85) + ")"
    }
    this.renderRelayStatus()
    if (this.open && this.code === code) {
      if (this.status.paired) await this.drawRelayReconnectQR()
      else await this.drawQR()
    }
  }

  async drawRelayReconnectQR() {
    if (!this.open || !this.relayUrl || !this.status.paired) return
    const host = this.root.querySelector("#helmet-host")?.value.trim().replace(/\/+$/, "")
    const canvas = this.root.querySelector("#helmet-relay-qr")
    if (!canvas || !host) return
    try {
      const qrUrl = new URL("/helmet", host).toString()
      const qr = relayQRUrl(qrUrl, this.relayUrl)
      if (qr === qrUrl) {
        this.relayStatus = "LOCAL LINK / HTTPS 4443 LAN ADDRESS REQUIRED"
        return this.renderRelayStatus()
      }
      await QRCode.toCanvas(canvas, qr, {width: 190, margin: 2, errorCorrectionLevel: "M"})
      this.relayReconnectQRReady = true
      this.renderRelayStatus()
    } catch {
      this.relayStatus = "LOCAL LINK / UNABLE TO DRAW RECONNECT QR"
      this.renderRelayStatus()
    }
  }

  start() {
    if (!this.panel) return this
    this.root.querySelector("#nav-helmet-open")?.addEventListener("click", () => this.openPanel())
    this.root.querySelector("#nav-helmet-close")?.addEventListener("click", () => this.closePanel())
    this.root.querySelector("#helmet-forget")?.addEventListener("click", () => this.forget())
    this.root.querySelector("#helmet-relay-check")?.addEventListener("click", () => this.checkRelay())
    // Center the phone while it is already mounted in the VR headset.
    // Keep this separate from the calibration arrows and flight controls.
    window.addEventListener("keydown", event => {
      if (event.code !== "KeyC" || event.repeat ||
          event.ctrlKey || event.altKey || event.metaKey || event.shiftKey ||
          event.target?.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(event.target?.tagName) ||
          !this.canAdjustAlignment()) return
      event.preventDefault()
      this.recenter()
    }, true)
    const host = this.root.querySelector("#helmet-host")
    host?.addEventListener("input", () => { this.hostEdited = true })
    host?.addEventListener("change", () => this.drawQR())
    // Do not offer localhost as a QR destination: a phone cannot reach it.
    if (host) host.value = chooseHelmetOrigin((window.SPACE_NOVA_SERVER_ORIGIN || window.location.origin))

    this.channel = this.socket.channel("helmet:control:" + this.playerId, {})
    this.channel.on("helmet_status", data => this.updateStatus(data))
    this.channel.onError(() => this.message("Helmet link interrupted. Reconnecting…"))
    this.channel.join()
      .receive("ok", reply => {
        this.suggestNetworkHosts(reply.network_hosts || [], reply.helmet_https_origin)
        this.updateStatus(reply.status)
        this.setCombat(this.combatActive)
        if (this.open && !reply.status.paired) this.requestPairing()
      })
      .receive("error", () => this.message("Helmet control channel unavailable."))
    return this
  }

  suggestNetworkHosts(hosts, lanHttpsOrigin = null) {
    const address = helmetPairingOrigin(
      (window.SPACE_NOVA_SERVER_ORIGIN || window.location.origin), hosts, lanHttpsOrigin)
    const input = this.root.querySelector("#helmet-host")
    if (input && !this.hostEdited) input.value = address
    const options = this.root.querySelector("#helmet-host-candidates")
    if (options) {
      options.replaceChildren()
      if (address.startsWith("https://")) {
        const secure = document.createElement("option")
        secure.value = address
        options.appendChild(secure)
      }
      for (const hostname of hosts) {
        const origin = chooseHelmetOrigin("http://localhost:4000", [hostname])
        if (!origin) continue
        const candidate = new URL((window.SPACE_NOVA_SERVER_ORIGIN || window.location.origin))
        candidate.hostname = hostname
        const item = document.createElement("option")
        item.value = candidate.origin
        options.appendChild(item)
      }
    }
    if (this.open && this.code) this.drawQR()
  }

  canAdjustAlignment() {
    return Boolean(this.combatActive && this.status.connected &&
      this.status.rendering && this.status.mode === "combat" &&
      this.channel?.state === "joined")
  }

  adjustAlignment(axis, direction) {
    if (!this.canAdjustAlignment()) return false
    if (!["gap", "eye_sep"].includes(axis) || ![-1, 1].includes(direction)) return false

    this.channel.push("adjust_alignment", {axis, direction})
      .receive("error", reply => this.alignmentFeedback(
        "HMD calibration unavailable: " + (reply.reason || "unknown")))
      .receive("timeout", () => this.alignmentFeedback("HMD calibration timed out"))
    return true
  }

  recenter() {
    if (!this.canAdjustAlignment()) return false
    this.channel.push("recenter", {})
      .receive("error", reply => this.alignmentFeedback(
        "HMD recenter unavailable: " + (reply.reason || "unknown")))
      .receive("timeout", () => this.alignmentFeedback("HMD recenter timed out"))
    return true
  }

  alignmentFeedback(value) {
    // No floating calibration HUD: use the existing headset status label
    // only when a keyboard adjustment fails.
    const status = this.root.querySelector("#cockpit-helmet-status")
    if (status && value) status.textContent = value
  }

  setCombat(active) {
    this.combatActive = Boolean(active)
    if (this.channel?.state === "joined") {
      this.channel.push("set_mode", {mode: active ? "combat" : "standby"})
    }
  }

  openPanel() {
    this.open = true
    this.panel.hidden = false
    this.updateStatus(this.status)
    this.renderRelayStatus()
    if (this.nativeRelayInvoke()) {
      this.relayPoll = setInterval(() => {
        if (this.status.connected || this.relayUrl) void this.checkRelay()
      }, 2000)
      void this.checkRelay()
    }
    if (!this.status.paired) this.requestPairing()
    else if (this.nativeRelayInvoke() && !this.relayVerified) {
      void this.prepareRelayQR(null)
    }
  }

  closePanel() {
    if (!this.open) return
    this.open = false
    this.panel.hidden = true
    if (this.relayPoll !== null) clearInterval(this.relayPoll)
    this.relayPoll = null
    this.code = null
    this.clearQR()
    const reconnect = this.root.querySelector("#helmet-relay-reconnect")
    if (reconnect) reconnect.hidden = true
    // Once verified, the read-only LAN stream must continue while the
    // user leaves Atlas and flies in the cockpit. Only unverified QR
    // challenges are revoked when the setup panel closes.
    if (!this.relayVerified) {
      const invoke = this.nativeRelayInvoke()
      if (invoke) void invoke("stop_sbs_relay_probe").catch(() => {})
      this.relayUrl = null
      this.relayReconnectQRReady = false
      this.relayStatus = "LOCAL LINK / NOT TESTED"
    }
    if (this.channel?.state === "joined") this.channel.push("cancel_pairing", {})
  }

  requestPairing() {
    if (this.channel?.state !== "joined") {
      this.message("Waiting for the ship connection. Reopen this panel after it connects.")
      return
    }
    this.message("Preparing helmet pairing QR code…")
    this.channel.push("open_pairing", {})
      .receive("ok", ({code}) => {
        if (!this.open) {
          this.channel.push("cancel_pairing", {})
          return
        }
        this.code = code
        void this.prepareRelayQR(code)
      })
      .receive("error", ({reason}) => this.message(reason || "Could not open pairing."))
  }

  async drawQR() {
    if (!this.code || !this.open) return
    const host = this.root.querySelector("#helmet-host")?.value.trim().replace(/\/+$/, "")
    const canvas = this.root.querySelector("#helmet-qr")
    if (!/^https?:\/\/[^/]+$/i.test(host)) {
      this.message("No LAN address detected. Enter the laptop IP and port (find it with: hostname -I).")
      return
    }
    try {
      const url = new URL("/helmet", host)
      url.searchParams.set("pair", this.code)
      const qr = relayQRUrl(url.toString(), this.relayUrl)
      if (this.relayUrl && qr === url.toString()) {
        this.relayStatus = "LOCAL LINK / HTTPS 4443 LAN ADDRESS REQUIRED"
        this.renderRelayStatus()
      }
      await QRCode.toCanvas(canvas, qr, {width: 250, margin: 2, errorCorrectionLevel: "M"})
      this.message(qr !== url.toString()
        ? "Scan once. Phone pairing and the secure local-link test happen automatically."
        : "Scan to pair through Phoenix. Secure relay is not configured for this address.")
    } catch (_error) {
      this.message("Unable to draw QR code. Check the laptop address.")
    }
  }

  clearQR() {
    const canvas = this.root.querySelector("#helmet-qr")
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height)
  }

  updateStatus(status = {}) {
    this.status = status
    const label = status.rendering ? "SBS ACTIVE" :
      status.connected && status.mode === "combat" ? "CONNECTED / STARTING SBS" :
      status.connected ? "CONNECTED / STANDBY" :
      status.paired ? "PAIRED / OFFLINE" : "NOT PAIRED"
    const cockpit = this.root.querySelector("#cockpit-helmet-status")
    if (cockpit) cockpit.textContent = status.rendering ? "HMD SBS LIVE" :
      status.connected ? "HMD CONNECTED" : status.paired ? "HMD PAIRED" : "HMD UNPAIRED"
    const indicator = this.root.querySelector("#nav-helmet-status")
    if (indicator) indicator.textContent = label
    const current = this.root.querySelector("#helmet-device-status")
    if (current) current.textContent = status.paired ?
      (status.device_name || "Phone headset") + " · " + label : "No helmet paired"
    const paired = this.root.querySelector("#helmet-paired")
    if (paired) paired.hidden = !status.paired
    const unpaired = this.root.querySelector("#helmet-unpaired")
    if (unpaired) unpaired.hidden = Boolean(status.paired)
    if (status.paired) {
      this.code = null
      this.clearQR()
    }
    this.renderRelayStatus()
    if (this.open && status.connected) void this.checkRelay()
  }

  forget() {
    if (!window.confirm("Forget this helmet? You will need to scan a new QR code to pair again.")) return
    this.channel?.push("forget", {}).receive("ok", () => {
      if (this.open) this.requestPairing()
    })
  }

  message(value) {
    const node = this.root.querySelector("#helmet-pairing-message")
    if (node) node.textContent = value
  }
}
