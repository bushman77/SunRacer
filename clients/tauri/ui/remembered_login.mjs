// OS credential storage only, scoped to the exact validated server origin.
import {serverOrigin} from "./server_url.mjs"

export function rememberedLogin(rawOrigin, invoke = globalThis.__TAURI__?.core?.invoke) {
  const origin = serverOrigin(rawOrigin)
  const call = (operation, credential = null) => {
    if (typeof invoke !== "function") {
      if (operation === "read" || operation === "clear") return Promise.resolve(null)
      return Promise.reject(Error("OS credential storage requires the installed desktop client."))
    }
    return invoke("remembered_credential", {origin, operation, credential})
  }
  return {read: () => call("read"), write: credential => call("write", credential),
    clear: () => call("clear")}
}
