// The game runs from packaged local assets. Only signed credentials,
// world-state and pilot commands cross the network; no remote HTML is loaded.
import {DEFAULT_SERVER_URL, serverOrigin, passwordResetUrl} from "./server_url.mjs"
import {nativePostJson, nativeErrorMessage} from "./native_transport.mjs"
import {installGameplayBrowserGuard} from "./gameplay_browser_guard.mjs"
import {rememberedLogin} from "./remembered_login.mjs"

const login = document.querySelector("#native-login")
const form = document.querySelector("#native-login-form")
const error = document.querySelector("#native-login-error")
const busy = document.querySelector("#native-login-submit")
const game = document.querySelector("#game-client")
const status = document.querySelector("#native-session-status")
const server = document.querySelector("#native-server-name")
const authStorageKey = "sunracer-native-server"
const fallbackStorageKey = "sbs-space-server-origin"
let token = null
let origin = DEFAULT_SERVER_URL
let refreshTimer = null
const remember = document.querySelector("#native-remember-me")
let vault = null
let signingOut = false

installGameplayBrowserGuard({active: () => !game.hidden && Boolean(token)})

try {
  origin = serverOrigin(localStorage.getItem(fallbackStorageKey) ||
    sessionStorage.getItem(authStorageKey) || DEFAULT_SERVER_URL)
} catch {
  origin = DEFAULT_SERVER_URL
}
server.textContent = origin
vault = rememberedLogin(origin)
// Recovery stays on the selected server's CSRF-protected hosted form.
// The remote page does not receive the native Tauri command capability.
document.querySelector("#native-password-reset").href = passwordResetUrl(origin)

async function postJson(route, payload, bearer = null) {
  const response = await nativePostJson(origin, route, payload, bearer)
  const body = response.status === 204 ? {} : await response.json()
  if (!response.ok) {
    const failure = Error(body.error || "Server refused this request (" + response.status + ").")
    failure.status = response.status
    throw failure
  }
  return body
}

function showError(message) {
  error.textContent = message
  error.hidden = false
}

function resetToLogin(message) {
  token = null
  game.hidden = true
  login.hidden = false
  if (refreshTimer) clearInterval(refreshTimer)
  if (message) showError(message)
}

async function refreshToken() {
  if (!token || signingOut) return
  try {
    const refreshed = await postJson("/api/native/refresh", {}, token)
    if (signingOut) return
    token = refreshed.token
    game.dataset.socketToken = refreshed.token
    status.textContent = "Secure pilot session active"
  } catch {
    if (signingOut) return
    // A short socket token may expire during sleep. Keep the remembered
    // credential until the server actually rejects it at /resume.
    resetToLogin("Your pilot authorization expired. Reconnect from the launcher.")
    window.location.replace("./index.html")
  }
}

async function activateSession(session) {
  token = session.token
  document.querySelector("#native-password").value = ""
  game.dataset.socketToken = session.token
  game.dataset.layoutPlayerId = String(session.pilot_id)
  game.dataset.serverOrigin = origin
  window.SUNRACER_SERVER_ORIGIN = origin
  login.hidden = true
  game.hidden = false
  status.textContent = "Secure pilot session active"
  await import("./native_game.js")
  refreshTimer = setInterval(refreshToken, 10 * 60 * 1000)
}

async function resumeRememberedLogin() {
  busy.disabled = true
  busy.textContent = "Checking remembered sign-in…"
  try {
    const credential = await vault.read()
    if (!credential) return
    remember.checked = true
    const session = await postJson("/api/native/resume", {}, credential)
    await activateSession(session)
  } catch (cause) {
    if (cause.status === 401) {
      try { await vault.clear() } catch { /* server already rejected it */ }
      showError("Remembered sign-in expired. Please sign in again.")
    } else {
      resetToLogin("Remembered sign-in unavailable. Sign in manually. " + nativeErrorMessage(cause))
    }
  } finally {
    busy.disabled = false
    busy.textContent = "Sign in and launch"
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault()
  if (busy.disabled) return
  error.hidden = true
  busy.disabled = true
  busy.textContent = "Establishing secure link…"
  const username = document.querySelector("#native-username").value.trim()
  const password = document.querySelector("#native-password").value
  try {
    const session = await postJson("/api/native/login", {username, password, remember_me: remember.checked})
    let rememberWarning = null
    try {
      if (remember.checked && session.remember_token) await vault.write(session.remember_token)
      else {
        await vault.clear()
        if (remember.checked) rememberWarning = "Server does not support remembered sign-in yet."
      }
    } catch {
      if (remember.checked) rememberWarning = "OS credential storage unavailable; sign-in will not be remembered."
    }
    await activateSession(session)
    if (rememberWarning) {
      status.textContent = rememberWarning
      window.alert(rememberWarning)
    }
  } catch (cause) {
    resetToLogin(cause?.name === "AbortError"
      ? "Connection timed out. Check your SOCKS5 proxy and try again."
      : nativeErrorMessage(cause))
  } finally {
    busy.disabled = false
    busy.textContent = "Sign in and launch"
  }
})

// Intercept server-rendered form/navigation markup reused by the local build.
document.querySelector("#pilot-logout-form").addEventListener("submit", async event => {
  event.preventDefault()
  signingOut = true
  const oldToken = token
  token = null
  if (refreshTimer) clearInterval(refreshTimer)
  let serverFailed = false
  let vaultFailed = false
  try { await vault.clear() } catch { vaultFailed = true }
  try {
    if (oldToken) await postJson("/api/native/logout", {}, oldToken)
  } catch { serverFailed = true }
  if (serverFailed) window.alert(vaultFailed
    ? "Sign-out could not clear remembered authorization. Check your connection and OS credential store."
    : "Signed out locally; server revocation could not be confirmed.")
  window.location.replace("./index.html")
})

for (const equipment of document.querySelectorAll("[data-native-equipment]")) {
  equipment.addEventListener("click", event => {
    event.preventDefault()
    status.textContent = "Equipment management is still on the Phoenix website; native loadouts are next."
  })
}

void resumeRememberedLogin()
