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
* The provisional development graph is SOL ↔ Alpha Centauri ↔ Tau Ceti. Links and mouth positions are fictional proposals; real stellar names are retained. Expansion systems have no playable planets.
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
