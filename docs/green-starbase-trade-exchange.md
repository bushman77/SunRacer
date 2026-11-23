# Green Starbase Trade Exchange (initial balance baseline)

## Scope

Tarek Sol's trading desk at the Green Starbase Trade Exchange kiosk buys any
legal cargo from the pilot's hold and sells a short list of common goods.
Prices are fixed by the server (`Sunracer.Trade.Market`), per one-tonne unit.
The client sends only a cargo id and a whole-unit amount (1-1,000); prices,
credits, mass and hold capacity are server values.

Every trade requires the ship to be docked and the station avatar to be in
range of Tarek's kiosk: `Core.World.station_purchase(..., attendant: "trade")`
checks this inside the map process, serialized against docking, walking and
launching. In PostgreSQL the account row is locked first and the inventory
row second (the global Account -> equipment lock order), and the credit change
and cargo change commit or roll back together. A refused trade changes
neither credits nor cargo.

Open the desk with **E** at Tarek Sol, then **Open trade console**.

## Prices (tight tier)

Sell prices are about half of a 150 / 400 / 900 "moderate" baseline. Buy price
is the sell price × 1.3, rounded up, so buying and selling back at the same
desk always loses credits (no single-station arbitrage).

| Tier | Sell (cr/t) | Buy (cr/t) | Stocked by the exchange | Sell-only (loot) |
| --- | ---: | ---: | --- | --- |
| Common | 75 | 98 | Methane, Hydrogen cells | Recovered salvage, Rock samples, Civilian mail, Patrol supplies |
| Mid | 200 | 260 | Titanium, Industrial parts, Spare parts, Brandy, Refined minerals | Medical supplies |
| Rare | 450 | 585 | Dilithium | Rare ores, Industrial machinery, Survey equipment, Research data |

For scale: the starter Sunracer holds 4 t, so a full hold sells for 300-1,800
credits. The cheapest fitting (G3N-1010, 20,000 credits) needs more than ten
full holds of the best cargo. The price book fails the build if it ever
disagrees with the cargo catalog.

## Known limitations and next gates

- There is only one market. Bought goods can only be sold back here at a loss
  until a second station (or a cargo-hauling mission) prices them
  differently. Buying is in place so that later markets need only a price
  book.
- No dynamic stock, supply/demand drift, or per-station prices yet.
- Earn rates depend on how often piracy yields cargo; that loop has not been
  measured, so progression pace is not yet known.
