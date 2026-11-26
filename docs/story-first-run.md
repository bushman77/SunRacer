# SunRacer — Story & Tutorial Design: "First Run"

Design draft, decisions as of 2026-11-21 (Brad). Editable working copy:
https://claude.ai/artifact/KcvCtJ1QRxaoBAuAiAdRRW — keep this file in sync
when the design changes. The prologue (steps 1 to 9, payout, failure rules, and scripted dialogue)
is implemented on branch `story_line`; the full player playthrough is in
[`story-first-run-playthrough.md`](story-first-run-playthrough.md). See "Implementation" at the end
and ROADMAP.md "Story prologue: First Run" for status.

## Purpose and principles

SunRacer gets an original story set entirely in the Solar System, and its prologue doubles as the tutorial: new pilots learn every core mechanic by playing the opening chapter, not by reading instructions.

- **Every step is server-verified.** A step advances only when the server confirms the pilot did it (docked, arrived, won the fight). Nothing advances on a client claim, matching how cargo, combat and docking already work.
- **One prompt at a time.** A single short instruction in the cockpit HUD, also drawn in the headset's stereo HUD.
- **NPC-issued missions only.** The HUD tracks objectives; it does not assign work. Docking proximity never offers a mission. The First Run begins with explicit contact with Dispatcher Halden Ross on ship comms. Juno Rook handles in-person story dialogue at Green Starbase.
- **Skippable.** Veteran pilots can skip the tutorial prompts; the story stays available later.
- **Scripted opening, real world.** Only the prologue's key moments are staged. Traffic, routes and the economy around it are the live simulation.
- **Original IP.** Inspired by how Space Rogue (1989) wove jobs into a story, but no names, plot or factions taken from it. (The starter ship's name, Sunracer, matches Space Rogue's scout class; it is kept deliberately as a nod.)

## Setting

The story uses the world that already exists in the game: the real Solar System, run by planetary authorities and kept moving by competing shipping factions.

- **The Solar System (SOL).** Every planet from Mercury to Pluto is its own authority, with an orbital base and a forward refinery producing real stock.
- **The shipping factions.** Solar Merchant League (big trade), Helios Courier Cooperative (fast deliveries), Outer Rim Trading Guild (outer system), Solar Survey Consortium (research), Independent Operators, and Unaffiliated Raiders.
- **The Green Starbase.** An independent station in deep space between Earth and Mars. Nobody officially owns it. It has a walkable interior and six staff.
- **Real traffic.** Named ships fly real routes with real cargo (medical supplies, civilian mail, research data, rare ores) whether or not anyone is online.

**Tone:** grounded, working-class space. Pilots are couriers and haulers, not chosen heroes. The danger is people: raiders, and whoever is paying them.

## Characters

The prologue needs only a small cast; most of it already exists in the game. New names are placeholders (approved for now) to change freely.

| Character | Who they are | Role in the prologue | Exists today? |
| --- | --- | --- | --- |
| You | A newly licensed Helios courier pilot on your first solo run | Protagonist | Yes (any pilot) |
| Dispatcher Halden Ross *(placeholder)* | Helios dispatch, Earth orbit | Voice on comms; delivers each tutorial instruction in character | No: text comms only |
| Vesper-02 and Captain Ines Varga *(placeholder)* | Senior Helios courier on the Earth–Mars run | Friendly close pass, then the ship you rescue | Ship yes; captain name no |
| Corsair-17 *(placeholder)* | Unaffiliated raider | The attacker who surrenders and carries the data chip | Raider type yes (off in live game) |
| Mara Venn | Green Starbase repair engineer | Patches your hull, comments on the raider's weapons | Yes |
| Juno Rook | Green Starbase mission liaison | Debriefs you; notices the data chip; opens Chapter 1 | Yes |
| Eno Kade | Green Starbase communications officer | Relays the Vesper-02 distress call | Yes |

## Prologue: "First Run"

Your first solo Helios delivery, Earth to Mars, goes wrong in a way that teaches every core mechanic in a single sitting. Each step advances only on the server event in the Trigger column.

| # | Story beat | Pilot does | Teaches | Trigger (server) | Exists today? |
| --- | --- | --- | --- | --- | --- |
| 1 | You undock your Sunracer from the Earth dock; Dispatcher Ross runs your systems check | Throttle up, steer, try mouse look | Flight, cockpit HUD | Flight controls received with throttle and rotation input | Flight yes; step tracking no |
| 2 | Dispatcher Ross offers 3 crates of medical supplies over ship comms | Contact his NPC and explicitly accept the Mars delivery | NPC dialogue, cargo | Authenticated contact and server-verified acceptance load the crates | Implemented |
| 3 | Ross clears you for Mars | Open the Atlas, plot Earth to Mars, start cruise | Navigation, cruise | Voyage status becomes traveling to Mars | Yes |
| 4 | Vesper-02 passes close and Captain Varga hails you | Hail, then Resume | Encounter hold | Hail or resume on that encounter | Hold yes; staging it for this pilot no |
| 5 | Eno Kade relays a distress call: raiders have Vesper-02 pinned near the Green Starbase | Attack the raider, aim with the sight | Combat, aiming | Tactical encounter starts against the staged raider | Combat yes; staged raider no |
| 6 | Corsair-17 surrenders | Accept the surrender, seize its cargo | Surrender, seizing cargo, standing | Surrender settlement recorded | Yes |
| 7 | Your hull is damaged, so you divert to the Green Starbase | Approach the bay, hold still to dock | Docking | Station docked event | Yes |
| 8 | Inside, Mara Venn patches you up and Juno Rook debriefs you | Walk to the repair bay and Mission Office, talk to both | Walking, dialogue, repair | Validated dialogue with each attendant | Walk and talk yes; real repair no |
| 9 | You launch, finish the run and deliver to Mars | Launch, cruise on, arrive | Completing a mission | Arrival at Mars with the 3 crates still aboard | Arrival yes; delivery payout no |

**Reward:** first pay in credits, your Helios courier license, and a small standing gain with the Helios Courier Cooperative. From here on, the Green Starbase merchant opens a small selection of gear that grows as the story advances.

### The prologue as the pilot lives it

**1. The Earth dock.** You've just earned your Helios wings, and the Sunracer is the cheapest ship the Cooperative would lease you. Dispatcher Ross is dry and patient: undock, bring the throttle up, swing the nose around, try the mouse look. He's done this with a hundred new pilots and sounds like it.

**2. The consignment.** Three crates of medical supplies for the Mars refinery: routine, low pay, the run every new courier starts on. After the flight check, the cockpit provides an objective to contact Dispatcher Halden Ross. The pilot explicitly opens the NPC dialogue and accepts Ross's assignment; only then does the server load crates. The old HUD acceptance is removed. No station-approach mission offer exists.

**3. Clearance.** You open the Atlas, plot Earth to Mars, and engage cruise. Ross signs off: "Quiet lane today. Enjoy it."

**4. Vesper-02.** Mid-cruise, a ship comes up close. It's Vesper-02, Captain Ines Varga, Helios's best courier, heading the same way. She hails you, half welcome, half warning: "Keep your eyes open past the starbase." You hail back and resume cruise. It's a friendly moment that teaches the encounter hold with nothing at stake.

**5. The distress call.** Eno Kade at the Green Starbase breaks in on comms: Vesper-02 is under attack nearby and you're the closest ship. You divert and drop into combat against Corsair-17. This is the first fight, against a raider tuned to be beatable, so the pilot learns to aim with the sight, manage shields, and choose to attack.

**6. The surrender.** Corsair-17 breaks off at 50% hull and offers surrender. Accepting it retrieves verified route telemetry as story evidence, regardless of the separately optional cargo-seizure choice (which requires spare hold capacity). The existing `data_chip` progress flag is retained for compatibility but represents the surrender's recovered navigation record, **not** a physical inventory item. Varga thanks you and limps on toward Mars.

**7. Limping in.** Your hull is chewed up and the Green Starbase is close. You line up on the bay and hold still to dock: the docking lesson, with a reason to do it.

**8. The station.** You walk the concourse for the first time. Mara Venn inspects and patches the Sunracer and identifies military-grade emitters. Only after Mara's inspection can Juno Rook receive the report and the verified navigation evidence. It contains your flight plan filed with Helios dispatch before launch. Juno asks you to keep the leak quiet.

**9. Mars.** You launch, finish the run, and deliver the crates. You get your first pay, your courier license, and a message from Juno Rook: come back to the Green Starbase when you can. That message opens Chapter 1.

### When things go wrong

- **The pilot dies at any step:** the normal respawn at Earth happens, and the story carries on from the same step. Nothing is reset.
- **Vesper-02 is destroyed during the rescue:** the rescue (steps 5–6) is redone. The distress call fires again on the pilot's next cruise past the Green Starbase.
- **The crates are lost before Mars** (sold, jettisoned, or seized by someone else): Helios reissues the consignment at Earth once, and step 9 waits for the new crates. *(Implemented provisionally so a pilot cannot soft-lock; not yet confirmed by Brad.)*

## The hook and Chapter 1: "Leaked Routes"

The data chip seized from Corsair-17 holds *your own* route plan, filed with Helios dispatch hours before you launched; someone is selling courier routes to raiders.

Juno Rook spots it during the debrief at step 8 and asks you to keep it quiet. Chapter 1 opens after the Mars delivery: who leaked the routes, and why?

**Suspects (each gives the investigation a different direction; the real leaker is undecided):**

- **Inside Helios dispatch.** Someone with access to filed routes. Dispatcher Ross is the obvious suspect, which is why it probably isn't him.
- **The Solar Merchant League.** Raiders hitting Helios couriers push contracts to League haulers. A motive, if not proof.
- **The Green Starbase itself.** Independent, unowned, and conveniently placed on the Earth–Mars lane. Its staff hear every docking pilot's plans.

**How it can grow through the system:**

1. **Inner system (Earth, Mars, Venus):** follow the money and the chips. Courier jobs double as cover for investigating.
2. **Asteroid belt and Jupiter:** the raiders' supply side. Bounties and combat.
3. **Outer system:** why someone wants Helios out of the outer routes. A thread for the Survey Consortium and the Outer Rim Trading Guild.

Repeatable side jobs (courier runs, bounties and tips) are **deferred** until the current storyline is completed, reviewed and explicitly opened for expansion. The first implementation pass is the First Run; mission office contracts remain offline.

## Systems to build

Five new server pieces make the prologue playable; everything else it uses already exists. In build order:

1. **Story progress store.** A PostgreSQL table per pilot: chapter, current step, step timestamps, a skipped flag. Steps advance only from server events (the Trigger column), and each advance is idempotent so a retry or reconnect never double-counts.
2. **Tutorial prompts and comms.** One short in-character line per step from the dispatcher or station staff, shown in the cockpit HUD and in the headset's stereo HUD. Text only. A skip option on first launch.
3. **Credits payout.** The first thing in the game that earns credits: a delivery reward with a once-only receipt, following the existing cargo-claim pattern. Also covers the license flag and the Helios standing gain.
4. **Staged encounters for one pilot.** Force the Vesper-02 close pass at step 4, and spawn one raider (Corsair-17) at step 5 with surrender set up to happen. Only for a pilot on that step; the live game's raider settings stay untouched.
5. **Mission Office actions.** Juno Rook's dialogue gains real topics driven by story state (debrief, the data chip, Chapter 1). All future offers will be initiated and accepted via authenticated NPC dialogue, not station proximity.

Not needed for the prologue: real repair transactions (step 8 can patch the hull as a scripted story reward), hostile raiders in the live game, and interceptions.

## Decisions and open questions

**Decided (Brad, 2026-11-21):**

- The pilot starts in the Sunracer at the Earth dock.
- All missions are issued through explicit NPC dialogue. The First Run is accepted from Earth-orbit dispatcher Ross over comms, while Juno Rook remains the Green Starbase liaison.
- Story missions are developed and verified one at a time until completion. Other or repeatable missions remain out of scope for this story-first milestone.
- Placeholder names approved: Halden Ross, Ines Varga, Corsair-17.
- If the pilot dies, the normal respawn at Earth happens and the quest carries on.
- If Vesper-02 is destroyed, that part of the quest is redone.
- Payouts are in credits. As the quest advances, the Green Starbase merchant introduces a limited selection of gear.
- First delivery pays 500 credits.
- Ilya Quill (Ship Outfitter) sells the story-unlocked gear (next milestone).
- The staged Corsair-17 is seen only by the pilot doing the prologue.
- Build scope: the prologue first; the gear shop follows.

**Still open:**

- [ ] Which suspect is the real leaker? Undecided for now; Chapter 1 can be written so all three stay plausible until late.
- [ ] What is the first gear item Ilya Quill unlocks?
- [ ] Confirm or change the one-time crate reissue at Earth (built provisionally).

## Implementation (branch `story_line`, 2026-11-21)

**Where it lives.**

- `Sunracer.Story.Prologue` (apps/sunracer): pure step engine, prompts and station lines. No database, socket or clock.
- `Sunracer.Story`: applies the engine under a `story_progress` row lock. Crates, credits, the `story_rewards` receipt and the faction event commit with the step change; staging, the hull patch and the cached standing run after commit.
- `Core.Universe.StoryTraffic` plus `Navigation.stage_story_contact/3` and `clear_story_contacts/2` (apps/core): the private Vesper-02 and Corsair-17. Core stays database-free.
- Hooks: `Sunracer.World` (hail, resolve, tactical start and finish, station talk, story actions) and `SunracerWeb.WorldChannel` (accepted flight commands, the pilot's own navigation snapshots, docking). The channel pre-filters with the engine so high-rate events skip the database.
- Client: `story_hud.mjs` (cockpit objective card `#story-comms`), `story_radio.mjs` (dismissible, multi-line scripted transmissions delivered only on committed step changes), the stereo HUD objective line, and `helmet_story` for the phone headset. Ross issues the assignment via `story_dispatch_offer` and `story_dispatch_accept`, with a separate NPC dialogue; the generic `story_action: accept_consignment` is rejected.
- `Sunracer.Story.Scenes`: nine narrated step transitions plus a rescue-retry scene. A story event carries its scene only on commit; reconnect snapshots do not replay old transmissions. Hailing Vesper-02 or Corsair-17 has separate scripted lines, and Corsair's surrender plea requires the authoritative surrendered ship state.
- The station debrief is strictly ordered: Mara's repair/inspection must be complete and the verified surrender evidence flag must be present before Juno's story topic is offered.
- The one-time First Run payout remains **500 credits**. Extra and repeatable missions remain disabled by design until the current storyline is fully play-tested and signed off.

**Design changes made while building.**

- The consignment is **3 crates**, not 6: the Sunracer's hold is 4 t. Three leave room for one seized crate from Corsair-17. If the hold is full, accepting the surrender (without seizing) still completes step 6.
- **Vesper-02 in the story is a private copy** on the Earth–Mars run, staged for the prologue pilot only. The shared Vesper-02 keeps its Earth–Venus timetable, and other pilots never see the story copy. The story copy cannot be attacked.
- **Story vessels hold position** where they are staged; they are props for one encounter hold and retire when the voyage ends.
- **The fight is won by range, not stats.** Player beams reach 540 world units, the Dart's laser 420. Standing still against Corsair-17 loses; holding it between 420 and 540 wins without damage. **Updated 2026-11-21:** this is no longer achievable in cruise. Cruise reverse is now capped at a third of forward speed (105.6), which is slower than a Dart closes (210), so the gap collapses in 1.15 s. The gap can only be held under Newtonian flight, by running up to speed and then rotating to face the raider while still coasting away. Step 6's prompt now teaches that manoeuvre and the Ctrl+E mode switch, and step 3 plants the flight assist where cruise is first introduced so step 6 is not a cold introduction. See `docs/flight-combat-balance.md`.
- **Corsair-17 surrenders at 50% hull.** Destroying it instead loses the data chip, so the rescue is redone like any other failure.
- **Timing.** Vesper-02 closes in once the Earth–Mars cruise passes 12%. The distress call fires when the pilot cruises within 2.5 million game-km of the Green Starbase, in either direction. After a failed rescue it waits for a later voyage.
- **Skip** pauses the whole prologue (no staging, no prompts); *Resume story* continues from the same step.

**Not built yet.** Chapter 1, non-story missions, and human-verified end-to-end gameplay signoff. An executable First Run sequence, unique server-verified radio scenes, and the manual test script are in place; see [the playthrough](story-first-run-playthrough.md). Ilya Quill has a credit-priced outfitting shop.

**Known gap in the step 6 fight (2026-11-21).** Corsair-17 bee-lines at the
pilot and has no tactical states, so once the pilot establishes the 420-540 gap
the raider politely stays inside it. That turns a touchy fight into a slow but
safe one. A full-health Dart takes 25.9 s of unbroken accurate fire to kill
with the stock Garnet beam (245 hull plus 120 shields at 0.6 absorption), while
a Dart kills the pilot in 10.8 s. Corsair-17 surrenders at 50% hull, so the
tutorial fight is roughly half that, but it is still a long first engagement
and worth re-checking once the raider can break off and re-approach.

### 2026-11-25 range playtest update

The earlier 420–540 band described above is historical. Current player beam range is 1,080; Corsair-17 remains at 420. The wider 660-unit standoff band is a deliberate playtest adjustment. The Newtonian retreat manoeuvre remains useful, but the timing and difficulty of the encounter need a fresh playthrough.
