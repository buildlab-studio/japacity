# Luck, the safety net, and the kiosk

> Numbers are working values with sources where they exist. The Friday draw is `lottery.md`'s; offline, the odds are fixed and drawn from the world's seed.
> Kinds: `offer`, `activity`, `obligation`, `news`, `turn` (the `big` line).

Any player can read the code, so nothing here depends on a rule being secret. Wins come from the world and from who the character is, never from looking poor.

## Rules

**luck:luck-never-reads-money** An offer entry marked `luck: true` is a win that arrives because of the world or the profile. Its `when` may read qualities, routes, documents, the place, the era and the world's variables. It may never read a money requirement, directly or inside `not` or `any`. `checkContent` fails on a luck offer that reads money; that check is the proof that luck cannot be farmed by looking broke. Advisers and agents are bound by the same rule (advice:agents-never-read-money).

**luck:whip-round-once-per-life** The whip-round is the one rescue per life. `offer.whip-round` opens at most once, in the `come-up` phase, when the character:

- has played 12 months or more;
- holds under `tuning.luck.rescueUnder` across every pocket of every currency, valued in naira at the official rate;
- has no loan in default;
- is at home.

It pays `tuning.luck.rescue` to the bank as a gift, flagged. The pay is always less than `rescueUnder` times `tuning.luck.rescueRatio`, so throwing money away to reach it loses more than it brings. A test proves the inequality against content.

**luck:no-kicking-while-down** "No kicking while down", stated openly: while `quality.wellbeing` or `quality.standing` is under 30, offer entries marked `bad: true` roll at half their chance and entries marked `luck: true` at double. The halving and doubling read qualities only. The illness (health:illness-rolls-when-run-down) is marked `bad` but rolls by its own rule at the full `tuning.health.illnessBp`, never halved.

**luck:dry-spell-raises-luck** A dry spell ends. When no `luck` offer has opened for `tuning.luck.drySpellMonths` months, every `luck` entry's chance rises by `tuning.luck.drySpellBp` for each further month, capped at `tuning.luck.drySpellCapBp`. The count is months, never money.

**luck:kiosk-sells-lotto-tickets** The lotto kiosk: `activity.play-lotto` is a now-act at home (activity:now-acts-and-month-acts: the kiosk sells at once, as a purchase that may repeat; the draw waits for the month).

- **Tickets.** Its param is the ticket count, from 1 to `tuning.luck.maxTickets`. The cap is in the simulation (engine:limits-tested-through-step). The contract's `param` kinds have no `tickets`, so the activity kind gives the kiosk its counts by its id.
- **Paying.** Each ticket costs `tuning.luck.ticket` (reason `social`), from earned naira only, never from a top-up (wallet:top-ups-are-marked). It is paid by its size (decision 0014): cash first at or under `tuning.wallet.cashUpTo`, the bank first above it.
- **The draw** is on the stream `lotto`: `tuning.luck.prizeSmallBp` wins `prizeSmall`, `prizeMidBp` wins `prizeMid`, and `jackpotPerMillion` (draws in a million) wins `prizeJackpot`. Winnings are credited to the bank with the reason `win`, never flagged: a winner's letter explains them. The expected return is under half the stake, and a test proves it from the numbers.
- **Offline only.** The kiosk's slip is the offline game's: `activity.play-lotto` holds only while `World.lottery` is null, through the requirement `world/lottery` of `lottery.md`'s contract. Online, the same kiosk sells the Friday draw (lottery:draw-runs-online-only).
- **Spending shown.** The Lotto app says what this month's tickets cost and how many, read from the month's lines (each kiosk ticket's `social` debit, each online ticket's line), so the money spent on the lotto shows where the player looks.
- **Monthly ceiling.** At most `tuning.luck.maxTickets` tickets a month across visits. A purchase that would pass it is refused `not-legal`, and the kiosk says so in its own voice (`line.activity.play-lotto.cap`). So "play every time in case I win" costs real money but never becomes a strategy. The view offers only the ticket counts still under this month's ceiling, and none once it is reached, so it never offers a slip the kiosk refuses. The kiosk's act then leaves it for the month, as a now-act done does, and the last ticket's answer states the ceiling.
- **What the player is told.** When buying, the kiosk says the draw comes with the month. At the month's end the results state the draw's outcome in words among the month's events, never only the ticket's tag, and a full month never cuts it: "Your ticket did not win." ("Your 3 tickets did not win."), or the win with what came in (`line.activity.lotto-won`; a jackpot or a mid prize gets its moment card, moment:outcomes-that-are-moments). News tells it in the same words.

**luck:bet-slip-stake-and-odds** The bet slip: `activity.bet-slip` stakes `tuning.luck.stake` from the naira, paid by its size (decision 0014). It draws on stream `lotto`, with `tuning.luck.betWinBp` to win `betOddsBp` of the stake (reason `win`, paid in by its size). Wellbeing +2 on a win and -2 on a loss. The expected return is under the stake.

**luck:telco-promo-may-be-fraud** The telco promo: `offer.telco-promo` ("You have won. Send ₦2,000 to claim") is a `life` offer with `fraudBp` 8000. A fraud takes the fee and nothing follows; an honest one pays `tuning.luck.promo` to the bank as a gift. Its signs are learnable, as the agent's are.

- **How its money is described.** As what it was, in the results, the Bank and News alike, never as money paid to an agent, since there was none:
  - a fraud's fee: "₦2,000 sent for a prize that never came.";
  - an honest one's fee: "₦2,000 sent to claim the prize.";
  - the prize: "The prize came through: ₦50,000."
- The interface names the payment for its answer by the wallet line's reason (`ui.line.offer-paid.<offer>.<reason>`, and `.then-<reason>` for a payment followed by more of the answer's money). The ledger's reason is `fee-agent`.

**luck:big-wins-are-staged** Big wins are staged. A report line with `big: true` is given for:

- the first pay of a life;
- the first pay in a foreign currency at home (a dollar salary, shown in naira in the line's params);
- the first pay abroad (shown in naira);
- the visa grant;
- the departure, or an in-country switch of status;
- a wedding;
- going home for December (`setpiece.december` answered Go);
- a kiosk or Friday draw win of the jackpot or the mid prize.

This page holds the list; `text.md` cites it. The interface gives each a moment of its own. The simulation sets the flag and changes no rule. In the world, a big line goes to the corner before the results, and its moment card belongs to the world.

**luck:savings-circle-holds-pot** The savings circle: `offer.join-ajo` opens `obligation.ajo`, an obligation of type `ajo`, of `amount` a month for `term` months with no interest.

- It holds the pot, `amount` times `term`, as its principal and what is outstanding. The charges never lower it.
- In each `due` phase, after the charge is paid, one draw on stream `lotto`, with a chance of one in the months still to come, gives the character the pot: `amount` times `term`, to the bank as a gift, once per circle.
- A missed month closes the circle with standing -6, and no pot if the pot has not come. A pot already paid is kept.
- The expected value is exactly what was paid in; the win is the timing.
- The circle is one of the passbook's roads (wallet:roads-to-the-target), shown with these figures from content.

**luck:japa-luck-in-existing-systems** Luck that belongs to japa lives in the existing systems. Each of these is `luck: true`:

- `offer.relative-sends`: a relative abroad sends $500 to the dollar bank pocket, gift, flagged, when any route is known;
- `offer.december-bonus`: a thirteenth month from the job, salary, when `var.season-december` is 1 and a job is held, chance 3000;
- `offer.scholarship-round`: when `route.uk-masters` is known with an offer held, £3,000 to the GBP bank as a gift (see the entries table), 15% a month in the window.

## Entries

| Id | Group | When | Chance | Terms and effects |
|---|---|---|---|---|
| `offer.whip-round` | life, luck | luck:whip-round-once-per-life | opened by the rule, not rolled | gift `tuning.luck.rescue` ₦250,000, flagged; choices `accept`, `decline` (standing +3: pride) |
| `offer.telco-promo` | life | always | 300 | fee ₦2,000 (`fee-agent`); honest pays ₦50,000 gift; fraud 8000; signs `shortcode` (honest 80, fraud 20), `reply-now` (20, 90), `strange-number` (10, 85) |
| `offer.relative-sends` | life, luck | any route known | 400 | $500 to USD bank, gift, flagged; cooldown 9 |
| `offer.december-bonus` | life, luck | job held, `var.season-december` 1 | 3000 | one month's pay to the bank, `salary`; cooldown 11 |
| `offer.scholarship-round` | life, luck | an offer from a school on `route.uk-masters` | 1500 | `money/add` of £3,000 to the GBP bank pocket, reason `gift`, not flagged: a scholarship letter explains it. It is a `money/add`; the school's discount is separate |
| `offer.join-ajo` | money | standing 40, network 20, at home | 800 | opens `obligation.ajo`: ₦20,000 a month for 10 months; cooldown 12; also opened by the match (activity:watch-the-match) |
| `activity.play-lotto` | now-act, a purchase, home | while `World.lottery` is null | | param: the ticket count, 1 to 5, at ₦200 each |
| `activity.bet-slip` | now-act, a purchase, home | always | | stake ₦2,000 |

## Numbers

| Setting | Value | Source | In content as |
|---|---|---|---|
| Rescue pays | ₦250,000 | working value | `tuning.luck.rescue` |
| Rescue needs holdings under | ₦100,000 | working value | `tuning.luck.rescueUnder` |
| Rescue opens after | 12 months played | working value | `tuning.luck.rescueAfterMonths` |
| Down, for luck:no-kicking-while-down | wellbeing or standing under 30 | working value | `tuning.luck.downUnder` |
| Rescue ratio | the pay is under 3 times the line | the inequality in luck:whip-round-once-per-life | `tuning.luck.rescueRatio` 30000 |
| Dry spell | 8 months, then +100 bp a month, cap +800 | working values | `tuning.luck.drySpellMonths`, `drySpellBp`, `drySpellCapBp` |
| Ticket | ₦200, at most 5 a month | a 5/90 lotto line is sold from about ₦100 | `tuning.luck.ticket`, `maxTickets` |
| Prizes | 1 in 10 wins ₦500; 1 in 2,000 wins ₦50,000; 1 in 100,000 wins ₦2,000,000 | stylised from 5/90 payouts of about 240 times for two numbers | `tuning.luck.prize*Bp`, `prize*`; the jackpot's chance is `tuning.luck.jackpotPerMillion` 10, counted in a million because one in 100,000 is under one basis point |
| Expected return on a ticket | ₦95 on ₦200 | computed | the test |
| Bet slip | ₦2,000 at 1.9 times, 45% to win | typical odds of 1.85 to 2.10 on favourites | `tuning.luck.stake`, `betOddsBp` 19000, `betWinBp` 4500 |
| Bet slip wellbeing | +2 on a win, -2 on a loss | working value | `tuning.luck.betWellbeing` 2 |
| Promo | ₦2,000 to claim ₦50,000, a fraud 80 times in 100 | working values | the entry |
| Savings circle | ₦20,000 a month, 10 months | working values | the entry |

## Sources

- [Awajis: how the 5/90 lotto pays](https://awajis.com/baba-ijebu-lotto/), [Wikipedia: gambling in Nigeria](https://en.wikipedia.org/wiki/Gambling_in_Nigeria)
- [Cowrywise: the sure odds lie](https://cowrywise.com/blog/betting-vs-investing-nigeria/)

## Not verified

- Lotto stakes and payout multipliers come from a fan guide, not the operator. The game's figures are stylised in any case.
