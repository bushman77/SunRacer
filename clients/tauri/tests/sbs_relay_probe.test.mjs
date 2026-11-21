import assert from "node:assert/strict"
import test from "node:test"
import {readFileSync} from "node:fs"

const read = path => readFileSync(new URL(path, import.meta.url), "utf8")
const native = read("../src-tauri/src/sbs_relay_probe.rs")
const launcher = read("../ui/index.html")
const ui = read("../ui/sbs_relay_probe.mjs")
const cargo = read("../src-tauri/Cargo.toml")
const main = read("../src-tauri/src/main.rs")
const build = read("../src-tauri/build.rs")
const config = JSON.parse(read("../src-tauri/tauri.conf.json"))

test("secure relay proof is disabled by default and explicitly bound to private LAN only", () => {
  assert.match(native, /std::env::var\("SPACE_NOVA_SBS_BIND"\)/)
  assert.match(native, /SocketAddr::V4\(a\) if a\.port\(\) >= 1024 && private_lan/)
  assert.match(native, /tls_config\(\)\?/)
  assert.match(native, /TlsAcceptor::from\(config\)/)
  assert.doesNotMatch(native, /danger_accept_invalid_certs|no_certificate_verification/)
  assert.doesNotMatch(native, /HttpServer|TcpListener::bind\("0\.0\.0\.0/)
})

test("phone proof uses one-use bearer over HTTPS, with no game or asset routes", () => {
  assert.match(native, /const TTL: Duration = Duration::from_secs\(600\)/)
  assert.match(native, /let mut bytes = \[0u8; 24\]/)
  assert.match(native, /SystemRandom::new\(\)\.fill/)
  assert.match(native, /verify_slices_are_equal/)
  assert.match(native, /\*secret = None/)
  assert.match(native, /"https:\/\/\{address\}\/relay-check#\{token\}"/)
  assert.match(native, /"POST", "\/relay\/prove"/)
  assert.match(native, /"GET", "\/relay-check"/)
  assert.match(native, /Cache-Control: no-store/)
  assert.match(native, /Content-Security-Policy:/)
  assert.match(native, /history\.replaceState\(null,"","\/relay-check"\)/)
  assert.doesNotMatch(native, /world_state|world_delta|\/api\/native|\/game\/assets/)
})

test("native IPC capabilities are strictly local and explicit", () => {
  const capability = config.app.security.capabilities[0]
  assert.equal(capability.local, true)
  assert.deepEqual(capability.windows, ["main"])
  for (const command of [
    "start_sbs_relay_probe", "sbs_relay_probe_status", "stop_sbs_relay_probe"
  ]) {
    assert.match(main, new RegExp("sbs_relay_probe::" + command))
    assert.ok(build.includes('"' + command + '"'))
    assert.ok(capability.permissions.includes("allow-" + command.replaceAll("_", "-")))
  }
  assert.match(native, /crate::network::require_local\(&window\)\?/)
})

test("the installed launcher exposes start, stop, proof URL and completion state", () => {
  for (const id of [
    "sbs-relay-panel", "sbs-relay-open", "sbs-relay-start", "sbs-relay-stop",
    "sbs-relay-url", "sbs-relay-copy", "sbs-relay-close", "sbs-relay-status",
  ]) {
    assert.equal(launcher.split('id="' + id + '"').length - 1, 1, id)
  }
  assert.match(launcher, /sbs_relay_probe\.mjs/)
  assert.match(ui, /start_sbs_relay_probe/)
  assert.match(ui, /stop_sbs_relay_probe/)
  assert.match(ui, /sbs_relay_probe_status/)
  assert.match(ui, /Phone verified over local HTTPS/)
  assert.doesNotMatch(ui, /fetch\(|WebSocket|\/socket|console\.log/)
})

test("Rust dependency versions are pinned to existing lockfile-compatible versions", () => {
  assert.match(cargo, /tokio-rustls = "0\.26"/)
  assert.match(cargo, /ring = "0\.17"/)
  assert.match(cargo, /tokio = \{ version = "1\.54"/)
})
