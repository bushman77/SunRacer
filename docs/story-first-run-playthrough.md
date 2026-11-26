# First Run — mission screenplay and verification route

The playable opening chapter has **nine objectives**, all owned by the
authenticated server state machine. The player receives **one** mission: the
medical consignment from Dispatcher Halden Ross. The following encounters
and station visits are *objectives of that same mission*, not extra contracts.

The core implementation is `Sunracer.Story.Prologue`, the persistence layer
is `Sunracer.Story`, the radio scenes are `Sunracer.Story.Scenes`, and the
pilot-facing clients are `story_hud.mjs` and `story_radio.mjs`.
Dialogue is scripted; no LLM is required.

## Story beats, mechanics and verification

| Step | Speaker / event | Player action | Verified transition | Radio scene |
| --- | --- | --- | --- | --- |
| 1 | Ross: preflight | Throttle and rotate the Sunracer | MapServer accepted both inputs | `systems_green` |
| 2 | Ross: medical consignment | Open Ross's comms, read the offer, accept | Explicit authenticated offer and channel-scoped acceptance; three cargo crates loaded once | `consignment_loaded` |
| 3 | Ross: clearance | Plot Mars and engage SOL cruise | Authenticated voyage traveling to Mars | `outbound_lane` |
| 4 | Captain Varga: Vesper-02 | Hail her, or continue the verified encounter | Server-authorized Vesper hail or held-encounter resolution | `vesper_distress` |
| 5 | Eno Kade: rescue | Approach Green Starbase and enter Corsair tactical combat | Tactical start against this pilot's staged private Corsair-17 | `corsair_challenge` |
| 6 | Corsair-17: surrender | Outrange the raider and accept the actual surrender; optional cargo seizure | Server verifies surrendered hull state and settles encounter | `vesper_rescued` |
| 7 | Varga: divert | Approach Green Starbase and complete docking | MapServer station-docked event | `station_debrief` |
| 8 | Mara, then Juno | Physically visit the repair bay; obtain inspection; bring route evidence to Mission Office | Each NPC's genuine range, room and story topic; ordered Mara then Juno | `return_to_route` |
| 9 | Ross / Juno: Mars | Launch, finish course to Mars with all three crates | Verified idle arrival at Mars, full cargo removed in a transaction and one-time reward receipt | `first_run_complete` |

The dialogue card tracks the current task but **cannot** award cargo, complete
combat, or accept a mission. Missions are NPC-issued. At step 2, Ross's offer
can be declined; no cargo is loaded, and the pilot can speak with him again.
Other missions and repeatable jobs are deliberately unavailable during this
story-first development stage.

## Character drama and timing

**Ross:** dry, practical mentor. Systems check -> contract -> departure
clearance -> receipt for all three Mars crates. He pays the 500 credits
only after the server verifies delivery.

**Varga:** senior Helios courier. Her first hail includes a warning about
suspiciously precise attacks on the Earth–Mars lane. Once the voyage nears
Green Starbase her emergency signal breaks up; after the player secures
Corsair's surrender she thanks the pilot and diverts them to Mara.

**Eno Kade:** Green Starbase communications operator. Announces the Vesper
distress, provides an interception vector and tactical range guidance, and
welcomes the pilot after docking.

**Corsair-17:** threatens the pilot on the initial hail and during tactical
entry. Once the server reports its state as `surrendered`, the cockpit
renders its "Hold your fire" appeal. Dialogue cannot forge that state or
bypass the real surrender settlement.

**Mara:** the first required station conversation. Inspects military-grade
weapon damage and performs the established story hull/shield patch. Her
inspection unlocks Juno's report topic.

**Juno:** examines the route evidence after Mara has inspected the hull.
She recognizes the pilot's own filed Helios route and suspects someone is
selling courier itineraries. The real leaker is intentionally *not* exposed
in First Run. Chapter 1, *Leaked Routes*, remains locked and unimplemented.

## Surrender and route evidence

The server's verified Corsair surrender currently grants a persistent
`data_chip` **story flag**; this is the recovered route telemetry from
the surrender handshake. It is **not** an inventory item or a seized cargo
crate. Optional cargo seizure is a distinct authenticated piracy choice:
the 4-tonne starter hold may not have room, and releasing the raider
must not soft-lock First Run.

Destroying Corsair instead of accepting surrender, retreating, losing the
fight or ignoring the intercept fails the rescue. The server returns the
pilot to step 5, suppresses another interception on the same voyage, and
allows a retry on a later voyage. Normal death and respawn preserve mission
progress. A one-time medical crate reissue at Earth remains a provisional
anti-soft-lock rule.

## Manual acceptance route

Use a fresh test pilot (or a pilot at step 1), a functioning server, and
the `story_line` branch. This is a **manual checklist**, not a claim that
all nine beats have been human-play-tested.

- [ ] Complete throttle and steering checks. One Ross objective advances.
- [ ] Open Ross's NPC comms; decline the contract once. Verify step 2 and zero new medical crates. Contact him again and accept.
- [ ] Verify the hold contains exactly three medical crates. Repeated acceptance must not grant more.
- [ ] Plot Mars in Atlas. Hail Vesper-02. Read the warning transcript. Verify the continue button changes from "Ignore / Resume course" to "Resume course" only after a successful hail, then resume. A new encounter resets the wording.
- [ ] On the distress call, engage the private Corsair-17. Hail to hear its threat if desired.
- [ ] Damage Corsair to its 50% surrender threshold. Verify the plea appears once while the enemy is in surrendered state.
- [ ] Accept surrender; choose whether to seize freight only if capacity allows. Verify rescue success irrespective of optional cargo.
- [ ] Dock at Green Starbase. At Juno's kiosk **before Mara**, verify the investigation topic is absent.
- [ ] Visit Mara and use the story repair/inspection topic. Verify hull and shield recovery; then visit Juno and receive the route revelation.
- [ ] Launch and arrive at Mars with all medical crates. Verify exactly 500 credits, Helios standing gain, courier license, cargo consumed and a single story reward receipt.
- [ ] Reconnect and confirm the saved step, credits and ship state persist. Duplicate payout and duplicate radio scene must not occur.
- [ ] Retry the Corsair encounter on a separate test pilot after retreat; ensure it cannot be immediately repeated on the same voyage.

## Automated gate

The SOL workflow runs the pure story, persistence, authenticated world-channel,
private-contact, cockpit radio and scene tests before broader helmet tests.
A full manual run remains necessary for in-cockpit readability, timing,
headset comfort and the end-to-end combat difficulty of the Corsair encounter.
