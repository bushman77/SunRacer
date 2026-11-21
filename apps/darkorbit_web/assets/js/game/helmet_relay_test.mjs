// Stage 1: the existing QR carries a fragment-only one-time TLS challenge.
// The phone proves the local path to the compiled Tauri client after Phoenix
// authenticates its existing helmet pairing. This carries NO world state.
const PROOF_TYPE = "space-nova:relay-proof"

function privateIPv4(host) {
  const parts = host.split(".")
  if (parts.length !== 4 || !parts.every(s =>
    /^[0-9]{1,3}$/.test(s) && Number(s) <= 255 && String(Number(s)) === s)) {
    return false
  }
  const [a, b, , d] = parts.map(Number)
  return d !== 0 && d !== 255 &&
    (a === 10 || (a === 172 && b >= 16 && b <= 31) ||
     (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127))
}

export function validRelayInvitation(value, pageUrl) {
  try {
    if (typeof value !== "string" || value.length > 256) return null
    const page = new URL(pageUrl)
    const link = new URL(value.trim())
    if (page.protocol !== "https:" || page.port !== "4443" ||
        !privateIPv4(page.hostname) ||
        link.protocol !== "https:" || link.hostname !== page.hostname ||
        link.port !== "4455" || link.pathname !== "/relay-check" ||
        link.username || link.password || link.search ||
        !/^#[a-f0-9]{48}$/.test(link.hash)) return null
    return link
  } catch {
    return null
  }
}

// Does not affect Phoenix's query-string registration code. The fragment is
// never sent in an HTTPS request or Referer.
export function relayQRUrl(qrURL, invitation) {
  const valid = validRelayInvitation(invitation, qrURL)
  if (!valid) return qrURL
  const qr = new URL(qrURL)
  qr.hash = new URLSearchParams({relay: valid.href}).toString()
  return qr.href
}

export function relayInvitationFromQR(pageUrl) {
  try {
    const page = new URL(pageUrl)
    const params = new URLSearchParams(page.hash.slice(1))
    if (params.size !== 1) return null
    const url = params.get("relay")
    return url ? validRelayInvitation(url, pageUrl)?.href || null : null
  } catch {
    return null
  }
}

export function authenticatedRelayResult(event, expectedWindow, expectedOrigin) {
  if (!expectedWindow || event?.source !== expectedWindow ||
      event.origin !== expectedOrigin || event.data?.type !== PROOF_TYPE ||
      typeof event.data?.passed !== "boolean") return null
  return event.data.passed
}

// The phone has no relay controls; the pilot sees verification in the laptop's
// HMD panel. The hidden iframe is needed only for HTTPS origin isolation.
export function attachHelmetRelayTest(root, {win = window} = {}) {
  const result = root.querySelector("#helmet-relay-result")
  let frame = null
  let expectedOrigin = null
  let timer = null
  const clear = () => {
    if (timer !== null) win.clearTimeout(timer)
    timer = null
    frame?.remove()
    frame = null
    expectedOrigin = null
  }
  const show = (message, passed = false) => {
    clear()
    if (!result) return
    result.hidden = false
    result.textContent = message
    result.dataset.passed = String(passed)
  }
  const onMessage = event => {
    const passed = authenticatedRelayResult(event, frame?.contentWindow, expectedOrigin)
    if (passed === true) show("LOCAL LINK VERIFIED", true)
    if (passed === false) show("Local link unavailable; SBS still works through Phoenix.")
  }
  win.addEventListener("message", onMessage)
  return {
    prove(invitation) {
      const link = validRelayInvitation(invitation, win.location.href)
      if (!link) {
        show("Local relay invitation invalid; using Phoenix.")
        return
      }
      clear()
      if (result) {
        result.hidden = false
        result.textContent = "Checking secure local link..."
        result.dataset.passed = "false"
      }
      expectedOrigin = link.origin
      frame = win.document.createElement("iframe")
      frame.title = "Secure local relay connection proof"
      frame.setAttribute("aria-hidden", "true")
      frame.setAttribute("tabindex", "-1")
      frame.referrerPolicy = "no-referrer"
      frame.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0"
      frame.src = link.href
      root.appendChild(frame)
      timer = win.setTimeout(() => {
        if (frame) show("Local link timed out; SBS still works through Phoenix.")
      }, 15_000)
    },
    dispose() {
      clear()
      win.removeEventListener("message", onMessage)
    },
  }
}
