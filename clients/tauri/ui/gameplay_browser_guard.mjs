// Native gameplay is not a browser tab. Keep bearer credentials in memory
// and suppress browser chrome shortcuts while an authenticated game is visible.
// Context-menu cancellation must not swallow RMB flight or custom Atlas menus.
export function installGameplayBrowserGuard({target = globalThis.window, active}) {
  const contextmenu = event => {
    if (active()) event.preventDefault()
  }
  const keydown = event => {
    if (!active()) return
    const key = String(event.key || "").toLowerCase()
    const reload = key === "f5" || event.code === "F5" ||
      ((event.ctrlKey || event.metaKey) && !event.altKey &&
        (key === "r" || event.code === "KeyR"))
    if (!reload) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  target.addEventListener("contextmenu", contextmenu, true)
  target.addEventListener("keydown", keydown, true)
  return () => {
    target.removeEventListener("contextmenu", contextmenu, true)
    target.removeEventListener("keydown", keydown, true)
  }
}
