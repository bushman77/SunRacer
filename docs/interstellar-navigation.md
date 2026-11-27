# Interstellar navigation — foundation

## Campaign boundary

SOL remains the complete first campaign. Production wormhole discovery and
transit are locked until a future server-owned campaign completion event
grants access. First Run alone does not grant that access. No live unlock or
travel endpoint is added by this milestone.

## Coordinate domains and topology

* Each system has its own compressed strategic game-km coordinate frame.
* Tactical maps remain independent local XYZ simulation regions.
* Interstellar routes are paired wormhole mouth IDs, not a straight line
  drawn between unrelated system coordinates.
* The planned campaign graph follows the ordered 29-system catalogue, with provisional physical mouths only for SOL ↔ Alpha Centauri ↔ Barnard's Star. Links and mouth positions are fictional proposals; real stellar names are retained. Expansion systems have no playable planets.
* The existing SOL catalogue and its coordinates are unchanged.

## Intended physical transit

Approach a server-owned mouth in the current system, enter conventional flight,
and explicitly begin a transit after server checks. Pilot through a 3D tunnel
with ordered rings or checkpoints using the existing flight controls and
cockpit/SBS renderers. The simulation, not a client-reported success, verifies
progress. Failed traversal should return the pilot to a safe source-side
position; success exits at the paired mouth in the destination system.

Before live travel, extend navigation checkpoint versioning to persist
system identity (old v1 records restore to SOL), namespace local maps and
contacts by system, isolate faction territories and traffic, and make
transfer crash-safe and idempotent. The Atlas needs a system graph and
current-system body catalogue. Reconnect and failure tests must demonstrate
that a pilot and ship cannot exist in both systems or lose their cargo.
No client may supply arbitrary exit coordinates or unlock claims.

## Status

Added pure server-side catalogue and reciprocal mouth lookup with regression
tests. No runtime integration, migrations, Atlas changes, tunnel renderer,
new combat tuning, or production unlock yet. Elixir compilation and test
execution pending.

## 2026-11-26 — Galactic Atlas artwork

- Replaced schematic spiral strokes with a local, photographic-style galaxy art layer inside the interactive SVG. Guide rings, system marker coordinates, labels, selection and zoom remain independent of the image. The approved mockup's clean artwork derivative is supplied separately as `spacenova-galaxy-assets.zip`; extract at repository root and commit `apps/sunracer_web/priv/static/images/game/galaxy/milky-way.webp` before publishing a release. Existing native staging recursively copies game images. A missing asset displays a visible warning without disabling marker interaction. No live travel or catalogue changes. Focused renderer test added; native visual acceptance pending.

## 2026-11-26 — Sequential galactic campaign road

- All 29 systems now have a server-owned campaign phase; the first six retain the agreed SOL → Alpha Centauri → Barnard's Star → Sirius → Epsilon Eridani → Tau Ceti order. Later phases are provisional and arranged to reduce crossings on the existing schematic map. The SVG draws 28 directed, dashed planned connections behind interactive markers, labels phases, and shows previous/next systems. First leg gold means next campaign, not available travel. Replaced the provisional Alpha Centauri–Tau Ceti mouth pair with Alpha Centauri–Barnard's Star to match the chain; remaining physical mouths and unlock/transit logic are not implemented. Artwork and all marker positions unchanged. Added catalogue and renderer tests. Full Mix/precommit and native visual verification pending.

## 2026-11-26 — SOL / Alpha Centauri wormhole flight lab

- Added an isolated development-only `/dev/wormhole` LiveView and a server-owned deterministic transit model. Existing FlightControls emits signed input; Three.js renders curved, narrowing sections, luminous filaments, guide rings and the exit from server-provided geometry. Lab steering is lateral pitch/yaw, not yet full ship attitude physics. Exposure bypasses shields: cumulative hull loss floor(t + 0.025*t²), t in seconds, plus 12 HP/s of wall contact. 9,600-unit tunnel at 240 units/s takes about 40 seconds at full thrust; zero hull destroys the simulated ship, abort retains simulated damage. Tests cover exposure, stationary destruction, forged input, wall contact, steering and abort. No pilot persistence, live warp authorization, destination map transfer, native cockpit or SBS integration; production routing remains disabled. Full Mix/Node and visual lab validation pending.

## 2026-11-26 — Wormhole boundary breach and ejection

- Removed the simulated tunnel wall clamp. Three continuous seconds outside the geometric radius triggers SOL entrance ejection, with ordinary accelerating hull exposure and 12 HP/s wall damage continuing through the recovery window. Steering back inside resets the countdown, never refunds damage. Zero hull wins over ejection or arrival. Voluntary abort also returns to the origin. Returned simulated ships stop taking exposure damage and have a server-owned ten-second re-entry cooldown; retry preserves current/max hull and shields while resetting the new transit timer. Lab shows boundary warnings, red viewport edge, countdown and re-entry controls, with a return-facing camera pose. Added core tests for breach/recovery/ejection/cooldown/retry/destruction/exit rejection. Still an isolated development lab: browser refresh explicitly resets the simulated ship; persisted disconnect recovery, live ship damage settlement and actual system transfer remain unimplemented. Full Mix/Node and visual validation pending.

## 2026-11-26 — Wormhole visual and piloting refinement

- Replaced static wall colors with animated procedural plasma, flowing particle filaments, stronger cyan/gold 3D guidance rings, and a luminous exit ring instead of an opaque disc. Successful arrival reveals a procedural Alpha Centauri binary-star sky preview via a short fading transition; ejection/abort shows a SOL exterior preview. Neither changes actual pilot location. Increased centerline bends (740/480 units) and narrowed minimum radius from 350 to 270 units; geometry sampling doubled to 193 sections. Server still owns all geometry, collision, exposure and ejection; damage/cooldown constants unchanged. Added clearance telemetry and regressions for unsteered failure, steered success, mesh UV seam and arrival scene gating. Isolated lab only. Native/SBS and persistent transfer remain deferred; visual/GPU and full Mix/Node verification pending.

## 2026-11-26 — Sharper wormhole turns

- Increased horizontal/vertical bend amplitude to 980/620 units and frequencies to 4π/7π, with five narrower choke points (minimum radius 230; entrance/exit remain 460). Existing 193-section geometry, steering authority, throttle, turbulence, exposure and ejection rules are unchanged. Renderer consumes the revised server geometry automatically. Strengthened geometry and unsteered-ejection regression; existing centerline steering regression retained. Independent numerical mirror: full-throttle unsteered ejection at 6.5 seconds; steered arrival at 40 seconds with 220/300 hull, minimum clearance about 68 units. Actual ExUnit and manual flight validation pending. Development lab only.

