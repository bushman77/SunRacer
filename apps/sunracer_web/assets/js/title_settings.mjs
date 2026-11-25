// A same-origin HTTP reachability check, not a WebSocket or proxy benchmark.
export async function checkTitleConnection(fetcher = globalThis.fetch, now = () => performance.now()) {
  const started = now()
  try {
    const response = await fetcher("/", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    })
    const elapsed = Math.max(0, Math.round(now() - started))
    if (response.body) await response.body.cancel().catch(() => {})
    return response.ok
      ? `Server reachable · HTTP ${response.status} · ${elapsed} ms`
      : `Server responded with HTTP ${response.status}`
  } catch {
    return "Connection test failed. Check your network or proxy."
  }
}

export function startTitleSettings(root = document, origin = window.location.origin) {
  const panel = root.querySelector("#nova-settings-panel")
  if (!panel) return
  const server = panel.querySelector("#nova-network-origin")
  const button = panel.querySelector("#nova-network-test")
  const status = panel.querySelector("#nova-network-status")
  if (!server || !button || !status) return
  server.textContent = origin
  button.addEventListener("click", async () => {
    button.disabled = true
    status.textContent = "Checking server…"
    try {
      status.textContent = await checkTitleConnection()
    } finally {
      button.disabled = false
    }
  })
}
