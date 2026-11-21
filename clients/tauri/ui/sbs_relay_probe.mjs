// Bundled Tauri launcher only. No remote page receives relay IPC permission.
const byId = id => document.getElementById(id)
const panel = byId("sbs-relay-panel")
const open = byId("sbs-relay-open")
const close = byId("sbs-relay-close")
const start = byId("sbs-relay-start")
const stop = byId("sbs-relay-stop")
const url = byId("sbs-relay-url")
const status = byId("sbs-relay-status")
const copy = byId("sbs-relay-copy")
const invoke = () => window.__TAURI__?.core?.invoke

function message(text, failure = false) {
  status.textContent = text
  status.dataset.error = failure ? "true" : "false"
}
async function refreshStatus() {
  if (!panel || panel.hidden || !invoke()) return
  try {
    const state = await invoke()("sbs_relay_probe_status")
    if (state.verified) {
      message("Phone verified over local HTTPS. Stage 1 link test passed; no game-state traffic was forwarded.")
    } else if (state.running && !url.value) {
      message("Secure listener active. Return to the original invitation or stop and restart the test.")
    }
    start.disabled = Boolean(state.running)
    stop.disabled = !state.running
  } catch (error) {
    message("Unable to read relay status: " + String(error), true)
  }
}
open?.addEventListener("click", () => {
  panel.hidden = false
  refreshStatus()
})
close?.addEventListener("click", () => {panel.hidden = true})
start?.addEventListener("click", async () => {
  if (!invoke()) {
    message("This test must run in the installed Tauri client, not a remote website.", true)
    return
  }
  start.disabled = true
  message("Starting TLS listener on the laptop...")
  try {
    const result = await invoke()("start_sbs_relay_probe")
    url.value = result.url
    message("Ready: copy this private HTTPS link to the Galaxy S21 on the same Wi-Fi. " +
      "It expires in " + Math.round(result.expires_seconds / 60) + " minutes.")
  } catch (error) {
    message(String(error), true)
    start.disabled = false
  }
})
stop?.addEventListener("click", async () => {
  if (!invoke()) return
  try {
    await invoke()("stop_sbs_relay_probe")
    url.value = ""
    message("Secure LAN test stopped. No listener remains active.")
    start.disabled = false
    stop.disabled = true
  } catch (error) {
    message("Unable to stop relay test: " + String(error), true)
  }
})
copy?.addEventListener("click", async () => {
  if (!url.value) {
    message("Start the test before copying a phone invitation.", true)
    return
  }
  try {
    await navigator.clipboard.writeText(url.value)
    message("Copied one-time private link. Open it on your Galaxy S21.")
  } catch {
    url.focus()
    url.select()
    message("Link selected. Press Ctrl+C to copy it.")
  }
})
if (panel) setInterval(refreshStatus, 2000)
