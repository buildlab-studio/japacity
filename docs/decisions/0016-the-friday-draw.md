# 0016. The Friday draw: a kind of its own, fixed odds and a rolling jackpot

Status: Accepted

## Context

Once a week the whole world draws together. The draw changes money, and money changes only inside the simulation, yet the draw itself needs a secret, a public beacon and every ticket in the world, which only the server has. A shared pot makes a ticket's worth depend on how many play, so the same ticket would be a different bet from one week to the next, and a pot made up by the house could make a ticket worth more than its price.

## Decision

- **The lottery is a kind.** `lottery` has a slice per character (`draw`, `tickets`, `paid`, `seen`), the commands `lottery/buy` and `lottery/pay`, the events `lottery/bought`, `lottery/paid` and `lottery/shown`, the reason `ticket`, the requirement `world/lottery`, `World.lottery` (null in the stand-in world, so offline play is unchanged), `Tuning.lottery` and the view's `lottery` (`../rules/lottery.md`). The kind holds the tickets, pays what the authority says and shows the result once; the draw runs on the server, and `lottery/pay` is an authority command (decision 0005). The draw's functions are pure code in the simulation package with a pure SHA-256 and published test vectors (`packages/sim/src/lottery/lottery.draw.ts`), since Web Crypto's digest is asynchronous and platform code, so the client's draw page runs the same function the server does.
- **Fixed odds.** Every ticket has a set chance of a set prize, whatever the number of players, read alone from the draw's seed by the pure `ticketResult` (lottery:ticket-result-is-public-function). There is no shared pot and no house top-up. Each prize is the house's and is credited with the reason `win` (lottery:fixed-prizes-shared-jackpot).
- **A rolling jackpot.** When nobody hits it, the jackpot grows by a share of the draw's sales, up to a cap; once hit it starts again (lottery:jackpot-rolls-over). The odds and amounts come from the private settings when a draw opens and are published with it (lottery:odds-fixed-at-draw-open), and a test proves a ticket's expected return is under its price at the start and at the cap (lottery:expected-return-below-price).
- **Nothing credits `pot-top-up`.** The reason stays in the `Reason` union with a ceiling of zero in the money report, and a `lottery/pay` carrying a top-up is refused (lottery:winners-paid-by-authority, lottery:money-report-checks-draws).

## Consequences

- A ticket is worth the same with five players or five thousand.
- The big number stays on the screen, and luck is made friendlier or tighter from the settings, never by editing a draw.
- The money report checks every draw: `win` against the published result, `pot-top-up` at zero, `ticket` against sales.
- The draw's seed, fingerprint and beacon (lottery:fingerprint-commits-secret, lottery:ticket-list-frozen-anonymously and lottery:seed-from-secret-and-beacon) and the closed list of authority commands are untouched by the odds.
