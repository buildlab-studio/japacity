# 0016. The Friday draw is a kind of its own, with fixed odds and a rolling jackpot

Status: Accepted

## Context

- Once a week the whole world draws together.
- The draw changes money, and money changes only inside the simulation.
- Yet the draw needs a secret, a public beacon and every ticket in the world, which only the server has.
- A ticket has to be the same bet however many play, and never worth more than its price.

## Decision

**The lottery is a kind** (`../rules/lottery.md`)

- `lottery` has a slice per character: `draw`, `tickets`, `paid`, `seen`.
- Its parts: the commands `lottery/buy` and `lottery/pay`; the events `lottery/bought`, `lottery/paid` and `lottery/shown`; the reason `ticket`; the requirement `world/lottery`; `World.lottery`; `Tuning.lottery`; and the view's `lottery`.
- `World.lottery` is null in the in-browser world, so offline play has no draw.
- The kind holds the tickets, pays what the authority says and shows the result once.
- The draw runs on the server. `lottery/pay` is an authority command (decision 0005).

**The draw's code is shared**

- The draw's functions are pure code in the simulation package, with a pure SHA-256 and published test vectors (`packages/sim/src/lottery/lottery.draw.ts`).
- Not Web Crypto, whose digest is asynchronous and platform code.
- So the client's draw page runs the same function the server does.

**Fixed odds** (lottery:ticket-result-is-public-function, lottery:fixed-prizes-shared-jackpot)

- Every ticket has a set chance of a set prize, whatever the number of players.
- The pure `ticketResult` reads it from the draw's seed alone.
- There is no shared pot and no house top-up.
- Each prize is paid by the house and credited with the reason `win`.

**A rolling jackpot** (lottery:jackpot-rolls-over, lottery:odds-fixed-at-draw-open, lottery:expected-return-below-price)

- When nobody hits it, the jackpot grows by a share of the draw's sales, up to a cap. Once hit, it starts again.
- The odds and amounts come from the private settings when a draw opens, and are published with it.
- A test proves a ticket's expected return is under its price, both at the start and at the cap.

**No top-up** (lottery:winners-paid-by-authority, lottery:money-report-checks-draws)

- Nothing raises a prize past what the draw's rules give it.
- Every prize is credited as `win`, never flagged.
- The money report checks each draw's `win` against what its published result gives.

## Consequences

- A ticket is worth the same with five players or five thousand.
- The big number stays on the screen. Luck is made friendlier or tighter in the settings, never by editing a draw.
- The money report checks every draw: `win` against the published result and `ticket` against sales.
- A change of odds touches none of these: the draw's seed, fingerprint and beacon (lottery:fingerprint-commits-secret, lottery:ticket-list-frozen-anonymously and lottery:seed-from-secret-and-beacon), and the closed list of authority commands.

## Alternatives

- **A shared pot split among the winners.** A ticket's worth would depend on how many play, so the same ticket would be a different bet from one week to the next.
- **A pot topped up by the house.** The house could make a ticket worth more than its price.
