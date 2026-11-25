import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const readText = path => readFileSync(new URL(path, import.meta.url), "utf8")
const config = JSON.parse(readText("../src-tauri/tauri.conf.json"))
const signedBuildConfig = JSON.parse(readText("../src-tauri/tauri.updater.conf.json"))
const windowsConfig = JSON.parse(readText("../src-tauri/tauri.windows.conf.json"))
const packageConfig = JSON.parse(readText("../package.json"))
const rustSource = readText("../src-tauri/src/main.rs")
const cargoSource = readText("../src-tauri/Cargo.toml")

test("desktop version and updater verification settings are consistent", () => {
  assert.match(config.version, /^\d+\.\d+\.\d+$/)
  assert.equal(packageConfig.version, config.version)
  const cargoVersion = cargoSource.match(/^version = "([^"]+)"$/m)?.[1]
  assert.equal(cargoVersion, config.version)
  assert.equal(config.identifier, "game.sbs.space")
  assert.match(config.plugins.updater.pubkey, /^[A-Za-z0-9+/=]+$/)
  assert.ok(config.plugins.updater.pubkey.length > 100)
  assert.deepEqual(config.plugins.updater.endpoints, [
    "https://github.com/bushman77/SunRacer/releases/latest/download/latest.json"
  ])
  assert.equal(config.plugins.updater.windows.installMode, "basicUi")
})

test("updater artifacts require an explicit signed publishing build", () => {
  assert.equal(config.bundle.createUpdaterArtifacts, undefined)
  assert.equal(signedBuildConfig.bundle.createUpdaterArtifacts, true)
  assert.equal(config.app.security.capabilities.length, 1)
  assert.equal(config.app.security.capabilities[0].local, true)
  assert.equal(config.app.security.capabilities[0].remote, undefined)
  assert.equal(config.app.withGlobalTauri, true)
  assert.deepEqual(windowsConfig.bundle.targets, ["nsis"])
})

test("native updater requires consent and never exposes installation commands to web pages", () => {
  assert.match(rustSource, /tauri_plugin_updater::UpdaterExt/)
  assert.match(rustSource, /MessageDialogButtons::OkCancel/)
  assert.match(rustSource, /if !accepted/)
  assert.match(rustSource, /update\.download_and_install/)
  assert.match(rustSource, /APPIMAGE/)
  assert.match(rustSource, /invoke_handler/)
  assert.match(readText("../src-tauri/build.rs"), /AppManifest::new\(\)\.commands/)
})

test("production window creates with optional native SOCKS5 proxy only on opt-in", () => {
  assert.equal(config.app.windows.length, 1)
  assert.equal(config.app.windows[0].create, false)
  assert.match(rustSource, /WebviewWindowBuilder::from_config/)
  const networkSource = readText("../src-tauri/src/network.rs")
  assert.match(networkSource, /SUNRACER_USE_SOCKS_TUNNEL/)
  assert.match(networkSource, /socks5:\/\/127\.0\.0\.1:1080/)
  assert.match(networkSource, /require_local/)
  assert.match(rustSource, /window\.proxy_url\(proxy_url\.parse\(\)\?\)/)
  assert.match(rustSource, /window\.build\(\)\?/)
  assert.doesNotMatch(rustSource, /danger_accept_invalid_certs|ignore_certificate_errors/)
})

test("SunRacer desktop branding is consistent across the native package and launcher", () => {
  assert.equal(config.productName, "SunRacer")
  assert.equal(config.app.windows[0].title, "SunRacer")
  assert.equal(packageConfig.name, "sunracer-client")
  assert.match(cargoSource, /^name = "sunracer-client"$/m)
  assert.match(readText("../src-tauri/Cargo.lock"), /name = "sunracer-client"/)
  const npmLock = JSON.parse(readText("../package-lock.json"))
  assert.equal(npmLock.name, "sunracer-client")
  assert.equal(npmLock.packages[""].name, "sunracer-client")
  assert.match(readText("../ui/index.html"), /<title>SunRacer/)
  assert.match(readText("../ui/index.html"), /SUNRACER<\/span>/)
})

test("manual update uses the same native check and local-only IPC", () => {
  const html = readText("../ui/index.html")
  const launcher = readText("../ui/launcher.mjs")
  const capability = config.app.security.capabilities[0]
  assert.match(html, /id="check-client-update"/)
  assert.match(html, /id="client-update-status" role="status" aria-live="polite"/)
  assert.match(launcher, /bindClientUpdate\(/)
  assert.ok(capability.permissions.includes("allow-check-client-update"))
  assert.deepEqual(capability.windows, ["main"])
  assert.equal(capability.local, true)
  assert.equal(capability.remote, undefined)
  assert.match(readText("../src-tauri/build.rs"), /"check_client_update"/)
  assert.match(rustSource, /network::require_local\(&window\)\?;/)
  assert.match(rustSource, /check_for_updates\(app\)\.await/)
  assert.match(rustSource, /check_for_updates\(handle\)\.await/)
  assert.match(rustSource, /UPDATE_ACTIVE\.compare_exchange/)
  assert.match(rustSource, /impl Drop for UpdateGuard/)
  assert.match(rustSource, /receive\.await\.unwrap_or\(false\)/)
  assert.doesNotMatch(rustSource, /danger_accept_invalid_certs|ignore_certificate_errors/)
})
