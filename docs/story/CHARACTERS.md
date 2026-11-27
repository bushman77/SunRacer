# SpaceNova — Characters and persistent NPC design

**Revision:** 0.1 · 2026-11-26

**Status:** the persistent-NPC principle was agreed by the project owner on 2026-11-26. Existing identities and placements are recorded from the game. Proposed character development, future catalogue design and quest mechanisms require separate review before implementation.

**Related:** [CAMPAIGN.md](CAMPAIGN.md), [LORE.md](LORE.md), [FACTIONS.md](FACTIONS.md), [TIMELINE.md](TIMELINE.md), [First Run](../story-first-run.md).

## 1. The design rule

SpaceNova is a limited-sandbox MMO, not a single-player campaign that replaces its world each time a player completes a chapter. A persistent stationary NPC has an enduring identity, home, occupation and service role. A quest can change what that NPC says or offers to an individual pilot, but cannot move, remove, replace or permanently disable the NPC in the shared world.

**The universe remains persistent; the player's experience evolves.**

- Players at different stages of the campaign must be able to visit the same station and recognize the same people.
- Stationary NPCs remain at their established station and room. Future missions can involve their skills, contacts, information and decisions without relocating them.
- A character's normal services remain available according to the existing service rules, independent of whether a new story quest is accepted or completed. Story-specific equipment or options may be unlocked separately.
- Existing characters can participate in later campaigns, optional contracts, and expansions. Completing First Run is not a reason to retire its cast.
- Mobile characters retain their identity and established vessel or operating route. They are not teleported or reassigned because one pilot progressed. Normal server-owned traffic movement is distinct from a story-driven relocation.
- Mission-scoped actors and temporary encounter vessels may be introduced for a particular pilot or eligible group. They must not mutate the corresponding shared NPC or become visible to unrelated players.
- No personal quest can permanently kill, abduct, exile, replace or otherwise remove a shared persistent service NPC. If a plot needs a dangerous rescue, use a separate mission actor or an appropriately scoped encounter. Any exceptional global world revision requires explicit design approval and compatibility planning; it is not a normal quest effect.

This is a content and state-ownership constraint, not a requirement to freeze all NPC animation or natural mobile traffic.

## 2. Current character roster — source-backed

Green Starbase (`sol:starbase:green`) already has six station attendants. Their exact placement and local contact IDs come from `Core.World.StationAttendants`. Room bounds come from `Core.World.StationInterior`. Preserve these values and do not invent a new NPC identity by changing an existing service key.

| Name | Established role | Local contact ID | Permanent room ID | Local X/Z |
| --- | --- | --- | --- | --- |
| Mara Venn | Repair Engineer | `repair` | `repair_bay` | -49, -143 |
| Tarek Sol | Trade Broker | `trade` | `trade_exchange` | 49, -143 |
| Ilya Quill | Ship Outfitter | `outfitting` | `outfitting` | -49, -181 |
| Sera Vale | Supply Officer | `resupply` | `resupply` | 49, -181 |
| Juno Rook | Mission Liaison | `missions` | `mission_office` | -16, -211 |
| Eno Kade | Communications Officer | `comms` | `communications` | 16, -211 |

These are local station contact keys, not a globally unique character registry. The same service key could occur at a future station without referring to the same person. A future global identity can be bound to a station plus local contact key, preserving current interfaces.

Other established story identities:

| Identity | Established location or context | Classification |
| --- | --- | --- |
| Dispatcher Halden Ross | Helios dispatch, Earth orbit; authenticated ship-comms story offer | Fixed remote contact; no walkable character model assumed |
| Captain Ines Varga | Vesper-02, Helios Courier Cooperative | Mobile story contact associated with a vessel |
| Corsair-17 | Unaffiliated raider vessel in the private First Run encounter | Mission-scoped encounter; crew identity not yet defined |

The shared Vesper-02 traffic route is Earth–Venus. The private First Run Vesper-02 scene is staged for the relevant pilot on Earth–Mars. Its script and scoped instance are not a second permanent character or a change to the shared route. Preserve the existing private-overlay behavior documented in First Run.

Corsair-17 is a vessel callsign, not a confirmed personal name. Do not invent its captain's identity or future survival as an established fact. Preserve the successful surrender evidence and existing rescue retry rules.

## 3. Core cast — character development without relocation

The following are working narrative directions, not fixed biographies, new gameplay services or confirmed future mission scripts. Detailed histories, ages, appearances and personal secrets can be developed when they matter.

| Character | Voice and motivation (proposed) | Continuing narrative possibilities |
| --- | --- | --- |
| Mara Venn | Practical, precise, protective of crews; trusts evidence over promises. | Examine weapons damage, compare recovered components, advise on passage exposure and analyze delivered research. Always based in her repair bay. |
| Tarek Sol | Commercially astute, sociable but careful with confidential transactions; values reliable commitments. | Compare freight contracts, introduce legitimate contacts, assist with shortages and trace commercial records. Always at the Trade Exchange. |
| Ilya Quill | Methodical and blunt about equipment limitations; dislikes expensive mistakes. | Advise on fitting choices, explain recovered technologies and offer reviewed equipment unlocks. Always at the outfitting counter. |
| Sera Vale | Organized, pragmatic and attentive to supply reliability; sees the human cost of missed deliveries. | Help trace missing consignments, coordinate emergency supplies and advise on convoy provisioning. Always at the supply depot. |
| Juno Rook | Discreet, patient and evidence-led; wants to protect people without compromising an investigation. | Issue Leaked Routes, review evidence, coordinate contacts and offer later SOL or cross-system story assignments. Always in the Mission Office. |
| Eno Kade | Concise and alert; values accurate communication over rumor. | Verify transmissions, track missing contact records and relay messages through credible infrastructure. Always at Communications. |
| Halden Ross | Established dry, patient dispatch voice; values professional reliability. | Explain flight records, respond to investigation and offer courier work. Remains based at Earth-orbit dispatch. His guilt or innocence is unresolved. |
| Ines Varga | Experienced courier captain who recognizes skill and reliability. | Recur through her established vessel, legitimate communications and properly scoped encounters. May advise or coordinate operations without moving her shared vessel's established route. |

Mara, Juno and the other station staff must not acquire a new physical placement in later acts to fulfill these arcs. For distant missions, use accessible relays, transportable records, a local counterpart, or a later visit if return travel is supported. Do not require a return to SOL until that mechanic exists. No instantaneous interstellar message is assumed across an unavailable passage.

### Example: Mara across different pilot histories

| Pilot state | Available story interaction (illustrative) | Shared role |
| --- | --- | --- |
| New arrival | Explain ship condition; First Run inspection when eligible | Repair Engineer |
| SOL investigation | Examine a relevant recovered component after authenticated acceptance | Repair Engineer |
| Gateway preparation | Advise on verified ship readiness or hull condition | Repair Engineer |
| Later research | Review a delivered telemetry record through a valid channel | Repair Engineer |
| Campaign completed | Future optional research contracts if introduced | Repair Engineer |

These rows may coexist at one moment for different pilots. Normal repair continues under its actual current rules, including the current commissioning-period complimentary service. A proposed later topic does not imply a change in price or service mechanics.

Sera's automatic replenishment remains uncommissioned in the current attendant dialogue. Her future story contributions do not imply that replenishment already works.

## 4. Shared world versus personal narrative

The durable world should be accessible when a pilot chooses not to advance the story. Pilots can visit familiar NPCs, trade, repair, fly and socialize within the implemented sandbox and their actual access rights.

| State | Scope | Examples |
| --- | --- | --- |
| Persistent character identity | Shared | Name, home, room, occupation, presentation references |
| World and traffic state | Shared | Station geometry, physical service presence, legitimate vessel schedules |
| Character service rules | Server-owned | Authenticated location, eligibility, inventory and transaction rules |
| Pilot narrative state | Per pilot | Mission progress, evidence, accepted offers, choices and optional relationship flags |
| Encounter state | Explicitly scoped | Private story encounter or future party encounter, with controlled visibility and recovery |

Personal relationship flags are a potential future feature, not an existing universal reputation subsystem. Faction standing and warrants are distinct from personal NPC relationships. Multiplayer co-presence does not grant shared campaign progress or reward eligibility.

### Extensible content model (proposed, not an API or schema)

A character definition owns stable identity, home, baseline dialogue and services. Mission definitions separately reference character identity and declare prerequisites, offers, objectives, narrative dialogue, effects and recovery. The server selects eligible content from verified pilot state; the client displays only eligible topics.

A future definition might use a globally namespaced character key alongside the existing local service key, but no key migration is needed to write the next SOL chapter. Avoid replacing the current First Run implementation with a speculative large framework.

Mission definitions should have stable identifiers and versions. A content update may add a new mission or dialogue topic to an existing NPC without changing that NPC's world identity. Already accepted missions must remain completable against their original rules or have an explicitly tested migration. Completed missions and once-only reward receipts must not reset when new content is published.

Base services and story offers must remain separate. A player whose Chapter 1 investigation is pending should still be able to use the normal trade desk. NPC conversation is not itself proof of delivery, combat victory, evidence recovery or payment eligibility. Server-owned domain events remain the basis of mission progression.

## 5. Character categories and expansion

Grow the cast by function and location, not by a numerical quota.

| Category | Lifetime and placement | Purpose |
| --- | --- | --- |
| Fixed station personnel | Persistent, anchored to station and room | Services, relationships, mission offers, recurring story |
| Fixed remote contacts | Persistent, anchored to a credible installation | Dispatch, research, intelligence and long-distance coordination |
| Mobile civilian or military contacts | Persistent identity; established ship or route | Trade, patrol, escorts, recurring encounters |
| Mission-specific actors | Scoped lifetime and authorized encounter | Witnesses, survivors, rivals, hostile contacts and scene-specific events |
| Ambient population | Shared or local presentation according to implementation | Make locations feel occupied without requiring a biography or quest for everyone |

A new star system should introduce the cast necessary for its own economy, conflict and missions. Existing NPCs continue to contribute through their established locations; a local engineer is preferable to relocating Mara simply to fill another repair bay.

Potential SOL additions include a dispatch records custodian, freight auditor, Jovian security officer, outer-system survey researcher, and independent freight captain. These are role candidates, not yet named or placed. Introduce each only when a reviewed chapter needs them. The eventual antagonist roster, Directorate leadership and expansion-system casts remain open.

## 6. Character record template

Use a dedicated file for a character or regional roster once the detail justifies it. Do not pre-create dozens of empty files or require hundreds of unique 3D models before completing SOL.

```yaml
# Authoring example; not a runtime configuration file.
character_id: <stable proposed identity>
display_name: <name>
status: proposed | approved | implemented
category: fixed_station | fixed_remote | mobile | encounter
home:
  system_id: <system>
  station_id: <station if applicable>
  room_id: <room if applicable>
  local_contact_id: <existing or proposed local key>
  vessel_or_route: <if mobile>
occupation: <normal role>
affiliation: <verified faction or independent>
baseline_services: <actual capabilities>
voice: <speech patterns and temperament>
motivation: <what matters to this person>
history: <relevant events and dates>
relationships: <people and institutions>
knowledge_limits: <what they can know and when>
mission_references: <stable mission identifiers>
appearance_reference: <approved artwork or existing asset>
continuity_constraints: <placement, access, secrets, recovery>
```

For a mission-scoped actor, also specify visibility, encounter lifecycle, recovery, and whether it represents a private scene copy of an existing vessel. For fixed personnel, record the exact shared location and do not encode personal mission progression into it.

## 7. Character visuals

Identity and gameplay interaction are authoritative on the server. Visual models are presentation only. The existing `station_character_models.mjs` maps these local contact keys to GLB paths:

| Contact | Configured asset |
| --- | --- |
| repair | `mara_venn.glb` |
| trade | `tarek_sol.glb` |
| resupply | `sera_vale.glb` |
| outfitting | `ilya_quill.glb` |

Paths are under `apps/sunracer_web/priv/static/images/game/station/`. This table records the mapping in the current source, not a manual check of every model or its appearance. Juno and Eno have no custom mapping in that module at this revision.

Reuse approved character designs and the existing ai3d workflow where appropriate. Replacing a mesh or improving its idle animation must not change character identity, interaction anchor or location. A new NPC may use the existing procedural presentation before its custom model is ready. Avoid requiring art production for every proposed name.

## 8. Authoring and verification contract

When a new quest uses an existing character, specify the existing contact, baseline services, new dialogue/offer prerequisites, server-verified objectives, reward and failure rules, and whether the scene is private or shared. If a quest seems to require relocating a persistent NPC, redesign the quest around the fixed location or a new local contact.

Before implementing new mission content, verify:

- Two pilots at different story stages see the same permanent station roster and placement, but only their own eligible story options.
- Completing or retrying a quest cannot remove an NPC, disable baseline services, alter shared traffic or advance an unrelated pilot's quest.
- Reconnect and content upgrades preserve accepted and completed missions, evidence and reward receipts.
- A private encounter remains invisible and inaccessible to unrelated players; optional future party participation has explicit eligibility.
- Returning to an older NPC works without replaying completed rewards or exposing later story spoilers.
- The actual placement, proximity checks and browser/desktop/SBS presentation remain consistent.

These are future regression and playthrough requirements, not claims of tests performed by this documentation milestone.

## 9. Next writing milestone

After review of [MISSION_DESIGN.md](MISSION_DESIGN.md), write the first detailed SOL chapter, Leaked Routes, using Juno's existing Mission Office as its opening point. Identify exactly which existing characters can supply the required evidence and which genuinely new local actors are needed. Do not choose the culprit prematurely.

The existing First Run tutorial and all six permanent station contacts remain intact. Expand the world through additive characters and reusable mission content, one reviewed chapter at a time.
