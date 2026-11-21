# Space Nova — SBS Local Relay and Bandwidth Budget

**Status:** Stage 0 instrumentation implemented; secure LAN relay NOT implemented.
**Branch:** `star_base`. No new branches, automatic EC2 deployment or `mix format`.
**Rule:** EC2/Phoenix remains authoritative for all player identity, navigation, movement, combat, damage, inventory and persistence.

## Architecture audit

- The Tauri client ships a locally built Three.js renderer, JS modules, CSS and graphic assets.
- The desktop world Channel joins with `stream: "delta_v1"`, applying sparse state deltas after a full join/resync.
- The current phone `/helmet` page separately opens the Phoenix `helmet:viewer` Channel and receives full `world_state` snapshots and a full initial snapshot. This creates redundant remote traffic when the server is EC2.
- The paired phone downloads its own renderer assets from the web origin serving `/helmet`. Those are LAN transfers only when using local Phoenix.
- Existing Tauri Rust `native_loopback` is a narrow whitelist for local login/refresh/logout requests, NOT a LAN file server or unrestricted proxy.

## Stage 0 — in-client bandwidth probes (implemented)

The desktop and phone expose `window.spaceNovaBandwidth.snapshot()` in their respective browser consoles.
The probe records only event names, message counts and UTF-8 JSON PAYLOAD byte estimates, not credentials, game-state objects, raw messages or player IDs.
Capture at least 30 seconds in each situation: idle Atlas, cruise, asteroid-belt free flight, combat, and disconnect/reconnect.
Inspect `receivedBytesPerSecond`, `sentBytesPerSecond`, `window`, `total` and `byEvent`. The phone's `helmet_control/world_state` count reveals duplicated snapshots.

**Important:** These are diagnostic estimates, NOT actual EC2 egress numbers. They omit WebSocket framing, TLS, compression, heartbeat frames, HTTP assets and TCP retransmissions.
Compare against the real proxy/network counters or EC2 CloudWatch egress using the same test interval.

## Stage 1 — secure local asset distribution (not yet implemented)

A native, explicitly enabled laptop-hosted LAN endpoint should serve only the immutable, bundled headset asset manifest (hashes, strict file allowlist, MIME types and cache headers).
Do not permit arbitrary filesystem reads, arbitrary URL forwarding, dynamic command execution, or bearer token exposure.
Phone browser motion sensors require a secure context. Investigate trusted LAN HTTPS certificate provisioning; never silently fall back to plain HTTP, disable TLS validation, or ship an unauthenticated listener.
Use a versioned manifest and offline cache. A locally authenticated WebRTC transport may be an alternative if trusted browser HTTPS cannot be provisioned cleanly.

## Stage 2 — authenticated read-only state relay (not yet implemented)

The laptop will keep a single authoritative Phoenix world connection and apply the existing `WorldStreamDelta` pipeline.
The LAN relay sends only a whitelisted view for the current pilot: pose, relevant visible entity transforms, collision warning presentation, docking visuals, laser effects, and the environment profile.
Never forward the full game snapshot, other pilots' private data, commerce/inventory, service tokens or arbitrary server events.
The S21 runs its own stereo renderer and head tracking; it must not submit combat or motion authority through this relay.
Use ordered sequence numbers, bounded queues, dropped stale updates, explicit resync after gaps, authenticated device pairing, per-session revocation, and fail-closed disconnection.
Pair tokens must be random, short-lived, single-use and separate from the pilot's EC2 credentials. LAN binding is explicit opt-in.

## Stage 3 — pre-EC2 release gate

1. One remote game connection per pilot in normal local-relay mode.
2. Phone makes zero direct EC2 game/asset requests; verify with network isolation, not merely static code inspection.
3. Phone obtains all game JS/models/textures from the local authenticated manifest; no refetch on Atlas/cockpit toggling.
4. Reconnect/region transition recovers state without duplicates or stale collisions.
5. Phone sees no private cargo, credentials, arbitrary server contacts or mutation commands.
6. Benchmarks include idle, cruise, dense asteroid belt, combat and a 30-minute session with realistic NPC count.
7. Define numeric bandwidth budgets from the measured results, including peak and sustained bytes per pilot; fail CI/performance checks on regression.

Do not move this milestone to EC2 production until the local secure relay and network acceptance tests pass. Keep the old direct helmet path as an explicit development fallback only during migration.

## Read the stage-0 estimates without developer tools

- **Laptop / Tauri:** In the game window, open the small **NET** disclosure at the bottom-right. It updates once per second while expanded.
- **Galaxy S21:** Leave fullscreen VR and open **NET · BANDWIDTH** on the headset setup screen to review the counters accumulated during play.
- Watch `Server -> device` (incoming) and `Device -> server` (outgoing), plus the largest event totals. The readout is diagnostic JSON payload only; it is not an EC2 transfer-rate or billing meter.
- The original `window.spaceNovaBandwidth.snapshot()` remains available for optional browser debugging, but neither game UI requires a console.

## Live headset SBS bandwidth display

The **top-right of each SBS eye** now contains a small, stereo-correct
head-locked overlay showing **RX** (incoming) and **TX** (outgoing) bandwidth,
with a five-second rolling average refreshed **every second**. The readout
is sourced solely from the headset's existing `BandwidthProbe`, and
introduces **no extra Phoenix/WebSocket connection or telemetry traffic**.
The display is also present while docked; it is hidden in the desktop view
and does not intercept or modify gaze targeting.

The overlay is explicitly labeled `NET / JSON EST.` and
`EXCL. ASSETS + TLS`: these are JSON-payload estimates, **not total
network-interface throughput or actual EC2 billable traffic**. The existing
NET details panel on the phone's setup screen remains available for
event-by-event and cumulative statistics.

## S21 headset layout correction

The first, camera-parented Three.js bandwidth texture did not appear in
on-device screenshots despite passing static tests. The revised headset UI
uses **two small HTML labels**, one at the top-right of each eye viewport,
above the stereo canvas. They draw the already-collected RX/TX probe values
every second using `textContent`, and are displayed independently of motion
sensor availability or camera projection. The overlay never captures pointer
events or triggers another connection. It is hidden whenever SBS is stopped.

SBS cockpit telemetry now uses at most 55% of the per-eye width (desktop
retains 75%). NAV and the FLIGHT / CONTACTS / SPACE gaze panel, CLOSE,
RECENTER and tabs are proportionally smaller and moved apart so they do not
obscure instrument text. Gaze dwell timing is unchanged.

On a local dev Phoenix server, pull the updated `star_base`, rebuild assets,
restart Phoenix, and close/reopen the Galaxy S21 `/helmet` browser tab. If
the page remains unchanged, clear that origin's browser cache before
re-pairing; the phone does not need a rebuilt Tauri installer.

## Direct headset sparse-stream experiment (Stage 0b)

The S21 showed ~19.4 KiB/s incoming JSON while stationary. The existing headset channel was transmitting a complete world-state map on every tick. The delta-v1 optimization now sends one initial snapshot and only changed fields thereafter. No-op updates are suppressed with periodic clock updates. The phone reconstructs its state using the same WorldStreamDelta algorithm as the desktop and can request an authenticated, rate-limited resync after a gap. This is an interim improvement, NOT the complete secure LAN relay: the headset still contacts the server directly. Compare steady RX readings after rebuilding both phone assets and the local Phoenix server. Do not claim measured savings until the Galaxy S21 is retested.


## Stage 1a — Tauri → Galaxy TLS-only LAN proof (implemented)

The native Tauri launcher has a new opt-in **SBS relay test**. It starts a
restricted HTTPS listener **only** after a local user clicks Start, and only
on a single explicit private LAN IPv4 address (`SPACE_NOVA_SBS_BIND`, port
4455 in the developer script). It reuses the phone-trusted mkcert certificate
and never falls back to plaintext. The existing login bridge, Phoenix stream,
and HMD rendering are untouched.

The launcher presents a ten-minute, one-time, 192-bit random invitation in
an HTTPS **fragment**. The phone loads a bundled static TLS proof page, clears
its fragment, and sends its token in an Authorization header to a single
allowed POST endpoint. Tauri consumes the token and reports **Phone verified
over local HTTPS**. The listener accepts no other routes, no uploads, no
arbitrary file paths, no CORS and no game commands. Stop or closing the client
terminates the listener. Re-pairing requires a new token.

Try using `bash clients/tauri/scripts/dev-sbs-relay.sh` from the repo root,
then click **SBS relay test → Start secure LAN test** in the Tauri launcher;
copy the resulting one-time URL to the S21 on the same Wi-Fi. The phone's
Android browser must trust the cert's issuing CA and the certificate must
include the laptop's private IPv4 SAN. If this cannot be verified, fail
closed instead of bypassing a certificate warning.

**Important:** This is a transport/authentication proof, **not** the finished
local relay. It does not yet send any world-state delta or locally hosted
graphical asset. Existing `/helmet` remains connected to Phoenix until the
scoped LAN state relay, local static asset manifest, and isolation tests pass.
The next implementation step should use the established trusted LAN channel
and migrate the phone to the filtered state stream, not copy or multiplex
another full Phoenix connection.

## Minimal S21 setup and in-place relay result

The Phoenix `/helmet` landing page displays only **Enter VR** and
**Test Local Relay** as its primary controls. Enter VR requests sensor access
and fullscreen from the same user gesture, avoiding a separate head-tracking
button. Head tracking still requires a secure browser context and browser
permission if prompted; if unavailable, the phone may continue rendering
without head pose. Advanced calibration remains controlled from the laptop;
recenter remains available via the headset screen button and gaze.

The headset **Test Local Relay** control checks the opt-in Tauri Stage 1
TLS listener. Copy the ten-minute invitation using the Tauri launcher; tap
the phone's relay button. It first tries the clipboard from the tap, or
displays a small link-paste field only if clipboard access is unavailable.
Only HTTPS on port 4455, the `/relay-check` path, the same private
IPv4 as the current `https://<laptop-ip>:4443/helmet` page, and a
48-character one-time token are accepted. A hidden iframe loads that TLS
proof page, whose **same-origin authenticated POST** consumes the token.

The Tauri proof page sends a boolean message to its same-laptop port-4443
parent. The headset checks both the expected source window and exact
origin; **only a successful authenticated proof** turns the button into
**PASSED**. A failed, expired, or unreachable test shows **NOT CONNECTED**
and permits retry; merely loading the page or pressing a button never
counts as success. No pilot credentials, game state, or token appear in the
message. This is still only the link test—not a working world-state relay.


### Stage 1 launcher-origin fix (Linux / WebKitGTK)

If the bundled Tauri launcher displays `Unable to read relay status:
Networking preferences are available only in the local launcher`, no LAN
listener or invitation has been created. A second Rust origin test was using
`WebviewWindow::url()`, which may disagree with the actual local IPC
request origin on WebKitGTK. The listener's commands now rely on Tauri's
**local-only, main-window** IPC capability to authorize the originating
request, plus an independent native `main` window-label check. Remote
websites have no native permission; **no remote capability** was introduced.
Restart the rebuilt Tauri application for this native Rust fix to take effect.
The ordinary `/helmet` page on port 4443 still cannot generate invitations.


## Stage 1b — Integrate link proof into the existing headset QR

**Implemented in the native game HMD panel.** The removed Tauri launcher relay
modal and its manual copied URL were removed. Opening **PILOT HMD** in the
compiled Tauri client now starts the restricted TLS listener while requesting
the existing Phoenix pairing code. One QR contains both, with the Tauri
one-time challenge only in a URL fragment. The S21 pairs with Phoenix and
then automatically opens an isolated HTTPS iframe to the local Tauri listener
and consumes the challenge, reporting the boolean result. Tauri requires no
prior phone address and learns the peer address from the inbound socket.

The small HMD status shows `LOCAL LINK / AWAITING PHONE` and later
`LOCAL LINK / VERIFIED`. Once Phoenix reports an authenticated headset
connection, **CHECK LINK** re-reads the native verification state. This
button checks the completed one-time proof; it does not send a new latency
probe or transfer world state. Existing game-state authority and SBS rendering
are unchanged.

Use `bash clients/tauri/scripts/dev-sbs-relay.sh`, sign into the Tauri
client, open Atlas → PILOT HMD, and scan its QR. The existing phone page must
be reachable at trusted `https://<same-laptop-IP>:4443/helmet`; the local
listener binds to that IP on port 4455. A mismatched or untrusted address
leaves Phoenix pairing intact but skips the LAN test. **No global automatic
listener** is opened at app launch; the pilot must open the HMD panel first.


### Existing saved headset registrations

Opening PILOT HMD in the native client while a headset is already registered
also starts the opt-in LAN listener and shows a small **reconnect QR** beside
the paired-device details. It points to the existing Phoenix `/helmet` page
with **no new `pair` code**, only the LAN proof fragment. The S21 must still
have the saved authenticated Phoenix headset credential. After it verifies
that credential, the phone automatically sends the one-time native proof and
the laptop status changes to `LOCAL LINK / VERIFIED`. This avoids forgetting
an otherwise working headset just to test LAN transport. The QR disappears
from the paired panel once the proof succeeds.
