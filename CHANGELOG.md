## 2026-11-25 — Installed headset relay: no command-line configuration

- Opening the HMD panel selects the already discovered private HTTPS headset IPv4 and binds port 4455 on that exact interface. The optional developer bind override must match. No wildcard/public/loopback bind, no listener at app startup, no TLS downgrade. Existing trusted local Phoenix certificate/key are discovered in the standard app config directory or the existing ~/SunRacer checkout. A native Certificate setup button selects and validates a certificate/key pair once and saves only local file paths; retry requires no relaunch or environment variables. Existing Phoenix pairing is preserved on relay failure.
- The trusted HTTPS phone page on the same LAN IP:4443 and phone CA trust remain prerequisites for the optimized local stream. Public EC2 phone origins retain direct Phoenix connectivity; fully automatic trusted certificate provisioning and local asset serving for arbitrary installations remain separate work. No secrets bundled or transferred. Added Rust address validation and native markup/IPC checks; full builds and Galaxy acceptance pending.

## 2026-11-25 — Fix SVG layer obscuring the installed 3D Atlas

- The overhead map is an SVGElement, not an HTMLElement. Setting its `.hidden` property did not set the DOM `hidden` attribute required by the CSS, leaving the opaque overhead layer above the 3D scene. Toggle the actual attribute on mode changes and regression-test SVG attribute semantics. Preserve the previous native first-frame guard and overhead fallback. Installed-client visual verification pending.

## 2026-11-25 — Installed-client orrery visibility recovery

- Keep the functional overhead map visible until an initial 3D frame is confirmed. On native clients, retain the WebGL drawing buffer and present via a regular 2D canvas, validating the first frame's solar-center pixel; use explicit stacking and the same high-performance GPU preference as the cockpit. Guard against zero draw calls, context loss and rendering exceptions. Show the failure reason and restore the overhead chart rather than leaving an interactive blank viewport. Disable invisible picks before first frame. Added mode transition tests.
- This is a defensive fix for a reported blank installed-client viewport, not a verified diagnosis of WebKitGTK. Installed GPU verification and complete tests pending. No simulation, transport, package identity or release version changes.

## 2026-11-25 — SpaceNova 3D Solar Orrery

- Added a locally rendered Three.js orrery with a tilted camera, shaded schematic planets, Saturn rings, thin cyan-blue orbit paths, midnight/nebula backdrop, labels, player and server-positioned station/contact markers and schematic route indicators. Left click selects, right click opens existing route actions, middle drag rotates, wheel zooms and double-click focuses; reset and keyboard camera controls are available. The overhead chart remains available and is the fallback if WebGL initialization fails.
- Reuses the existing reversible SOL chart projection and authenticated navigation callbacks. No protocol, physics, ephemeris, or SBS changes. Sensor contacts without a supplied position remain in the existing contacts panel; no invented locations. Routes are diagram indicators, not predicted obstacle-avoidance trajectories. Planet markings and distances remain schematic.
- Added shared landing-page color tokens, actual SVG icons for the native toolbar, context-sensitive flight actions and suppressed the redundant closed NET tab in Atlas. Preserved existing flight handlers and settings.
- Added projection/camera and native markup regression tests. Source integration checks passed; automated suite, asset build and GPU/browser/manual verification pending. No version bump, deployment or Mix formatting.

## 2026-11-25 — SpaceNova Atlas command layout

- Organized the shared Atlas into a compact SpaceNova header, live connection state, left pilot command toolbar and top-left settings disclosure. Existing inventory, loadout, sensor contacts, mouse preferences, headset, HUD reset, diagnostics and logout controls retain their original handlers. Pilot and mission readouts use existing authoritative player/story data.
- Restyled the right instrument stack with translucent midnight-blue surfaces; existing target selection, transit and draggable instruments remain intact. Native markup conversion recognizes the new icons. No changes to simulation, gameplay transport, SBS overlays or cockpit flight controls.
- This is the Atlas organization milestone, not a full cockpit redesign. Native equipment editing remains at its existing limitation; mission toolbar is read-only while existing story decisions remain in the cockpit. Graphics/audio settings and expanded context panels are not yet implemented.
- Added shared markup and native packaging regression checks; static control-ID checks passed. Node/ExUnit suites and visual verification pending. No release or deployment.

## 2026-11-25 — SpaceNova native pilot authentication

- Native Play/sign-in now uses the same staged artwork, logo, title stylesheet and angular action button as the launcher, with a translucent right-side login card and responsive sizing.
- Preserved the native auth form IDs, password handling, server selection, recovery, launcher return, token lifecycle and initial gameplay visibility. Changed only the visible native window title to SpaceNova; package/update identity remains SunRacer.
- Added native markup and styling regression checks. Static source/ID checks passed; Node suite, Tauri rebuild and manual login verification pending. No new release version or deployment.

## 2026-11-25 — Unify the installed SpaceNova launcher with the web title screen

- Replaced the bundled desktop launcher's old two-column console with the approved SpaceNova artwork, wordmark and Play/Create account controls. Both launch surfaces use the same title CSS and static artwork. Native staging now explicitly bundles the shared CSS and background, including the SVG fallback, without runtime downloads.
- Moved server selection, diagnostics, update and preview tools into the top-left settings menu. Existing native proxy form, Rust commands, local IPC boundary, package identity and standalone game launch are preserved.
- Updated launcher markup, branding and offline staging regression tests. Static control-ID checks passed; Node suite, Tauri build and manual desktop verification pending. No new release version or EC2 deployment.

## 2026-11-25 — Restore native proxy settings in title menu

- Moved the installed client's existing system/SOCKS5 proxy selector, host, port, tunnel override notice and save/restart flow into a top-left translucent, intrinsic-width hamburger menu. Existing Rust validation, persisted settings and local-only IPC capability are unchanged.
- Browser title screen explains where native proxy configuration lives; no remote IPC or browser proxy bypass introduced.
- Added markup and capability regression coverage; local Node suite, Tauri build and real proxy/restart verification pending. No Mix formatting or deployment performed.

## 2026-11-25 — SpaceNova title settings menu

- Removed duplicate Pilot Sign In; Play still routes guests to login and authenticated pilots to the cockpit.
- Added a reusable top-left settings popover, intrinsic-width translucent midnight-blue panel, and a browser network section with current origin and on-demand same-origin HTTP connection check. Native proxy controls remain in the Tauri launcher; browsers manage their own proxy settings.
- Added homepage DOM and Node network-check regression coverage. Full local test/build and visual verification pending; no Mix formatting or deployment performed.

## 2026-11-25 — SpaceNova public title screen

- Replaced the public homepage with a responsive cinematic title screen and styled SpaceNova wordmark. Guest actions use existing login, registration and recovery routes; authenticated actions use play, equipment and logout.
- Install the approved `spacenova-space.webp` at `apps/sunracer_web/priv/static/images/landing/` before deploying. The original `sol-approach.svg` remains a CSS fallback while the binary artwork is pending. No runtime names, native clients or game protocol changed.
- Updated guest homepage DOM regression test. ExUnit, asset build and live visual verification are pending; no Mix formatting performed.

## 2026-11-24 — SBS cockpit

Removed the top-right RX/TX bandwidth card from both headset eyes and its once-per-second refresh. The headset still collects network estimates for console inspection.

## 2026-11-21 — SunRacer namespace migration

- Renamed application/module references, directories, CI paths, and configuration.
- Automated tests have not yet been run; local verification is required.
- Existing database data and production deployment need separate migration checks.

# Changelog

## Unreleased

### Imported models for every station attendant; Ilya Quill slot (2026-11-23, branch `story_line`)

#### Changed

- `GreenStarbaseInterior` loads an imported GLB for **every** attendant listed
  in `STATION_CHARACTER_ASSETS` (keyed by `Core.World.StationAttendants`
  id), not only Mara. Each gets the same placement, idle animation and
  fallback; one request per attendant per station scene.
- Added `outfitting: /images/game/station/ilya_quill.glb` (Ilya Quill). Until
  that file exists Ilya keeps his procedural figure (one console info line).

#### Tests

- `station_character_models_test.mjs`: two attendants with assets load their
  models, one without keeps its figure, no repeated requests.
  `npm test` in `apps/sunracer_web/assets`: 528 passed, 0 failed.
- **Not run:** `mix precommit` (JavaScript-only). **Manual verification not
  performed** (Ilya's model has not been generated yet).

### Mara Venn's 3D model plays an idle animation (2026-11-23, branch `story_line`)

#### Added

- The Green Starbase repair bay plays the imported character's **idle**
  animation (`createCharacterAnimator` in `station_character_models.mjs`,
  driven by the interior's existing frame delta). Clip choice: `idle`, then
  any clip with "idle" in its name, then any clip except ai3d's report-only
  `ai3d_pose_test`; a GLB without clips simply stands still, as before.
  Skinned meshes are exempt from frustum culling (rest-pose bounds do not
  cover animated poses). The mixer is stopped and uncached on dispose.
- Mara's GLB comes from the ai3d pipeline (github.com/bushman77/ai3d):
  single closed mesh, Mixamo bone names (`mixamorig:*`), automatic weights,
  8 s looping `idle` clip (arms relaxed, breathing, slow look-around).
  Placement, scaling and the existing fallback are unchanged.

#### Tests

- `station_character_models_test.mjs`: idle clip selection (never the pose
  test), looping and culling on a skinned fixture, and the Green Starbase
  interior advancing and disposing the animation. `npm test` in
  `apps/sunracer_web/assets`: 527 passed, 0 failed. `npm test` in
  `clients/tauri`: 43 passed, 0 failed.
- **Not run here:** `mix precommit` (JavaScript-only change; no Elixir files
  touched).
- **Manual verification not yet performed:** viewing the animated model in
  the laptop cockpit and the paired SBS headset. The GLB itself is not in
  this commit; copy it as described in
  `apps/sunracer_web/priv/static/images/game/station/README.md`.

### Trade Exchange: sell looted cargo, buy common goods (2026-11-23, branch `story_line`)

#### Added

- Tarek Sol's Trade Exchange is live (`Sunracer.Trade`,
  `Sunracer.Trade.Market`). Pilots sell any cargo in their hold and buy
  stocked common goods at fixed, tight prices (sell 75 / 200 / 450 credits
  per tonne by tier; buy at sell x 1.3, so same-desk arbitrage always
  loses). See `docs/green-starbase-trade-exchange.md`.
- Tarek's dialogue gains **Open trade console**; a new console
  (`station_trade_panel.mjs`, `#station-trade-panel`) lists the cargo board,
  hold usage and credits, with a tonnes picker and Sell / Buy buttons.
- Channel events `station_trade`, `station_trade_sell`, `station_trade_buy`
  (cargo id + whole amount 1-1,000 only; anything else is `invalid_trade`).
- `Core.World.station_purchase/3` and `MapServer.station_purchase` take the
  kiosk to check (`attendant:` option, default `"outfitting"`), so trades are
  proven to happen at Tarek's kiosk.

#### Changed

- Station help text and Tarek's "market"/"prices" lines no longer say cargo
  trading is offline.

#### Fixed (CI: "Verify SOL free-flight mechanics", red since at least 2026-11-22)

- `helmet_channel_test.exs` still expected `solar_accept_surrender` from the
  headset to be refused as read-only, but the 2026-11-21 gaze surrender
  feature deliberately allows it (payload ignored, resolved from the
  pilot's own session). The test now asserts that behaviour for both
  `solar_accept_surrender` and `solar_seize_cargo`. That stale assertion
  skipped the test's cleanup, so `HelmetManager` crashed on teardown and the
  next test's join failed ("join crashed"); the first test now also waits
  for its channel to close before the sandbox is released.
- `MapServer.available?/2` reported a map that had just stopped as available,
  because `Registry` drops entries asynchronously after the process exits
  (about 22% of the time in a 2,000-run standalone reproduction). It now also
  checks that the registered process is alive. This fixes the flaky
  `world_test.exs` free-flight assertion and a real window in which
  `FreeFlightRegion.ensure_started/2` could skip restarting a pilot's map.

#### Tests

- Added `apps/sunracer/test/sunracer/trade_test.exs` (price book, sell, buy,
  refusals leave credits and cargo unchanged, no same-desk arbitrage, input
  validation, snapshot); a kiosk check in
  `green_starbase_docking_integration_test.exs`; channel refusals in
  `world_channel_test.exs`; `station_trade_panel_test.mjs`.
- **Not run here:** `mix test` / `mix precommit`. The session's network
  policy blocked the Hex package registry (`repo.hex.pm`), so project
  dependencies could not be fetched. Instead: every changed Elixir file was
  parsed with Elixir 1.18.4 / OTP 25; `Sunracer.Trade.Market` was compiled
  with the real cargo catalog and its tests passed standalone (and its
  compile-time catalog guard was shown to fail the build on a mismatch);
  `Sunracer.Trade` was compiled against in-memory stand-ins for Ecto, Repo
  and Inventory and its sell/buy/rollback flow tests passed. All browser JS
  and Tauri tests pass under Node 22. `mix test` must be run before merging.

### Virtual-joystick mouse steering and SBS headset smoothing (2026-11-22, branch `story_line`)

#### Changed

- Mouse steering is now a full-screen virtual joystick
  (`mouse_steering.mjs`). Mouse movement moves a persistent stick
  deflection: screen centre is neutral, the screen edges are full yaw/pitch,
  with a 5% dead zone and a 1.5 response curve. The deflection holds until the
  pilot moves back to centre (F, Esc, Atlas and capture loss recentre it).
  This replaces the idle-timer rate steering, whose guesses at "the hand
  stopped" from pointer-event gaps caused stop/turn pulses (jank) on
  WebKitGTK. The idle timer, `expire()`, intent window and jitter heuristics
  are removed.
- Sensitivity now means steering-line travel per mouse pixel (1.0 = 1:1),
  stored under a new key, `sunracer:mouse-stick-sensitivity:<id>`.
- The headset (SBS) own-ship view now keeps rotating at the laptop camera's
  body rates (and moving at the ship's velocity) between LAN visual poses,
  and blends each new pose's small error out with the existing
  `OwnShipCameraReconciler` (`headset_pose_prediction.mjs`). Previously it
  chased each ~32 ms pose with a 25 ms settle, which juddered the stars and
  scenery while turning (the cockpit is ship-fixed, so it did not show).

#### Added

- A faint steering line from the crosshair to the stick deflection on the
  laptop (SVG overlay, `#mouse-steering-vector`).
- The same line in the headset: a ship-fixed tube in the cockpit frame from
  the nose to the laptop stick's world direction, with a dot at the tip.
- LAN visual pose fields `steering` {x, y, aspect} and `rates`
  {yaw, pitch, roll} (rad/s), validated in `sbs_relay_world.mjs`,
  `local_visual_pose.mjs` and the Rust relay allowlist
  (`sanitized_visual_pose`). Phoenix never receives either.
- Diagnostics: the headset shows `STICK LINE: <state>` (NO LAN RELAY,
  NO LAPTOP POSE, LAPTOP NOT SENDING STICK, OK); the laptop steering status
  appends SBS STICK SENT / NOT SENT / HEADSET NOT RENDERING.

#### Fixed

- Headset view shimmered constantly, even with the head still: raw phone
  orientation events (sub-degree sensor noise, out of step with the display)
  were applied directly. `HelmetHeadTracking.rotation(time)` now runs a
  One-Euro filter (`HeadPoseFilter`: 1.0 Hz min cutoff, beta 0.05, 1.0 Hz
  derivative cutoff), reset on recenter. Simulated +/-0.5 deg noise:
  frame-to-frame shimmer ~0.9 deg raw -> ~0.18 deg; a 90 deg/s head turn
  lags ~2.6 deg. `rawRotation()` keeps the unfiltered pose.
- Headset jitter while mouse-steering (stopped by Esc): the headset
  extrapolated each LAN pose from its ARRIVAL time, but poses are sent 0-30
  ms after being sampled (publisher coalescing) plus Wi-Fi delay, so every
  pose landed a different amount ahead or behind during a turn. The laptop
  now stamps each pose with its sample time (`t`, laptop clock; passed by
  the Rust allowlist); the headset estimates the laptop->phone clock offset
  as the minimum observed delay over ~3 s (`ClockOffsetEstimator`) and
  extrapolates from the true sample time. Simulated 60 deg/s turn with
  0-32 ms publisher + 0-30 ms Wi-Fi delay: worst per-frame step deviation
  ~0.30 deg (arrival-based) -> ~0.06 deg.
- Headset jitter that grew the longer the mouse stayed captured (Esc and
  recapture reset it): the laptop's client-led camera and Phoenix integrate
  the same commands at different times and nothing pulled them back
  together, so they drifted apart without bound. Whenever a LAN pose was
  briefly late, the headset fell back to the (drifted-away) server
  orientation and snapped back. Fixes: `ClientLedMouseCamera.correctToward`
  pulls the local camera toward the server orientation replayed to now
  (`predictOrientation`) with a 1.5 s time constant (simulated persistent
  0.02 deg/frame mismatch: 36 deg drift after 30 s uncorrected, under 2 deg
  corrected, no per-frame step larger than the mismatch itself); and the
  headset keeps the last laptop pose for up to 500 ms
  (`VISUAL_POSE_MAX_AGE_MS`, was 150) instead of snapping to the server.
- Slight headset jitter on keyboard (WASD) turns: outside the client-led
  mouse camera the laptop relayed the server's last-tick angular velocity,
  which is stale while a key turn ramps up or down (95 deg/s^2), so the
  headset extrapolated at the wrong rate and was corrected every pose.
  `predictOrientation` can now report its final body rates (`ratesOut`);
  the laptop relays those predicted rates (used only while fresh, <100 ms).
- A world update without a visual pose could replace a pending LAN frame and
  strip the cockpit pose; the publisher now carries the latest pose forward
  for up to 100 ms on the same map.

#### Tests

- Browser JS: all `assets/js/game/*_test.mjs` files pass under Node 22
  (the three `three`-dependent model tests were run with `three@0.187.0`
  installed temporarily). New: `headset_pose_prediction_test.mjs`, including
  a jittery-Wi-Fi simulation of a steady 60 deg/s turn at 60 fps: the largest
  deviation of the per-frame rotation step fell from 0.75 deg (old chase) to
  0.11 deg. Rewritten `mouse_steering_test.mjs`, plus an end-to-end test from
  laptop stick to headset line tip through a JSON round trip.
- Tauri `tests/*.test.mjs` pass. The Rust `sanitized_visual_pose` and its test
  were compiled and run in a standalone crate with `serde_json`; the full
  Tauri crate was not built (no GTK/WebKit libraries in that environment).
- No Elixir code was changed in this entry, and `mix precommit` / `mix test`
  were not run (no Elixir toolchain in that environment).

#### Known limitations and manual verification

- The user reported the joystick feels right on the laptop and asked for the
  headset jitter to be fixed next. The headset jitter fix has not been
  manually verified on the S21; nor has the headset line's visibility.
- The `STICK LINE` headset label is a temporary diagnostic; its second line
  shows headset FPS, the share of frames over 25 ms, and the head-sensor
  event rate, to separate dropped frames from sensor noise.
- The user reports the headset is still jittery "all the time, even fully
  still" after the LAN pose prediction; the head filter targets that and has
  not yet been verified on the S21.

### Gaze icon for the flight mode switch (2026-11-21, branch `story_line`)

#### Added

- A cruise/Newtonian icon in the headset cockpit, selected by the usual gaze
  dwell. Prologue step 6 now requires Newtonian flight and tells the pilot to
  press Ctrl+E, which is close to impossible to find blind in an HMD; this
  makes the switch reachable without changing mouse or keyboard control at all.
- The icon's label comes from `flight_mode` in the authoritative world
  snapshot, not from a local guess, so it cannot drift from the real ship. It
  names the current mode first and the consequence second ("CRUISE / CUT
  ASSIST"), and disarms itself until the world confirms the change.
- `FlightControls.toggleMode/0`, now the single place the mode flips, shared by
  the Ctrl+E chord and the icon so the two routes cannot drift apart.

#### Architecture

- The headset still never sends a flight control. The icon relays a **named
  intent** over `helmet_action`; `HelmetManager.gaze_action/2` checks it
  against an allowlist of exactly one action and only while the pilot is in
  the cockpit, then broadcasts to `helmet:control:<player_id>`; the pilot's own
  laptop receives it and applies it through the same `FlightControls` the
  keyboard drives. The cockpit remains the only flight commander, so this is
  not a fourth exception to the channel's read-only rule — it issues nothing.

#### Tests

- Browser JS 424 passing: 6 new in `helmet_mode_icon_test.mjs` and an
  integration case tracing the whole relay from gaze target to allowlist to
  the laptop applying it. Tauri 42, `apps/core` 302, Prologue 14.
- Two guards added earlier in this branch asserted the gaze candidate array
  as an exact literal and broke on each new conditional target. They now
  assert the resting pair plus any conditional spreads, along with each
  target's armed guard, so the read-only intent is enforced without breaking
  on the next addition.

#### Known limitations

- `apps/sunracer_web` still cannot be compiled here (no hex.pm access), so the
  channel handler and `HelmetManager.gaze_action/2` were parse-checked and
  text-asserted, never run.
- No testing in a headset.

### Gaze-reachable death recovery and surrender choice in the headset (2026-11-21, branch `story_line`)

#### Added

- A pilot whose ship is destroyed while wearing an HMD now sees a centred
  cockpit panel reading SHIP DESTROYED and a RECOVER AT EARTH target selected
  by the existing gaze dwell (1 s to arm, 800 ms to confirm). Previously the
  headset had no death handling of any kind: the respawn panel and button
  existed only in the laptop client, so a pilot who died in the headset was
  stranded with no way back that did not involve finding a keyboard blind.
- `helmet_respawn_view.mjs` derives the panel from the world snapshot and the
  in-flight request state, so the wording and the armed/disarmed logic are
  unit-testable without a WebGL context.
- A surrendered captain now raises a cockpit prompt in the headset with three
  gaze targets: RELEASE, SEIZE HOLD and KEEP FIRING. The headset already
  received pilot-scoped surrender state but could do nothing with it, so an HMD
  pilot could neither accept a surrender nor take a hold — which also made
  prologue step 6 impossible to complete in a headset, since it instructs the
  pilot to do both.
- `helmet_surrender_choice.mjs` derives that prompt, with KEEP FIRING resolved
  entirely locally so declining never reaches the server.
- `Sunracer.World.settle_surrender_for_player/2` resolves the encounter from
  the pilot's own live session, because a headset is never given an encounter
  id to send back.
- `SunracerWeb.HelmetChannel` accepts three world-mutating messages: `respawn`,
  `solar_accept_surrender` and `solar_seize_cargo`.

#### Changed

- While the wreck panel is up it is the **only** gaze-selectable surface. The
  nav switch and HUD panel are hidden and excluded from the raycast, so a pilot
  who has just died cannot open the nav panel by looking slightly off-centre.
- The target disarms itself while a request is in flight and `requestRespawn`
  guards on it, so a held gaze cannot fire two recoveries.
- A refusal re-arms the target and names the reason on the panel rather than
  failing silently, which is the only feedback channel a headset pilot has.

#### Security

- The surrender handlers take **no payload at all**: the phone names no
  encounter, ship, cargo or target. The encounter is resolved server-side from
  the authenticated `helmet_player_id`, and `Core.World.MapServer` refuses a
  `:surrender` outcome with `:enemy_not_surrendered` unless the opponent has
  genuinely yielded, so a forged or mistimed message settles nothing. Seizing
  cargo stays a separate, deliberate choice exactly as it is on the laptop.
- The surrender prompt is additive rather than exclusive — the pilot is still
  flying — and sits below the sight line so tracking a target cannot dwell on
  it by accident. A wreck outranks it: dying closes the prompt.
- The `respawn` handler is deliberately not a ship command and is scoped to an
  authenticated `:viewer`. It accepts nothing from the phone — no coordinates,
  ship, map or player id — resolving the session from `helmet_player_id` via
  `SessionManager.fetch_player/2`. `Sunracer.World.respawn/1` then re-verifies
  destruction against the map, so a pilot with an intact hull is refused. The
  only reachable outcome is an Earth-orbit restore of the pilot's own ship.
  The channel moduledoc records this as the single documented exception to its
  read-only rule.

#### Tests

- Browser JS suite 417 passing: 7 new in `helmet_respawn_view_test.mjs`, 7 new
  in `helmet_surrender_choice_test.mjs`, and 2 new integration cases covering
  the gaze candidate rules, the client wiring and the server scoping for both
  features. Tauri 42, `apps/core` 302, `Sunracer.Story.Prologue` 14, unchanged.
- One existing guard was updated rather than worked around: it asserted the
  resting gaze set was exactly `[navSwitch, hudPanel]`, which the surrender
  buttons extend. It now asserts the resting set plus the conditional spread,
  so the read-only intent is still guarded.

#### Known limitations

- **`apps/sunracer_web` was not compiled.** This environment cannot reach
  hex.pm for Phoenix, so the new channel handler was verified by parsing only
  (`Code.string_to_quoted/1`) and by asserting its text from the JS integration
  test. `session.id` and `SessionManager.fetch_player/2` were read from
  `Core.World.SessionManager`, which does compile here, but the handler itself
  has never been run. Run `mix precommit` before trusting it.
- No manual verification in an actual headset.

### Newtonian flight given weight; cruise handbrake removed (2026-11-21, branch `story_line`)

#### Changed

- `Core.World.FlightDynamics` now derives acceleration from the hull's
  `acceleration_g` rather than hardcoding multiples of top speed. One constant,
  `@g_acceleration`, scales g ratings into simulation units and so sets the
  weight of every ship in the game. For the Sunracer this is 64 u/s^2 against
  the previous 480 (Newtonian) and 240 (cruise).
- Both flight modes now share one envelope. The Newtonian ceiling drops from
  `speed * 1.5` to `speed * 1.0`, so cruise and Newtonian have the same top
  speed and the same acceleration. Cruise is flight assistance on the same
  engine, not a weaker drive; what Newtonian buys is control, not performance.
- `reverse_factor` is new game data on `Core.Ships.Ship`, 0.33 on the Sunracer,
  applied to negative throttle in cruise only. Full reverse is -105.6 instead
  of -320. Newtonian flight is deliberately not capped: velocity and facing are
  independent there, so a pilot who turns around and burns is thrusting
  forward, and there is no reverse to limit.
- Slowing down now uses the same thrust as speeding up, replacing a separate
  and much larger braking constant. A full stop from top speed takes 5.0 s
  rather than 0.83 s.

#### Fixed

- Switching from Newtonian to cruise no longer deletes lateral momentum. It
  kept `dot(velocity, forward)` and discarded the remainder instantly, so a
  pilot drifting at full speed with the nose across the vector could cancel 320
  units/s in a single tick, for free, with one keypress — a combat exploit that
  made momentum optional. `Core.World.Entity` now carries `drift_velocity`, the
  momentum the assist has not yet cancelled, and the controller bleeds it off
  at the drive's thrust. The same 320 units/s now takes 5.1 s to shed.

#### Why

- At 480 u/s^2 the velocity vector swings at 86 deg/s under perpendicular
  thrust while the nose can only point at 44 deg/s. Momentum therefore never
  lagged behind pointing, and Newtonian flight was functionally identical to
  cruise. At 64 u/s^2 the vector swings at 11.4 deg/s, the nose leads it 3.9x,
  and committing to a vector becomes a real decision.
- Derivations, measurements and the remaining open numbers are in
  `docs/flight-combat-balance.md`.

#### Tests

- `mix test` in `apps/core`: 302 tests, 0 failures. Four new
  `Core.World.FlightDynamicsTest` cases cover envelope parity, the cruise
  reverse cap, the drift bleed-off, and the nose leading the velocity vector.
- Three existing tests were updated because they asserted the old behaviour:
  two hardcoded the former acceleration constants, and one asserted
  `velocity.y == 0.0` after a mode switch, which was the handbrake itself. A
  planetary impact test now ticks until the hull reaches the boundary instead
  of assuming a standing start crosses 4 units in one tick.
- `mix compile --warnings-as-errors` is clean.

#### Known limitations

- `apps/sunracer` and `apps/sunracer_web` were not compiled or tested: the
  environment could not reach hex.pm for Phoenix and Ecto. All edits are inside
  `apps/core` and every outside consumer reads `Core.Ships.Stats` through
  `Stats.calculate/2` rather than matching the struct exhaustively, so the
  added fields should be additive — but run `mix precommit` at the umbrella
  root to confirm.
- `mix format --check-formatted` was not run. The pre-existing tree fails it
  under Elixir 1.17.3 on files untouched here, which indicates a formatter
  version difference rather than a finding.
- **No manual verification.** Every figure above is from simulation, not from
  flying the ship. A 5 s acceleration and a 5 s stop need a cockpit to judge.
- Prologue step 6 still teaches the old static band hold, which this change
  makes much harder than its prompt implies. The Dart's speed and the step
  re-tune are still open.

### SunRacer rename completed across docs, CI, scripts and config (2026-11-21, branch `story_line`)

#### Changed

- Removed the last 163 Space Nova references in 40 files. Renamed 6 workflow
  files (`.github/workflows/sunracer-*.yml`), 6 docs (`docs/sunracer-*.md`) and
  5 scripts; `scripts/sunracer` and `scripts/sunracer-tunnel` are now the real
  scripts rather than wrappers delegating to `scripts/space-nova`.
- `scripts/sunracer-version.py` renamed from `space-nova-version.py`, which
  fixes `scripts/sunracer`: it already called the new name, so version, release
  and deploy commands were broken against the missing file.
- Production host is now `sunracer.ddns.net` (`config/prod.exs`, the
  `PHX_HOST` default in `config/runtime.exs`, registration email resend link,
  Tauri launcher defaults, SBS relay probe and docs).
- All `SPACE_NOVA_*` environment variables renamed to `SUNRACER_*` with no
  fallback to the old names.
- `window.spaceNovaBandwidth` renamed to `window.sunRacerBandwidth`.
- Atlas HUD branding guard now asserts the markup does not contain the old
  name, rather than asserting against the new name it also requires.

#### Verification

- Ran `node --test` in `apps/sunracer_web/assets` (401 pass, 0 fail) and in
  `clients/tauri` (42 pass, 0 fail), and `pytest scripts/test_sunracer_*.py`
  (7 pass).
- `mix precommit`, `mix test` and `mix assets.deploy` were NOT run: no Elixir
  toolchain in the environment used for this change. Elixir edits were limited
  to `config/prod.exs`, `config/runtime.exs` and one URL string in
  `registration_email.ex`; no module names changed.
- Not performed: DNS for `sunracer.ddns.net`, EC2 systemd environment rename,
  local deploy shell environment rename, TLS certificate for the new host.

### Player beam range synced with NPC weapons (2026-11-21, branch `story_line`)

#### Changed

- Player beam range (manual twin beams and lock-on) drops from 3,600 to
  540 world units (`Core.Combat.player_attack_range/0`). NPC lasers reach
  420 (Dart) and 380 (Scow), so there is a narrow band where a pilot hits
  without being hit back, and beyond 540 the beam no longer reaches. At 540
  units the 40-unit NPC hit sphere spans about 8.5 degrees in the sight;
  at 3,600 it was about 1.3 degrees.
- On a miss the wing beams now converge on the sight line at 540 units.
- Story step 6 prompt teaches the band: reverse throttle, keep Corsair-17
  between 420 and 540.

#### Why

- Simulated against the real map server with the staged Corsair-17 and a
  fresh Sunracer (sight on target, every shot hitting): standing still,
  the pilot is destroyed at 10.2 s with Corsair-17 on 185/245 hull. Backing
  off in cruise mode to hold 450-520 units, Corsair-17 surrenders at 16.9 s
  and the pilot takes no damage. The Sunracer reverses at up to 320 u/s;
  the Dart pursues at 210, so the band can be held by flying.

#### Verification

- New test: every NPC weapon is outranged by the player beam by more than
  0 and at most 200 units. Updated: the long-range hit test (now 500 units,
  inside the band) and the dual-laser test (aims the eye sight, not ship
  centre; it previously passed only because beams converged at 3,600).
- `mix test` core 298 / sunracer 82 / sunracer_web 96, 0 failures;
  `npm test` 400 pass. The simulations were run as throwaway tests and not
  committed.
- Manual verification: none. The band has not been flown in the cockpit.

### Story prologue "First Run": playable prologue (2026-11-21, branch `story_line`)

#### Added

- `Sunracer.Story` and the pure engine `Sunracer.Story.Prologue`: the
  nine-step prologue from `docs/story-first-run.md`. Steps advance only from
  server-confirmed events (flight commands the map accepted, Navigation
  snapshots, hails, encounter resolution, tactical start and settlement,
  MapServer docking, validated station dialogue) under a `story_progress`
  row lock; replays and reconnects never double-count.
- Migration `create_story_progress`: `story_progress` (per pilot and
  chapter) and `story_rewards` (once-only payout receipts).
- Consignment of 3 medical-supply crates (accepted from the comms card),
  removed on delivery at Mars; 500 credits, the Helios courier license flag
  and +5 Helios Courier Cooperative standing paid exactly once.
- `Core.Universe.StoryTraffic` and `Navigation.stage_story_contact/3`,
  `clear_story_contacts/2`: private per-pilot story vessels. Vesper-02
  (hailable, protected from attack) and Corsair-17 (hostile, surrenders at
  50% hull through a new `surrender_at` NPC doctrine). They never enter
  shared traffic; other pilots cannot see, hail or attack them, and their
  tactical map actor carries `private_to`, which the world and helmet
  channels use to strip it from every other pilot's stream.
- `ShipCondition.story_patch/2` and `MapServer.station_patch_hull/4`: the
  scripted field patch at Mara Venn's bench (step 8).
- Story topics for Mara Venn, Juno Rook and Eno Kade, added to the normal
  station dialogue list; MapServer still validates room and distance first.
- Cockpit comms card (`#story-comms`, `story_hud.mjs`) with step, speaker,
  objective, checklist, the offered action, skip and resume; the objective
  is drawn in the stereo HUD on the laptop SBS view and the phone headset.
- Channel API: `story` in the world join reply, `story_updated` pushes,
  `story_action` (`accept_consignment`, `skip`, `resume`), `helmet_story`.

#### Changed

- Design change: the consignment is 3 crates, not 6. The Sunracer's hold is
  4 t, so six 1 t crates could never be loaded; three leave room for one
  seized crate from Corsair-17.

#### Failure rules as built

- Death: normal respawn at Earth; the step is kept.
- Rescue lost (resume past the distress call, retreat, defeat, escape, or
  destroying Corsair-17 instead of accepting its surrender): back to step 5;
  the distress call returns on a later voyage past the Green Starbase.
- Crates missing at Mars: step 9 waits; Helios at Earth reissues the
  consignment once (provisional, prevents a soft lock; awaiting Brad).

#### Verification

- Automated, run in this session from the umbrella root with the full
  dependency set: `mix test` core 297 / sunracer 82 / sunracer_web 96,
  0 failures; `npm test` 400 pass; `mix compile --warnings-as-errors` clean;
  esbuild bundle of `app.js` and `native_game.js` builds.
- Tests added: `story_traffic_navigation_test.exs` (6), staged Corsair
  surrender in `world_test.exs`, hull patch in
  `green_starbase_docking_integration_test.exs`, `prologue_test.exs` (13),
  `story_test.exs` (5, full prologue with payout and replay),
  a channel play-through of steps 1 to 6 plus a lost rescue in
  `world_channel_test.exs`, private-actor stripping in
  `world_stream_policy_test.exs`, `story_hud_test.mjs` (7).
- `mix format --check-formatted` still fails on 118 files that were
  unformatted before this work; the new files are formatted, existing files
  were not reformatted, so `mix precommit` stops at that step.
- Known flaky test, present before this work (3 of 15 baseline runs):
  "authenticated pilot freely switches from AI cruise to deep-space cockpit
  and back" asserts on the Registry right after the map process exits.
- Manual verification: none. The prologue has not been played in the
  laptop cockpit or headset yet.

### Story prologue design: "First Run" (2026-11-21)

#### Added

- `docs/story-first-run.md`: design for an original Solar System storyline
  whose prologue is the new-pilot tutorial. Covers principles (server-verified
  steps, one prompt at a time, skippable), setting, cast, the nine-step
  prologue with the server trigger for each step, failure rules, the Chapter 1
  "Leaked Routes" hook, the systems still to build, and decisions made so far.
- ROADMAP milestone tracking the build.

#### Verification

- Documentation only; no code or tests changed.

### Manual lasers converge on the central sight (2026-11-21)

#### Fixed

- Manual wing lasers fired parallel to the nose from the wing muzzles,
  about 24 world units below the pilot's eye line, but the cockpit camera
  (and the central sight) sits 2.75 scene units above ship centre. A target
  centred in the sight was hit only by a ~2 unit margin of the 40-unit hit
  sphere; drifting ~4 units upward (under half a degree at combat range)
  missed with both beams, so shooting felt like it did nothing.
- `LineOfFire.trace_pair/4` now traces the sight line (pilot eye along the
  nose, server-owned `eye_position/2`) and converges both wing beams on its
  impact point, or on the sight line at maximum range on a miss. Each wing
  still traces its own muzzle-to-aim segment, so a ship physically in the
  way takes that wing's hit. Range, cooldown and damage are unchanged; no
  client ray or target is trusted.

#### Verification

- `line_of_fire_test.exs`: 12/12 pass, run standalone against the real
  `Combat`, `Orientation`, `FlightDynamics` and `LineOfFire` modules. Tests
  updated to place "centred" targets on the real eye line; added coverage
  for the hit zone around the sight (+/-20 units), eye position under roll,
  and a ship blocking one wing.
- Full `mix test` not run (the sandbox cannot reach hex.pm). Not verified in
  game yet.

### Green Starbase launch faced back into the hangar (2026-11-21)

#### Fixed

- Launching from the Green Starbase placed the ship 350 km in front of the
  bay mouth but with `launch_attitude` yaw pi, which points south, back into
  the hangar. Full throttle flew through the open bay and hit the solid rear
  wall after about 4 s; the swept collision then set throttle, speed and
  velocity to 0 and applied impact damage ("accelerates, then drops to 0").
  Launch now faces out of the bay (yaw 0, north).

#### Verification

- New regression test in `green_starbase_docking_test.exs` steps the real
  `FlightDynamics` at full throttle from the launch pose for 10 s and asserts
  no hull contact. Run standalone against the real world modules (with
  `Core.Universe.Sol` and `Core.Combat` stubbed): 4/4 pass with the fix; on
  the old code the new test fails at `:hangar_rear_wall`.
- Full `mix test` not run (the sandbox cannot reach hex.pm).
- Not verified in game yet.

### HMD: stop the "HEAD TRACKING UNAVAILABLE" flash in the cockpit (2026-11-21)

#### Fixed

- The in-cockpit "HEAD TRACKING UNAVAILABLE" panel no longer pops up while
  head tracking is working. Two causes:
  - A 2-second staleness timeout treated a quiet sensor as lost tracking.
    Browsers only fire `deviceorientation` when the angle changes, so
    holding the head still for 2 s flashed the panel and snapped the view to
    straight ahead until the next small movement. The last pose is now held.
  - Every recenter (screen tap, gaze RECENTER, entering VR, orientation
    change) returned no pose until the next sensor event, with the same
    flash. The view now looks straight ahead while the recenter waits for
    its fresh sample.
- The panel now follows the sensor status only: permission denied,
  unsupported browser, or HTTPS required.

#### Verification

- Browser JavaScript suite: 393 tests pass (head-tracking and gaze
  integration tests updated for the held-pose rules; one test added).
- Not verified on the headset yet.

### Pilot HMD smoothing and comfort fixes; predicted mouse look (2026-11-20)

#### Fixed

- Headset entities are smoothed between world updates (Phoenix ~10 Hz, LAN
  relay ~16 Hz) with the same presentation smoothing the laptop uses
  (`entity_smoothing.mjs`). Previously each update replaced every entity and
  the headset camera stepped at the update rate. Fresh snapshots, resyncs,
  map changes and jumps over 1,500 world units snap instead of sweeping.
- The headset render loop holds a single animation-frame request
  (`frame_scheduler.mjs`). A frame queued before the page was hidden used to
  resume alongside the new loop after wake, adding another full stereo render
  per vsync on every screen sleep/wake.
- `/helmet` sets `viewport-fit=cover` (that page only), so Android no longer
  letterboxes the camera cutout in landscape fullscreen; the canvas was
  narrower than the screen and both eye centres sat off the lenses.
- Planetary proximity warnings now reach the headset HUD (computed from the
  world map the phone already receives).
- Encounter holds and surrender offers are drawn only in the stereo cockpit
  HUD; the flat 50/50 DOM cards ignored lens calibration.
- Laser beams reuse pooled meshes over shared unit geometry instead of
  allocating and disposing geometry/materials every frame.
- SBS pointer picking follows the calibrated eye gap.

#### Changed

- SBS eye cameras are parallel (`camera.focus` effectively infinite); lens
  alignment is left to the calibrated centre gap.
- The sight ring is drawn at the depth of what it points at: the cockpit
  control under the head-gaze, otherwise 60 units ahead (same angular size).
- Headset render resolution cap 2.0 (was 1.5); override with localStorage
  `sunracer:pilot_hmd_max_dpr` (1-3). Laptop cap unchanged.
- First-run centre gap -48 CSS px (was +8). Saved calibration unchanged.
- Laptop manual flight: the own ship's orientation and position are predicted
  between server ticks by running the server's turn rules
  (`FlightDynamics.advance_angular_rate`, keyboard and mouse profiles) forward
  from the last authoritative update while replaying the pilot's recorded
  input (`own_ship_prediction.mjs`, capped at 200 ms). Each update restarts
  the prediction; a 45 ms settle absorbs the correction. The existing mouse
  steering filter (`f021007`) is unchanged. Presentation only.

#### Added

- Optional lens distortion correction (beta, off by default): a checkbox on
  the headset setup screen enables a per-eye barrel pre-distortion pass
  centred on the calibrated lens centre. Defaults k1=0.10, k2=0.05; override
  with localStorage `sunracer:pilot_hmd_lens_k` ("k1,k2").

#### Not changed

- Strategic fly-by contacts are still not sent to the headset: the viewer
  channel deliberately withholds contact identities and route state.

#### Verification

- Browser JavaScript suite: 392 tests pass (366 before; 26 added in
  `entity_smoothing_test`, `frame_scheduler_test`, `helmet_display_test`,
  `lens_distortion_test`, `own_ship_prediction_test`, `stereo_math_test`).
- esbuild bundles `js/app.js`.
- Added an ExUnit test (`/helmet` uses `viewport-fit=cover`, `/` does not);
  Elixir suites were **not run** (the sandbox could not reach hex.pm). Changed
  Elixir files were syntax-parsed only.
- No device, headset or browser manual verification has been performed. The
  lens distortion pass has not run on real WebGL hardware.
- `own_ship_prediction.mjs` mirrors `@turn_limits`/`@mouse_turn_limits` in
  `flight_dynamics.ex`; change both together.

### Repository-generated artifact cleanup (2026-11-06)

#### Removed

- Removed five accidental zero-byte command-token files from the Phoenix asset
  project: `FETCH_HEAD`, `core`, `sunracer`, `node`, and `test`.
- Removed the empty root `package-lock.json`; the umbrella root has no
  `package.json`, while the Phoenix asset and Tauri npm lockfiles remain at
  their actual package roots.
- Removed 31 tracked `phx.digest` outputs: 11 fingerprinted copies and 20 gzip
  copies. The 11 undigested static inputs, including every original game SVG,
  remain tracked.
- Added precise ignore rules for the removed root/asset-token files and for
  Phoenix gzip and 32-hex fingerprint output. Existing compiled asset-directory
  and cache-manifest rules remain in force.

#### Verification

- Before removal, `mix assets.deploy` regenerated all 31 tracked digest files
  byte-for-byte; SHA-256 checks passed for every file.
- `MIX_ENV=test mix compile --warnings-as-errors` and `mix assets.build` pass.
- `mix test` passes 358 tests: 238 Core, 48 persistence, and 72 web tests. It
  reports only the existing signed-zero pattern warnings in `sol_test.exs` and
  `world_channel_test.exs`.
- The Phoenix browser suite passes 253 JavaScript tests; the Tauri launcher
  suite passes 12 JavaScript tests. The browser suite retains its existing
  Node module-type warning.
- The local unsigned Tauri Linux release build passes and produces the Debian
  and AppImage bundles only under the ignored `src-tauri/target/` tree.
- `git diff --check` passes. No automated tests were added because this change
  alters repository hygiene only.
- `mix precommit` passes strict compilation and the unused-dependency check,
  then stops at `mix format --check-formatted` on existing repository-wide
  Elixir 1.20 RC formatter drift. No formatter output was applied, and its
  embedded test step was not reached; the full suite was run separately.

#### Manual verification and limitations

- No browser, headset, installer-launch, or signed-release manual verification
  was performed. The signed release workflow requires publishing secrets and
  explicit operator authorization and was not invoked.
- The audited Tauri workflows keep Node, generated bindings, Rust targets, and
  packaged output ignored, but still use `npm install` rather than the stricter
  lockfile-only `npm ci`; changing release dependency policy remains separate.

### Scow defensive combat repair (2026-11-06)

#### Fixed

- Preserved the server-owned NPC firing origin selected by `Core.NPC.AI`
  through `Core.World.MapServer` attack resolution. Merchant cruise or evasive
  movement later in the same tick can no longer move an otherwise valid
  Garnet shot out of range and cause `resolve_npc_attack/2` to discard it.
- Kept the resolution-time checks for current alive state, legal target,
  cooldown, damage, and range. The correction does not extend the Scow's
  380-unit weapon reach or let a merchant pursue a pilot.
- Changed Scow tactical placement to prefer a direction-aware 340-unit
  separation, inside the defensive turret envelope, while retaining the
  existing 520-unit front/side/rear candidates as safe fallbacks when map or
  planetary collision exclusions reject the preferred positions.

#### Tests

- Added a failing-before-fix full-MapServer regression in which a confirmed
  hit provokes an evasive Scow at valid range; its same-tick movement
  previously left the player at 300 hull instead of applying 10 damage.
- Extended world coverage for neutral non-aggression, confirmed provocation,
  authoritative `:laser_fired` publication, exact player damage, Scow
  cooldown cadence, out-of-range rejection, cruise/evasive movement,
  surrendered/destroyed actors, and two-pilot tactical target isolation.
- `mix test apps/core/test/core/npc/ai_test.exs` passes 4 tests and
  `mix test apps/core/test/core/world/world_test.exs` passes 45 tests.
- `mix test` passes 358 tests: 238 Core, 48 persistence, and 72 web tests.
  It reports only the existing signed-zero pattern warnings in `sol_test.exs`
  and `world_channel_test.exs`.
- `mix compile --warnings-as-errors` passes. The modified-file formatting
  check and `mix precommit` stop at `mix format --check-formatted` because the
  installed Elixir 1.20 RC formatter rewrites these pre-existing files and many
  untouched repository files. The unrelated formatter output was not applied;
  `mix precommit` therefore did not reach its embedded test step.

#### Manual verification

- Manual browser and SBS/headset combat verification was not performed.

### Milestone A — Persistent player domains

- Added account registration, authentication, inventory, fleet, two ship loadouts, preferences, titles, and starter-state provisioning.
- Added catalog-aware equipment and ship ownership operations.

### Milestone B — Persistent-state hardening

- Made registration and equipment replacement atomic, ownership scoped, and constraint backed.
- Added row locking and concurrent mutation tests to prevent inventory and loadout duplication.

### Milestone C — Ship stats and authoritative world

- Added configurable ship/equipment catalogs and pure derived ship statistics.
- Added the supervised `1-1` map, in-memory player sessions, server-owned bounded movement, deterministic ticks, and transport-neutral world events.

### Milestone D — Authenticated browser flight

- Added credential login, short-lived signed socket authentication, and the authenticated world channel.
- Added the Canvas 2D sector client, original placeholder art, HUD telemetry, authoritative interpolation, movement synchronization, and disconnect cleanup.
- Added `demo_pilot` and `wing_pilot` development accounts for browser testing.

### Milestone D.1 — Continuous mouse navigation

#### Added

- Added classic click-and-hold canvas navigation: the ship continuously retargets toward the held pointer at a throttled cadence, including while the camera moves beneath a stationary cursor.
- Added pointer-capture lifecycle handling for release, cancellation, lost capture, window blur, and document visibility changes.
- Added focused JavaScript tests for click navigation, throttling, camera-aware retargeting, redundant-command suppression, the near-ship dead zone, and cancellation safety.

#### Preserved

- Movement remains server-authoritative: the browser sends destinations only, while the world simulation continues to validate map boundaries and own ship positions and speeds.

#### Verification

- Graphical ship flight and continuous mouse navigation were manually verified.
- Two-player synchronization is covered by automated channel tests and awaits manual verification in two browser sessions.

### Milestone E — Server-authoritative NPC combat

#### Added

- Added the configurable original `Rift Skirmisher` NPC definition with deterministic sector `1-1` spawns and provisional combat, movement, patrol, and respawn values.
- Added pure deterministic combat mechanics for legal targets, range, tick-based cooldowns, non-negative damage, shield absorption, hull damage, and destruction.
- Added pure `idle`, `patrol`, `pursue`, `attack`, and `destroyed` NPC decisions with deterministic local patrol routes.
- Extended the map process with world-owned NPC state, AI ticks, player and NPC health, selected targets, laser attacks, NPC removal, and tick-based respawning.
- Added authenticated `select_target`, `clear_target`, and `laser_attack` channel intentions plus authoritative targeting, NPC-state, damage, destruction, and spawn events.
- Added a catalog-defined Phoenix pulse emitter so existing pilots have combat damage without login-time inventory mutation.
- Added right-click and nearest-hostile targeting, target hull/shield telemetry, a Space/click fire control, NPC labels and indicators, animated beams, shield/hull impacts, explosions, and server-driven HUD health.
- Added focused Core, world, channel, concurrency, disconnect, and JavaScript targeting/combat tests while preserving the navigation suite.

#### Verification

- `mix compile --warnings-as-errors`, `mix test`, `mix precommit`, `mix assets.build`, the JavaScript test command, and `git diff --check` pass.
- The Elixir suite has 78 passing tests with no failures: 32 Core, 30 persistence, and 16 web/channel tests.
- The JavaScript suite has 16 passing tests with no failures, including all Milestone D.1 pointer-navigation regressions.

#### Limitations

- The complete browser combat encounter and two-browser observation flow have not yet been manually verified.
- Destroyed players do not respawn; ammunition, rewards, loot, PvP, spatial partitioning, multi-node ownership, and live-state recovery remain out of scope.
- Initial NPC and weapon values are provisional balancing data.

### Milestone E.1 — Classic combat controls, persistent target lock, and action hotbar

#### Added

- Added authoritative `engaged_target_id` state alongside selected `target_id`, plus explicit combat engage, disengage, and structured hotbar-action commands.
- Added a server-defined ten-slot action catalog. Slot 1 contains the existing Phoenix pulse emitter; slots 2 through 0 are safe empty placeholders and do not mutate inventory or ammunition.
- Added map-tick automatic player attacks with server-owned range, damage, cooldown, destruction, and validity enforcement. Out-of-range engagement pauses without moving the player and resumes when range becomes valid.
- Added idempotent repeated engagement, automatic target/engagement clearing on invalidation and destruction, preserved movement destinations during combat, and clean respawn/disconnect lifecycle handling.
- Added left-click rendered-NPC hit testing before navigation capture while preserving empty-space single-click and click-and-hold movement. Existing right-click targeting remains available.
- Added replicated combat-facing state and smooth shortest-path ship rotation toward moving engaged targets, independent from navigation direction.
- Added a responsive bottom-center hotbar with number-row and click activation, Space engagement, Esc cancellation, and distinct selected, active, empty, and authoritative-cooldown visuals.
- Added keyboard guards for repeated keys, modifier chords, form controls, buttons, and content-editable fields.

#### Tests

- Added Core coverage for the action catalog, distinct selection/engagement, tick-owned automatic fire, cooldown enforcement, range pause/resume, concurrent movement, cancellation, invalid/repeated actions, automatic destruction, player destruction, disconnect cleanup, and respawn lock clearing.
- Added channel coverage for hotbar definitions, explicit engagement/action commands, empty/invalid slots, repeated engagement, cancellation, and multiplayer state synchronization.
- Added JavaScript coverage for left-click target interception without movement, render-dimension hit testing, slots 1 through 0, input/key-repeat guards, combat-facing precedence, moving targets, navigation-facing restoration, and wrap-safe rotation smoothing.

#### Verification

- `mix compile --warnings-as-errors`, `mix precommit`, `mix assets.build`, and `git diff --check` pass.
- `mix test` passes with 84 tests: 37 Core, 30 persistence, and 17 web/channel tests.
- The JavaScript suite passes 21 tests across 16 top-level cases, including all prior pointer-navigation regressions.
- Manual browser verification confirmed navigation, NPC targeting, persistent laser engagement, combat facing, and circular combat maneuvering.
- Broader two-browser observation remains deferred.

#### Limitations

- Slots 2 through 0 intentionally have no assigned action. Ammunition, rockets, abilities, consumables, and equipment assignment remain future work.
- Destroyed player recovery, rewards, loot, PvP, and persistent/multi-node live world state remain out of scope.

### Milestone E.2.1 — Modular cockpit HUD, movable windows, and persistent layouts

#### Added

- Added a reusable cockpit window manager with unique window IDs, desktop defaults, title-bar-only Pointer Event dragging, pointer capture, focus ordering, viewport clamping, lock/unlock mode, collapse/expand, hide/restore, reset, and keyboard arrow positioning.
- Added versioned, failure-safe local layout persistence namespaced by the non-sensitive numeric player ID. Position, visibility, collapsed state, and HUD lock state survive refreshes; incompatible or malformed data safely falls back to current defaults.
- Converted ship telemetry and authoritative target/combat telemetry into standardized cyan/blue and hostile orange cockpit windows while preserving every existing combat action and health indicator.
- Replaced the minimap painted into the main space canvas with one dedicated, resize-aware, throttled minimap canvas that consumes the same interpolated entity collection and authoritative map boundaries.
- Added a compact cockpit settings surface, window visibility menu, narrow-screen horizontal dock, reduced-motion behavior, and pointer boundaries that prevent cockpit interactions from reaching the navigation canvas.
- Kept the ten-slot action hotbar anchored at bottom center and outside the window manager, preserving number-row, Space, Esc, click, empty-slot, and authoritative cooldown behavior.

#### Tests

- Added JavaScript coverage for unlocked and locked dragging, title-bar capture cleanup, collapse/expand, hide/restore, defaults reset, persistence/restoration, corrupted or unavailable storage, viewport clamping, resize docking, canvas input isolation, keyboard movement, hotbar-key preservation, reduced motion, minimap projection, render throttling, and lifecycle cleanup.
- Extended the authenticated game-page test to verify the per-player layout namespace, exactly three cockpit windows, one minimap canvas, the HUD controls, and the unchanged hotbar surface.

#### Verification

- `mix compile --warnings-as-errors`, `mix test`, `mix precommit`, `mix assets.build`, and `git diff --check` pass.
- `mix test` passes with 84 tests: 37 Core, 30 persistence, and 17 web/channel tests.
- `npm test` passes 38 JavaScript tests across 29 top-level cases, including all existing navigation and combat regressions.
- Manual browser verification of the E.2.1 cockpit has not been performed. The complete layout-editing, persistence, resize, navigation, and combat acceptance flow remains required before graphical sign-off.

#### Limitations

- At the E.2.1 milestone boundary the minimap was display-only; Milestone E.2.2 supersedes that limitation with server-authoritative minimap navigation.
- Layouts are local to one browser profile and are not synchronized through the account database.
- Broader multiplayer validation, multiplayer expansion, recovery, rewards, ammunition, loot, PvP, and persistent or multi-node live world state remain deferred.

### Milestone E.2.2 — Interactive and scalable minimap

#### Added

- Added locked-HUD minimap click and click-and-hold steering through the existing pointer-navigation lifecycle. Minimap gestures project into authoritative map boundaries and submit destination intentions without changing local entity positions, combat state, or server-owned movement rules.
- Added visible minus and plus controls to the minimap header. Each activation changes the floating minimap width by 40 pixels, bounded from 192 to 520 pixels and clamped to the available viewport.
- Persisted the minimap width in the existing version-1, per-player cockpit layout payload. Layouts saved before the width field existed retain all coordinates, visibility, collapse, and lock state while adopting the 272-pixel default.
- Kept size controls interactive while the HUD is locked. The compact horizontal dock continues to own narrow-screen panel sizing while retaining the selected floating width for supported viewports.

#### Tests

- Added JavaScript regression coverage for locked sizing controls, exact 40-pixel steps, rendered width application, automatic persistence and reload restoration, legacy payload compatibility, reset persistence, configured bounds, viewport bounds, and compact-dock behavior.
- Preserved and reran the existing JavaScript navigation and combat regressions, including continuous minimap steering, projection after CSS resize, active-combat isolation, cancellation cleanup, and server-authoritative destination submission.
- Extended the authenticated game-page test to require exactly one visible decrease control and one visible increase control.

#### Verification

- `mix precommit` passes with 84 Elixir tests: 37 Core, 30 persistence, and 17 web/channel tests.
- `npm test` passes 46 JavaScript tests across 37 top-level cases.
- The focused authenticated game-page test passes 3 tests, `mix assets.build` passes, and `git diff --check` passes.
- Manual browser verification was not performed. Minimap sizing, persistence across reload, locked-HUD controls, responsive docking, and click-and-hold steering still require graphical acceptance at the supported viewport sizes.

#### Limitations

- Layout size remains local to one browser profile and is not synchronized through the account database.
- On compact viewports the horizontal dock intentionally overrides the floating minimap width; the persisted width is used again when the cockpit returns to floating mode.

### Milestone E.2.3 — Server-authoritative laser toggle controls

#### Added

- Replaced ambiguous engagement shortcuts with one atomic `Core.World`/map/channel laser toggle shared by Ctrl and the slot-1 action. Toggle-off preserves the selected target and clears only active engagement; Escape retains explicit clear-and-disengage behavior.
- Reworked the server action catalog around explicit action ID, type, and activation mode. Slot 1 now contains toggle-mode X1 ammunition linked to, but distinct from, the existing Phoenix pulse-emitter weapon; no inventory item, rocket, or consumable was added.
- Preserved the pulse emitter's server-owned damage, range, and cooldown state across toggles, preventing stop/resume from accelerating its firing cadence.
- Added correct `ControlLeft`/`ControlRight` handling, repeat and Ctrl-chord rejection, reserved-Space unavailable messaging, metadata-driven hotbar active state, and authoritative `AUTOFIRE`/`STANDBY` presentation.
- Kept NPC selection independent from activation, retained destruction and clear lifecycles, and restored gameplay focus when the main canvas is clicked without consuming native cockpit-button or editable-field keyboard behavior.

#### Tests

- Added Core regressions for direct, slot, and alternating toggles; selection-preserving stop/resume; explicit clear; sequential NPC destruction/selection; cooldown preservation; and invalid, empty, unauthorized, destroyed-player, and missing-target handling.
- Extended channel coverage for X1 action metadata, shared toggle state, ignored spoofed toggle fields, multiplayer engagement/disengagement broadcasts, retained selection, and fresh activation.
- Added JavaScript coverage for both physical Ctrl keys, `event.ctrlKey`, held-key suppression, modifier chords, reserved Space behavior, and metadata-driven active indicators while retaining every existing cockpit, minimap, navigation, targeting, and rotation regression.

#### Verification

- `mix precommit` passes 87 Elixir tests: 40 Core, 30 persistence, and 17 web/channel tests.
- `npm test` passes 48 JavaScript tests across 39 top-level cases.
- `mix assets.build` and `git diff --check` pass.
- Manual browser verification was not performed. Ctrl/X1 alternation, retained-target stop/resume, Space messaging, canvas focus restoration, minimap preservation, and two-browser synchronization remain pending.

#### Limitations

- Slots 2 through 0 remain empty. Space reserves a future single-shot rocket but does not create a rocket attack.
- X1 is currently a non-inventory action identity; configurable ammunition selection, quantities, consumption, X2/X3/X4, rockets, and other hotbar assignments remain future work.


## 2026-11-01 — Experimental SBS branch
- Added optional 3D cockpit and stereoscopic dual-eye renderer with Three.js.
- Kept the original Canvas 2D mode and existing Phoenix combat/navigation contracts.
- Added render-only world coordinate and per-eye pointer projection utilities/tests.
- Added a display selector, keyboard fallback, setup dependency and design notes.
- Build and real browser/headset verification pending; server is still XY only.


### SBS cockpit visibility follow-up
- Shrunk/repositioned 3D cockpit readouts and made eye-aspect fitting adaptive.
- Thinned and repositioned canopy beams toward peripheral eye views.
- Hid the desktop controls hint in stereo mode; added viewport-fit tests.
- First in-browser SBS rendering observed in user screenshot, but revised
  geometry and headset compatibility still require manual verification.


### 2026-11-01 — Navigation Computer V1 (`sbs`)
- Added an SVG sector overview with coordinate input, eight-point course drafts,
  route preview, and server-reported helm/position telemetry.
- Implemented `plot_course` with full server-side validation and deterministic
  ordered waypoint progression, plus session-bound `stop_navigation`.
- Manual `move` cancels autopilot; destruction also clears a course.
- Preserved Classic 2D, single-view Three.js, and dual-eye SBS render modes.
- Added Core, channel, and pure JavaScript tests. Static JS checks and partial
  geometry checks passed; full automated suites and manual browser verification
  remain outstanding.


### SBS branch — XYZ world and sector atlas transition (2026-11-01)
- Made XYZ authoritative on the server with bounded altitude and full 3D
  Euclidean navigation and combat range.
- Added backwards-compatible `position_3d`, `destination_3d`, `route_waypoints_3d`
  and sector `volume` fields to the wire snapshots.
- Retired Classic 2D from the gameplay view selector: Three.js single-view
  and true dual-eye SBS are the only presented cockpit views.
- Recast the top-down SVG chart as the sector atlas with Z altitude selection
  and real XYZ route distances; legacy minimap is telemetry-only.
- Added spatial visualization, height interpolation and regression tests.
- Full suite, asset compilation and in-browser verification remain pending.

### SBS branch — remove legacy 2D flight fallback (2026-11-01)

- Removed the legacy 2D ship/grid/stars rendering pipeline from `client.js`.
- Replaced its Canvas 2D input canvas with a transparent DOM pointer target.
- Restricted `V` and the selector to 3D/SBS; added display-mode tests.
- Missing WebGL now reports an error rather than activating an obsolete view.
- The flat navigation atlas and 3D cockpit CanvasTexture readouts remain.


### SBS branch — Manual Cruise/Newtonian flight (2026-11-01)
- Added `Core.World.FlightDynamics`: server-owned signed thrust, velocity,
  attitude, sector bounds and two flight physics modes.
- Added authenticated `flight_controls` commands and 3D/SBS keyboard piloting.
- Flight keys follow the original Space Rogue layout with a modern reverse
  throttle extension; `Ctrl+E` toggles flight physics.
- Added HUD readouts and Core/Channel/browser regressions.
- Browser flight-control tests passed in isolation; run full local suites and
  evaluate flight handling in Firefox before treating it as production ready.

### SBS branch — corrected flight axes and throttle (2026-11-01)

- Reassigned W/S to forward/reverse throttle ramp while held.
- Mapped arrows to pitch, A/D to yaw, Z/C to roll, and F to release steering.
- Corrected 3D camera orientation using an explicit forward vector and
  roll-adjusted camera up vector, matching server-positive yaw/pitch.
- Added live heading, pitch, roll indicators and deterministic input/basis tests.
- Atlas input release is now silent, avoiding cancellation of an active route.

### SBS branch — finalized player flight keymap (2026-11-01)

- W/S pitch up/down; A/D yaw left/right; Q/E roll left/right.
- = accelerates and - decelerates signed throttle, including reverse.
- Throttle keys are hold-to-ramp in normalized 10% steps every 120 ms,
  independent of OS key repeat; numeric keypad +/- are supported.
- Preserved Ctrl+E for Cruise/Newtonian switching and F to release steering.
- Updated UI instructions and automated mapping/modifier tests.

### SBS branch — pitch-down responsiveness fix (2026-11-01)

- S can pitch continuously down through vertical, no +/-89-degree cutoff.
- Most recently pressed pitch key takes precedence during W/S overlap.
- Flight HUD shows whether UP/DOWN pitch input is currently registered.
- Regression tests cover key reversal, +/- pitch symmetry and inverted camera basis.

### SBS branch — make web asset rebuild reliable from umbrella root (2026-11-01)

- Added root-level Mix `assets.setup`, `assets.build`, and
  `assets.deploy` aliases that explicitly execute the web child's aliases.
- Prevents repeated testing of outdated cockpit JavaScript after source pulls.
- Documented checking the built `app.js` for the latest `lastPitchKey` code
  before diagnosing the W/S and obsolete X key mapping.

### SBS branch — smooth, capped pitch/yaw/roll (2026-11-01)

- Added server-owned angular velocity, per-axis turn acceleration/braking
  and capped angular rates, with smooth opposite-key reversals.
- Changed pitch/yaw/roll integration to trapezoidal angular displacement.
- Added shortest-path wrapped-angle rendering interpolation for 3D and SBS.
- Added turn-rate telemetry on cockpit and stereoscopic HUD.
- Added browser interpolation tests, server angular-dynamics tests and
  socket telemetry assertion; full Mix suite must run on the laptop.

### SBS branch — thrust follows current nose (2026-11-01)

- Corrected Cruise Flight to integrate a signed forward-speed scalar and
  project world-space velocity along the ship's live heading every tick,
  removing unintended prior-course drift after turning.
- Newtonian thrust continues to use the live nose while retaining
  momentum; switching to Cruise converts forward momentum and removes
  sideways drift.
- Added regression tests for turn-before-thrust, turn-while-moving,
  pitched climbs, negative throttle, and Cruise/Newtonian transitions.
- Reset cruise speed on legacy movement, atlas route and navigation stop.

### SBS branch — Space Rogue manual red laser firing (2026-11-01)

- Added Space hold-to-fire, server-authoritative nose-aimed 3D raycasts
  against living NPCs, including misses consuming real weapon cooldown.
- Separate red manual laser beams with glowing streaks in 3D and SBS;
  damage and beam endpoints are replicated by authoritative events.
- Left existing Ctrl/slot-1 automatic fire intact; added L as an original-
  style shortcut for automatic X1 fire and T for nearest-hostile targeting.
- Added ray collision, no-lock fire, session anti-spoofing, cooldown and
  keyboard regressions. R weapon cycling remains deferred.

### SBS branch — simplify combat interface and protect Space input (2026-11-01)

- Removed large right-hand target information panel and its toggle button,
  while preserving 3D/SBS target display and minimal hit/miss messages.
- Removed panel from saved-layout definitions and visibility menu.
- Captures Space keydown/keyup to stop button focus from consuming the
  laser trigger or inadvertently toggling autofire.
- Added layout persistence and keyboard-focus regression tests.

### SBS branch — body-relative quaternion orientation (2026-11-01)

- Replaced fixed-world Euler attitude for simulation and aiming with a
  normalized body-relative quaternion, retaining old Euler telemetry.
- Updated cruise and Newtonian thrust, manual laser ray, 3D/SBS camera
  and other player meshes to share authoritative orientation.
- Added shortest-path quaternion slerp and actual nose-based HUD heading,
  pitch and bank readouts plus body-relative regression coverage.

### SBS branch — dual wing-mounted laser hits (2026-11-01)

- Replaced single visual-offset shot with two server-positioned,
  body-relative laser rays from symmetric cockpit/wing emitters.
- Traced independent ray/target intersections using authoritative
  orientation, 3D NPC collision spheres, and the existing weapon range.
- Combined concurrent hits in one authorized burst and single cooldown;
  damage is not doubled if both rays connect with the same target.
- Broadcast per-wing endpoints, collision flags and impacted NPC states;
  client applies all damage states and draws two red beams and hit flashes.
- Aligned NPC render positions with collision geometry and included
  twin wing beams on existing targeted automatic fire.
- Added paired-hit, miss, yaw/roll, multi-target and world damage tests.

### SBS branch — 5× pulse emitter range and explicit laser hits (2026-11-01)

- Increased server-enforced player pulse laser range from 720 to 3,600 units
  for wing-mounted manual fire and automatic X1 engagements.
- Added 3,200-unit positive hit/actual NPC damage regression and out-of-range
  negative tests while preserving existing cooldown and total damage.
- Added HIT N/2 and MISS confirmation with server-reported shield/hull damage
  in mono and stereo cockpits; reticle changes color for 1.6 seconds.
- Added selected-target range in world units with IN RANGE/OUT OF RANGE and
  shield/hull readings directly on the stereoscopic cockpit HUD.
- Extended dual red beam rendering to 550ms, increased thickness and impact
  flash visibility; existing server-owned beam/impact geometry is unchanged.

### Sector 1-1 demo — one original-inspired Dart fighter (2026-11-02)

- Replaced the three `rift_skirmisher` demo spawns with one deterministic
  `dart` pirate fighter at (1480,1000), preserving the existing
  authoritative AI and spawn/destruction/respawn event lifecycles.
- Mapped the original Space Rogue Dart's documented 245 armor to
  245 hull; shield and laser values remain explicit provisional
  balance values pending faithful directional-shield/weapon systems.
- Added lightweight procedural Three.js Dart geometry in orange with
  sweeping delta wings, pointed nose, small dark canopy, vertical
  dorsal fin, exhaust ports and the existing target-selection ring.
- Added Dart orientation, ship-model and NPC target-facing tests;
  rewrote the multi-NPC-dependent simulation and channel tests for
  the single-Dart demo, including destruction and delayed respawn.
- Left the current cockpit, player flight, twin laser hit logic,
  damage authorization and bounded AI control unchanged.

### Solar System Atlas V1 — Sun through Pluto (2026-11-02)

- Replaced the tactical sector map as the initial Atlas screen with a
  custom SOL overview displaying the Sun, eight planets and Pluto.
- Added mean astronomical distances in AU, orbital periods, selectable
  body details, differentiated colors, orbital rings, compressed radius
  projection and an inner-planets magnification.
- Preserved the working Sector 1-1 XY/Z route planner under its own tab.
  Planet selections are display-only and cannot send map coordinates.
- Added regression tests for ordering, Pluto's dwarf-planet category,
  scaling, SVG object rendering, view changes and isolation of
  existing tactical waypoint drafts.
- Documented that planet positions are schematic: no live ephemerides,
  interplanetary flight or encounter simulation has been added yet.

### Default Atlas launch instead of cockpit (2026-11-02)

- Launch `/play` with the Solar System Atlas visible from the first
  HTML paint, and call `NavigationComputer.open()` during JS boot
  after flight and laser input handlers are ready but before socket
  connection. Prevent immediate cockpit interaction while Atlas is open.
- Retain the existing `M`, `Esc` and Return to cockpit controls,
  3D/SBS renderer, world socket, server-side Sector 1-1 Dart and
  tactical route planner.
- Add regression coverage for initial open, idempotent repeated opens,
  closing the Atlas, and restoring cockpit readiness.

### Peaceful entry and SOL navigation prototype (2026-11-02)

- Disabled startup Dart spawning in the production authoritative map:
  Sector 1-1 now begins free of encounters and players cannot take NPC
  damage while examining the initial Atlas.
- Added explicit server-only NPC encounter spawn/clear APIs. Production
  encounters now end on destruction rather than restarting endlessly.
- Added `Core.Universe.Sol` and independent supervised
  `Core.Universe.Navigation`, keyed by authenticated player identity,
  with bounded game-scaled interplanetary transit, arrival and abort.
- Integrated SOL course requests and broadcasts in the Phoenix
  WorldChannel; no client-controlled player ID or AU-to-sector coordinate
  translation is accepted.
- Added Solar Atlas route controls and schematic moving transit marker,
  separate from the still-functional Sector 1-1 XYZ tactical planner.
- Updated combat fixtures and added Elixir and JS tests for peaceful
  entry, explicit encounters, Sol catalogue, route validation, progress,
  abort and server/client state isolation.

### Two real-time propulsion modes and sublight SOL cruise (2026-11-02)

- Superseded 12–120-second game-timer voyages with constant-speed
  interplanetary sublight cruise through deliberately compressed SOL
  gameplay coordinates. Accurate AU references remain separate.
- Added authoritative per-pilot SOL coordinates, distance travelled,
  fixed cruise drive speed and independent voyage state, advanced on the
  same one-second clock as all players. No clock fast-forwarding.
- Added server API guards preventing cockpit flight, target/combat and
  weapon operations while a pilot is in sublight transit.
- Engaging cruise cancels old local autopilot movement and combat lock.
- Atlas displays sublight drive speed, route progress and minute:second
  ETA; cockpit indicates that flight controls are locked during transit.
- Added V2 regression tests for sample travel times, concurrent voyages,
  sublight position interpolation and propulsion-mode exclusivity.
 
### EncounterDirector classification without tactical handoff (2026-11-03)

- Added `Core.Universe.EncounterDirector` for classification of genuine
  sensor-derived SOL close passes using NPC disposition, owning faction,
  Zone of Control and server-provided faction standing.
- Identified Sentinel-07 as a Venus patrol; preserved all six existing
  routes, schedules, cargo and player-independent movement.
- Returned encounter classification in private per-pilot navigation
  snapshots and one-time events; retained existing strategic flyby mode
  and continuous interplanetary cruise.
- Updated ordinary cockpit encounter text for neutral flyby, patrol
  attention and hostile contact; no combat/inspection promise.
- Added deterministic director tests and a hostile navigation regression.
- Test execution: not run here (Elixir/Mix unavailable); live browser
  verification remains outstanding. No faction reputation persistence,
  tactical instances, interception, random spawns or NPC combat added.


### Strategic encounter modal and pilot cruise hold (2026-11-03)

- Changed real SOL close passes from passing notifications to a
  server-authoritative, pilot-scoped travel hold with a pending decision.
- The pilot's location, voyage progress and ETA freeze during the hold.
  NPC vessel traffic and all other pilots continue independently.
- Added authenticated `solar_resolve_encounter` with strict encounter ID
  and action validation. Hail remains read-only and sensor-range checked;
  Continue resumes the original route without a position reset.
- Added centered modal encounter decisions to normal cockpit/Atlas and
  duplicated per-eye panels for SBS. Updated Atlas and helm status.
- Added regression cases for hold/reconnect state, isolation, travel
  completion after resolution, and invalid client decisions.
- No physical tactical encounter/combat or restart durability yet.
  Mix, npm, asset build and browser/HMD verification are still pending.

### Encounter regression correction (2026-11-03)

- Updated the two-pilot hold test to account for independent Mars-route traffic:
  pilot 732 can also encounter a vessel, so attempting to resolve pilot 731's
  courier ID correctly yields `:encounter_mismatch`, not `:no_pending_encounter`.
- Verify pilot 732 can resolve its own contact and continue moving while pilot
  731 remains paused. No runtime encounter behavior was changed.
- User-reported initial run: 11/12 core navigation tests, 18/18 Phoenix
  channel tests, and asset build succeeded. Revised test awaits execution.

### LAN-accessible development endpoint (2026-11-03)

- Changed the default development Bandit interface from loopback
  `127.0.0.1` to `0.0.0.0`, supporting an external SBS headset without
  requiring the former `SUNRACER_LAN_HMD=1` launch flag.
- Added `SUNRACER_LOOPBACK_ONLY=1` to opt into a restricted local-only
  listener on untrusted networks. Production endpoint configuration is unchanged.
- Not verified on physical headset; run from a trusted LAN and use the
  laptop's IPv4 address for remote device connections.


### Encounter popup delivery and HMD overlay (2026-11-03)

- Restored the direct `solar_encounter_started` listener in the laptop
  cockpit so its server-held encounter popup opens on first notification.
- Preserved snapshot-based reconnect recovery and keyboard-modal behaviour;
  the Atlas is inert while the popup is awaiting a decision.
- Added a filtered, read-only SOL encounter subscription for the separate
  phone headset and a per-eye alert; decisions still use the laptop's
  authenticated WorldChannel.
- Added headset view and channel privacy regression tests; no combat,
  trade or tactical travel changes were introduced.
- Tests and real headset/browser verification were not run in the
  editing environment.

### Procedural SOL encounters (2026-11-03)

- Corrected the scarcity of close-pass events after an Earth–Venus departure:
  a shared real-position traffic vessel is now launched on a converging
  route for each departure in the current playtest configuration.
- Randomized trader/patrol/raider type and meeting phase in the server.
- Added 32-ship procedural limit and 15-minute expiry, preserving the
  six scheduled ships and existing NPC independence.
- Maintained an established radio channel for the exact pilot-held
  pending contact; unrelated hails remain range-gated.
- Added collision-of-trajectories and lifecycle regressions and extended
  channel arrival test for multiple decisions. Tactical fights remain
  unimplemented; no Mix execution available in the editing environment.



### Enter real 3D combat from a hostile SOL encounter (2026-11-03)

- Added a server-validated **Engage / Enter combat** action for hostile
  and patrol-attention close passes. Neutral contacts remain unchanged.
- Instantiated one Dart-class local opponent per pilot encounter, named
  for the contacted vessel, with validated map-space spawn near the ship.
- During tactical combat only, unlock conventional cockpit controls,
  preserve frozen SOL travel progress, and keep the current real planet
  visible to avoid concealing collision hazards.
- Verified-map-victory and explicit retreat both resume the original
  interplanetary route. Retreat cleans stale target locks.
- Paired HMD now subscribes to pilot's real planetary map and remains
  display-only.
- Added core world and Phoenix channel tests. The tactical scene currently
  reuses the existing orbital region (not isolated mid-space). Tests and
  physical headset acceptance await running on the user's workstation.

- On server-confirmed pilot defeat, canceled the held SOL voyage and
  cleaned the NPC so the player can reconnect at their departure planet.
  Added authorization regression tests for defeated ships.
- Reused the original swept-wing Dart model for unique tactical NPC IDs
  and limited an encounter NPC's auto-targeting to its owner.


### Neutral trader tactical attacks (2026-11-03)

- Added an explicit **Attack vessel** encounter action for peaceful traffic,
  including procedural Harbor traders; retained existing Hail and Ignore.
- Opened server-authorized tactical combat for pending neutral flybys
  while keeping encounter ownership and held SOL cruise enforced.
- Neutral NPCs now remain passive until hit, then can retaliate; raiders
  and hostile patrol contacts still pursue immediately.
- Updated UI copy and added JS, Core World and Phoenix channel regressions.
- Trader-specific models, reputation/penalties, trade inventory outcomes
  and actual loot remain future work. Tests still require local execution.


### Scow trader hull (2026-11-03)

- Introduced **Scow** as a separate Core NPC ship definition (210 hull,
  10-damage laser, slower movement) rather than reusing Dart stats.
- Annotated existing scheduled/procedural merchant and courier traffic
  with a server-owned Scow class; surfaced it through encounter
  snapshots and authenticated tactical entry.
- Added a distinctive procedural blue, rounded-bow cargo vessel and
  Scow model selection in the shared Three.js/SBS renderer.
- Expanded Core World, traffic and Phoenix channel regression tests,
  and added Node tests for the model's identity and dimensions.
- Flight, surrender, jettison, reputation and loot behavior remain
  future work; this commit does not claim these are implemented.
- Elixir suites and physical browser/HMD verification still pending.


### Scow graphics and damage-model audit (2026-11-03)

- Corrected missing Scow graphics in the strategic close-pass preview:
  type-aware view now selects the actual new blue cargo model and
  preserves it for a pending paused encounter.
- Added the authoritative tactical NPC `ship_class` to world snapshots,
  consumed by laptop and SBS headset with a shared type resolver.
- Display selected ship class in the cockpit target HUD.
- Added end-to-end model identity, classification and preview tests;
  the code is not yet verified on a running HMD.
- Audited original Space Rogue mechanics: fore/aft shield hemispheres,
  global hull armor and disableable ship systems. Current pooled
  shield/hull damage is unchanged; detailed impact behavior is a
  future combat milestone, not part of the rendering fix.


### Course-driven Scow interception (2026-11-03)

- Tactical Scows now inherit authenticated SOL origin and destination
  instead of selecting the square `idle -> patrol` NPC pattern.
- Added server-owned `Core.NPC.CruiseRoute` projection into a safe local
  straight transit lane, avoiding planetary exclusion geometry.
- Added distinct moving `:cruise` merchant behavior: neutral ships
  do not chase; provoked ships can fire their turret while flying onward.
- Serialized stable NPC bearing and course endpoints for both desktop
  and paired SBS HMD renderers.
- On crossing the lane's endpoint, automatically remove the Scow,
  release target locks and resume the owner's held SOL voyage, including
  disconnected viewers. Strategic SOL traffic continues independently.
- Added route, AI, and end-to-end world regression tests. These tests
  have not been executed in the editing environment.


### Sunracer baseline, cargo hold and equipment locker (2026-11-03)

- Changed catalog ship 1 from placeholder Phoenix to Sunracer, retaining
  persisted account ship ID 1 and preserving future multi-ship ownership.
- Base Sunracer now has 300 armor, a 10-point built-in Garnet, a four-tonne
  cargo hold and original Forward-1/missile/drive system metadata.
- Added Beryl (15) and Sapphire (20) named upgrades; single Sunracer
  beams replace rather than stack damage, while existing SunRacer
  multi-slot ships retain additive equipment calculations.
- Added /equipment authenticated equipment/loadout screen, account-owned
  equip/unequip forms, and persistent C-1/C-2 selection applied to the
  next cockpit session.
- Added fixed-catalog cargo commodity storage to the existing
  inventory JSON with row-locked capacity-constrained transfers.
- Added non-suicidal Scow survival transitions: evade at 80% hull and
  surrender at 35%; accept surrender is ownership checked and resumes
  the suspended course; surrendered ships are protected from shots.
- Added unit and integration tests for baseline stats, owned inventory,
  equipment transfers, configuration activation, surrender and security.
- Directional shield physics, real cargo trading, surrender payout,
  loot reconciliation and live-session refitting are not implemented.
- Elixir/Mix tests and physical headset runs not executable in the
  editing environment.


### Active ship configuration join correction (2026-11-03)

- Phoenix WorldChannel now reads the persisted active C-1/C-2 choice
  before both player_status/2 and World.connect/3. Previously it always
  supplied configuration 1 and ignored the shipyard's activated layout.
- Updated legacy player-combat and ship-catalog assertions from
  Phoenix 4,000 / 40 to Sunracer 300 / Garnet 10, including the Dart
  shield/hull split on a successful starter laser hit.
- Added channel regression for genuinely spawning with Beryl 15 in
  configuration 2 after a server-owned activation.
- Hotbar retains stable pulse_emitter and x1_laser identifiers, but its
  visible label no longer falsely says Garnet when Beryl or Sapphire is
  equipped.
- Elixir/Mix tests remain unrun in the editing environment.


### Sunracer post-test regression cleanup (2026-11-03)

- Updated the two remaining Core.WorldTest Phoenix/40-damage expectations
  to actual Sunracer Garnet 10-damage combat: 6 shield + 4 hull damage
  per hit against the legacy Dart, and 108/237 after the second shot.
- Fixed the client entity spawn object assigning `angle` twice.
  Initial orientation now uses the server-provided numeric heading
  with route bearing as a visual fallback, while keeping
  `navigationAngle` as a separate presentation field.
- The 2026-11-03 workstation log reported Core.WorldTest 35/37 passed,
  204/204 Node tests passed, equipment controller 5/5 passed,
  world channel 21/21 passed, and successful assets.build (with
  duplicate-key warning). These changes target the two remaining
  failures and that build warning; retesting is required.

- Corrected SOL zone-boundary quadratic roots to divide scalar numerators
  instead of single-element tuples; existing TerritoryTest crossing cases
  exercise this real runtime-error path.
- Grouped default-argument declarations in Factions.patrol_directive/2
  and Security.assess/2; removed an unused collision binding and an
  unused equipment-controller test variable. The MapServer handle_call/3
  grouping warning remains and does not by itself imply a test failure.

### Mix precommit callback grouping (2026-11-03)

- Reordered only the two private laser-burst helper functions below the contiguous `handle_call/3` callback clauses in `Core.World.MapServer`. This removes Elixir's callback-clause grouping warning under `--warnings-as-errors` without changing gameplay, calculations, or routing. Mix verification remains required on the workstation.

### Deterministic courier test and clean helmet test teardown (2026-11-03)

- Fixed the Earth→Venus courier close-pass test's unit conversion:
  `Traffic.advance/2` uses milliseconds, while SOL cruise speed is
  in game-km/second. The test had accidentally multiplied its player's
  journey distance by 1,000, causing the arrival guard to suppress the
  encounter. The actual simulated ships pass about 2,708 game-km apart,
  within the 650,000 game-km encounter radius; production traffic and
  encounter behavior remain unchanged.
- Replaced deprecated literal-charlist syntax in HelmetNetwork tests with
  `~c""`, and avoided floating-point signed-zero pattern warnings in
  the world volume test.
- Synchronized HelmetChannel test socket shutdown/revocation before the
  Ecto SQL sandbox owner exits. This addresses the observed intermittent
  HelmetManager post-test database disconnect and uses the previously
  unused remembered helmet channel reference.
- No combat, merchant AI, shield, equipment, or flight behavior changed.
  Mix verification still required on the workstation.

### SOL vessel identity and combat state reconciliation (2026-11-03)

- SOL Traffic now owns hull, shields, survival state and settlement history
  for its physical, voyage-identified merchants and other encounter ships.
- Navigation reserves a physical vessel for one tactical encounter at a
  time and checks the strategic voyage identity before spawning a map NPC.
- Tactical map actors inherit existing damage. Their server-verified exit
  reports drive one-time Traffic settlement on victory, surrender, retreat,
  defeat and autonomous lane escape.
- Destroyed vessels remain non-travelling tombstones; surrendered vessels
  are disabled and no cargo is granted or reset by finishing combat.
- Procedural TTL and strategic voyage transitions are suspended at the
  boundary for actively claimed vessels to avoid ghost/duplicate ships.
- Added pure Traffic, Navigation and world integration regression cases.
  Database durability and shared-instance multiplayer combat remain TODO.
- Changes have not been executed with Mix in this editing environment.

## 2026-11-06 — Unified GitHub releases (implementation; deployment unverified)

- Aligned the umbrella release version to 0.3.1, the existing Tauri client version. Subsequent release bumps edit only root `mix.exs`.
- Added a version-generation helper for Windows/Linux build-time Tauri, Cargo and npm metadata, with offline regression tests.
- Extended the Linux `scripts/sunracer` menu with a unified server and signed desktop release command.
- Expanded the signed GitHub Actions release to validate Elixir and JavaScript suites, build an Ubuntu OTP server archive, package stable-name Windows/Linux installers, generate checksums and publish a complete release after signing.
- Added an OTP database-migration entry point, release validation CI and the release runbook. Publication, EC2 deployment and device smoke tests have not been performed.

### Local server diagnostic packaging correction (2026-11-06)

- Replaced the blanket refusal to build when workstation development TLS keys exist with an isolated `git archive HEAD` production build.
- The archive uses only committed source, excludes ignored/untracked local credentials, validates Phoenix digested assets and the OTP bundle, and leaves workstation TLS files untouched.
- Automated workflow syntax validation is provided; local production packaging still requires manual execution on Pop!_OS and has not been independently verified here.

### Restore existing EC2 Caddy proxy topology (2026-11-06)

- Reconciled the release's production runtime with the verified existing EC2 architecture: Caddy public TLS on 443 → loopback Phoenix HTTP on 4000; explicit `SUNRACER_PROXY_MODE=true` opt-in retains optional direct Phoenix TLS.
- Updated SSL forwarded-protocol handling for trusted Caddy connections and preserved HSTS; no direct internet listener is opened by the proxied Phoenix endpoint.
- Fixed the Tauri launcher default to `https://sunracer.ddns.net`, migrated saved `:4000` production origin, retained local port-4000 development and optional direct-TLS mode, and expanded launcher regression coverage.
- Replaced obsolete port-4000-only deployment guidance. No EC2 runtime or Caddy service was changed by the repository commit; production needs a newly built server archive.

### Pilot registration verification recovery (2026-11-06)

- New registration email tokens are securely random, SHA-256 digested at rest, expire after 24 hours and are single-use.
- Opening a verification link no longer activates accounts. Activation requires CSRF-protected confirmation POST.
- Added generic resend recovery page with 60-second/5-per-day per-account throttle; failing email sends no longer leave pilots without a recovery interface.
- Existing verified accounts are unaffected. Old unverified verification links without expiry must be resent.
- Added targeted GitHub Actions account/controller tests. Production email remains disabled until configured.

### Optional production SMTP mail transport — 2026-11-06

- Added gen_smtp as Swoosh's SMTP dependency, supporting authenticated TLS-only SMTP on ports 587/465/2525 with certificate and hostname validation.
- Retained Resend API delivery as an alternative; missing or incomplete provider credentials fail closed.
- Added independent SUNRACER_REGISTRATION_OPEN flag to keep public signup disabled while testing delivery.
- Added operator-only Sunracer.Email.Probe.send_test/1 and tests; no email admin HTTP route or automatic production deployment.


### 2026-11-20 — SOL environment regions (Stage 1)
- Added read-only, server-position-derived environment profiles for sparse
  open space, asteroid belt, Earth orbital debris, and a fictional ion storm.
- Atlas overlays are anchored to the same server-provided compressed-game-km
  geometry as Navigation. No new navigable targets, combat authority,
  collisions, environmental damage, economy changes, or dependencies.
- Added Core region classification and Node Atlas overlay regression tests.
- Tests have not been executed locally in this GitHub editing environment.

### 2026-11-20 — SOL environment scenery (Stage 2)
- Added deterministic instanced local rocks, orbital debris and plasma scenery
  to the shared desktop/SBS Three.js scene; no collision or damage logic.
- Sparse open space and denser belt regions are driven by the server-provided
  profile; spatial-cell coordinates remain stable across Atlas toggles.
- Added Node tests for density, stability, locality and invalid input.
- Laptop/phone visual verification and full test suites remain outstanding.

- HMD scenery parity: restricted helmet feed now carries only the validated
  environmental profile, with no cargo or strategic contacts. Added phone-side
  validation and CI coverage for all new environmental components.
