// Stage 1 only: verify that the S21 can reach the laptop's opt-in TLS
// listener with a single-use invitation. No world state or player credentials.
// The relay proof page sends an explicit postMessage after its authenticated
// same-origin POST. A loaded iframe alone must NEVER count as a pass.

const INVITATION_PATH = "/relay-check"
const PROOF_TYPE = "space-nova:relay-proof"

function privateIPv4(host) {
  const parts = host.split(".")
  if (parts.length !== 4 || !parts.every(s => /^\d{1,3}$/.test(s) &&
    Number(s) <= 255 && String(Number(s)) === s)) return false
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
    // The LAN service only listens on an explicit private IPv4. Bind the
    // invitation to this SAME laptop, not an arbitrary host, origin or path.
    if (page.protocol !== "https:" || page.port !== "4443" ||
        !privateIPv4(page.hostname) ||
        link.protocol !== "https:" || link.hostname !== page.hostname ||
        link.port !== "4455" || link.pathname !== INVITATION_PATH ||
        link.username || link.password || link.search ||
        !/^#[a-f0-9]{48}$/.test(link.hash)) return null
    return link
  } catch {
    return null
  }
}

export function authenticatedRelayResult(event, expectedWindow, expectedOrigin) {
  if (!expectedWindow || event?.source !== expectedWindow ||
      event.origin !== expectedOrigin ||
      event.data?.type !== PROOF_TYPE ||
      typeof event.data?.passed !== "boolean") return null
  return event.data.passed
}

export function attachHelmetRelayTest(root, {win = window} = {}) {
  const button = root.querySelector("#helmet-relay-test")
  const result = root.querySelector("#helmet-relay-result")
  const entry = root.querySelector("#helmet-relay-entry")
  const urlInput = root.querySelector("#helmet-relay-url")
  const submit = root.querySelector("#helmet-relay-submit")
  if (!button || !result || !entry || !urlInput || !submit) return () => {}

  let frame = null
  let expectedOrigin = null
  let timer = null
  const clearProof = () => {
    if (timer !== null) win.clearTimeout(timer)
    timer = null
    frame?.remove()
    frame = null
    expectedOrigin = null
  }
  const show = (message, pass = false) => {
    clearProof()
    result.hidden = false
    result.textContent = message
    result.dataset.passed = String(pass)
    button.disabled = false
    if (pass) {
      button.hidden = true
      entry.hidden = true
      urlInput.value = ""
    } else {
      button.hidden = false
      button.textContent = "TEST LOCAL RELAY"
    }
  }
  const onMessage = event => {
    const accepted = authenticatedRelayResult(
      event, frame?.contentWindow, expectedOrigin)
    if (accepted === true) show("PASSED", true)
    if (accepted === false) show("NOT CONNECTED")
  }
  win.addEventListener("message", onMessage)

  function run(value) {
    const link = validRelayInvitation(value, win.location.href)
    if (!link) {
      entry.hidden = false
      show("PASTE A VALID TAURI LINK")
      return
    }
    clearProof()
    result.hidden = true
    entry.hidden = true
    urlInput.value = ""
    button.textContent = "TESTING..."
    button.disabled = true
    expectedOrigin = link.origin
    frame = win.document.createElement("iframe")
    frame.title = "Secure local relay connection test"
    frame.setAttribute("aria-hidden", "true")
    frame.setAttribute("tabindex", "-1")
    frame.referrerPolicy = "no-referrer"
    frame.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0"
    frame.src = link.href
    root.appendChild(frame)
    timer = win.setTimeout(() => {
      if (!frame) return
      entry.hidden = false
      show("NOT CONNECTED")
    }, 15_000)
  }

  const onClick = async () => {
    if (button.disabled) return
    button.disabled = true
    // Chrome allows clipboard read in response to this explicit tap. If it
    // isn't available, reveal a tiny paste field only when needed.
    let copied = ""
    try {copied = await win.navigator?.clipboard?.readText?.() || ""} catch { /* fallback below */ }
    button.disabled = false
    if (validRelayInvitation(copied, win.location.href)) {
      run(copied)
    } else {
      entry.hidden = false
      result.hidden = false
      result.textContent = "PASTE LINK FROM TAURI"
      result.dataset.passed = "false"
      urlInput.focus()
    }
  }
  const onSubmit = () => run(urlInput.value)
  button.addEventListener("click", onClick)
  submit.addEventListener("click", onSubmit)
  urlInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault()
      onSubmit()
    }
  })

  return () => {
    clearProof()
    win.removeEventListener("message", onMessage)
    button.removeEventListener("click", onClick)
    submit.removeEventListener("click", onSubmit)
  }
}
