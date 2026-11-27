# SpaceNova — Factions, institutions and political conflict

**Revision:** 0.1 · 2026-11-26

**Status:** working faction design. The project owner accepted the direction of giving factions credible political philosophies, economic interests and historical grievances, including an understandable motivation for the Directorate. Existing identities and reputation policy are taken from the current game; the detailed motives, planetary profiles, internal factions and historical incidents below are proposals for review, not implemented or individually approved canon.

**Read with:** [CAMPAIGN.md](CAMPAIGN.md), [LORE.md](LORE.md), [First Run](../story-first-run.md). Contains author-only campaign spoilers.

## 1. Political foundation

Five hundred years after humanity's first interstellar crossing, civilization has no universal sovereign. Local authorities govern settlements, infrastructure and territory; commercial organizations connect economies across jurisdictional boundaries. Passage instability exposes how heavily even politically independent societies depend on one another.

No faction is defined solely by its enemies. Each institution must have a reason to exist, resources it controls, resources it needs, people it serves, competing interests within its membership, and a credible limit to its power. A faction's public principles need not match the behavior of every officer or contractor.

The central political disagreement is not simply good versus evil. It is whether safety can be maintained through cooperation among independent communities or requires a single authority controlling passage access. The Directorate's deliberate coercion and manufactured crisis are the wrongdoing at the heart of the story, not the mere fact that some people favor central coordination.

## 2. Established faction registry

These are the existing organization identities in `Core.Factions`. Preserve their IDs when introducing branches in another system. The political and economic interpretations in later sections expand on their current roles.

| Stable ID | Established name | Registry kind |
| --- | --- | --- |
| `helios_couriers` | Helios Courier Cooperative | courier |
| `sol_merchant_league` | Solar Merchant League | merchant_guild |
| `outer_rim_traders` | Outer Rim Trading Guild | merchant_guild |
| `sol_surveyors` | Solar Survey Consortium | research |
| `independent` | Independent Operators | independent |
| `independent_raiders` | Unaffiliated Raiders | outlaw |

SOL planetary authorities are distinct territorial identities, using the existing planetary and dwarf-planet IDs. Green Starbase is an independent landmark, not a seventh registered commercial organization or an additional planet. Legacy MMO/EIC/VRU player-company IDs are unrelated to these identities.

Do not register the Directorate, a coalition, a local authority in another system or any other proposed institution merely because this document mentions it. Future implementation needs an explicit design and a stable ID.

## 3. Commercial and civilian organizations

### Helios Courier Cooperative

*Proposed motto: "Every delivery matters."*

- **Purpose:** dependable, affordable transport of time-sensitive cargo and information; pilots cooperate to share risks that individuals cannot bear alone.
- **Resources:** dispatch, trained couriers, flight schedules, contracted cargo and trusted delivery records.
- **Dependencies:** safe routes, repair facilities, affordable ships, honest dispatch, and reliable access to customers and refineries.
- **Principle:** a legitimate delivery obligation should be honored regardless of the customer's wealth or location.
- **Internal conflict:** experienced operators want to protect pilots and keep contracts sustainable; financial pressures may encourage management to accept dangerous routes, outsource work or surrender operational independence.
- **Player relationship:** starting employer and first source of trust. Dispatcher Halden Ross and Captain Ines Varga embody the human side of the Cooperative. Their innocence or guilt cannot be inferred from affiliation.
- **Campaign:** leaked route records in SOL, humanitarian transport in Act II, coalition logistics in Act III, restoration convoys in Act V.

Helios is not the player's permanent master. A courier license is earned in First Run; other future affiliations must not erase that accomplishment.

### Solar Merchant League

*Proposed motto: "Trade keeps the stars connected."*

- **Purpose:** coordinate large-scale commercial transport, procurement and commercial standards.
- **Resources:** warehouses, cargo contracts, merchant fleets, finance, insurance relationships and purchasing leverage.
- **Dependencies:** predictable passage access, contract enforcement, solvent customers, industrial production and dependable smaller carriers.
- **Principle:** stable markets and standardized contracts make interstellar prosperity possible.
- **Internal conflict:** long-term merchants need reliable trade; opportunists can profit from scarcity and displaced competitors. Some may support exclusive passage agreements as protection against piracy, while others fear the monopoly those agreements create.
- **Player relationship:** trade opportunities, contract investigations, difficult negotiations and commercial witnesses.
- **Campaign:** a plausible early suspect because it could benefit from attacks on Helios, not because profit proves guilt. Later League members may help establish transparent supply agreements or resist coercive trade restrictions.

### Outer Rim Trading Guild

*Proposed motto: "Distance is not a debt."*

- **Purpose:** represent remote communities and transporters whose needs are neglected by the larger commercial centers.
- **Resources:** local relationships, outer-system depots, experienced long-haul crews and knowledge of difficult routes.
- **Dependencies:** imported machinery, medicine, communications and reliable connections to other markets.
- **Principle:** communities at the edge of the network deserve access on fair terms, even when serving them is less profitable.
- **Internal conflict:** some members favor open trade and solidarity; others favor local protection, exclusive arrangements or informal routes to keep supplies moving.
- **Player relationship:** exploration, remote deliveries, regional trust and negotiation under scarcity.
- **Campaign:** a bridge from the SOL investigation to the first passage; central to isolation, emergency convoys and later resistance logistics.

### Solar Survey Consortium

*Proposed motto: "Evidence before certainty."*

- **Purpose:** investigate stellar environments, map routes and establish reliable navigation knowledge.
- **Resources:** survey ships, instruments, observations, research archives, engineers and scientific credibility.
- **Dependencies:** funding, specialist equipment, safe access to sites and independent verification.
- **Principle:** navigation knowledge that affects public safety should be accurate and independently verifiable.
- **Internal conflict:** open research versus restricted data; commercial sponsorship versus independence; rapid experimentation versus crew safety. Some researchers may accept restrictive funding without knowing its eventual use.
- **Player relationship:** survey escorts, instrument recovery, independent validation and passage research.
- **Campaign:** a lead during the outer SOL investigation; evidence gathering in Acts I–II; essential expertise in Act IV. The Consortium as a whole does not know the ancient truth at the start of the story.

### Independent Operators

*Proposed informal saying: "My ship, my choice."*

- **Purpose:** a broad category of pilots, businesses and contractors outside the major organizations; not a single ideological guild or unified command.
- **Resources:** individual vessels, specialist skills, personal networks and flexibility.
- **Dependencies:** access to stations, repairs, customers, fair contracts and a functioning credit economy.
- **Principle:** many value autonomy and the ability to negotiate their own work; others simply cannot join or do not wish to join a larger institution.
- **Internal conflict:** individual operators may cooperate, compete, unionize locally or accept restrictive contracts. There is no universal independent policy.
- **Player relationship:** freelance opportunities, civilian encounters and friendships beyond employer or political identity.
- **Campaign:** the people most immediately affected by compulsory licenses, monopolized services and unpredictable restrictions.

### Unaffiliated Raiders

No universal motto or command structure. The registry category does not mean all raider crews belong to one criminal organization.

- **Purpose and motives:** predation for profit, coercive contracts, opportunism, and in some cases desperation following economic disruption. Motive does not excuse harm.
- **Resources:** armed vessels, stolen cargo, illicit commercial contacts and sometimes outside sponsorship.
- **Dependencies:** repairs, supplies, sale of goods, and information about routes.
- **Internal conflict:** independent crews, paid contractors and coerced participants have different incentives. Some surrender; others remain dangerous. Their conduct, not their category alone, determines individual responsibility.
- **Player relationship:** combat, negotiated surrender, recovery of evidence, stolen goods and consequences for unlawful conduct.
- **Campaign:** Corsair-17 remains the first encounter. Its military-grade weapons and knowledge of the pilot's route are evidence to investigate. Do not declare the Directorate its confirmed employer during First Run.

## 4. SOL territorial authorities

The existing game registers Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune and Pluto as territorial factions. Each has its own orbital infrastructure and refinery in the current SOL setting. The following are proposed economic and political emphases to guide chapter design, not approved settlement histories, constitutional systems, or claims about real planetary resources.

| Territory / existing ID | Proposed identity and priority | Dependency and tension |
| --- | --- | --- |
| Mercury / `mercury` | Energy-intensive industry and engineering; reliability and technical standards. | Needs imported consumables and dependable transport; disagreements over industrial access and safety. |
| Venus / `venus` | Specialized industrial processing and orbital commerce; contractual stability. | Needs reliable inputs and markets; tension between large contractors and smaller operators. |
| Earth / `earth` | Ancestral home, major population and commercial/administrative hub. | Needs imports and interplanetary cooperation; influence is not universal sovereignty. |
| Mars / `mars` | Established industrial and settlement economy; local autonomy and supply reliability. | Dependent on critical deliveries, including the First Run medical consignment. |
| Jupiter / `jupiter` | Large outer-system logistics hub; protection of industrial shipping and regional infrastructure. | Depends on trade, engineering crews and trusted freight; potential dispute over security procurement. |
| Saturn / `saturn` | Distributed orbital industry and transit services; balancing regional cooperation with local interests. | Depends on dependable parts and communications; concerned about trade restrictions. |
| Uranus / `uranus` | Remote industrial and service communities; operational resilience. | Longer supply routes magnify disruptions and unequal access to contracts. |
| Neptune / `neptune` | Outer-system science, maintenance and navigation support. | Needs specialized equipment and outside funding; pressures around restricted research. |
| Pluto / `pluto` | Frontier support, survey logistics and approach services near the historic Alpha Centauri route. | Vulnerable to distant supply interruptions and disputes over passage access. |

These are orbital and local-system economic roles, not a claim that gas giants have habitable solid surfaces. Specific settlements, facilities, governors and local institutions will be designed when needed. Exact titles, population sizes, laws and resource recipes remain open. Do not replace current economy or faction data based on this table.

## 5. Green Starbase

**Established:** independent station between Earth and Mars, charted as `sol:starbase:green`. First Run establishes its role as a repair, communications and mission hub. Do not assign ownership to Helios, Earth or the Merchant League.

**Proposed charter principle:** serve ships and crews without surrendering station autonomy. Its survival depends on legitimate customers, repair materials, staff, safe approaches and relationships across factions.

This independence makes Green Starbase useful as a place where pilots from different organizations meet. It also creates credible exposure to sensitive commercial and navigation records. The station is therefore a plausible suspect during Leaked Routes without making its entire staff conspirators.

Juno Rook, Mara Venn, Ilya Quill, Tarek Sol, Sera Vale and Eno Kade have professional responsibilities that can create disagreements without turning them into caricatures. [CHARACTERS.md](CHARACTERS.md) records the permanent station roster and character continuity constraints. Detailed histories and the station's governance remain open. No new station faction ID or legal immunity is implied.

## 6. The Directorate — author-only

**Working name; not registered in the game.** The campaign introduces evidence of the organization's existence at Tau Ceti (phase 6). Its exact formation date, founders and leadership remain unresolved.

### What its supporters believe

Five centuries of expansion have created a network whose economic dependencies cross political boundaries. Supporters of the Directorate believe that fragmented authority leaves shipping vulnerable to piracy, inconsistent standards, disputes and cascading shortages. They argue that a single passage authority could coordinate safety, licensing, emergency priorities and infrastructure maintenance better than competing local authorities.

Its proposed public promise is **"One network. A safer civilization."** This is a fictional slogan, not the established name of a public government or a player-facing announcement at the start of the game.

A frightened parent whose medicine has been delayed, a captain who lost a convoy, and an engineer unable to coordinate maintenance might each find that promise attractive. These people are not automatically aware of or complicit in the inner circle's actions.

### What makes it the antagonist

A hardline inner circle concludes that ordinary political consent will never yield the control it seeks. As established in the campaign proposal, it manufactures or exploits instability, manipulates contracts, acquires confidential route data and uses illicit operations to create dependence on its own protection.

It seeks control over who can travel, under what conditions, and at what price. The danger is not simply standardized safety rules; it is concentrated, unaccountable coercion justified by a crisis it helped create.

The proposed Resonance Array can disturb or stabilize particular connections using local equipment, power, operators and calibration data. It is not an unlimited switch for every passage. Its resource dependencies allow investigators, engineers and ordinary workers to affect the conflict.

### Internal currents (proposed, not formal faction IDs)

| Current | Motivation | Narrative function |
| --- | --- | --- |
| Coordinators | Believe central safety standards and emergency planning can prevent systemic failure. | May be legitimate negotiating partners or eventual witnesses. |
| Commercial patrons | Want predictable contracts, protected assets and privileged access; may underestimate the political consequences. | Create complicated financial leads and conflicting loyalties. |
| Technical specialists | Want to understand and maintain passage technology; disagree on secrecy, experimentation and accountability. | Can defect, testify or help restore infrastructure; knowledge must be verified. |
| Hardline command | Believes coercive control is necessary and is willing to deliberately create shortages and instability. | Principal organized antagonist; must answer for its choices. |
| Security personnel and contractors | Range from professional duty to financial incentive, coercion or ideological commitment. | Permit varied encounters, surrender, rescue and defection; never treat an affiliation as proof of guilt. |

These currents need not be formal departments or mutually exclusive memberships. Do not fix their hierarchy, names or individual leaders before character and timeline work.

### Reveal discipline

- First Run: compromised navigation record and military-grade weapon damage only.
- SOL: investigate the leak, supply chain and clandestine outer-system operation; do not expose the complete organization.
- Alpha Centauri through Epsilon Eridani: connect recurring patterns through independently verified evidence.
- Tau Ceti: establish the organization's identity and connection to deliberate interference.
- Acts II–III: experience the human cost, encounter supporters and internal disagreements, and develop a coalition.
- Act IV: learn the network's ancient engineering and a constrained restoration method. The Directorate does not automatically know every ancient secret.
- Act V: end coercive interference, protect civilian access, establish accountability and help negotiate future stewardship.

The Directorate must not become an all-powerful explanation for every local dispute. Independent piracy, ordinary economic failure, technical faults and honest disagreement continue to exist.

## 7. Relationships and sources of conflict

This is a narrative tension matrix, not a table of implemented faction standing, formal alliances or universal hostilities.

| Relationship | Reason to cooperate | Reason to disagree |
| --- | --- | --- |
| Helios ↔ Merchant League | Both need reliable contracts and delivery. | Pricing power, route information and contract allocation. |
| Merchant League ↔ Outer Rim Guild | Remote markets need bulk imports; merchants need customers and local partners. | Freight prices, access conditions and priority for profitable routes. |
| Survey Consortium ↔ territorial authorities | Reliable navigation and safer infrastructure benefit everyone. | Funding, research access, public safety and restricted information. |
| Helios ↔ Independent Operators | Shared skills, subcontracting and mutual assistance. | Work allocation, membership obligations and rates. |
| Green Starbase ↔ neighboring authorities | Repairs, emergency aid, communications and local trade. | Jurisdiction, neutrality and the handling of sensitive records. |
| Local authorities ↔ Directorate | A promise of shared safety can be appealing during instability. | Loss of autonomy, coercive licensing and evidence of manufactured crises. |
| Directorate ↔ commercial and scientific institutions | Contracts, technical expertise and financial resources can serve legitimate purposes. | Secrecy, exclusive control and complicity once wrongdoing becomes known. |

Relationships change through events, evidence, negotiations and local decisions. No automatic standing transfer between factions is assumed.

## 8. From politics to playable missions

A faction must create different kinds of activity rather than merely provide a different color of hostile ship:

| Gameplay | Narrative application |
| --- | --- |
| Trade and delivery | Fulfill a contract; choose priorities when supplies are scarce; establish delivery receipts. |
| Escort and rescue | Protect a civilian convoy; recover crews and preserve evidence without requiring gratuitous combat. |
| Investigation | Compare records, interview contacts and validate evidence before accusing a person or institution. |
| Exploration and engineering | Survey routes, recover instruments, restore infrastructure and independently verify findings. |
| Diplomacy | Negotiate access, reconcile competing obligations and earn credible assistance. |
| Combat | Intercept a verified threat, defend a vulnerable vessel or support a lawful objective; surrender and recovery have consequences. |

Offers and acceptance remain NPC-driven. Rewards and standing changes are server-owned, based on verified actions and once-only receipts. A quest's narrative relationship is not equivalent to a mechanical permission or a guarantee of docking.

### Existing reputation policy (implementation reference)

`Core.Factions` defines these inclusive bands and potential patrol directives. They are policies, not automatic combat or encounter results.

| Standing | Band | Potential patrol directive |
| --- | --- | --- |
| 60 to 100 | allied | assist |
| 20 to 59 | friendly | clear |
| -19 to 19 | neutral | observe |
| -59 to -20 | unfriendly | inspect |
| -100 to -60 | hostile | intercept |

An active wanted warrant overrides the standing-derived directive with pursue. Detection and escalation still require authoritative encounter decisions. A friendly or allied pilot may be wanted. Membership, territorial jurisdiction, standing, warrants, story flags and passage clearance must remain distinct.

Preserve the First Run reward of 500 credits and its existing standing change. No faction reward amounts, discounts, patrol behavior or standing propagation changes are approved by this document.

## 9. The coalition and the post-campaign world

A practical intersystem coalition is proposed to emerge at Capella in phase 13. It starts with concrete objectives such as humanitarian passage and reliable calibration, not an automatic merger of all governments.

Existing institutions may join for different reasons. The Survey Consortium can contribute evidence; couriers and traders can provide transport; local authorities can contribute infrastructure and security; independent operators can make meaningful contributions. Individual participation and resources should reflect the pilot's story choices where feasible.

At Fomalhaut, the proposed ending concerns stewardship of the liberated network. Distributed local responsibility, an accountable shared authority and a negotiated mixed arrangement remain possible outcomes for review. None authorizes a permanent global change that invalidates another pilot's campaign in a shared multiplayer world.

## 10. Design checklist for new systems

Before introducing a local faction or branch in an expansion system, define:

- Stable proposed identity, kind, jurisdiction, and relation to existing organizations.
- Founding motive and historical event (coordinate with the future TIMELINE.md).
- Public principles, internal disagreements, resources, dependencies and limitations.
- Local civilian consequences of the passage crisis.
- Named NPC representatives with individual motivations and knowledge limits.
- Credible conflicts and cooperation with at least two other institutions.
- Specific mission offers, evidence, rewards, recovery and relevant server-owned events.
- Whether the institution is historical background, proposed story content, or actually implemented.

Do not invent all 28 expansion governments now. Develop them as each system's chapters are written.

## 11. Decisions remaining

- Review the proposed motives, mottos, SOL economic profiles and internal Directorate currents.
- Determine who leaked the First Run route; keep the three established suspects plausible until evidence resolves it.
- Establish the Directorate's founding incident, leaders and recruitment history in future timeline and character documents.
- Decide the legal charter of Green Starbase and the details of local territorial jurisdiction.
- Define expansion-system institutions and the coalition's exact composition as required by the campaign.
- Review any proposed reputation or faction registry extension separately before implementation.
