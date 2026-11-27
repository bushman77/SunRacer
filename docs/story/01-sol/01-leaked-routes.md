# Phase 01 — SOL · Chapter 01: Leaked Routes

**Design revision:** 0.1 · 2026-11-26  
**Status:** owner authorized implementation on 2026-11-27. First assignment implementation underway; M2/M3 remain design-only. Runtime verification and manual playthrough pending.  
**Previous:** [First Run](../../story-first-run.md) · **Next:** Following the Money (outline only).

Follow [MISSION_DESIGN.md](../MISSION_DESIGN.md), [CAMPAIGN.md](../CAMPAIGN.md), [LORE.md](../LORE.md), [FACTIONS.md](../FACTIONS.md), [CHARACTERS.md](../CHARACTERS.md) and [TIMELINE.md](../TIMELINE.md). This chapter is set in the existing Year 500 SOL campaign. No system unlock, optional quests, repeatable contracts, new economy or permanent NPC relocation.

## 1. Narrative purpose

The pilot completed First Run. They have a Helios courier license, recovered navigation evidence from Corsair-17 and Mara's military-grade emitter assessment. Juno asked them to return after their Mars delivery.

The player now discovers that the leaked route was distributed through a legitimate commercial routing exchange and that one unusual transaction is associated with its distribution. This demonstrates a traceable supply of information rather than random piracy. It does not establish which person transmitted the route to Corsair, whether they were coerced, or whether a whole organization was responsible.

**Player experience:** begin with an investigation aboard the familiar station, fly to Earth and Venus to establish the evidence, survive an attempted intercept, and return to Juno with a concrete financial lead. Three assignments deliberately vary the activity: investigation, navigation and verification, then combat and delivery.

**Ending lead:** an authenticated commercial audit identifies a suspicious processing charge billed through a clearing account. Chapter 2 will investigate the money. Do not identify the Directorate or the final culprit in Leaked Routes.

## 2. Eligibility and locations

The existing First Run row must be complete (chapter `prologue`, step 10), with verified `data_chip`, `talked_mara`, `talked_juno` and `helios_license` flags. Preserve the existing `prologue:first_run` reward receipt; check it exists for normally completed pilots. If historical data is inconsistent, diagnose and repair explicitly rather than granting fabricated evidence or forcing the player to repeat First Run. The actual preexisting credits and faction standing are not prerequisites: a pilot may have spent their reward or changed standing.

Chapter 1 is eligible on completion, but begins only after an explicit offer and acceptance with Juno Rook at the Green Starbase Mission Office. The pilot can continue normal sandbox activities instead. No initial enemy staging.

| Contact/location | Existing identity | Chapter function |
| --- | --- | --- |
| Juno Rook, Green Starbase | `missions` / `mission_office` | Issuer, evidence review, chapter debrief |
| Tarek Sol, Green Starbase | `trade` / `trade_exchange` | Explains commercial distribution and identifies an audit reference |
| Eno Kade, Green Starbase | `comms` / `communications` | Compares the station routing copy and its distribution record |
| Halden Ross, Earth orbit | `helios_dispatch` | Supplies the original filed routing record through an authenticated local remote contact |
| Venus orbital freight exchange | Existing Venus destination; **new proposed remote contact Nadia Pell** | Neutral audit contact verifies a clearing record and issues the final courier assignment |
| Breaker-09 | **New proposed mission-scoped raider vessel**, unaffiliated, Dart class | Attempts to intercept the pilot's return journey |

Nadia Pell is a proposed fixed communications contact at the Venus freight exchange, not a walkable station NPC. She is an audit clerk, precise and wary of making unsupported accusations. Her service is restricted to reviewed story dialogue in this milestone. No new faction ID or physical orbital interior is required; authenticate her local contact using authoritative navigation. A future service can reuse her stable identity without changing her location.

Breaker-09 is a callsign, not a named person, not a shared traffic vessel and not a proven Directorate agent. No new permanent NPC model is required. The new names are provisional until review. Mara, Ilya and Sera remain at their established service counters; no extra quest participation is required simply to use the entire cast.

## 3. Evidence and knowledge boundaries

First Run currently persists a verified evidence flag, not a raw captured file or a database of historical route logs. Implement this chapter using authored story evidence unlocked by the actual validated interactions, bound to the pilot and chapter. Do not pretend existing production telemetry already contains the new fictional documents.

For revision 1, durable evidence can be represented by explicit chapter flags with stable authored record references. If actual structured records are needed later, migrate compatibly. All values are selected server-side from the reviewed story definition, never supplied by the client as a document ID, timestamp or proof. The reference names below are fictional, local to this story; they are not real account numbers.

| Evidence key | Source and proposed content | What it proves / does not prove |
| --- | --- | --- |
| `prologue.data_chip` | Existing verified Corsair surrender record | The raider had the pilot's prefiled route. No identified leaker. |
| `prologue.talked_mara` | Existing completed Mara inspection | Military-grade damage was identified. No arms supplier proven. |
| `station_distribution` | Eno's authorized station routing record | Station received a legitimate distribution copy of the original route before departure. Does not show who leaked it. |
| `exchange_reference` | Tarek's commercial exchange reference, batch AX-41 | A licensed routing service processed the distribution. The Merchant League is one customer, not established culprit. |
| `dispatch_original` | Ross's filed route record, obtained at Earth | Confirms the recovered route matches the filed version and approved distribution to station and exchange. Does not establish who exported the copy to Corsair. |
| `clearing_audit` | Nadia's authenticated Venus audit extract for AX-41 | A separately billed access-processing charge, reference VX-204, is associated with the distribution. The beneficiary is masked by a clearing account; no named culprit. |
| `intercept_resolved` | Server-verified settlement of the pilot's own Breaker-09 encounter | The pilot survived and resolved the attempted interception. Hail suggests someone knows the audit was obtained, not who ordered it. |
| `case_delivered` | Juno's validated final hand-in of the completed evidence chain | The investigation has a financial lead and is ready for Chapter 2. |

AX-41 and VX-204 are authored narrative references, not a lookup against an existing dynamic trade ledger. Evidence is non-transferable knowledge/records, no cargo slots, no sellable items, no equipment requirement, no value in the trade console. Records persist after death and reconnect once obtained. Delivering the case does not erase the evidence. No other player's records can satisfy objectives. Do not expose later evidence, the Directorate or the Architects before the relevant objective.

### Three plausible suspects

- **Helios dispatch:** access to the original plan; distribution was legitimate, but misuse remains possible.
- **Solar Merchant League:** commercial motive and access through a licensed exchange; benefiting from a leak is not proof of responsibility.
- **Green Starbase:** legitimate copy and proximity to the attacked lane; station access remains a possibility without making the staff guilty.

The same copied record could have passed through several hands. The charge provides a traceable lead, not a verdict. The culprit remains an explicit open decision.

## 4. Mission sequence and proposed rewards

Three separately accepted, nonrepeatable main-story assignments. Rewards are design proposals for review, not current game values.

| # | Stable proposed mission ID | Title | Issuer | Completion | Credits |
| --- | --- | --- | --- | --- | ---: |
| 1 | `sol.leaked_routes.station_records` | The Distribution List | Juno Rook | Return both station records to Juno | 200 |
| 2 | `sol.leaked_routes.follow_the_copy` | Follow the Copy | Juno Rook | Obtain original at Earth, then audit at Venus | 400 |
| 3 | `sol.leaked_routes.secure_the_record` | Secure the Record | Nadia Pell | Resolve scoped intercept and debrief Juno | 600 |
| | | Total | | | **1,200** |

No standing adjustment, equipment grant, physical cargo consumption, trade price modification or wormhole clearance in this chapter. Reward amounts are intentionally modest relative to the existing 500-credit First Run. Juno authorizes the investigation budget, including the return assignment offered on her behalf by Nadia. Use existing story reward receipts, one per mission, with the stable mission ID as reward identity or an explicitly reviewed equivalent. Never change reward identity when editing text.

## 5. Mission 1 — The Distribution List

**Prerequisites:** completed First Run, no Chapter 1 acceptance yet, valid docked position within range of Juno's existing office.  
**Offer topic:** `leaked_routes.offer_station_records` — "About the leaked route".  
**Accept topic/action:** conversation-bound, explicit acceptance of this offer. Opening the topic alone is read-only. Decline leaves the assignment available.

### Offer scene

**Juno:** "You finished the run. Good. I checked the record from Corsair. They didn't guess where you'd be. Someone had your filed course before you left Earth."

**Pilot option — Who else had access?**

**Juno:** "Dispatch, the freight exchange, and this station all handle parts of the same flight plan. That's three places to look, not three guilty parties. Eno can compare our communications record. Tarek knows how the commercial copies are distributed."

**Juno:** "Speak to both of them and bring me their references. Two hundred credits for the investigation. Don't pick a fight just because somebody looks guilty."

**Player choices:** Accept investigation / Not now.

### Objective and event specification

| Objective ID | Player action | Verified producer / predicate | Durable effect and next objective |
| --- | --- | --- | --- |
| `accept_station_records` | Accept Juno's offer | Authenticated World station interaction; exact offered mission, current prerequisites, Juno proximity, server recheck under lock | Mark mission active; expose two investigation topics |
| `collect_station_distribution` | Ask Eno "Who received our route?" | World.station_talk with validated `comms`, current topic, actual room/range | Record `station_distribution` |
| `collect_exchange_reference` | Ask Tarek "How was the route distributed?" | Same station authority, validated `trade`, current topic | Record `exchange_reference` |
| `report_distribution` | Return to Juno and select "Report the distribution list" | Validated `missions` topic with both records already committed | Complete M1; create unique 200-credit receipt and credit once; make M2 offer eligible |

Eno and Tarek may be consulted in either order. No completion via ordinary shop conversation, general greeting, remote topic call or another pilot's dialogue. Repeat reads return the same approved information without additional progression.

### Dialogue and objectives

**Eno, topic `leaked_routes.station_distribution`:**

"Here's our station copy. It came through the usual dispatch distribution before your departure. No unusual source on the receipt itself. That's not enough to tell me whether somebody copied it afterward. I've marked the distribution record for Juno."

**Tarek, topic `leaked_routes.exchange_reference`:**

"Flight plans aren't only navigation. Cargo contracts, berth estimates and insurance all depend on them. The commercial copy went through a licensed exchange under batch AX-41. Plenty of organizations use that service, including the Merchant League. If you want proof, follow the batch, not the logo on the invoice."

**HUD active:** "Speak to Eno Kade and Tarek Sol at Green Starbase." Checks: station distribution / exchange reference. Once both committed: "Report the distribution list to Juno Rook."

**Juno, topic `leaked_routes.report_distribution`:**

"Two legitimate copies, and neither tells us who passed the record to Corsair. Good. We know where to look without making accusations. I'll settle the two hundred. Now we need the original from Ross and an independent audit of AX-41."

**Committed completion radio:** Juno: "Distribution list recorded. Your payment is confirmed. When you're ready, ask me about following the copy."

No travel or combat staging for M1. Normal station repairs, trade and fitting remain available.

## 6. Mission 2 — Follow the Copy

**Prerequisites:** M1 completed and receipted; valid contact with Juno.  
**Offer topic:** `leaked_routes.offer_follow_copy` — "Follow the copy".  
**Accept:** separate explicit NPC acceptance; do not accept automatically after M1.

### Offer scene

**Juno:** "First, go to Earth and ask Ross for the original flight plan. He'll know which record you mean. Then take the distribution reference to Nadia Pell at the Venus freight exchange. She's a careful auditor."

**Juno:** "Do this in person over local ship communications at each destination. I don't want the entire case passed around a public channel. Four hundred credits when Nadia verifies the audit. You won't need cargo space."

**Choices:** Accept assignment / Not now.

### Objective and event specification

| Objective ID | Player action | Verified producer / predicate | Durable effect and next objective |
| --- | --- | --- | --- |
| `accept_follow_copy` | Accept at Juno's office | Validated exact offer and M1 completion, rechecked under lock | Activate M2 |
| `obtain_dispatch_original` | Launch, plot Earth, engage cruise; at verified Earth arrival contact Ross and select "Request original flight plan" | Authoritative SOL navigation idle at `earth`, live authenticated pilot/ship, no pending/tactical encounter, validated Ross topic and active objective | Record `dispatch_original`; make Venus audit eligible |
| `verify_clearing_audit` | Plot Venus, cruise; at verified Venus arrival contact Nadia and select "Audit batch AX-41" | Same local-contact rules at `venus`, exact proposed auditor contact and eligible topic, all earlier evidence present | Record `clearing_audit`; complete M2 and once-only 400-credit payout atomically; expose M3 offer |

Arrival is eligibility, not mission completion. A pilot already at the target can use the appropriate contact only after the assignment is accepted; do not require meaningless departure and re-arrival if the current validated state qualifies. No physical station interior at Earth/Venus is assumed. Wrong planet, traveling state, free-flight tactical encounter, stale contact or mismatched topic must fail. Existing Ross First Run offers remain unchanged.

**Implementation dependency:** an authenticated local story contact interaction for Ross and Nadia, including exact destination checks, current chapter eligibility and UI on supported clients. Existing First Run remote dispatcher channel is a precedent, not an existing generalized local contact directory. Use an explicit action from the story HUD to open the validated NPC conversation; the HUD cannot accept or fabricate the record.

### Dialogue and objectives

**Ross, topic `leaked_routes.dispatch_original`:**

"Your original is still on file. Earth to Mars, three medical crates. Same route record Juno described. Our authorized distribution went to Green Starbase and the commercial exchange. I can confirm that, but I can't tell you what anybody did with a copy after it left our desk."

**Ross:** "If you're asking whether someone here sold it, I want to know the answer as much as you do. I've released the filed record to your case."

**HUD before Earth:** "Travel to Earth and contact Dispatcher Ross." Once at Earth: "Ask Ross for the original flight plan." After record commit: "Travel to Venus and contact the freight exchange auditor."

**Nadia, topic `leaked_routes.clearing_audit`:**

"AX-41. Yes, I have the distribution entry. Your original matches. There is one separate access-processing charge under VX-204. I can't establish a recipient for that from this record. It was passed through a clearing account."

**Nadia:** "A charge isn't proof of who received the leaked route. But it is a place to start looking. I'll certify the extract and confirm your assignment with Juno."

**Committed completion radio:** Nadia: "Audit verified. Four hundred credits settled. I have one more request, on Juno's authority. Speak to me before you leave Venus."

The chapter does not create a general live invoice database or add a merchant job market. No raider is spawned until M3 is accepted.

## 7. Mission 3 — Secure the Record

**Prerequisites:** M2 completed and receipted; `clearing_audit` durable; pilot at verified Venus idle state with valid local Nadia conversation.  
**Offer topic:** `leaked_routes.offer_secure_record` — "Return the certified audit".  
**Accept:** explicit separate NPC offer; do not begin automatically after audit.

### Offer scene

**Nadia:** "Someone asked whether AX-41 had been audited. They shouldn't know what you asked me to look up. I don't know who made the inquiry, but I'm not sending the extract back over the same commercial exchange."

**Nadia:** "Carry the certified record to Juno yourself. Plot Earth first, then return to Green Starbase. If someone challenges you on the lane, deal with the threat before continuing. Juno has authorized six hundred credits for a completed return."

**Choices:** Accept return assignment / Not now.

### Objective and event specification

| Objective ID | Player action | Verified producer / predicate | Durable effect and next objective |
| --- | --- | --- | --- |
| `accept_secure_record` | Accept Nadia's local offer | Exact eligible conversation, Venus idle and M2 receipt/evidence, rechecked under lock | Activate M3; authorize one scoped intercept on eligible voyage |
| `intercept` | Plot Earth from Venus, engage cruise and resolve Breaker-09 | Server observes eligible Venus-origin Earth-bound voyage; stages private contact. Owned tactical settlement `:surrender` or `:victory` verifies outcome | Record `intercept_resolved`, exact attempt identity and outcome once; clear private contact after settlement |
| `deliver_case` | Continue travel, plot Green Starbase using existing waypoint, dock and walk to Juno; select "Deliver the certified audit" | Validated `missions` interaction at Green Starbase and all committed evidence including intercept result | Mark `case_delivered`; complete M3 and chapter; once-only 600-credit payout |

Earth is the required destination of the intercept voyage; do not introduce a separate unimplemented orbital hand-in there. After the encounter is settled the player may finish Earth travel or use any valid existing route to Green Starbase. Juno's final topic is gated by the committed intercept result and physical interaction, not by a fabricated additional Earth arrival requirement. The wording of the offer and objective should make clear that the Earth-bound leg establishes the intercept lane.

### Scoped encounter: Breaker-09

Proposed script `leaked_routes_intercept`, class Dart, affiliation existing `independent_raiders`. Use the current Dart class baseline; surrender threshold proposed at 50% hull, matching the proven prologue pattern. No new weapon or equipment required. The actual difficulty and balance require stock-Sunracer playtesting before acceptance.

- Stage only for the pilot with an active M3 and no committed intercept result, while cruising an authoritative Venus-to-Earth voyage at or beyond 12% progress, with no pending or active tactical encounter. The origin must be verified by Navigation's voyage state or a durable server-owned departure binding, not a client assertion or merely the current destination.
- Reuse private story contact overlay, encounter hold, tactical controls and authoritative settlement. Script selection, contact and attempt identity are server-owned, distinct from First Run. Preserve the shared Vesper-02 schedule and all other pilots' traffic.
- Hail is available but not required for the outcome. It does not satisfy the intercept objective. The HUD instructs the pilot to defend the ship if challenged.
- Surrender or victory both qualify. The audit was already obtained at Venus; no vital record is stored in the attacker's ship. Unlike Corsair-17, destroying this attacker does not destroy the required evidence.
- Use no special cargo reward; proposed empty manifest. The assignment payout occurs only at Juno. No new faction-standing reward for this mission; review ordinary tactical settlement effects before implementation so the proposed encounter cannot unintentionally grant or charge story-specific rewards.
- Treat ordinary retreat, defeat, escape, ignored hold, canceled route and lost encounter as incomplete. Provide explicit retry instructions; never advance from a client-reported victory or inferred absence of the raider.
- If a tactical lease exists, do not clear it prematurely. An attempt can be rearmed only after authoritative settlement or reconciliation. The exact owned attempt and voyage must be verified; stale settlements from an old attempt cannot advance a new one.
- If a durable result cannot be recorded after a verified tactical settlement, reconcile from authoritative settled evidence when available; if unavailable, permit a new attempt after cleanup, never infer success. Completion must be idempotent. Runtime staging failures remain retryable.

**Implementation dependency:** extend the existing script catalogue and private staging/settlement integration for this new encounter. Existing `StoryTraffic` only has `:vesper_pass` and `:corsair_raid`. Do not reuse a Corsair identifier or the prologue's step-6 recovery path for this chapter. Confirm exact ownership, attempt identity and origin binding against Navigation before implementation.

### Radio and objective script

**Upon acceptance, Nadia:** "Take the Earth-bound route, courier. Keep the record secure. Juno will be waiting at Green Starbase."

**HUD:** "Plot Earth from Venus and engage cruise."

**At the committed/staged encounter notification, Breaker-09, open channel:** "Courier, you're carrying material that doesn't belong to you. Stand down and hand it over."

**If hailed, Breaker-09:** "The exchange record. That's all we want. Hand it over and you can continue on your way."

**HUD while held:** "Resolve the Breaker-09 interception. Surrender accepted or victory counts."

**On verified surrender, Breaker-09:** "We're done. Keep your record. We aren't being paid enough for this."

**On verified victory, pilot-facing status:** "Interceptor neutralized. Audit record intact."

**Committed success radio, Juno (SOL relay, if available; otherwise stored objective text):** "Keep that record. Don't chase another ship. Bring it straight to the Mission Office."

**HUD after success:** "Return to Green Starbase and deliver the certified audit to Juno."

**Retry prompt after failure:** "The audit is still secure. Return to Venus, repair if necessary, and take a new Earth-bound voyage to resolve the interception." Repairs remain available at Green Starbase under current rules; normal respawn and travel remain unchanged.

### Final debrief

**Juno, topic `leaked_routes.deliver_case`:**

"Let's see it. Station distribution, commercial batch, dispatch original, and the certified audit. The sequence holds. Someone paid to process access to the same route Corsair had. It could still have passed through any of those places."

**Juno:** "And somebody tried to stop you carrying this record back. That's worth noting, but it doesn't tell us who gave the order."

**Juno:** "VX-204 is our lead. Whoever paid that charge used a clearing account. We follow the money next, not the rumors. Six hundred credits. You've earned them."

**Committed chapter-complete radio:** "Investigation complete. Payment confirmed. Come back when you're ready to discuss the clearing account."

**HUD:** "Leaked Routes complete. Await the next assignment from Juno Rook." Do not offer a playable Chapter 2 until its design and implementation are approved.

## 8. Durable state, acceptance and compatibility

A minimal proposed chapter-specific progression fits the current step constraint without altering the prologue row. Final implementation may use these steps or an equivalent reviewed mapping. Keep objective and reward identities stable.

| Step | Meaning | Transition |
| ---: | --- | --- |
| 1 | Eligible; M1 offer available | Valid Juno acceptance -> 2 |
| 2 | M1 active; collect both local records | Both flags -> 3 |
| 3 | M1 hand-in | Verified Juno report + reward -> 4 |
| 4 | M2 offer available | Valid Juno acceptance -> 5 |
| 5 | M2 active; Earth original | Valid Ross record -> 6 |
| 6 | M2 active; Venus audit | Verified Nadia audit + reward -> 7 |
| 7 | M3 offer available | Valid Nadia acceptance -> 8 |
| 8 | M3 active; intercept | Verified qualifying settlement -> 9 |
| 9 | M3 active; Juno hand-in | Verified case + reward -> 10 |
| 10 | Chapter complete | No additional progression or payout |

Step 1 may be derived from a completed prologue until first acceptance; no requirement to insert a row merely to show eligibility. If a row is created on first read, it must not itself constitute acceptance. No existing pilot is reset or moved from the completed prologue until eligibility and active chapter selection are correct.

Use a new chapter key (proposed `sol.leaked_routes`) and revision 1 marker, not reuse `prologue`. Keep step flags, accepted assignment, evidence, receipts and attempt metadata under the existing story transaction boundary as appropriate. Existing progress constraint 1–10 can accommodate this proposed mapping; no migration is authorized in advance. Reward uniqueness and atomic progress/credit settlement are mandatory, including concurrent retries. All three acceptance operations must revalidate contact/offer and current state under the relevant authority.

The existing `Sunracer.Story` progress, public state, topics, events, scenes, `World.recover_story_encounter` and `WorldChannel` prefilters are prologue-specific. Extend minimally to select and dispatch the active chapter, preserve the First Run completion snapshot/receipt, expose correct mission topics, and avoid interpreting a Chapter 1 step 6 as a lost prologue rescue. If a new revision requires different persistence, review and test a compatible migration. Avoid a generic quest engine.

A committed scene is emitted once for the relevant transition; repeated reads and reconnect snapshots must not replay completion as a new event. A stage notification depends on actual server staging, not merely an intention to stage. If the objective is paused, do not stage new threats. Proposed behavior: optional main-story pause/resume outside active tactical encounters; while paused normal services remain available and durable records persist. Reject pause during a live tactical encounter or require ordinary settlement first. No abandonment/reset of accepted assignments in this chapter. Reassess pause implementation if it requires changes outside the reviewed mission scope; leaving an offer unaccepted is always supported.

## 9. Recovery matrix

| Failure / interruption | Required behavior |
| --- | --- |
| Decline any offer | No acceptance, new cargo, payment or encounter; return to that NPC whenever eligible |
| Leave or disconnect during local investigations | Preserve committed flags; return to missing contact |
| Incorrect dialogue, wrong planet, lost access | Reject action; retain objective; give current location/eligibility guidance without granting remote services |
| Death before or after obtaining records | Normal respawn; retain committed records and rewards; return to appropriate contact |
| Full hold, sold cargo or no credits | Records use no slots and missions require no purchase; existing economy unchanged |
| Wrong route, canceled voyage, ignored encounter | No intercept success; clear eligible private pending state safely, require a fresh Venus-origin Earth-bound voyage |
| Retreat/defeat/escape or lost tactical encounter | Retain certified audit; reconcile settled/leased state; rearm for later eligible voyage, no reward |
| Disconnect during tactical encounter | Use existing tactical settlement and reconnect recovery boundaries; if unresolved and lease cleared, rearm; never silently mark victory |
| Duplicate or stale acceptance/settlement | Reject or idempotently return already committed state; no extra credits or duplicated scene |
| Faction hostility affecting transit | No new mandatory faction-standing gate. Existing lawful access/warrant rules remain; verify there is a practical route to required contact, or specify a narrowly authorized recovery interaction before release |
| New version or rollback | Preserve completed prologue and Chapter 1 evidence and receipts; do not reset active assignments; evaluate release/schema compatibility |

The retry is deliberate and limited to a valid new voyage; no repeated staging in the same failed attempt. No extra payout for a repeat. Stock ship, available repairs and the existing flight controls should be sufficient. If playtests find a practical soft lock, fix the design before expanding.

## 10. Player-facing UI and capability boundaries

Reuse existing station dialogue, NPC offer presentation, story HUD, radio, Atlas, combat and docking. For Ross and Nadia, open a validated local NPC conversation from the current objective while at the required location. Separate offer display from acceptance. Native and browser clients must support the same commands; SBS must display the current objective and preserve existing headset/desktop interaction boundaries. Do not add global markers, a general quest log, a new dialogue keyword engine or forced tutorial replay.

| Existing capability | New, chapter-specific work |
| --- | --- |
| First Run progress, unique receipts, pure transitions | New chapter engine and active chapter selection, distinct evidence and reward handling |
| Validated station contact and topics | New exact topic/offer/acceptance handling without weakening proximity checks or legacy story dialogue |
| Earth/Venus strategic destinations, local navigation | Local remote story contact eligibility and dialogue for Ross/Nadia |
| Private First Run staging, hold and tactical settlement | New Breaker-09 script, exact attempt ownership, origin checks and recovery |
| Story prompts, radio and snapshots | Chapter-aware prompts, three offers, completion and reconnect behavior |

No new GLBs, planetary interiors, live wormhole transport, faction systems, general record database, side quests or additional story chapters in this milestone.

## 11. Verification and acceptance plan

### Automated tests required before gameplay signoff

- Preserve all First Run transitions, pause/resume, rescue recovery, original 500-credit reward, license, +5 Helios standing and existing receipt.
- Completed prologue eligible; incomplete/paused prologue not eligible; repeated login does not accept any Chapter 1 mission.
- Station M1: offer/decline, direct accept without offer rejected, wrong room/range rejected, Eno/Tarek in either order, hand-in requires both, 200 credits exactly once even under concurrent calls.
- M2: prior completion and separate acceptance, wrong system/planet and traveling contact rejected, Ross before Nadia, no auto-completion on arrival, 400 credits once; existing dispatcher paths remain valid.
- M3: no staging before acceptance, wrong origin/destination/replayed voyage rejected, exact private contact ownership, no other pilot sees/uses it; no stage during unrelated active tactical hold.
- Verify surrender and victory each complete intercept only, wrong outcomes do not; retreat, defeat, canceled voyage and reconnect rearm only when safe; no duplicate staging/payout or stale-attempt success.
- Final Juno contact requires all flags, correct proximity, committed intercept; 600 credits once and step 10. Chapter 1 pays exactly 1,200 credits across its three receipts, not counting unrelated economy or First Run. No travel unlock or unintended story standing/gear change.
- Chapter selection and chapter-specific prefilters/recovery never mistake same-numbered steps for the prologue; old stored rows and reward receipts retained.
- Two pilots at differing stages share station roster, positions and baseline services. Story topics, evidence, radio and encounters remain correctly scoped.
- Browser/native/SBS objective and NPC offer consistency, stale offers rejected, no future narrative spoilers and no replayed completion scenes on reconnect.
- Run applicable Mix/precommit and JS tests; record actual results and limitations.

### Manual playthrough

1. Complete First Run on a test pilot or use an existing legitimately completed pilot; verify original receipt and current balance before starting.
2. Return from Mars to Green Starbase. Decline Juno once; verify trade/repair remain possible and no mission started.
3. Accept Distribution List, speak to Eno and Tarek in either order, report to Juno; verify 200-credit receipt.
4. Accept Follow the Copy. Try Nadia before Ross, verify no advance. Fly Earth, speak to Ross; fly Venus and obtain audit; verify 400-credit receipt.
5. Decline and later accept Nadia's return assignment. Fly Venus to Earth. Verify Breaker-09 stage and scope with a second pilot if available.
6. Test at least one failure and recovery using a fresh valid voyage. Verify a successful settlement with a stock Sunracer; check both surrender/victory paths through automated tests and manual runs as practical.
7. Return to Green Starbase; dock, walk to Juno, deliver audit. Verify 600-credit receipt and Chapter 1 complete.
8. Reconnect, revisit earlier contacts and inspect mission state: no lost records, double reward or shared NPC relocation. Confirm Alpha Centauri remains locked and Chapter 2 is not live.
9. Record actual playthrough results, combat balance and any friction. Review before proceeding to Following the Money.

## 12. Approval decisions

Review before implementation:

- Three missions and the Earth/Venus/Green Starbase route.
- Nadia Pell, the fixed Venus remote auditor; Breaker-09, the private intercept callsign.
- AX-41 and VX-204 fictional evidence references and the financial lead; culprit remains unresolved.
- 200 / 400 / 600 credits, no story standing or item reward; preserve existing unrelated mechanics.
- Stock Dart baseline and 50% surrender, both verified surrender and victory acceptable; retry from Venus after failure.
- Proposed chapter steps, exact contact authorization, version compatibility and pause behavior.

Implementation authorized 2026-11-27. Deliver the first assignment as an incremental milestone; preserve the remaining design, and do not mark the chapter complete until all three assignments are implemented and verified.
