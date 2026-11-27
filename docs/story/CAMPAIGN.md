# SpaceNova — The Fractured Passage

> Every civilization depends on the passages between the stars. Someone has learned how to control them.

**Status:** proposed campaign bible, revision 0.1 (2026-11-26). This document is the working narrative reference; new names, motives, revelations and mission outlines remain proposals until the project owner accepts them. It does not grant travel access or describe implemented missions unless explicitly marked.

**Audience:** writers and developers. Contains full-campaign spoilers. Player-facing briefings must reveal only information earned at the current story step.

## 1. Narrative promise

The player is not a prophesied savior. They start as a newly licensed Helios courier in an inexpensive Sunracer, earning a living in SOL. Their first rescue exposes a leak of confidential navigation information. Following that evidence reveals an interstellar monopoly in the making: control the passages, control the price of food and medicine, control who can leave.

A pilot becomes consequential by keeping promises, learning to fly, making difficult decisions, building relationships, and surviving the consequences. The story should be enjoyable even for a player who prefers commerce, exploration, rescue or diplomacy over combat.

**Themes:** freedom of movement versus imposed order; trust earned through action; the human cost of isolation; the difference between protection and control; ordinary people becoming indispensable to one another.

**Tone:** grounded, working-class space opera that gradually grows into cosmic mystery. Ships need repairs. People need wages, supplies and safe passage. No exposition dump about a galactic conspiracy before the player has reason to care. Humor and quiet station conversations provide relief between dangerous missions.

## 2. Canonical starting point and boundaries

- The implemented [First Run](../story-first-run.md) prologue remains intact. Its [playthrough](../story-first-run-playthrough.md) is the reference for actual player actions.
- The pilot saves Vesper-02, accepts Corsair-17's surrender, recovers a verified navigation record of their own leaked route, and has Mara Venn inspect military-grade weapon damage. Juno Rook recognizes the significance. The internal flag `data_chip` represents evidence, not a physical inventory item.
- The pilot finishes the delivery of three medical crates at Mars, earning 500 credits, a Helios courier license and standing. Juno invites them back to Green Starbase.
- Chapter 1 begins only after that prologue. It must not retroactively change the rescue, reward or NPC dialogue.
- SOL is the entire first campaign, not a short tutorial followed immediately by interstellar travel. The SOL–Alpha Centauri entrance is charted beyond Pluto, ESE on the overhead Atlas, but live transit is locked. First Run completion alone must not unlock it.
- The 29 systems and their order come from `Core.Universe.StarSystems` and its campaign links. Galaxy marker positions are schematic, not real astrometric coordinates. The paired mouth catalogue and [interstellar navigation design](../interstellar-navigation.md) govern physical passage.
- SOL is the only playable system at this revision. Non-SOL settlements, factions, characters, hazards and chapters described below are fictional proposals, not available locations or promises of implemented features.

## 3. The truth behind the conspiracy (writer-only)

Human interstellar civilization is 500 years old at the start of First Run, measured from the first successful crossing to Alpha Centauri. The four historical ages and accepted technological constraints are recorded in [LORE.md](LORE.md); the approved broad historical periods are in [TIMELINE.md](TIMELINE.md).

The wormhole passages predate human expansion. Human surveyors discovered how to chart them, while successive generations of engineers developed beacon technology to stabilize approach and exit conditions. Settlements grew around reliable routes.

An influential but initially concealed coalition, working name **The Directorate**, believes that fragmented planetary authorities and unrestricted trade make civilization vulnerable. Its leadership treats a centrally controlled passage network as the only sustainable solution. A hardline inner circle deliberately manufactures the crisis that supposedly justifies its intervention.

The mechanism is called the **Resonance Array** (working name): compatible equipment can disturb or stabilize particular wormhole connections, provided it has calibration data from the network. It is not a magical remote switch for every star. It requires sites, power, instruments, operators, maintenance and information. This dependence creates tangible gameplay objectives and weaknesses.

The conspiracy uses legitimate contracts, compromised logistics accounts, illicit arms shipments and manipulated insurance records to hide experimental operations. Raids serve as cover for collecting route telemetry and displacing competitors. Some raiders are paid contractors; others are victims of the resulting shortages. Not every pirate, merchant or officer is a Directorate agent.

The ancient network is revealed only in Act IV. Its original builders (working name **the Architects**) left an engineered stabilization layer embedded in naturally occurring passages. Whether any builders survive is deliberately undecided. Their legacy is not a prophecy about the player; it is a difficult technical and ethical inheritance.

### Revelation ladder

| First revealed | What the pilot can establish | What remains unknown |
| --- | --- | --- |
| First Run | Someone leaked a route; raiders have unusually advanced weapons. | Who, why, and where the weapons came from. |
| SOL | A chain of compromised contracts points to a clandestine outer-system operation. | The wider organization and its purpose. |
| Alpha Centauri–Epsilon Eridani | The same signatures recur outside SOL; raids and outages correlate with specific cargo and experiments. | Whether incidents are deliberate, and who controls them. |
| Tau Ceti | The Directorate exists; evidence connects the campaign of interference to its agents. | The leadership's full plans and the network's origins. |
| Procyon–Polaris | Isolation is being engineered, and safe travel is being sold as a privilege. | How to reverse it without creating a worse crisis. |
| Capella–Wolf 359 | A coalition forms; factions within the Directorate disagree over its methods. | What the ancient stabilization layer can do. |
| Vega–Spica | The network is partly engineered; restoring it requires cooperation and distributed safeguards. | Who will govern access, and what costs a restoration will impose. |
| Regulus–Fomalhaut | The monopoly can be broken. The player helps decide how the liberated network is governed. | The future is not fully determined; a post-campaign era remains open. |

## 4. Campaign structure

One **phase** = the major campaign of one star system. A phase contains chapters; chapters contain NPC-issued missions and their verified objectives. The prologue is part of phase 1, not a separate system. Act transitions must have narrative payoffs, not merely larger enemy stats.

Mission count and playtime are not frozen. A useful starting target is 4–6 substantial chapters per system, with 3–5 meaningful missions per chapter, but quality, variety and development capacity take precedence over quota. SOL is developed and manually play-tested first. No need to write hundreds of filler delivery missions in advance.

### Act I — The Conspiracy (phases 1–6)

The mystery expands from one leaked delivery route to a coordinated interstellar campaign.

| Phase / system | Campaign | Conflict and player actions | Payoff and next lead |
| --- | --- | --- | --- |
| 01 SOL (`sol`) | Leaked Routes | Return to Juno; trace dispatch records, protect witnesses, follow the weapons supply chain, investigate outer-system traffic and inspect a clandestine research site. | Recover evidence and an authenticated passage calibration record linked to Alpha Centauri. Earn SOL completion and clearance for the first crossing. |
| 02 Alpha Centauri (`alpha_centauri`) | Beyond the Frontier | Arrive with a damaged hull in unfamiliar territory; secure repairs, earn local trust, escort survey crews and compare telemetry against the SOL evidence. | A missing outbound convoy carried experimental stabilizer components; its registered route leads to Barnard's Star. |
| 03 Barnard's Star (`barnard`) | The Missing Convoy | Search for the overdue convoy, recover survivors, salvage authenticated records, and investigate falsified loss claims. | Find evidence of rerouted military equipment through a Sirius trading exchange. |
| 04 Sirius (`sirius`) | Merchants of War | Navigate commercial rivalries; inspect cargo, investigate shell contracts, protect a witness and decide whether to cooperate with a compromised merchant. | A shipment registry identifies a clearing account and an Epsilon Eridani research contractor. |
| 05 Epsilon Eridani (`epsilon_eridani`) | The Black Ledger | Follow the accounts through hazardous salvage and guarded infrastructure; verify records independently of competing faction claims. | Connect payments, raider deployments and passage experiments to an operation based in Tau Ceti. |
| 06 Tau Ceti (`tau_ceti`) | The Directorate | Infiltrate a procurement network, secure witnesses and intercept an experiment shipment; confront a local Directorate coordinator. | Name the organization and expose evidence of deliberately induced instability. A distress call from Procyon demonstrates the next stage of its plan. |

**Act I climax:** the player proves the conspiracy is real, but disclosure alone cannot keep colonies supplied.

### Act II — The Silence (phases 7–12)

The player experiences what an interrupted transport network does to ordinary people.

| Phase / system | Campaign | Conflict and player actions | Payoff and next lead |
| --- | --- | --- | --- |
| 07 Procyon (`procyon`) | Distress Without Reply | Restore a damaged communications relay, deliver emergency medicine and locate a settlement whose requests were suppressed. | Establish that communication and transit disruption are coordinated; Betelgeuse has the last surviving outage telemetry. |
| 08 Betelgeuse (`betelgeuse`) | The Burning Frontier | Pilot through dangerous stellar conditions, evacuate endangered workers and recover a drifting survey instrument. | The instrument identifies an interference pulse associated with an unregistered fleet near Rigel. |
| 09 Rigel (`rigel`) | Ghost Fleet | Locate ships operating under stolen transponder identities, escort a defecting crew and document who gave the orders. | A recovered operations schedule reveals supply restrictions and a stranded maintenance expedition in Luyten 726-8. |
| 10 Luyten 726-8 (`luyten_726_8`) | Stranded | Repair local rescue infrastructure, conduct supply runs during intermittent passage failures and recover isolated technicians. | The technicians explain why calibration records are indispensable and name a reliable supply corridor through Ross 154. |
| 11 Ross 154 (`ross_154`) | The Last Supply Line | Organize a convoy, negotiate scarce supplies and defend civilian haulers from coercive seizures. | Deliver enough supplies to sustain the corridor; recover a navigation reference needed to diagnose the Polaris route. |
| 12 Polaris (`polaris`) | The Broken Compass | Restore reference beacons, validate navigation observations, and attempt a difficult passage stabilization mission. | Demonstrate partial recovery is possible without Directorate permission. Send proof to a proposed intersystem summit at Capella. |

**Act II climax:** a broken passage is stabilized locally, but rebuilding it everywhere is beyond the means of any one faction.

### Act III — Divided Stars (phases 13–18)

Survival becomes political. Allies have conflicting priorities, and the opposition is not a single mind.

| Phase / system | Campaign | Conflict and player actions | Payoff and next lead |
| --- | --- | --- | --- |
| 13 Capella (`capella`) | A Fragile Alliance | Escort delegates, investigate sabotage and broker a limited agreement on humanitarian passage. | Form a practical coalition despite unresolved disagreements; investigate a contested arms contract at Mirfak. |
| 14 Mirfak (`mirfak`) | The Price of Loyalty | Expose competing procurement claims, choose between lucrative patronage and protecting evidence, and secure coalition supplies. | A credible audit or rescued informant identifies a resistance logistics route to Lalande 21185. |
| 15 Lalande 21185 (`lalande_21185`) | Underground Resistance | Establish trusted couriers, smuggle humanitarian supplies through inspections, and rescue a compromised resistance contact. | Recover the timetable for a planned blockade at Deneb. |
| 16 Deneb (`deneb`) | The Siege | Sustain a blockaded civilian station, run escorts and establish a safe evacuation corridor while coalition forces contest the blockade. | Prevent a humanitarian collapse; a compromised command authorization points to Arcturus. |
| 17 Arcturus (`arcturus`) | Betrayal | Investigate an apparent ally's deception, distinguish coercion from collaboration, and secure an endangered witness. | Identify a hardline Directorate cell and a prison or detention route at Wolf 359. |
| 18 Wolf 359 (`wolf_359`) | No Surrender | Rescue detainees, capture authenticated network research and stop destruction of the records. | A former Directorate engineer explains the anomaly in human beacon designs and directs the coalition to Vega. |

**Act III climax:** the coalition survives betrayal. A former adversary offers a chance to end the crisis rather than merely win another battle.

### Act IV — The Architects (phases 19–24)

Exploration changes the interpretation of everything learned so far.

| Phase / system | Campaign | Conflict and player actions | Payoff and next lead |
| --- | --- | --- | --- |
| 19 Vega (`vega`) | Echoes of the Ancients | Survey strange structures, triangulate repeatable signals and defend research teams without destroying the evidence. | Establish that parts of the network predate human technology; recover a reference to paired records at 61 Cygni. |
| 20 61 Cygni (`61_cygni`) | The Twin Archives | Recover complementary archive fragments from separate survey sites, compare them and resolve conflicting interpretations. | Learn that distributed calibration, not centralized control, is fundamental; identify a dormant machine at Altair. |
| 21 Altair (`altair`) | The Forgotten Machine | Restore power to an ancient instrument, solve its alignment problem and survive an attempted seizure. | Decode a limited stabilization protocol requiring independent field validation in Ross 128. |
| 22 Ross 128 (`ross_128`) | The Living Passage | Test controlled passage adjustments, rescue crews during a failed trial and verify a safe operating envelope. | Prove a distributed repair procedure can work; the main interference source is linked to Antares. |
| 23 Antares (`antares`) | Heart of the Network | Approach a major calibration site, protect engineers and prevent the Directorate from monopolizing its output. | Recover the network's reference signal, but discover that abruptly disabling the Directorate equipment could isolate colonies. |
| 24 Spica (`spica`) | The Origin Signal | Reconcile archive evidence and telemetry; validate a staged recovery plan with multiple independent observers. | Produce a safe restoration sequence and gather the technical requirements for coalition deployment at Regulus. |

**Act IV climax:** the cure exists. The player must help carry it out without stranding the people they have spent the campaign protecting.

### Act V — The Last Passage (phases 25–29)

The final conflict is about access, responsibility and the future of civilization.

| Phase / system | Campaign | Conflict and player actions | Payoff and next lead |
| --- | --- | --- | --- |
| 25 Regulus (`regulus`) | Gathering the Fleet | Recruit transports, engineers and security vessels; establish supply priorities and resolve disputes over command. | Assemble the resources for a coordinated restoration, with the pilot's past relationships influencing available assistance. |
| 26 Aldebaran (`aldebaran`) | Operation Liberation | Escort deployment teams, reclaim key infrastructure and support evacuation while a rival force tries to cut the operation off. | Bring the first recovery sites online and identify the final blocking operation at Pollux. |
| 27 Pollux (`pollux`) | The Point of No Return | Choose a costly but safe restoration sequence, rescue endangered operators and defend the active calibration sites. | The staged recovery begins. The remaining command apparatus at Canopus can no longer control every passage unilaterally. |
| 28 Canopus (`canopus`) | The Directorate Falls | Secure command records, separate willing defectors from hardliners, protect civilians and neutralize the last coercive interference capability. | Break the monopoly and make its crimes independently verifiable. Fomalhaut hosts the last restoration and settlement process. |
| 29 Fomalhaut (`fomalhaut`) | A New Beginning | Complete restoration, return stranded crews to safety and help negotiate how passage access and maintenance will be governed. | A personal epilogue resolves key relationships and reflects player choices. The liberated network remains available for future stories and ordinary space life, subject to implemented travel rules. |

**Ending principle:** victory is not the destruction of a single ship. It is the restoration of safe movement and the prevention of another monopoly. Possible political outcomes (all provisional): distributed independent stewardship, accountable intersystem authority, or a negotiated mixed arrangement. No ending should require a permanent global state change that ruins another pilot's campaign.

## 5. SOL: first writing and implementation milestone

| Chapter | Working title | Story function | Status |
| --- | --- | --- | --- |
| 00 | First Run | Rescue, route evidence, first paid delivery | Implemented; preserve existing design |
| 01 | [Leaked Routes](01-sol/01-leaked-routes.md) | Determine how the pilot's route was exposed; investigate three plausible suspects | Detailed draft; awaiting approval |
| 02 | Following the Money | Trace suspicious contracts and payments; protect evidence and witnesses | Outline |
| 03 | Supply Line | Follow military-grade equipment through belt and Jovian shipping routes | Outline |
| 04 | Beyond the Frontier | Investigate Survey Consortium data and Outer Rim Trading Guild contacts; identify an unauthorized experiment | Outline |
| 05 | The Gateway | Secure the first passage calibration and earn clearance; complete SOL | Outline |

Chapter 1 should begin with an explicit return to Juno Rook's Mission Office at Green Starbase after the Mars delivery. Her existing invitation is sufficient. The actual leaker remains undecided; write the investigation so Helios dispatch, the Solar Merchant League and Green Starbase remain plausible until sufficient evidence is gathered. Do not retcon the prologue to establish a culprit.

**Proposed opening exchange (not yet implemented):**

> **Juno Rook:** You finished the run. Good. I checked the timestamps on that record. Corsair didn't guess where you would be. Someone sent them your filed course.
>
> **Pilot:** Who else had access?
>
> **Juno:** That's what I need you to find out. Dispatch, the freight exchange, and this station all handle parts of the same flight plan. If we accuse the wrong people, whoever did this will disappear.
>
> **Juno:** Start with the original record. Find out who received it, and when. Then come back to me. Don't pick a fight just because somebody looks guilty.

Detailed NPC offers, mission steps, rewards, evidence flags and recovery behavior are drafted in [01-leaked-routes.md](01-sol/01-leaked-routes.md), pending approval. The first mission must be explicitly accepted from Juno, not triggered by proximity or an automatic Atlas action.

## 6. Recurring cast and institutional continuity

| Character | Established role | Proposed long arc |
| --- | --- | --- |
| Juno Rook | Green Starbase mission liaison | Builds an evidence-led investigation and becomes a coalition intelligence contact. Must earn trust rather than know every answer. |
| Mara Venn | Repair engineer | Converts damaged ships and recovered telemetry into practical passage research. Challenges risky decisions that put crews in danger. |
| Ilya Quill | Ship outfitter | Helps the pilot prepare for progressively harsher journeys; equipment must have real costs and tradeoffs. |
| Tarek Sol | Green Starbase Trade Broker | Connects the pilot to merchants, legitimate trade, and later resistance supply networks from his existing desk. |
| Sera Vale | Green Starbase Supply Officer | Helps trace consignments and coordinate emergency supply contacts from the depot. |
| Eno Kade | Communications officer | Intercepts, validates and relays information. His work links otherwise separated characters. |
| Captain Ines Varga | Vesper-02 courier captain | A relationship founded on the rescue; may advise and coordinate later operations through established vessel routes, credible communications or scoped encounters. |
| Dispatcher Halden Ross | Helios dispatcher | Remains a plausible early suspect until the investigation earns its conclusion. His knowledge of routes remains valuable. |
| Corsair-17 | Surrendered raider vessel | The recovered record is established evidence. Crew identity, survival and later appearances must respect the actual surrender outcome. |

Persistent stationary NPCs keep their existing homes, rooms and service roles. New story content changes eligible dialogue and offers per pilot, not shared placement or availability. Mobile contacts retain established routes; private encounters remain scoped. Keep home-system characters reachable through credible relays, recorded messages or visits when return travel is supported, not story-driven relocation. No instant communications through a disabled passage unless a separate, established system provides it. Introduce local NPCs as needed. See [CHARACTERS.md](CHARACTERS.md) for the accepted continuity rule and source-backed roster.

Existing organizations are authoritative: Helios Courier Cooperative, Solar Merchant League, Outer Rim Trading Guild, Solar Survey Consortium, Independent Operators, Unaffiliated Raiders, and SOL planetary authorities. See `Core.Factions`. Their membership is not synonymous with guilt. The Directorate and Architects are proposed lore; neither is an implemented faction. Proposed motives, internal subdivisions and political relationships are developed in [FACTIONS.md](FACTIONS.md).

## 7. Narrative-to-gameplay contract

- **NPC authority:** only authenticated NPC dialogue offers and accepts story missions. The HUD and Atlas display objectives and status; they do not grant quests or permissions.
- **Sequential progression:** phase N+1 becomes eligible only after authoritative completion of phase N. Access clearance and successful physical crossing are different events. A failed crossing never advances a phase.
- **Wormhole continuity:** the pilot physically approaches the correct paired mouth, enters a hazardous transit, and reaches the verified exit. Current lab mechanics include accumulating direct hull exposure, boundary damage, a three-second ejection window and a ten-second re-entry cooldown. Production persistence, failure settlement and system transfer remain to be implemented; do not invent them in mission scripts as available features.
- **Persistence:** preserve per-pilot chapter, mission and verified evidence; record once-only rewards and consequential decisions. Use server-confirmed events. Never accept a client assertion of arrival, combat victory, evidence recovery or permission.
- **Multiplayer:** personal story events and instanced encounters cannot overwrite shared world facts for other pilots. Cooperative story objectives may be added only with explicit eligibility and reward rules. Preserve current single-pilot First Run staging.
- **Choice:** meaningful differences in information, standing, cost, allies and ending; reconverge onto the existing sequential system route. No branch may irreversibly block completion by an unanticipated trade or reputation loss.
- **Failure:** death, cargo loss, disconnect, surrender or failed passage must have specified, tested recovery. Consequences are allowed; impossible objectives and duplicate payouts are not.
- **Progression:** reward credits, standing, equipment access, knowledge and contacts rather than arbitrary numerical inflation. Commerce, rescue, investigation, diplomacy and piloting remain relevant alongside combat.
- **Delivery:** cockpit, desktop, browser and SBS must provide the same meaningful objective information. Long conversations belong in deliberate radio or station exchanges; never obstruct piloting with dialogue during a dangerous turn.
- **Verification:** every chapter needs a reviewed mission design, authoritative trigger inventory, failure/recovery tests, and a human playthrough before expanding the story. Do not create production unlocks for outline-only phases.

## 8. Decisions still requiring review

- Confirm the working title, Directorate ideology, Resonance Array and ancient-network reveal.
- Confirm the eventual leaker and whether a recurring individual antagonist is needed; keep the three SOL suspects plausible until reviewed.
- Elaborate the accepted 500-year history, politics, technologies and settlements in the lore, timeline and faction documents. Do not assume real exoplanets or inhabited worlds have been established by the current catalogue.
- Define how previously visited systems are revisited after unlocking and whether return travel has additional rules.
- Select mission counts, rewards, branching scope, and local chapter scripts one phase at a time.
- Decide what a completed campaign permits in multiplayer and future expansions; no global irreversible changes are approved.

## 9. Document workflow

This file is the top-level working story bible. Existing First Run documentation remains the reference for the implemented prologue. [LORE.md](LORE.md) records the accepted historical and technological foundations. [FACTIONS.md](FACTIONS.md) develops the proposed faction motives and relationships. [CHARACTERS.md](CHARACTERS.md) establishes persistent NPC continuity. [TIMELINE.md](TIMELINE.md) establishes the approved historical framework. [MISSION_DESIGN.md](MISSION_DESIGN.md) establishes the main-campaign mission design contract; other system directories will be created as their chapters are developed. See [story index](README.md).

When a design is accepted, record the decision and update this bible and the relevant chapter. Implementation must not quietly change accepted story facts; propose differences and document them. Track actual gameplay implementation in ROADMAP and CHANGELOG separately from narrative intent.
