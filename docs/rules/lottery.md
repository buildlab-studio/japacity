# The Friday draw

> Rests on `luck.md` (the offline kiosk this draw replaces, luck:kiosk-sells-lotto-tickets and luck:big-wins-are-staged), `wallet.md` (reasons and the ledger), `engine.md` (engine:seed-never-leaves-authority, engine:limits-tested-through-step), `server.md` (server:authority-commands-same-path, server:ledger-alarm-lists-suspects, server:apologies-never-currency, server:secrets-stay-on-server), `clock.md` (clock:world-tick-length-and-epoch). Sources read on 8 Oct 2026, linked below.
> Kind: `lottery`. One small slice per character; the draw itself is the server's.

Once a week the whole world draws together. Every ticket is bought with game naira that was earned by playing. Every ticket has a set chance of a set prize, whatever the number of players, like the kiosk and like the real 5/90 lotto: there is no shared pot and no house top-up. One jackpot rolls over: it starts at a set amount, grows by a share of the week's sales when nobody hits it, up to a cap, and starts again when it is hit. The server draws in a way anyone can check afterwards: it publishes a fingerprint of its secret as the week's sales open, and the secret itself after the draw, and each ticket's result is a pure public function of the seed and the ticket's number.

## Rules: tickets

**lottery:draw-runs-online-only** The draw runs only online. `World.lottery` is null in the stand-in world, so offline play keeps the kiosk; when it is present, `activity.play-lotto` is not offered and `lottery/buy` is the only way to play (`luck.md` holds the matching `when`: see Contract). Online the draw is sold at the street kiosk in the world. The kiosk on Bode Thomas Street keeps its name and its act, and while `World.lottery` is present the same tap opens the draw's sheet (world:things-are-tappable-models, world:one-action-one-sheet): the jackpot standing and whether it rolled over, the close counting down, the price and the cap, the tickets held, how many to buy, and one button that says the act ("Buy 2 tickets", its cost paid now) and sends `lottery/buy`; the odds, the draw's seal and the last draw with its check fold behind a tap on a row. The offline slip never opens online, even when a view lists `activity.play-lotto` as allowed. The phone's Lotto app only tells (world:phone-rises-over-scene: tickets are sold at the kiosk), so the kiosk in the world is the one way in.

**lottery:draw-sells-between-ticks** Draw `n` sells from tick `14n` and closes when tick `14(n + 1)` begins, a Friday at 18:00 UTC (clock:world-tick-length-and-epoch); `World.lottery.draw` is the draw on sale at the world's tick, and `closesTick` is its close. Draw `n` goes on sale with the first tick row made after draw `n - 1`'s result is stored (in practice the next tick after the close, Saturday 07:00 in Lagos), because its jackpot depends on that result; between the close and that row the world shows the closed draw being made, with no purchase, and `World.lottery.onSale` is false. The close is still tick `14(n + 1)`.

**lottery:ticket-buying-capped** `lottery/buy` with `tickets` costs no turn and takes `tickets` times `tuning.lottery.ticket` from the naira bank pocket, reason `ticket`. It is rejected with `bad-amount` unless `tickets` is a whole number from 1 and the character's tickets for the draw on sale would stay at or under `tuning.lottery.maxTickets`, and with `cannot-afford` when the pocket is short (engine:limits-tested-through-step: the cap is in the simulation).

**lottery:tickets-kept-per-draw** The slice holds `draw` and `tickets` for the draw on sale. Buying for a later draw first sets `tickets` to 0; tickets for a closed draw are never spent again, because the server has already drawn them.

**lottery:tickets-numbered-by-commit** Tickets are numbered by the server in the order their `lottery/buy` commands were committed, from 0, and the character's view shows its own ticket numbers once the draw closes.

**lottery:view-shows-draw-state** The view shows the ticket price, the cap, the character's tickets and numbers, the close as a real time, the pot so far, the draw's fingerprint and the last draw's result. The pot so far is the sales up to the start of the current tick, carried in the world's tick row.

## Rules: the draw

**lottery:fingerprint-commits-secret** When draw `n` opens, the server makes a 256-bit secret with `crypto.getRandomValues`, keeps it server-only (server:secrets-stay-on-server), and publishes in `World.lottery.fingerprint` the SHA-256 of the secret followed by the draw number, in hex, so one secret can never serve two draws, together with the number of the public randomness round it will use: the first round of the League of Entropy's `quicknet` beacon that falls after the close.

**lottery:ticket-list-frozen-anonymously** At the close the server freezes the ticket list: for each ticket in order, a token that is the first 16 hex digits of the HMAC-SHA-256 of the account id and the draw number under a server key, so no account is named. It publishes the list, the count and the list's SHA-256.

**lottery:seed-from-secret-and-beacon** The draw's seed is the SHA-256 of the secret, the list's hash and the beacon round's randomness, joined in that order. The beacon round is fixed before sales open and its value is unknown until after the close, so the server cannot steer the result even by adding tickets of its own; the fingerprint stops it changing the secret.

**lottery:ticket-result-is-public-function** `ticketResult(seed, ticketNumber, odds)` is pure and public: it reads the seed as a counter-mode stream (block `i` is the SHA-256 of the seed and `i` as eight bytes, big end first), takes the block for the ticket's number as a draw of one in a million, and reads the draw against the odds published for the draw: under `odds.jackpotPerMillion` the ticket hits the jackpot, else under that plus `odds.midPerMillion` it wins the mid prize, else under that plus `odds.smallPerMillion` the small prize, else nothing. Every ticket is drawn alone, so the number of tickets sold changes nothing.

**lottery:fixed-prizes-shared-jackpot** There is no pot. The small and the mid prize are fixed amounts, `odds.small` and `odds.mid`, paid in full to every ticket that wins them. The jackpot is `World.lottery.jackpot`, the amount standing when the draw opened: a ticket that hits it is paid that amount, shared equally to the kobo among every ticket that hits it in the same draw, with any kobo left over destroyed. The server pays nothing else and never pays more than this rule gives.

**lottery:jackpot-rolls-over** The jackpot rolls over. When the draw opens its jackpot is published with the fingerprint (lottery:fingerprint-commits-secret) and fixed for the draw. After a draw nobody hit, the next draw's jackpot is the smaller of the cap, `odds.jackpotCap`, and this draw's jackpot plus `odds.jackpotGrowthBp` of this draw's sales, rounded down. After a draw somebody hit, the next draw's jackpot is `odds.jackpotStart`. The first draw starts at `odds.jackpotStart`. There is no forced win: `odds.forcedWinWeeks` exists as a setting and is null; when set, a draw that is the given number of draws after the last hit pays the jackpot to the sold ticket whose draw is highest, and the page says so before sales open.

**lottery:winners-paid-by-authority** For each character with a winning ticket the server sends one `lottery/pay` with the draw and a list of `{ tier, amount }`, as the authority (server:authority-commands-same-path). It credits the naira bank pocket, reason `win`, never flagged (every prize is the house's by fixed odds; the reason `pot-top-up` is credited by nothing, decision 0016); records the draw as paid; and gives the letter `line.lottery.letter` with attention, with `big: true` when the list holds a `jackpot` or `mid` prize (luck:big-wins-are-staged). Sent by a player, it is rejected with `not-yours`; a second for the same draw is rejected with `not-legal`.

**lottery:money-report-checks-draws** The money report checks every draw: the `win` credited for it must equal what lottery:fixed-prizes-shared-jackpot gives the published result (each small and mid prize at its fixed amount, the jackpot shared among its hits), `pot-top-up` credited must be zero, and the `ticket` debited for it must equal its sales. Any one failing raises the world alarm (server:ledger-alarm-lists-suspects).

**lottery:result-published-in-tick-row** After every payment is committed, the server writes the result into the next tick row: `World.lottery.last` with the draw, the secret, the beacon round and its randomness, the list's hash, the count, the odds and jackpot the draw ran under, the winning ticket numbers by tier and the amounts. Anyone can recompute the seed and every ticket's result from it with `ticketResult`, and the client's draw page does so.

**lottery:draw-result-on-front-page** In the `news` phase, a character whose `seen` draw is older than `World.lottery.last.draw` is given one front-page line, `line.lottery.drawn`, with the jackpot amount and how many tickets won, and `seen` moves on. The radio reads the same line. A winner's name or character is never shown. A prize is told the moment it is paid, by the letter (lottery:winners-paid-by-authority), staged as a moment when big. The month whose lines bring the draw's result (this line) shows the draw's numbers on the results with the player's own lit (world:month-end-results-sheet), and a player who held tickets in that draw and matched none is told so in words, "Your ticket did not win." ("Your tickets did not win."). The ticket numbers are the last draw's only while the next draw is on sale (lottery:tickets-numbered-by-commit); while a closed draw is being made, nothing is said of the tickets in it until its result comes. The draw line sits in News.

**lottery:payment-waits-for-away-player** A payment waits in the log for a player who is away and is seen on the next visit; a player who is online is nudged (clock:socket-only-nudges).

## Rules: what the draw may never become

**lottery:tickets-bought-with-earned-naira** A ticket is bought only with naira earned in the game (wallet:top-ups-are-marked: the balance less the marked, topped-up share), and a prize lands in earned naira. Game naira is never sold, given to another player or taken out of the game. Real money may buy naira as a top-up, marked, which pays for anything in the game except a ticket, so the draw stays a game of money earned by playing with the odds as published. A test proves no command or effect turns a top-up, a paid item or another player's money into a `lottery/buy`.

**lottery:prizes-never-leave-game** A prize is only game naira in the winner's own pocket. Nothing a draw pays can leave the game or be exchanged for anything outside it.

## Rules: the odds are settings

**lottery:odds-fixed-at-draw-open** The odds and amounts of a draw are the private settings' `tuning.lottery.odds` at the moment the draw opens, published in `World.lottery.odds` beside the fingerprint and fixed for that draw: `smallPerMillion`, `small`, `midPerMillion`, `mid`, `jackpotPerMillion`, `jackpotStart`, `jackpotGrowthBp`, `jackpotCap`, `forcedWinWeeks`. The operator can make luck friendlier or tighter by changing the settings; a change takes effect at the next draw's opening, never on a draw whose sales are open.

**lottery:expected-return-below-price** A test proves from the numbers that the expected return on a ticket is under its price, at the starting jackpot and at the cap: `small × smallPerMillion + mid × midPerMillion + jackpot × jackpotPerMillion`, over a million, is less than `tuning.lottery.ticket` for `jackpot` at `jackpotStart` and at `jackpotCap`. The content check fails any settings that break it.

**lottery:screen-states-odds-plainly** The lottery screen shows the odds and amounts of the draw on sale as plain words ("1 in 10 wins ₦500, 1 in 2,000 wins ₦50,000, 1 in 5,000 wins the jackpot of ₦200,000"), the jackpot standing, and whether it rolled over from the last draw. The last draw's result shows how many tickets won each prize and whether the jackpot was hit. No line about a pot or a top-up.

**lottery:safeguards-beside-the-odds** Beside the odds, these hold: ₦200 a ticket, five a week (lottery:ticket-buying-capped), game naira only (lottery:tickets-bought-with-earned-naira, lottery:prizes-never-leave-game), nothing leaves the game, computer characters never buy tickets (person:computers-never-win-scarce), and the money report checks every draw (lottery:money-report-checks-draws).

## Numbers

| Setting | Value | Source | In content or config as |
|---|---|---|---|
| Ticket | ₦200 | `luck.md`: a 5/90 line is sold from about ₦100; the kiosk's price kept | `tuning.lottery.ticket` 20000 |
| Most tickets a draw | 5 | working value; the kiosk's monthly cap kept for a weekly draw | `tuning.lottery.maxTickets` |
| Small prize | 1 in 10 wins ₦500 | the kiosk's small prize (`luck.md`), kept | `tuning.lottery.odds.smallPerMillion` 100000, `odds.small` 50000 |
| Mid prize | 1 in 2,000 wins ₦50,000 | the kiosk's mid prize, kept | `odds.midPerMillion` 500, `odds.mid` 5000000 |
| Jackpot | 1 in 5,000, starting at ₦200,000 | a working value | `odds.jackpotPerMillion` 200, `odds.jackpotStart` 20000000 |
| Jackpot growth | 10% of a week's sales when nobody hits it | working value | `odds.jackpotGrowthBp` 1000 |
| Jackpot cap | ₦380,000 | the highest cap that keeps the return under the price with the odds above is ₦624,999 (lottery:expected-return-below-price); ₦380,000 gives the ₦151 below and leaves room to raise it | `odds.jackpotCap` 38000000 |
| Forced win | none | a working value: a setting, off | `odds.forcedWinWeeks` null |
| Expected return | about ₦115 on a ₦200 ticket at the start, about ₦151 at the cap | follows from the odds; lottery:expected-return-below-price tests both | the test |
| Close | Friday, 18:00 UTC: 19:00 in Lagos | clock:world-tick-length-and-epoch | `server.clock.epoch` |
| Secret | 256 bits | the size of the SHA-256 output it is hashed with | `server.lottery.secretBits` |
| Beacon | `quicknet`, one round every 3 seconds | drand | `server.lottery.beacon` |

The ₦200 ticket and the cap of 5 make the most a player can stake ₦1,000 a week, about one hundredth of the lowest monthly wage in `activity.md` (the teacher's ₦90,000), so a draw is a treat and never a strategy.

## Sources

All read on 8 Oct 2026.

- [drand: quicknet is live](https://docs.drand.love/blog/2023/10/16/quicknet-is-live): unchained rounds every 3 seconds, chain hash and genesis time.
- [drand: HTTP API](https://docs.drand.love/developer/http-api): `/v2/beacons/quicknet/rounds/{round}`.
- [drand](https://drand.love): a public, verifiable randomness beacon run by many independent members.
- [W3C: Web Cryptography API](https://w3c.github.io/webcrypto/): `getRandomValues` gives cryptographically secure random bytes.
- [RFC 9562, section 8](https://www.rfc-editor.org/rfc/rfc9562.html): a version 4 UUID has 122 random bits and must not be used as a security capability.
- [NIST SP 800-90A Rev. 1](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-90Ar1.pdf), section 8.6.3: entropy at least the security strength aimed at; 256 bits for a 256-bit strength.
- [NIST: interoperable randomness beacons](https://csrc.nist.gov/projects/interoperable-randomness-beacons): a beacon pre-commits to its next value; lotteries are a named use.
- [Commitment schemes](https://en.wikipedia.org/wiki/Commitment_scheme): commit, then reveal; hiding and binding.
- The offline kiosk's prices and their sources: `luck.md`.

## Contract

What the contract holds for this page:

1. `KindName` has `lottery`; `State.lottery: LotterySlice = { draw: number | null; tickets: number; paid: number | null; seen: number | null }`.
2. `Command` has `{ type: "lottery/buy"; tickets: number }` and, from the authority only, `{ type: "lottery/pay"; draw: number; prizes: { tier: "jackpot" | "mid" | "small"; amount: number }[] }`; `lottery/pay` is in `AUTHORITY_COMMANDS` (`server.md` contract item 4).
3. Events: `lottery/bought` (draw, tickets, cost), `lottery/paid` (draw, prizes), `lottery/shown` (draw).
4. `Reason` has `ticket`, a sink. `win` is reused for prizes. `pot-top-up` stays in the union, credited by nothing, its ceiling in the money report zero (decision 0016).
5. `World.lottery: { draw: number; closesTick: number; onSale: boolean; fingerprint: string; beaconRound: number; salesSoFar: number; jackpot: number; rolledOver: boolean; odds: LotteryOdds; last: LotteryResult | null } | null`, with `LotteryOdds = { smallPerMillion; small; midPerMillion; mid; jackpotPerMillion; jackpotStart; jackpotGrowthBp; jackpotCap; forcedWinWeeks: number | null }` and `LotteryResult = { draw: number; revealed: string; beaconRound: number; beaconRandomness: string; listHash: string; count: number; odds: LotteryOdds; jackpot: number; winners: { tier: string; tickets: number[]; amount: number }[]; nextJackpot: number }`. The stand-in world sets it to null.
6. `Tuning.lottery: { ticket: number; maxTickets: number; odds: LotteryOdds }`. The content check proves lottery:expected-return-below-price.
7. `PlayerView.lottery: { ticket: number; maxTickets: number; draw: number; closesTick: number; onSale: boolean; tickets: number; numbers: number[] | null; jackpot: number; rolledOver: boolean; odds: LotteryOdds; fingerprint: string; last: LotteryResult | null } | null`.
8. The phase `news` holds the lottery kind's line (lottery:draw-result-on-front-page); `line.lottery.drawn` and `line.lottery.letter` are among the text keys.
9. `packages/sim/src/lottery/lottery.draw.ts`: `ticketResult(seed: Uint8Array, ticket: number, odds: LotteryOdds) -> "jackpot" | "mid" | "small" | null` and `drawResults(seed, count, odds, jackpot)` over every sold ticket, with a pure SHA-256 in the same folder and published test vectors. It is pure code in the simulation package, because the client's draw page must run the same function the server does, and Web Crypto's digest is asynchronous and platform code.
10. `luck.md`: `activity.play-lotto` has a `when` that holds only while `World.lottery` is null, through the requirement `world/lottery` (`{ type: "world/lottery"; online: boolean }`).
11. `packages/store`: `WorldStore` has `draw(n)`, `putDraw(row)`, `addTickets(draw, character, count)`, `freeze(draw)`; `DrawRow = { draw; secret; fingerprint; beaconRound; closedAt: number | null; result: LotteryResult | null }`.
