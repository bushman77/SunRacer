# Green Starbase outfitting economy (initial balance baseline)

## Scope

Ilya Quill sells **one item per confirmed purchase**, at a server-owned fixed credit price.
A purchase adds the item to the authenticated pilot's persistent inventory.
Installation and removal remain separate, free transactions subject to
ship-hardpoint limits. No dynamic stock, player sales, buyback, price negotiation,
premium currency, or client-selected price exists in this phase.

All purchases require the actual ship to be docked and the station avatar to be
within range of Ilya's outfitting kiosk. The world map serializes the service
against docking, walking and launching. In PostgreSQL, the account is locked,
the server validates the current balance, and the credit debit and inventory
addition commit atomically. A failed purchase cannot debit credits or grant gear.

## Scarcity-based progression prices

This is a deliberately **steeper, provisional** price ladder. Entry upgrades
start at 20,000 credits; high-performance lasers and shields reach 8–35 million.
Larger power jumps cost disproportionately more instead of scaling linearly.

| Item | Effect | Old price | Revised price | × 500-credit first-run reward* |
| --- | --- | ---: | ---: | ---: |
| G3N-1010 (g1) | +2 speed | 1,500 | **20,000** | 40× |
| Beryl beam | 15 damage (vs built-in Garnet 10) | 2,000 | **35,000** | 70× |
| G3N-2010 (g2) | +4 speed | 5,500 | **100,000** | 200× |
| Sapphire beam | 20 damage | 6,000 | **150,000** | 300× |
| SG3N-A01 (sg1) | 1,000 shields, 40% absorption | 6,000 | **250,000** | 500× |
| G3N-3210 (g3) | +7 speed | 16,000 | **400,000** | 800× |
| LF-1 | 40 damage | 14,000 | **500,000** | 1,000× |
| SG3N-A02 (sg2) | 2,000 shields, 50% absorption | 22,000 | **1,250,000** | 2,500× |
| LF-2 | 60 damage | 32,000 | **2,000,000** | 4,000× |
| LF-3 | 150 damage | 130,000 | **8,000,000** | 16,000× |
| LF-4 | 200 damage | 300,000 | **25,000,000** | 50,000× |
| B02 shield | 10,000 shields, 80% absorption | 300,000 | **35,000,000** | 70,000× |

\* The first verified prologue delivery currently pays **500 credits only once**.
The last column expresses a price-to-reward ratio, **not repeatable mission
counts**. The game does not yet provide a measured repeatable credit income
loop; earning hours, progression pace, and final affordability cannot be
estimated reliably until that system exists.

## Balancing assumptions and next gates

- Starter Sunracer: one upgradeable laser hardpoint (built-in Garnet: 10 damage)
  and one generator hardpoint; two saved loadout configurations.
- The prices are initial manual tuning targets. The effect magnitudes in the
  current equipment catalog are also provisional.
- Buying extra copies consumes credits each time; there is currently no
  refund/resale path or free upgrade exchange.
- Keep the shop server-owned. Future restocking, faction discounts, and dynamic
  markets require independently validated server-side policy and tests.
- Next economic milestone: implement and measure repeatable missions, trade,
  and bounties. Tune earnings against this scarcity ladder using median hours
  per upgrade, combat survival, player attrition, and endgame inflation.
- Do not inflate rewards merely to make an expensive shop item affordable.
  Difficulty, travel risk, repair costs, and access to higher-paying contracts
  should explain increasing income over time.
- This adjustment changes **only** server purchase prices, their tests, and
  the economy specification; no credits, assets, or existing loadouts are
  changed or retroactively repriced.
