# SpaceNova — Mission design and implementation contract

**Revision:** 0.1 · 2026-11-26

**Status:** working design contract following the project owner's agreement to focus on the main storyline. The scope and persistent-NPC constraints reflect agreed direction; proposed interfaces, versioning details, acceptance checks and future storage changes require review before implementation. This file does not enable new missions.

**Related:** [CAMPAIGN.md](CAMPAIGN.md), [LORE.md](LORE.md), [FACTIONS.md](FACTIONS.md), [CHARACTERS.md](CHARACTERS.md), [TIMELINE.md](TIMELINE.md), [First Run design](../story-first-run.md), [First Run playthrough](../story-first-run-playthrough.md).

## 1. Scope: story first

SpaceNova is a persistent limited-sandbox MMO with a main galactic campaign. The story is the current development priority, not the only possible activity in the finished game. Existing trading, flight, station services and shared-world mechanics must remain usable within their actual eligibility rules.

| In scope for campaign development | Deferred until separately approved |
| --- | --- |
| Sequential main story phases and chapters | Optional side quests and independent quest chains |
| Explicit NPC-issued assignments | Repeatable commercial contracts and procedural jobs |
| Server-verified objectives, persistence and recovery | Epic equipment quest chains and extensive faction campaigns |
| Reviewed credits, equipment access and faction rewards | Cooperative quest progression and party rewards |
| Personal progression and eventual system clearance | New guild, quest discovery or generalized scripting systems |

EverQuest is a useful design reference for later optional content, persistent quest contacts and independent quest lines. It is not a feature specification for this milestone. Do not introduce keyword parsing, a quest marketplace, a generic quest DSL, or a large quest-engine rewrite merely to anticipate those features.

Develop one chapter at a time: complete the Markdown design, review it, obtain explicit approval, implement the smallest necessary changes, run regression tests, manually play through the chapter, and review the result before expanding.

## 2. Narrative units and identifiers

| Unit | Meaning |
| --- | --- |
| Act | Major narrative arc spanning several systems |
| Phase | Campaign within one star system, ordered by Core.Universe.StarSystems |
| Chapter | Coherent story sequence with a specific narrative payoff |
| Mission | NPC-issued assignment with an explicit acceptance and completion contract |
| Objective | Observable action or condition verified by the responsible server subsystem |
| Encounter | Scoped runtime interaction supporting an objective; not itself a mission |
| Reward | Durable, uniquely receipted consequence of verified completion |

First Run is the implemented prologue of phase 1, SOL. Its existing chapter identifier `prologue`, step range 1–10, and reward identifier `prologue:first_run` are compatibility anchors. Step 10 means complete. Do not rename these or reset any existing pilot's progress.

New chapters should have stable, descriptive identifiers. Missions and objectives within them need stable identifiers rather than relying on their display titles or position in a list. Example authoring IDs, not approved runtime keys: `sol.leaked_routes`, `sol.leaked_routes.verify_dispatch_record`. A chapter may contain multiple separately accepted assignments; do not make one conversation accept every future assignment.

Keep the next approved chapter as the only new playable campaign content until its playthrough is accepted. The larger campaign outline is not an obligation to implement all phases or a fixed mission count.

## 3. Mission lifecycle

Proposed logical lifecycle for future chapter designs:

```text
unavailable
    | prerequisites verified
    v
eligible -- NPC dialogue --> offered
                               | explicit acceptance, revalidated on server
                               v
                             active
                               | verified objectives / recovery
                               v
                        ready_to_complete
                               | required NPC hand-in or verified settlement
                               v
                            completed
```

This is a design vocabulary, not a new database enum. Offers may be ephemeral. A mission may use a direct verified completion event rather than a separate turn-in when the reviewed design calls for it.

- Eligibility requires the correct preceding campaign progress and any specifically reviewed prerequisites.
- An offer explains the work, destination, necessary cargo/equipment and material rewards or costs. Merely entering a station, selecting a map marker, opening the HUD or receiving a notification never accepts a mission.
- The pilot explicitly accepts through a valid NPC dialogue or authorized remote NPC contact. Recheck prerequisites, session, contact access, and any cargo capacity or other requirements at acceptance, not just when displaying an offer.
- If acceptance effects fail, the mission remains unaccepted and resources are not partially granted.
- Active objectives display a concise in-character instruction, with checks when appropriate.
- A conversation may itself be a valid objective if the design requires a specific authenticated dialogue topic. It cannot stand in for combat, delivery, payment, or evidence not independently verified.
- Completion is durable and once-only. Viewing completed dialogue or reconnecting cannot trigger another payout.
- A player may choose not to pursue the next assignment. Do not force story encounters on a pilot who has not accepted the relevant mission. First Run's existing skip/resume behavior remains a pause, not free completion. New pause, abandonment and retry policies must be specified per chapter; do not silently impose them on existing missions.

A single clear next main-story objective is the current presentation target. This does not require inventing multiple active mission slots yet.

## 4. Persistent NPC and encounter boundaries

See [CHARACTERS.md](CHARACTERS.md) for the accepted continuity rule.

An existing fixed NPC retains their identity, station, room and occupation across all pilots' story progress. Mission content may add dialogue, offers and legitimate story-dependent options without moving, removing or disabling that NPC. Baseline services remain independent of personal narrative eligibility, subject to actual service and world rules.

Station interactions must use the authoritative station, room, proximity and docked-session checks. Remote NPC interactions must validate the particular contact and communication context. Do not allow a client to supply arbitrary NPC identities or gain remote access to local services.

The existing private First Run Vesper-02 and Corsair-17 encounters demonstrate separation of shared traffic from pilot-specific story scenes. Preserve this pattern: authorized server staging, private visibility and exact encounter ownership, controlled cleanup, and no effect on unrelated players' traffic. Normal mobile NPCs retain their established operating routes.

A mission may reference multiple existing contacts. Introduce new NPCs only where the chapter genuinely needs a local role or a scoped encounter. Group completion is deferred; co-presence or shared travel alone never advances another pilot's story.

## 5. Existing implementation: preserve and extend incrementally

The existing code establishes a useful functional design:

| Component | Current responsibility |
| --- | --- |
| Sunracer.Story.Prologue | Pure transition function, eligibility checks, prompts, dialogue and effect intents |
| Sunracer.Story | Reads verified facts, locks progress, applies transitions and durable effects, broadcasts changes |
| Sunracer.Story.Progress | One persisted row per pilot and chapter |
| Sunracer.Story.Reward | Unique reward receipt per pilot and reward ID |
| Sunracer.Story.Scenes | Radio scenes on committed step changes |
| Core.Universe.StoryTraffic | Private, server-staged prologue vessels |
| Core.World.StationAttendants | Fixed service roster and validated conversation |
| Sunracer.World / SunracerWeb.WorldChannel | Integration with authenticated world actions and pilot-specific updates |
| story_hud.mjs / story_radio.mjs / SBS story HUD | Objective and narrative presentation |

Current facts that matter before implementing Chapter 1:

- `Sunracer.Story` is hardcoded to Prologue for progress lookup, row locking, transitions, topics, completion, public state and scenes. Broadcast currently uses the SOL topic and the channel filters by pilot.
- The database already has a unique index on `(user_id, chapter)`, but the `story_progress_step_range` constraint requires step 1–10 for every row. Do not assume it supports arbitrary chapter lengths.
- `story_rewards` has a unique index on `(user_id, reward_id)`. The current prologue settlement consumes three medical crates, grants 500 credits, records a license flag and +5 Helios standing, using the existing receipt and faction-event mechanisms.
- The pure Prologue.apply/3 engine returns `:ignore` or next progress and effect intents. It does not own a clock, database or socket.
- Current durable effects execute within the story transaction. Runtime actions, including staging and hull patching, run after commit. A process exit or failed effect is not automatically equivalent to rollback of the committed story step.
- The current schema has no explicit mission-definition version or general mission acceptance table. The proposed lifecycle and versioning in this document are not already implemented.

The next implementation should extend the existing story boundary only as needed for the approved Chapter 1 design. Possible changes include selecting the active chapter, dispatching to its pure transition module, resolving completed prerequisites and presenting the appropriate prompt. A chapter-specific constraint or compatible migration may be necessary if reviewed objectives require steps beyond the existing range.

Do not undertake a generic quest interpreter, unrelated refactor, or data migration before the chapter specification establishes a real requirement. Preserve the existing Prologue contract and regression tests.

## 6. Server-authoritative event contract

```text
Authenticated player intent
          |
          v
World / navigation / combat / inventory / NPC service
          | validates action and owns outcome
          v
Server-confirmed event + verified facts
          |
          v
Story chapter transition (pure, deterministic)
          |
          v
Transactional progress + durable effects / reward receipts
          |
          v
Reconciled runtime effects + pilot-specific presentation
```

This describes the desired boundary, not a requirement to add an event bus. The existing direct server calls and PubSub can be retained where adequate.

| Objective | Required evidence | Insufficient evidence |
| --- | --- | --- |
| Accept assignment | Validated contact, current eligibility, explicit acceptance | Opening an offer or arbitrary client mission ID |
| Arrive at destination | Authoritative navigation state for the correct pilot, system and destination | Client coordinates, selected Atlas marker or cruise start |
| Dock | Server-confirmed docking at the specified station | Proximity or a rendered docking animation |
| Consult NPC | Validated contact, room/context and exact eligible topic | Generic hail or forged NPC ID |
| Deliver cargo | Verified inventory, quantity, destination and settlement | Client inventory display or arrival alone |
| Resolve encounter | Correct owned encounter and authoritative outcome, including required surrender if applicable | Claimed kill, visual effects or another pilot's encounter |
| Recover evidence | Defined authoritative source and durable evidence record | A dialogue claim or arbitrary item label |
| Traverse wormhole | Future server-confirmed paired exit and durable transfer | Selecting a system, accepting clearance or completing lab transit |

Each chapter spec must identify the concrete producer for every event and fact, the ownership checks, acceptable outcomes, stale/replay handling, and necessary integration tests. If the required producer or authoritative action does not exist, identify it as an implementation dependency rather than fabricating an event.

Reject cross-pilot, wrong-system, wrong-contact, stale-encounter and out-of-order events. Do not trust a client-supplied event tuple, outcome, reward amount or completion flag.

High-frequency movement and navigation updates must be prefiltered using the current objective, following the existing Prologue.wants?/2 pattern. Avoid unnecessary database writes or global broadcast traffic from irrelevant physics ticks.

## 7. Evidence, persistence and rewards

Mission evidence must have an explicit meaning and provenance. Distinguish knowledge flags, recoverable physical cargo and confidential records. First Run's legacy `data_chip` flag means a verified navigation record recovered from the surrender; it is not a physical inventory item.

For each new evidence item, define its source, eligibility, whether it persists after death or cargo loss, whether it can be transferred or sold, how it is validated, and what happens if its source is unavailable. Do not require ownership of a fictional inventory item that the implementation cannot grant.

Durable progression and related cargo, credits, entitlement and standing effects must settle consistently. Use row locks and transactional effects with unique stable receipts where supported. Check receipt creation and apply dependent effects once; do not treat an already-issued receipt as permission to consume cargo again. If a necessary effect cannot be atomic with the existing transaction, specify durable intent and idempotent reconciliation before relying on it.

Preserve completed chapters, earned entitlements and reward receipts. No arbitrary reward amount is approved by this document. For each chapter, specify the actual credits, items or access, inventory capacity/failure rules, faction ID and standing adjustment, effect order, and unique reward identifiers. Faction standing and warrants remain separate; neither automatically grants story completion.

Runtime effects must be safe to retry. If private staging fails after a committed transition, the active objective must still be recoverable. If a durable or runtime action is essential to completion, the next state must not assume it succeeded without verification. Review the existing hull-patch and staging behavior without rewriting it solely because this document exists.

## 8. Failure and recovery design

Every mission must define recovery before implementation. There is no universal rule that all failures erase progress or that all losses are refunded.

| Situation | Required design decision |
| --- | --- |
| Pilot dies | Where normal respawn occurs; which objectives, evidence and rewards persist; how to resume |
| Cargo lost, sold or insufficient | Whether reacquisition/reissue is possible; quantity, cost, limit and route; no permanent unintended soft lock |
| Combat defeat, retreat, surrender or target destroyed | Which outcomes satisfy the objective; how a failed encounter is cleared and safely recreated |
| Docking or navigation interrupted | Whether to continue, restart travel or return to an NPC |
| Disconnect, server restart or process failure | Restore durable progress and reconcile scoped encounters without duplicate effects |
| Repeated, concurrent or stale event | Ignore or reject without changing unrelated state or issuing another payout |
| Faction hostility or missing equipment | A documented recovery path if the mission requires restricted access or equipment |
| Content upgrade | Preserve old objective meaning, accepted obligations, evidence and rewards |

First Run remains the reference for its own recovery semantics: death retains progress, unsuccessful rescue returns to step 5 for a later voyage, server-only reconnect recovery reconciles a lost step-6 encounter, and the existing crate reissue is limited to one. The one-reissue policy was provisional in the original design; do not assume repeated losses are already fully handled. A new chapter must specify its own workable recovery path.

For the future gateway, separate clearance, entrance, active transit, failed transit and verified arrival. Failed transit must not advance the campaign to another system. Production ship persistence, exit transfer and authorization remain unimplemented; see [interstellar navigation](../interstellar-navigation.md). No live unlock belongs in Leaked Routes.

## 9. Content evolution and compatibility

Design new mission content additively:

- Stable chapter, assignment, objective and reward identifiers; display text may evolve without changing identity.
- Explicit definition revision in authoring records. Decide the smallest runtime representation when needed for accepted missions.
- New quests may be offered by existing NPCs without changing their permanent placement, services or previous rewards.
- An already accepted mission must either finish under compatible original rules or undergo an explicitly tested migration that preserves earned progress and obligations.
- Completed missions must not become incomplete merely because a new chapter was published.
- Verify existing pilots at early, middle, paused, failed and completed prologue states before deployment.
- Do not assume hot code replacement also migrates persistent mission data. Release and rollback plans must account for the schema and stored progress.

This is a compatibility requirement, not authorization to build a versioned quest platform now.

## 10. Player presentation

NPC dialogue is the primary narrative interaction. Present a clear objective, necessary destination and meaningful reward terms without disclosing future secrets. The HUD and Atlas track authorized objectives; they do not issue quests or grant travel.

Use the current story HUD, in-character radio and station dialogue patterns where practical. The browser, native desktop and SBS should expose equivalent actionable information and validated commands, not separate story state. Respect existing input ownership during flight; do not force a long conversation in combat or a wormhole turn.

A committed transition may emit a radio scene. Reconnect snapshots show current state without replaying an old transition as a new event. Any later journal/history feature is deferred unless needed for a reviewed mission.

## 11. Chapter authoring template

Create the next chapter in `docs/story/01-sol/01-leaked-routes.md`. Do not duplicate the existing First Run document.

```text
Chapter ID / title / authoring revision / approval status
Narrative purpose and ending lead
Prerequisites and exact previous completion
Established contacts, locations and new actor proposals
Knowledge boundaries / evidence provenance
Mission list and stable identifiers

For each mission:
  NPC issuer, dialogue topic, offer text, acceptance interaction
  Objective sequence and exact player actions
  Server-confirmed triggers and facts; owning component
  Required evidence, cargo, equipment and eligibility
  Shared/private encounter scope and cleanup
  Complete dialogue, radio transitions and HUD objective text
  Durable effects, reward IDs, amounts and settlement
  Failure, retry, death, disconnect and upgrade behavior
  Completion condition and next eligible assignment
  Existing capability / required implementation dependency
  Automated test cases and manual playthrough checklist

Chapter completion, rewards and next chapter gate
Open decisions and explicit approval record
```

Prefer a table linking each objective to its player action, authoritative trigger, prerequisites, effects and recovery. Write the exact NPC dialogue and player-facing instructions before coding. Use existing services and events when they meet the narrative need.

## 12. Verification and release gates

Before writing gameplay code:
- Review chapter against the five-act outline, historical timeline, factions, permanent characters and revelation ladder.
- Confirm every objective has a feasible server-owned action or a named implementation dependency.
- Approve narrative, rewards and recovery rules. Do not lock in the SOL leaker through an implementation shortcut.

Before marking a chapter complete:
- Pure transition tests: valid progression, invalid/out-of-order events, prerequisites, pause/retry and completion.
- Persistence tests: row locks, duplicate/concurrent events, atomic settlement, reward uniqueness, old progress compatibility and reconnect.
- Integration tests: authenticated NPC access, location and ownership, private encounter isolation, two pilots at different story stages, normal service access, client spoofing and wrong-target rejection.
- UI tests: correct current prompt and offer, no future spoilers, no unintended radio replay, consistent browser/native/SBS information.
- Run the repository's required test/precommit workflow, including relevant JS tests, and record actual outcomes in ROADMAP and CHANGELOG. No claim of test success without execution.
- Human playthrough from an eligible starting state through completion, including a representative recovery scenario and verification that the old prologue still works. Record approval and outstanding issues before beginning the next chapter.

This documentation milestone adds no code or tests and is not gameplay signoff.

## 13. Immediate next milestone — Leaked Routes

The eligible pilot has completed First Run and received Juno's invitation. The first new assignment is explicitly offered by Juno Rook in Green Starbase's existing Mission Office. Her location and baseline role do not change.

Use the recovered navigation evidence and Mara's inspection as prerequisites already established by the prologue. Keep the three suspects (Helios dispatch, Solar Merchant League and Green Starbase) plausible until a reviewed investigation establishes evidence. Investigate provenance, not guilt by affiliation.

The chapter must deliver a concrete narrative payoff and a lead into Following the Money. Its mission count, dialogue, locations, new contacts, effects, rewards and recovery are drafted in [01-leaked-routes.md](01-sol/01-leaked-routes.md), pending approval. Do not add optional quests, repeatable contracts, unrelated content systems, or a production wormhole unlock as part of this chapter.

The aim is a second fully playable story chapter that reuses and carefully extends the existing game. Only then assess which mission abstractions have been demonstrated to be useful.
