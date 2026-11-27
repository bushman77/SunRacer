# SpaceNova — Lore and foundations

**Revision:** 0.1 · 2026-11-26

**Status:** the historical premise, four ages, core technological limitations, and 500-year interstellar history were accepted by the project owner on 2026-11-26. Additional explanatory details below are working interpretations; exact dates, names, local histories and unresolved mysteries remain open. Lore is not a declaration that a gameplay feature is implemented.

**Related documents:** [Campaign bible](CAMPAIGN.md), [First Run](../story-first-run.md), [Interstellar navigation](../interstellar-navigation.md).

## 1. The world at the beginning of First Run

Humanity has been an interstellar civilization for **500 years since the first successful human interstellar transit**, from SOL to Alpha Centauri. This is a fictional historical duration, not an estimate of when such travel will become possible in reality.

Earth remains humanity's ancestral home, but it is no longer the center of every society's political or economic life. Five centuries of travel, settlement, commerce, migration and local conflict have produced distinct communities across the charted 29-system network. The local histories of those communities have yet to be written.

People depend on trade for materials, medical supplies, equipment and livelihoods. A courier is therefore an essential worker, not merely a tutorial character. The pilot begins as one such worker, with an inexpensive Sunracer, a license to earn and a delivery to complete.

For the purpose of authoring the timeline, the first successful crossing is the reference event, year 0; the opening of First Run is approximately year 500. This relative dating convention is a working tool, not yet an in-universe calendar name or an agreed Gregorian year. See [TIMELINE.md](TIMELINE.md) for the approved broad historical periods; exact intervening events and dates remain open.

## 2. The four ages

| Age | Historical position | Defining transformation |
| --- | --- | --- |
| The Solar Age | Before the first crossing | Humanity establishes independent planetary authorities, stations, refineries and trade within SOL. |
| The Age of Discovery | Before and around year 0 | A gravitational anomaly beyond Pluto is discovered; experimental passage attempts culminate in a successful crossing to Alpha Centauri. |
| The Age of Expansion | After year 0 | Generations of surveyors, settlers and engineers establish interstellar routes, settlements and economies. |
| The Age of Fracture | By year 500 | Disappearances, instability, shortages, piracy and political distrust threaten the transport network. First Run begins. |

The ages describe historical changes, not four equal periods. The approved timeline subdivides Expansion and places the Fracture broadly in years 480–500; exact incident dates and local transitions remain open.

### The Solar Age

Long before humanity crossed between stars, people learned to live and work beyond Earth. Conventional propulsion made sustained movement within the Solar System possible. Mining, manufacturing, research, orbital habitats and supply networks grew around planetary economies.

Political power developed locally. Distance, travel costs, distinct economic interests and the need for practical administration encouraged independent planetary authorities. No universal government is assumed. The exact constitutional histories remain for the faction and timeline documents.

Commercial organizations bridged those jurisdictions: merchants, surveyors, couriers, independent operators and outer-system traders. Their activity eventually created the everyday world experienced in First Run.

### The Age of Discovery

A survey expedition beyond Pluto detected an unusual gravitational anomaly in the east-southeast sector of SOL's schematic navigation chart. Humanity initially understood it as a naturally occurring phenomenon, not as a designed transportation system.

The first attempts to explore it were dangerous. Some vessels disappeared, some were lost, and others returned with structural damage despite functioning shields. These experiences drove the development of passage surveying, pilot training, approach procedures and early beacon technology.

The first successful human interstellar transit reached Alpha Centauri. This event is the origin of the 500-year interstellar historical interval. The expedition name, crew, vessel, discovery date and interval between detection and successful transit are deliberately unspecified.

The first crossing did not make the rest of the galaxy accessible immediately. Each subsequent route needed to be discovered, charted, tested and made reliable enough for settlement and ordinary transport.

### The Age of Expansion

Surveyors traced additional passages. Engineering crews developed instruments and procedures to improve safe approach and emergence. Stations, repair facilities, fuel and supply depots followed the surveyed routes. Generations of migration created distinct local cultures.

Settlements are not automatically self-sufficient. A system may be rich in raw materials but need imported medical supplies, precision machinery or replacement components. Such dependencies give trade strategic as well as commercial importance.

Over five centuries, treaties, rivalries, shipping agreements and inherited grievances accumulated. Earth remained a cultural reference point, not necessarily an authority recognized by every community. SOL's existing planetary authorities and commercial organizations are established in the game; their non-SOL branches and the governments of other systems remain to be designed.

The network is established in civilization's history even though it is progressively inaccessible to the player. A locked campaign route means that pilot has not earned access, or an applicable route is unsafe or restricted; it does not mean nobody has ever traveled there. Exact clearance rules and the status of individual routes require implementation and chapter design.

### The Age of Fracture

By the time the pilot enters service, established trade routes are becoming less predictable. Couriers disappear. Passage failures and shortages make normal business increasingly dangerous. Armed groups exploit disruption, and authorities disagree about how to protect their populations.

Most inhabitants see local problems. A refinery manager sees a shipment that never arrives; a repair engineer sees unexpected weapons damage; a courier sees unusually dangerous routes. They do not begin the story with a complete explanation of events.

The campaign gradually connects these experiences. The larger conflict is detailed in the writer-only portion of CAMPAIGN.md. The approved broad Fracture period is years 480–500. No single incident or exact onset date is established.

## 3. Technological laws

These restrictions define the setting and should guide future missions. Where current mechanics are narrower, use the existing implementation rather than implying that the wider lore is already playable.

| Domain | Rule |
| --- | --- |
| Conventional propulsion | Sublight movement within a system. No independent faster-than-light drive. |
| Interstellar movement | Requires a charted, physically approached wormhole mouth and traversal to its paired exit. |
| Shields | Useful against conventional threats; cannot protect a hull from direct wormhole exposure. |
| Communication | Interstellar messages depend on functioning passages and relay infrastructure. No unexplained instantaneous communication across a severed link. |
| Manufacturing | Requires physical resources, energy, labor or machinery, and functioning supply chains. No unlimited matter creation. |
| Passage stabilization | Requires specialized equipment, calibration data, and suitable conditions. Cannot be performed arbitrarily from any location. |
| Artificial intelligence | Assists navigation and automation; can fail, has incomplete information, and does not remove human judgment or piloting. |
| Ancient technology | Poorly understood; its capabilities and limitations must be earned through investigation rather than introduced as convenient solutions. |

### Wormholes and navigation

Wormholes are connections between particular locations in distinct star systems. Conventional propulsion carries a ship to an entrance. The ship must then actually traverse the passage. Its paired exit determines the destination; selecting an arbitrary star on the Galactic Atlas does not move a vessel.

The player's piloting matters. Passage exposure directly damages hull integrity, increasing with duration. Leaving the tunnel's viable boundary introduces further danger. Human calibration technology improves navigability and safe access, not immunity. Hull damage must remain consequential after failure or arrival once live transit is implemented.

The current flight lab demonstrates accumulating hull damage, shield bypass, a three-second recovery window after a boundary breach, ejection to the origin and a ten-second retry cooldown. These are current simulated gameplay rules, not universal physical constants for every historical passage or vessel. The development lab does not yet perform persistent ship settlement or live system transfer.

The first SOL mouth lies at (+84,000,000, +35,000,000, 0) compressed game-km, beyond Pluto in the ESE direction on the overhead Atlas. These are game coordinates, not real astronomical measurements. The route to Alpha Centauri is currently locked in normal play.

### Communication and isolation

A functioning passage enables interstellar exchange of information through relay infrastructure or transported records. The exact signal transport mechanism and delays are open design questions.

An isolated system cannot assume that a distant authority knows its situation. News may be delayed, outdated, incomplete or deliberately distorted. When a message is critical to a mission, the design must establish how it reached the recipient.

This limitation makes rescue, intelligence work, couriers, and reconnecting communities central to the campaign.

### Economics, autonomy and infrastructure

A station needs maintenance, replacement parts and incoming resources. Ships require repairs and usable equipment. Independent organizations can operate across jurisdictions without owning the territory they serve.

Local authorities retain distinct interests and responsibilities. Trade agreements do not erase political independence. Reputation, lawful authority and criminal warrants are separate concepts, consistent with the game's current faction model.

A future writer must specify which organization operates a facility, what it supplies, whom it depends upon, and what happens when a route is interrupted. Avoid making every system an interchangeable copy of SOL.

## 4. The ancient mystery — writer-only

The accepted premise is that humanity initially believes the passages are natural, but later discovers evidence of ancient engineering. The campaign's working explanation is an engineered stabilization layer embedded in naturally occurring wormholes. The builders are provisionally called **the Architects**.

Do not claim that they created every wormhole, that they were human, or that they still exist. The following questions are intentionally unresolved:

- Who or what were the Architects?
- When did they operate?
- Why did they build or modify the network?
- Did they abandon it, die out, migrate, or suffer a catastrophe?
- Was their disappearance related to the technology?
- What evidence could distinguish these explanations?

Act IV is the planned point at which the player earns substantial evidence about the network's origins. Earlier events may contain anomalies and fragments, but not explicit confirmation of the Architects. Ancient technology is neither magic nor an unlimited source of power.

The Directorate's specific origin, motives, leadership and proposed Resonance Array are covered provisionally in CAMPAIGN.md and are developed provisionally in [FACTIONS.md](FACTIONS.md). No exact founding date, culprit, or individual antagonist is established here.

## 5. Cultural and narrative constraints

Five centuries are enough for societies to develop different traditions, institutions, accents, local histories and economic priorities, but their common human ancestry remains meaningful. Do not presume that all residents of a system share one culture, allegiance or moral outlook.

Original characters should have personal reasons to act: family, employment, loyalty, ambition, fear, curiosity and professional duty. A faction's leadership may have interests that differ from those of its members. Ordinary people must remain visible in the story's conflicts.

Real star names identify our fictional campaign locations. Their real astronomical properties are distinct from invented settlement geography. No actual inhabited exoplanet is implied. The Galactic Atlas is schematic; the fixed sequence is a campaign structure rather than a real map of wormholes.

## 6. Canon register and open decisions

**Accepted 2026-11-26**

- 500 years elapsed since the first successful human interstellar crossing to Alpha Centauri.
- Four ages: Solar, Discovery, Expansion and Fracture; First Run begins in the last. The broad historical periods within them are approved in [TIMELINE.md](TIMELINE.md).
- First wormhole discovered beyond Pluto, with dangerous early attempts and hull damage.
- Independent planetary authorities, mature interstellar cultures and physical supply dependencies.
- Conventional sublight propulsion, wormhole-only interstellar travel, shield bypass, relay-dependent communications, limited automation, specialized stabilization and poorly understood ancient technology.
- The gradual ancient-engineering revelation; the fate of the builders remains unresolved.

**Working interpretation, not individually ratified:** details of early survey development, political and economic historical explanations, and the broad progression of passage infrastructure.

**Still open:** absolute calendar, expedition and crew names, dates of later crossings and settlement, specific political constitutions and wars, Directorate founding and leadership, passage communication mechanism and delays, and the Architects' identity and fate.

Maintain this distinction in later scripts. [TIMELINE.md](TIMELINE.md) establishes the broad framework; named events and exact dates will be added as needed; FACTIONS.md and CHARACTERS.md will define institutions and personal histories. New details must not contradict the accepted 500-year interval or the implemented First Run.
