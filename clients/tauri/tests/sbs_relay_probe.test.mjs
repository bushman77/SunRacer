import assert from "node:assert/strict"
import test from "node:test"
import {readFileSync} from "node:fs"

const read = path => readFileSync(new URL(path, import.meta.url), "utf8")
const native = read("../src-tauri/src/sbs_relay_probe.rs")
const launcher = read("../ui/index.html")
const control = read("../../../apps/sunracer_web/assets/js/game/helmet_control.mjs")
const gameMarkup = read("../../../apps/sunracer_web/lib/sunracer_web/controllers/game_html/show.html.heex")
const phoneMarkup = read("../../../apps/sunracer_web/lib/sunracer_web/controllers/helmet_html/show.html.heex")
const phoneJS = read("../../../apps/sunracer_web/assets/js/game/helmet_client.mjs")
const relayJS = read("../../../apps/sunracer_web/assets/js/game/helmet_relay_test.mjs")
const cargo = read("../src-tauri/Cargo.toml")
const main = read("../src-tauri/src/main.rs")
const network = read("../src-tauri/src/network.rs")
const build = read("../src-tauri/build.rs")
const config = JSON.parse(read("../src-tauri/tauri.conf.json"))

test("secure relay proof is disabled by default and explicitly bound to private LAN only", () => {
  assert.match(native, /std::env::var\("SPACE_NOVA_SBS_BIND"\)/)
  assert.match(native, /SocketAddr::V4\(a\) if a\.port\(\) >= 1024 && private_lan/)
  assert.match(native, /tls_config\(\)\?/)
  assert.match(native, /TlsAcceptor::from\(config\)/)
  assert.match(native, /ServerConfig::builder_with_provider\(Arc::new\(/)
  assert.match(native, /rustls::crypto::ring::default_provider\(\)/)
  assert.match(native, /\.with_safe_default_protocol_versions\(\)/)
  assert.doesNotMatch(native, /^\s*let config = ServerConfig::builder\(\)/m,
    "default provider selection panics when aws-lc-rs and ring are both enabled")
  assert.doesNotMatch(native, /CryptoProvider::install_default\(/,
    "relay must not modify cryptography defaults for the entire Tauri process")
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
  assert.match(native, /window\.parent\.postMessage/)
  assert.match(native, /"space-nova:relay-proof",passed/)
  assert.match(native, /"https:\/\/"\+location\.hostname\+":4443"/)
  assert.match(native, /report\(true\)/)
  assert.match(native, /"space-nova:relay-world"/)
  assert.match(native, /"space-nova:relay-heartbeat"/)
  assert.match(native, /\/relay\/state\?since=/)
  assert.match(native, /MAX_WORLD_BYTES: usize = 256 \* 1024/)
  assert.match(native, /sanitize_world\(&world\)/)
  assert.match(native, /\*p\.shared\.session\.lock\(\)\.await = None/)
  assert.doesNotMatch(native, /postMessage\(\{[^}]*token/)
  assert.doesNotMatch(native, /world_state|world_delta|\/api\/native|\/game\/assets/)
})

test("native IPC capabilities are strictly local and explicit", () => {
  const capability = config.app.security.capabilities[0]
  assert.equal(capability.local, true)
  assert.deepEqual(capability.windows, ["main"])
  for (const command of [
    "start_sbs_relay_probe", "sbs_relay_probe_status", "stop_sbs_relay_probe",
    "publish_sbs_relay_world"
  ]) {
    assert.match(main, new RegExp("sbs_relay_probe::" + command))
    assert.ok(build.includes('"' + command + '"'))
    assert.ok(capability.permissions.includes("allow-" + command.replaceAll("_", "-")))
  }
  assert.match(native, /crate::network::require_local\(&window\)\?/)
  assert.equal(capability.remote, undefined,
    "do not permit remote HTTPS pages to invoke native relay commands")
  // WebKitGTK can report a different window URL than the authenticated
  // caller of a local IPC command. Tauri's ACL checks the caller origin.
  assert.match(network, /require_main_window_label\(window\.label\(\)\)/)
  assert.doesNotMatch(network, /window\.url\(\)/,
    "do not bypass local-IPC approval based on WebKitGTK navigation URL")
  assert.match(network, /if label == "main"/)
})

test("relay controls live only in the native PILOT HMD panel", () => {
  assert.doesNotMatch(launcher, /sbs-relay-open|sbs-relay-panel|sbs_relay_probe.mjs/)
  for (const id of ["helmet-relay-mini", "helmet-relay-status", "helmet-relay-check"]) {
    assert.equal(gameMarkup.split('id="' + id + '"').length - 1, 1, id)
  }
  assert.match(control, /start_sbs_relay_probe/)
  assert.match(control, /sbs_relay_probe_status/)
  assert.match(control, /stop_sbs_relay_probe/)
  assert.match(control, /this\.status\.connected/)
  assert.match(control, /relayQRUrl\(url\.toString\(\), this\.relayUrl\)/)
  assert.match(control, /drawRelayReconnectQR/)
  assert.match(control, /this\.status\.paired/)
  assert.match(gameMarkup, /id="helmet-relay-reconnect"/)
  assert.match(gameMarkup, /id="helmet-relay-qr"/)
  assert.doesNotMatch(control, /navigator\.clipboard|navigator\.share/)
})

test("QR initiates phone handshake after Phoenix authentication, with no copied links", () => {
  assert.match(phoneJS, /relayInvitationFromQR\(window\.location\.href\)/)
  assert.match(phoneJS, /this\.localLink\.prove\(relayInvitation\)/)
  assert.match(phoneJS, /if \(!this\.credential\)/)
  assert.match(phoneJS, /this\.localRelayActive/)
  assert.match(phoneJS, /"relay_stream_mode"/)
  assert.match(phoneJS, /this\.disableLocalRelay\(\)/)
  assert.match(relayJS, /new URLSearchParams\(\{relay: valid\.href\}\)/)
  assert.match(relayJS, /frame\.src = link\.href/)
  assert.match(relayJS, /authenticatedRelayResult/)
  assert.doesNotMatch(phoneMarkup, /helmet-relay-url|helmet-relay-submit|PASTE LINK/)
  assert.doesNotMatch(relayJS, /clipboard|navigator\.share/)
})

test("Rust dependency versions are pinned to existing lockfile-compatible versions", () => {
  assert.match(cargo, /tokio-rustls = "0\.26"/)
  assert.match(cargo, /ring = "0\.17"/)
  assert.match(cargo, /tokio = \{ version = "1\.54"/)
})
