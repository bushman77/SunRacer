# SunRacer — Flight model and combat balance

Working design record. Decisions as of 2026-11-21 (Brad), branch `story_line`.
Every number below was measured against the code in this repository, not
estimated. Where a figure is still open it is marked **OPEN** rather than
guessed.

Balance is a hard requirement for this game, not a preference. This document
exists so that tuning decisions have a derivation attached and so a future
change cannot quietly invalidate one.

## Principles

1. **Cruise is flight assist on the same engine.** An autopilot cannot make a
   drive more powerful. Cruise and Newtonian therefore share one performance
   envelope: same top speed, same acceleration. The only difference is who
   steers.
2. **Newtonian's reward is control, not performance.** What a pilot gains by
   switching the assist off is the decoupling of nose from velocity vector —
   point the guns one way while travelling another, carry momentum through a
   turn. Nothing is gained but control, nothing lost but assistance.
3. **Momentum must be a commitment.** Changing direction costs the same
   delta-v as building the original vector. If that cost can be avoided, the
   Newtonian model is decoration.
4. **Price is not a balance lever.** A price gate delays a power spike; it
   does not prevent one. Opposition scaling and hull-appropriate equipment do.
5. **No item may be unreachable in principle.** Hard to obtain is the goal.
   Impossible is not.

## Measured baseline

Player, stock Sunracer (`Core.Ships.Catalog` id 1):

| quantity | value | source |
| --- | --- | --- |
| hull | 300 | `hit_points` |
| shields | 0 | `shields` |
| cruise top speed | 320 | `speed` |
| Newtonian top speed | 480 | `limit(speed * 1.5)` in `FlightDynamics.step/4` |
| built-in beam | Garnet, 10 damage | `damage` |
| beam cooldown | 700 ms | `Core.Combat.ActionCatalog` pulse emitter |
| beam DPS | 14.3 | 10 / 0.7 |
| beam range | 540 | `Core.Combat` `@player_attack_range` |
| yaw rate | 44 deg/s | `FlightDynamics` `@turn_limits` |
| cargo capacity | 4 t | `cargo_capacity` |

NPCs (`Core.NPC.Catalog`):

| | Dart | Scow |
| --- | --- | --- |
| hull | 245 | 210 |
| shields / absorption | 120 / 0.6 | 45 / 0.45 |
| damage | 35 | 10 |
| cooldown | 1,200 ms | 1,800 ms |
| DPS | 29.2 | 5.6 |
| range | 420 | 380 |
| movement speed | 210 | 105 |

## Findings

### F1. Shield gains are capped by absorption, not pool size

`Core.Combat.apply_damage/2` computes
`shield_damage = min(shields, round(damage * absorption))` and sends the
remainder to the hull. The hull therefore always takes
`damage * (1 - absorption)`; the pool only determines how long that discount
lasts. Survival against a Dart:

| shield | pool | absorption | survival | multiple |
| --- | --- | --- | --- | --- |
| none | 0 | — | 10.8 s | 1.00x |
| sg1 | 1,000 | 0.4 | 18.0 s | 1.67x |
| sg2 | 2,000 | 0.5 | 21.6 s | 2.00x |
| bo2 | 10,000 | 0.8 | 51.6 s | 4.78x |

The whole shield line tops out near 4.8x. Strong, bounded, not catastrophic.

### F2. The laser line is uncapped and is the real balance break

On the Sunracer an installed beam replaces the Garnet rather than stacking
(`Core.Ships.Stats.derive/2` takes `Enum.max` of laser damage when
`ship.id == 1`). Beam damage is therefore a direct DPS multiplier with no
ceiling:

**Corrected 2026-11-21.** The first version of this table computed time to
kill against the Dart's 245 hull alone and ignored its 120 shields at 0.6
absorption. Two conclusions drawn from it were wrong. Real figures, computed
through `Core.Combat.apply_damage/2`:

| beam | damage | hits | time to kill a Dart | first draft said |
| --- | --- | --- | --- | --- |
| Garnet (built in) | 10 | 37 | 25.9 s | 17.5 s |
| Beryl | 15 | 25 | 17.5 s | 11.9 s |
| Sapphire | 20 | 19 | 13.3 s | 9.1 s |
| lf1 | 40 | 10 | 7.0 s | 4.9 s |
| lf2 | 60 | 7 | 4.9 s | 3.5 s |
| lf3 | 150 | 3 | 2.1 s | 1.4 s |
| lf4 | 200 | 2 | 1.4 s | 1.4 s |

Shields cap at 4.8x; lasers run to 20x. The LF line is legacy
DarkOrbit-scale equipment sitting in the same catalog as the original
Sunracer-scale items, and it cannot be sold to a 300-hull courier at any
price. That conclusion survives the correction.

The claim that Sapphire is "the crossover where a pilot can win a stand-up
fight with a Dart" does **not** survive it. A Dart kills the player in 10.8 s.
Sapphire needs 13.3 s and the stock Garnet needs 25.9 s, which is 2.4x longer
than the Dart needs. **Nothing sold at Sunracer scale wins a toe-to-toe fight
with a Dart**, and that is the correct and intended shape (see F12).

### F3. Reverse equals forward in both flight modes

Cruise sets `target_speed = entity.throttle * speed` with `throttle` validated
to `[-1.0, 1.0]`, so full reverse is exactly `-speed`. Newtonian applies
thrust along the nose and clamps with `limit(velocity, speed * 1.5)`, a
*magnitude* limit that is indifferent to direction. The mode-switch clamp is
symmetric too. There is no `reverse_factor` field anywhere.

### F4. The prologue's taught tactic depends on F3

Step 6 teaches holding Corsair-17 between 420 (its range) and 540 (the
player's). That band is 120 units wide. At full reverse the player recedes at
320 against the Dart's 210, *gaining* 110 units/s, so the band holds forever
with no skill involved. Any realistic reverse cap collapses it:

| reverse | speed | net closure | time in band | enough for Garnet's 17.5 s? |
| --- | --- | --- | --- | --- |
| full (current) | 320 | -110 | unlimited | yes |
| 3/4 | 240 | -30 | unlimited | yes |
| 1/2 | 160 | 50 | 2.4 s | no |
| 1/3 | 107 | 103 | 1.2 s | no |
| 1/4 | 80 | 130 | 0.9 s | no |

The threshold is the Dart's 210, i.e. 0.66x. There is no middle setting:
above it kiting is unlimited, below it the tactic is gone. Choosing a reverse
factor is choosing what the first fight teaches.

### F5. A reverse cap cannot be enforced in Newtonian at all

Newtonian velocity is world-space and rotation never touches it. A pilot
burns forward to the ceiling, rotates 180 degrees, and recedes nose-on at full
speed having spent no reverse thrust. Capping reverse thrust caps a control
the pilot does not need to use.

More generally: in a Newtonian model "reverse speed" is not a quantity.
Velocity and facing are independent. `reverse_factor` is a cruise-mode
concept and extending it into Newtonian is a category error.

### F6. Newtonian is currently dominant on every axis

| | formula | value | 0 to 320 |
| --- | --- | --- | --- |
| Newtonian thrust | `max(24.0, speed * 1.5)` | 480 u/s^2 | 0.67 s |
| cruise acceleration | `max(18.0, speed * 0.75)` | 240 u/s^2 | 1.33 s |
| cruise braking | `max(28.0, speed * 1.2)` | 384 u/s^2 | 0.83 s |

Newtonian has a 1.5x higher ceiling, 2x the acceleration, and free vector
decoupling. There is no trade-off to make.

### F7. At current acceleration, Newtonian is indistinguishable from cruise

Under perpendicular thrust the velocity vector turns at `accel / speed`:

| acceleration | 0 to 320 | vector turn rate | nose turn rate | result |
| --- | --- | --- | --- | --- |
| 480 (current) | 0.67 s | 86 deg/s | 44 deg/s | velocity outruns the nose |
| 240 | 1.33 s | 43 deg/s | 44 deg/s | dead even |
| 160 | 2.0 s | 29 deg/s | 44 deg/s | nose leads 1.5x |
| 80 | 4.0 s | 14 deg/s | 44 deg/s | nose leads 3.1x |
| 53 | 6.0 s | 9 deg/s | 44 deg/s | nose leads 4.6x |

At 480 the velocity vector swings twice as fast as the nose can point, so
momentum never lags, never has to be paid off, and never constrains a
decision. The distinguishing feature of the mode is invisible. **240 u/s^2 is
the threshold** below which the Newtonian model switches on.

### F8. Switching to cruise is a free handbrake (defect)

`FlightDynamics.controls/3` sets
`cruise_speed = clamp(dot(velocity, forward(entity)), -speed, speed)` when
entering cruise, and `step/4` then assigns `velocity = scale(heading,
forward_speed)`. The lateral component is discarded instantly and for free:

| nose vs velocity | speed before | kept | speed after | delta-v spent |
| --- | --- | --- | --- | --- |
| 0 deg | 320 | 320 | 320 | 0 |
| 60 deg | 320 | 160 | 160 | 0 |
| 90 deg | 320 | 0 | 0 | 0 |

Drifting at full speed with the nose across the vector, one keypress deletes
320 units/s of momentum in a single tick. This is a combat exploit: kite,
snap to a dead stop for an accurate shot, snap back. It voids principle 3
entirely.

The code comment states the intent correctly — "cruise assistance cancels
sideways drift from that point onward". The defect is that it cancels
retroactively and instantly rather than from that point onward.

### F9. Three handling fields on `Core.Ships.Ship` are documentation, not physics

- `cargo_pods: 4, max_cargo_pods: 8` — `Stats.derive/2` passes
  `cargo_capacity` straight through from the catalog and `cargo_pods` is only
  ever printed on the equipment page. The pilot is told the hold expands to 8
  and cannot act on it. 4 pods at 1 t already equals the stated 4 t capacity,
  so deriving capacity from pods is a non-breaking change.
- `acceleration_g: 0.20` — never read. Cruise and Newtonian both hardcode
  their rates.
- `reverse_factor` — does not exist.

### F10. NPCs have no physics, and should not have any

`Core.World.MapServer` advances an NPC with
`advance_entity(decided_npc, decided_npc.speed * distance_factor)`: a
kinematic bee-line at a fixed scalar. No inertia, no acceleration, no
momentum.

An earlier draft of this document called giving NPCs inertia "the deep fix"
and blamed the player/NPC asymmetry for making kiting unbeatable. **That was
wrong, and it is corrected here (Brad, 2026-11-21).** A kinematic chaser is
*better* at pursuit than an inertial one: it turns instantly, never
overshoots, never drifts wide on a turn, never has to decelerate, and holds
exactly its top speed while always pointing at its target. That is optimal
pursuit. Give it momentum and it becomes easier to escape, because it then
fights its own inertia exactly as the player does. What made kiting
unbeatable was only ever the speed differential in F11.

There is a design argument for the asymmetry as well, not merely a
convenience one. Newtonian flight is the *player's* skill tool: in the
original, pivoting while coasting to shoot down a pursuer is a manoeuvre the
pilot learns, and it is rewarding because the ship fights them and the enemy
does not have to. Granting every raider the same trick removes the mastery
rather than deepening it.

What the Dart lacks is not physics but **tactics**. A kinematic mover can
execute a firing pass perfectly well — approach, fire inside its range, break
off, extend, turn, re-engage — as AI states layered on `advance_entity`. That
reads as a fighter rather than a homing missile, mirrors the lesson step 6
should teach, and costs a fraction of a momentum model.

### F12. The courier outruns the fighter and can barely kill it

Design intent (Brad, 2026-11-21, from the original): a Sunracer **can** get
away from a Dart, but killing one is very touchy. The corrected F2 figures say
exactly that — 25.9 s of accurate fire to kill, against 10.8 s to die — so the
numbers already describe the intended ship. They were only ever misread.

This settles two things that earlier drafts of this document got wrong.

**The Dart's speed must stay below the player's.** D6, which called for raising
it above 320, is cancelled: a faster Dart removes the escape that is supposed
to exist. F11 below described the speed differential as a problem to fix in the
stats. It is not a problem; it is the design. 210 against 320 stays.

**The 420-540 range band is the technique, not an exploit.** It is the only way
a courier kills a fighter: hold the gap where your beam reaches and its does
not, and grind 26 seconds of fire into it. What was wrong was never the band —
it was that full reverse at 320 made holding the band free. The cost was
missing, not the tactic.

The implemented flight model happens to price it correctly:

- **In cruise the band-hold is now impossible.** Receding at 105.6 against a
  Dart closing at 210 loses the 120-unit band in 1.15 s. The cheap version is
  gone.
- **In Newtonian flip-and-coast it still works, and now costs something.**
  About 9.1 s to set up (5 s building the vector, 4.1 s to rotate), no way to
  re-accelerate out of trouble quickly, and 26 s of continuous aim at a target
  spanning roughly 8.5 degrees in the sight, with death 120 units inward.

What is still missing is that the Dart bee-lines and therefore stays in the
band once the player establishes it, which makes a touchy fight merely slow.
That is Q8, now the main outstanding work rather than an optional extra.

There is also no conflict with the canon figures, contrary to F11 below. The
recognition guide's Dart 0.30 g against the Sunracer's 0.20 g is
**acceleration**, not top speed. A courier with a higher flat-out speed that
loses every close fight because the fighter changes vector half again as fast
is coherent, and is the ship being described.

### F11. The player is simply faster than the opposition

**Superseded in part by F12.** The measurements here stand; the conclusion that
the differential must be fixed in the stats does not.

320 cruise and 480 Newtonian against the Dart's 210. In any correct physics
model a faster ship can always disengage from a slower one; that is a true
property of the universe rather than a bug to patch, so it has to be fixed in
the stats.

The project's own source data agrees. `Core.NPC.Catalog` records the Dart as
0.30 g acceleration and 45 deg/s turning from the Space Rogue (1989)
recognition guide, against the Sunracer's 0.20 g at the same turn rate: the
pirate fighter out-accelerates the courier by 50%. `movement_speed: 210`
against the player's 320 inverts that.

The consequence is intended, not a problem: **a Sunracer should lose a fair
fight with a Dart** — though per F12 it should still be able to run from one,
so the fix is not raising the Dart's speed. The story already assumes it — step 7 of the prologue is
diverting to the Green Starbase with a chewed-up hull. The prologue is
winnable because Corsair-17 is a staged, private, deliberately beatable
encounter, not because a courier beats a fighter. Escape becomes reaching a
safe zone (`station_safety.ex`, `green_starbase_safety.ex`) rather than
outrunning anything, and the gear curve acquires its purpose: buying your way
from a courier who survives to a courier who can fight.

## Decisions

Settled (Brad, 2026-11-21). D1, D2, D3 and D5 are **implemented** in
`Core.World.FlightDynamics`; measured results are in "Implemented" below.

- **D1. Envelope parity.** Newtonian's ceiling drops from `speed * 1.5` to
  `speed * 1.0`. Both modes share one top speed and one acceleration rate.
- **D2. Acceleration must be slow enough that the nose leads the velocity
  vector.** Target ratio about 3:1 or better, which means acceleration below
  240 u/s^2 and a time to top speed in the 4 to 6 second range. Exact figure
  **OPEN** (see Q1).
- **D3. Reverse is a cruise-only concept.** Add `reverse_factor` to
  `Core.Ships.Ship`, per hull, around 1/3. Do not attempt to limit reverse in
  Newtonian; limit the retros, not the main drive. A pilot who turns around
  and burns gets full acceleration, which rewards understanding the model.
- **D4. Newtonian keeps flip-and-coast.** It is correct physics and a
  legitimate skilled maneuver. Its price is the 4.1 s needed to rotate 180
  degrees at 44 deg/s with the guns off target, paid once, plus the delta-v to
  undo the vector later.
- **D5. Lateral momentum bleeds off, it is not deleted.** Fix F8 by having
  the cruise controller shed the lateral component at `cruise_braking` over
  time rather than zeroing it on the switch. This requires cruise to carry a
  lateral component internally while it converges, so `cruise_speed` as a bare
  scalar is not sufficient state. The mode switch should also then *feel* like
  something: a second or two of sideways slide while the assist settles the
  ship onto its nose.
- **D6. Cancelled (2026-11-21).** Previously "the Dart must be faster than the
  Sunracer". Per F12 the courier has to be able to escape, so the Dart stays at
  210 against the player's 320. Its advantage belongs in tactics (Q8), not top
  speed. Q2 is closed with it.
- **D7. The LF and SG lines are relocated, not retired.** Gate them on hull
  class rather than rescaling or deleting them. `sg1`'s 1,000 shields is
  sensible on a Yamato's 8,000 hull and absurd on a 300-hull courier. They
  stop being a balance problem and become content behind a bigger ship.
- **D8. Equipment unlocks use two gates.** The story grants a named
  authorization token; credits buy the item. This gives credits a sink, keeps
  the outfitter useful beyond one scene, and provides two independent tuning
  dials — story position controls when something becomes reachable, price
  controls the pace. Tokens are named after story beats, not items
  (`helios_courier_license`, not `unlock_beryl`), so rebalancing or renaming
  an item cannot orphan a save. One token may open several items.
- **D9. Pricing follows `price = K * power^3`**, where power is
  `(DPS / base DPS) * (survival / base survival)`. The cube makes
  power-per-credit fall steadily, which is the shape of "always reachable,
  never cheap"; it also self-corrects as items are added, because the curve is
  a function of power rather than a hand-picked ladder. Valid only inside a
  sane power band of roughly 1x to 2.5x — see F2 for why no exponent saves the
  LF line. Anchor **OPEN** (see Q3).
- **D10. Cargo pods price on payback, not power.** They are economic rather
  than combat items. Keep each pod's payback in the 8 to 15 delivery-run
  range.

### Indicative prices at a 500 credit anchor

Illustrative only until Q3 is settled. Anchored so the first beam upgrade
costs three delivery runs.

| item | power | price | runs |
| --- | --- | --- | --- |
| 5th cargo pod | — | 1,000 | 8 payback |
| Beryl beam | 1.50x | 1,500 | 3 |
| Sunracer-scale shield | ~1.33x | 2,000 | 4 |
| Sapphire beam | 2.00x | 3,500 | 7 |

Roughly 25 delivery runs from a stock Sunracer to a fully fitted one: long
enough to feel earned, short enough that a new pilot sees the whole arc.

## Implemented (2026-11-21)

D1, D2, D3 and D5 are in `Core.World.FlightDynamics`. Acceleration now comes
from the hull's `acceleration_g` scaled by `@g_acceleration` (320.0), so one
constant sets the weight of every ship in the game. `reverse_factor` is new
game data on `Core.Ships.Ship`, and `Core.World.Entity` carries both figures
plus a `drift_velocity` field holding the momentum cruise has not yet
cancelled.

Measured against the stock Sunracer (0.20 g, 320 top speed):

| quantity | before | after |
| --- | --- | --- |
| drive acceleration | 480 u/s^2 (Newtonian), 240 (cruise) | 64 u/s^2 (both) |
| 0 to top speed | 0.67 s / 1.33 s | 5.0 s |
| Newtonian ceiling | 480 | 320 |
| cruise full reverse | -320 | -105.6 |
| top speed to full stop | 0.83 s | 5.0 s |
| velocity vector turn rate | 86 deg/s | 11.4 deg/s |
| nose turn rate | 44 deg/s | 44 deg/s (unchanged) |
| 320 u/s of lateral momentum on switching to cruise | deleted instantly, free | bled off over 5.1 s |

The nose now leads the velocity vector 3.9x, so momentum lags behind pointing
and the two flight modes are distinguishable for the first time.

**Still to do from the build order:** prologue step 6 has not been re-tuned.
Its prompt teaches holding the 420-540 band, which is now impossible in cruise
and only achievable in Newtonian flight, so the lesson needs rewriting around
the mode it actually requires. D6 is cancelled (see F12), so nothing here is
blocked on a speed figure any more.

## Balance as a test, not a judgement

Because balance is a hard requirement, it should fail CI rather than rely on
anyone remembering it. Proposed property test over the catalog: for every
purchasable item combination on a given hull, against that hull's
tier-appropriate opposition, assert that

- the player needs **5 to 20 seconds** to kill it (under 5 is trivial, over 20
  is tedious), and
- the player **can still be killed** within 60 seconds of sustained fire.

Anything outside the band fails. This makes a future item unable to quietly
break the prologue, and makes `lf4` fail loudly instead of being a thing to
remember to worry about. Hang it on the existing `mix precommit` alias.
Status: **not built** — see Q6.

## Open questions

- **Q1. Time to top speed** — 4 s (80 u/s^2, nose leads 3.1x) or 6 s
  (53 u/s^2, nose leads 4.6x), or heavier. This sets the feel of the whole
  game more than any other single number.
- **Q3. Credits per delivery run at the long-run rate.** 500 is the
  prologue's first pay, which may not be the steady-state rate. The entire
  price curve scales off this number.
- **Q4. Unlock storage** — a new `player_unlocks` table (`user_id`, `token`,
  `source`, unique on the pair) or ride on the existing
  `story_progress.flags` map. The table costs one migration and accepts
  non-story sources later, which the story design already anticipates with
  faction standing and bounties. The flags map needs no migration but welds
  unlocks to the story.
- **Q5. First unlock** — the 5th cargo pod and then Beryl (courier fantasy
  first, zero combat-balance risk, and it makes F9's existing promise honest,
  but needs a new per-player column since `Sunracer.Fleet.PlayerShip` holds
  only `ship_id`), or Beryl alone (no migration, ships sooner).
- **Q6. Does the Sunracer get a shield slot at all?** It has
  `forward_shield_class: 1` and zero shields today. A Sunracer-scale shield of
  roughly 120 pool at 0.25 absorption fits the curve at about 1.33x.
  Alternatively the courier stays fragile by design and shields begin with the
  second hull.
- **Q7. Build the CI balance band test?**
- **Q9. Braking rate.** Slowing down is thrust, so the implementation uses the
  same rate in both directions, replacing a separate and much larger braking
  constant: a full stop from top speed went from 0.83 s to 5.0 s. A stricter
  model would brake at the retro rate (`thrust * reverse_factor`), which is
  about three times slower again, on the grounds that the assist cannot flip
  the hull to brake on the main drive. This is a feel decision rather than a
  correctness one, and it affects station approaches most.
- **Q8. NPC tactical states.** Replaces the earlier "NPC inertia" question,
  which F10 now argues against. Should the Dart gain approach / fire / break /
  extend / re-engage states on top of the existing kinematic mover, so it
  flies a firing pass instead of homing? This is the mirror of the lesson step
  6 should teach, and it is the honest reason the current encounter feels flat.
  NPCs keep no momentum model, deliberately.

## Build order

Flight model first, because it changes what combat is; then the balance
invariant, so the shop cannot violate it; then the shop. Pricing gear against
a combat model that is about to be replaced would mean pricing it twice.

1. Envelope parity and acceleration (D1, D2), honouring `acceleration_g`.
2. The handbrake fix (D5).
3. `reverse_factor`, cruise only (D3).
4. Re-tune prologue step 6: the band-hold it teaches now requires Newtonian
   flight, so the prompt has to teach the mode as well as the range.
   Corsair-17 is already staged and private, so lowering its hull for the
   tutorial fight is in keeping with the existing design — worth considering
   given 25.9 s of accurate fire for a full-health Dart with the stock beam.
5. The CI balance band (Q7).
6. Hull-class gating for the LF and SG lines (D7).
7. Unlock tokens and the outfitter transaction (D8, D9), which also lets
   `Core.World.StationAttendants` retire its placeholder text — its moduledoc
   already promises that "real service transactions will be added as separate
   validated operations".

## Verification status

Every table in this document was computed from the repository's own constants
by mirroring the relevant function:

- F1 and the survival figures mirror `Core.Combat.apply_damage/2`.
- F2 uses the 700 ms pulse-emitter cooldown and `Core.Equipment.Catalog`.
- F4, F7 and F8 mirror `Core.World.FlightDynamics.step/4` and `controls/3`.

The flight model changes (D1, D2, D3, D5) are covered by automated tests:
`mix test` in `apps/core` passes 302 tests with 0 failures, including four new
`Core.World.FlightDynamicsTest` cases for envelope parity, the reverse cap, the
drift bleed-off and the nose-leads-vector ratio. `mix compile
--warnings-as-errors` is clean.

Not verified: `apps/sunracer` and `apps/sunracer_web` were not compiled or
tested, because the environment used for the change cannot reach hex.pm to
fetch Phoenix and Ecto. All edits are inside `apps/core`, and every consumer
outside it reaches `Core.Ships.Stats` through `Stats.calculate/2` and reads
fields rather than constructing or exhaustively matching the struct, so the
added fields should be additive — but this has not been proven by a build.
Run `mix precommit` at the umbrella root before relying on it.

`mix format --check-formatted` was not run: the pre-existing tree already
fails it under Elixir 1.17.3 on files untouched by this change, which points
at a formatter version difference rather than a real finding. The new code
follows the surrounding style by hand.

**No manual play-through has been performed.** Every figure above comes from
the simulation, not from flying the ship. The feel of a 5 second acceleration
and a 5 second stop needs a cockpit to judge.
