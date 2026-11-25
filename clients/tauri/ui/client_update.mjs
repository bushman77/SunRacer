// A local launcher may request the native signed updater; it never chooses
// an endpoint, supplies an installer, or bypasses native confirmation.
export function bindClientUpdate(button, status, getInvoke) {
  if (!button || !status) return
  button.addEventListener("click", async () => {
    if (button.disabled) return
    status.hidden = false
    const invoke = getInvoke()
    if (typeof invoke !== "function") {
      status.textContent = "Client updates require the installed SunRacer desktop app."
      return
    }
    button.disabled = true
    status.textContent = "Checking for updates. If prompted, approve the signed installation to continue…"
    try {
      status.textContent = await invoke("check_client_update")
    } catch (cause) {
      status.textContent = "Update unavailable: " + (cause?.message || String(cause))
    } finally {
      button.disabled = false
    }
  })
}
