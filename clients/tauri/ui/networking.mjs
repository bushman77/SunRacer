// Local-only proxy configuration. The remote Phoenix website must not
// acquire these capabilities. Tauri stores and applies the actual preferences.
export function bindNetworkSettings(root = document, nativeInvoke = () => window.__TAURI__?.core?.invoke) {
  const panel = root.querySelector("#networking-panel")
  const open = root.querySelector("#networking-open")
  const details = root.querySelector("#native-network-settings")
  const form = root.querySelector("#networking-form")
  const mode = root.querySelector("#proxy-mode")
  const host = root.querySelector("#proxy-host")
  const port = root.querySelector("#proxy-port")
  const fields = root.querySelector("#proxy-fields")
  const status = root.querySelector("#networking-status")
  const override = root.querySelector("#networking-override")
  if (![panel, open, details, form, mode, host, port, fields, status, override].every(Boolean)) return
  const submit = form.querySelector('[type="submit"]')
  let ready = false
  let busy = false
  let generation = 0

  function message(value, isError = false) {
    status.textContent = value
    status.dataset.error = String(isError)
  }

  function updateFields() {
    const manual = mode.value === "socks5"
    fields.hidden = !manual
    host.disabled = !manual
    port.disabled = !manual
  }

  function updateSubmit() {
    submit.disabled = !ready || busy
  }

  async function refresh() {
    const request = ++generation
    ready = false
    updateSubmit()
    const invoke = nativeInvoke()
    if (!invoke) {
      message("The installed desktop client is required to change native proxy settings.", true)
      return
    }
    message("Loading saved networking settings…")
    try {
      const settings = await invoke("get_network_settings")
      if (request !== generation) return
      mode.value = settings.saved.mode
      host.value = settings.saved.host
      port.value = String(settings.saved.port)
      override.hidden = !settings.forced_ssh_tunnel
      updateFields()
      ready = true
      message("Settings are stored on this computer and applied at startup.")
    } catch (cause) {
      if (request === generation) message(String(cause), true)
    } finally {
      if (request === generation) updateSubmit()
    }
  }

  function setOpen(value, restoreFocus = false) {
    panel.hidden = !value
    open.setAttribute("aria-expanded", String(value))
    if (value) {
      details.open = false
      ready = false
      updateSubmit()
    } else {
      ++generation
      if (restoreFocus) open.focus()
    }
  }

  open.addEventListener("click", () => setOpen(panel.hidden))
  details.addEventListener("toggle", () => {
    if (details.open && !panel.hidden && !busy) refresh()
  })
  root.addEventListener("pointerdown", event => {
    if (!panel.hidden && !panel.contains(event.target) && !open.contains(event.target)) setOpen(false)
  })
  root.addEventListener("keydown", event => {
    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault()
      setOpen(false, true)
    }
  })
  mode.addEventListener("change", updateFields)
  updateFields()
  updateSubmit()

  form.addEventListener("submit", async event => {
    event.preventDefault()
    const invoke = nativeInvoke()
    if (!invoke || !ready || busy) return
    const settings = {
      mode: mode.value,
      host: host.value.trim(),
      port: Number(port.value),
    }
    if (!Number.isInteger(settings.port) || settings.port < 1 || settings.port > 65535) {
      message("Enter a valid TCP port (1–65535).", true)
      return
    }
    busy = true
    updateSubmit()
    try {
      await invoke("save_network_settings", {settings})
      message("Saved. Restarting SpaceNova to apply your connection preferences…")
      await invoke("restart_client")
    } catch (cause) {
      message("Unable to save or restart: " + String(cause), true)
    } finally {
      busy = false
      updateSubmit()
    }
  })
}

if (typeof document !== "undefined") bindNetworkSettings()
