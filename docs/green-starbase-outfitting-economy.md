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

## Fixed prices

| Item | Effect | Price (credits) | First-run rewards needed to match price* |
| --- | --- | ---: | ---: |
| G3N-1010 (g1) | +2 speed | 1,500 | 3 |
| Beryl beam | 15 damage (replaces built-in Garnet's 10) | 2,000 | 4 |
| G3N-2010 (g2) | +4 speed | 5,500 | 11 |
| Sapphire beam | 20 damage | 6,000 | 12 |
| SG3N-A01 (sg1) | 1,000 shield capacity, 40% absorption | 6,000 | 12 |
| LF-1 | 40 damage | 14,000 | 28 |
| G3N-3210 (g3) | +7 speed | 16,000 | 32 |
| SG3N-A02 (sg2) | 2,000 shields, 50% absorption | 22,000 | 44 |
| LF-2 | 60 damage | 32,000 | 64 |
| LF-3 | 150 damage | 130,000 | 260 |
| LF-4 | 200 damage | 300,000 | 600 |
| B02 shield | 10,000 shields, 80% absorption | 300,000 | 600 |

\* The current prologue pays **500 credits once** at the first verified delivery.
The equivalents above express **relative cost**, not an assertion that the
delivery is repeatable. The game needs a separate, server-verified repeatable
income path (missions, cargo trading, bounties) before equipment purchases
become a fully reachable long-term progression loop. Do not silently increase
story rewards or give starter equipment as a workaround.

## Balancing assumptions and next gates

- Starter Sunracer: one upgradeable laser hardpoint (built-in Garnet: 10 damage)
  and one generator hardpoint; two saved loadout configurations.
- The prices are initial manual tuning targets. The effect magnitudes in the
  current equipment catalog are also provisional.
- Buying extra copies consumes credits each time; there is currently no
  refund/resale path or free upgrade exchange.
- Keep the shop server-owned. Future restocking, faction discounts, and dynamic
  markets require independently validated server-side policy and tests.
- Next economic milestone: verify a repeatable earning loop and measure
  credits earned per hour, upgrade time-to-purchase, survival difficulty,
  and endgame inflation before modifying the price book.
