# Space Nova — HMD gaze HUD interaction

**Branch:** `star_base` · **Scope:** phone headset display only · **No server/gameplay authority changes**

In the Galaxy S21 SBS cockpit, enable motion-sensor head tracking (requires a
secure browser context). The green center reticle moves relative to
ship-fixed cockpit instruments as the pilot turns their head. Looking at a
gaze-enabled control for **1,000 ms** arms it; the amber circular confirmation
ring fills over the following **800 ms**. The selection occurs after **1,800
ms total dwell**. Looking away, losing tracking or moving to a different
control cancels the timer. A held stare activates only once until focus changes.

## Enabled targets

- **NAV**: open the compact information overlay.
- **Main cockpit telemetry instrument**: inspect its live flight readout.
- **FLIGHT**: read throttle, speed, hull and shield values.
- **CONTACTS**: see a bounded list of contacts already present in the
  authenticated visual snapshot.
- **SPACE**: see the current visual environment type and intensity.
- **CLOSE**: dismiss the overlay.
- **RECENTER**: rebaseline the headset's orientation sensors.

The panel is physically positioned in cockpit 3D space for correct SBS
vergence, not duplicated as a flat HTML overlay. Controls are spaced above
and below the content instead of covering text. The graphics live locally in
Three.js; selecting a tab **does not send anything to Phoenix**. All flight
controls, combat, docking and economy actions remain on the laptop and are
server authoritative. If the pilot docks, flight HUD gaze is disabled.

For now this is a **safe first extension** of HUD interaction, not permission
for gaze-triggered firing, weapon targeting, purchasing or docking. Those
actions require a separate explicit design and safety review.

## Verification

1. On the phone, enable head tracking, enter SBS, and look at the bottom
   cockpit instrument long enough to fill the reticle ring.
2. Gaze-select CONTACTS, SPACE and FLIGHT; verify changing pages shows actual
   replicated information and does not move or fire the ship.
3. Look away mid-timer; the ring must reset without selecting.
4. Hold a gaze after activation; the same target must not repeatedly fire.
5. Turn toward CLOSE and verify the whole overlay disappears.
6. Leave fullscreen or lose sensor tracking; the cursor must not activate
   controls. Repeat after recentering.
7. Check both eye panels for comfortable alignment and clear button spacing.

No change to the laptop's native desktop cockpit controls or the SBS pairing
protocol is intended.
