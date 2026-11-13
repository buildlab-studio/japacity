# The road

> Every number here is stylised on purpose. The record it follows is `../research/02-all-routes-and-timeline.md` section 2. The rules obey the "Design principles" below.
> Kinds: `route` (gate `road`), `offer` (group `road`), `obligation` (type `agent-debt`), `setpiece`. No kind of its own.
> This page holds no usable detail: no places beyond the stylised, no real prices, no contacts, no methods.

The road is the irregular journey north by land and sea. This page holds its design principles and the rules that carry them out.

## Design principles

These hold for every step of the road and every rule below. They have no names of their own: the rules carry them out.

1. **It arrives as an offer, never as a menu choice.** A cousin's friend, a recruiter at a salon, a man at the motor park. On every number the player can see, the offer beats the formal routes: faster, cheaper, no exams.
2. **The warning signs are there and can be learned.** They are in the feed, in the agency's radio spots and in what returnees say. A player who has listened can say no.
3. **Inside, the list of things to do shrinks.** Loss of control is the mechanic. Choices go one at a time.
4. **Debt is the main meter.** It grows after departure. The calls go to the family at home, and they pay with what the player built.
5. **Outcomes follow the documented record.** Most do not arrive. Death is possible and final for that character.
6. **Nothing rewards taking it.** No achievement, cosmetic or leaderboard, and no adverts inside the chain.
7. **No operational detail.** No usable waypoints, prices, contacts or methods. Places and sums are stylised.
8. **Trafficking is shown through debt, confinement and control.** No sexual content and no scenes. The character can be deceived. The player is never put in the role of trafficker or buyer.
9. **Exits exist and are shown.** The anti-trafficking agency, return flights, the embassy, shelters. Coming home carries debt and stigma, and a real way to rebuild.
10. **No player can recruit, sell to or profit from another player.** Every handler is a computer character. A dealer's role for a real player would pay one player to deceive another into a loss; the trick would work only until players warned each other, and with preset phrases the pitch cannot be made anyway. What real players can be is the word on the street: someone who took the road can leave a warning, or a boast, for others to hear.
11. **The real story follows.** After the chain, a card credits and links the journalism it draws on. Nothing from that journalism is reproduced.
12. **The road is never labelled.** The offer does not say "desert" or "dangerous". It is sold as "Europe in three weeks, no visa wahala". The player learns what it is in steps: a deposit, a night meeting at a motor park, the news that it is by road, then a demand for more money. Turning back is possible early (road:road-night-allows-turn-back).
13. **Offers are a system, and not all are what they seem.** Some cheap offers are the road. Some are plain fraud: the money goes and nobody travels. A few are real. The player cannot tell from the price.
14. **Anyone can take the road.** Nothing is locked: the offer reaches every player and is ranked like everything else, more often and higher for a life under pressure (road:pitch-rises-with-pressure, road:pitch-reaches-anyone-at-home). A curious player can go looking for it. The game never pushes it at a profile that has better options.
15. **The warning is given once, at the door.** The game is for adults: the age screen comes before any play (account:age-screen-refuses-minors), and the terms say the game shows dangerous journeys. The offer itself carries no warning, which would give it away.

## Rules

**road:road-route-has-no-figure** `route.road` has the gate `road`, no checklist, no window variable and no japacity figure, and never appears in the routes view. Its state moves only through the offers below. japacity:best-open-route-is-japacity skips it. The content switch `tuning.road.enabled` turns the whole pool off. The road gate builds the road variant of `RouteGateView` (`gate: "road"`, `step`, `monthsHere`), but it is never sent: the routes view drops every route whose gate is `road` before the gate's part is read. While the chain runs, the player sees it through `place.where` (`road`), the report lines and the card.

**road:pitch-rises-with-pressure** The pitch is an offer in group `road`: `offer.road-radio`, `offer.road-park`, `offer.road-cousin`. Each is rolled as any offer is, with its chance raised or lowered by the character's situation: offer:come-up-rolls-in-order reads `chanceBp` plus the entry's `pressure` terms. They add +200 per earlier refusal, +300 if any loan is in default, +200 if standing is under 30 and +100 per year of age over 30, and take -400 if any formal route is known with a japacity figure of 60 or more. `activity.ask-around` at the motor park (a now-act, `where: home`) opens `offer.road-park` at once for the curious. The pitch never says desert, sea, road or danger.

**road:taking-pitch-pays-deposit** Taking the pitch pays its `deposit` term from the naira, by its size (wallet:money-lands-as-in-lagos), reason `fee-agent`. Which of three things the offer is stays hidden: `fraud` (the money is gone and nothing follows), `realish` (a connection that moves), or `road` (the thing itself). The shares are the entry's `kinds`, in basis points. The fraud is drawn when the pitch opens, at the entry's `fraudBp`, which is the `fraud` share (offer:opening-fixes-terms-and-fraud), so the signs follow it. Taking an honest pitch splits it between `realish` and `road` by their shares, with one draw on the `road` stream. `fraud` ends there, with a line a month later. The other two open `setpiece.road-night`.

**road:road-night-allows-turn-back** `setpiece.road-night` asks one question with two answers: `go` and `turn-back`. Turning back costs the deposit and nothing else, and closes the chain with standing -2. Going opens the next step. From here on, every set piece in the chain keeps at least one `exit` answer. An open road scene holds the month like any set piece (route:open-set-piece-holds-month). Between scenes none is open, so the months pass while you wait, and the road's Wait ends the month whatever the bank of turns holds (turn:month-turns-on-empty-bank).

**road:road-truth-asks-more** `setpiece.road-truth` tells the player it is by road and asks for `more` money. The answers:
- `pay`: from the naira, by its size (wallet:money-lands-as-in-lagos), reason `fee-agent`;
- `call-home`: the family pays; `quality.family-means` falls by one point for each ₦100,000 of the amount, `quality.family-stake` is set to 1, standing -5;
- `exit`: home with standing -4, the money gone.

Paying or calling home moves the route to `applying` and the character to the place `road` for the chain's remaining steps. The home obligations are suspended and there are no free slots: the month's activities are the chain's own.

**road:chain-steps-monthly** The chain runs in the `clocks` phase, one step a month, each a draw on stream `road` from the entry's outcome table for that step. Steps: `desert` (2 to 4 months), `compound` (0 to 6 months), `coast` (1 to 3 months), `sea` (1 month). At each step the outcomes are: `on` (to the next step), `held` (another month here, and a ransom call), `turned` (returned to the previous country by its authorities: to `exit`), `lost` (the ending). The compound's `held` outcome opens `obligation.agent-debt` for the ransom sum and `offer.road-ransom-call` to the family: `pay` takes from family means and standing; `cannot` adds the sum to the debt and costs wellbeing -10.

**road:exit-is-assisted-return** `exit` at any step after `truth` is the assisted return: the effect `place/return` with the shape `assisted` (place:return-shape-decided-at-once), standing by return:standing-by-return-shape, and `obligation.agent-debt` kept open in naira: the debt follows you. The return is on the place record with `country` null, because the road is not a country. The exit is shown on every card, in the words of the anti-trafficking agency and the migration agency, from content.

**road:lost-is-final** `lost` applies `turn/finish`, and the view's card is the `lost` one (`card.kind`). It is final for that character. The view shows the ending card and the real-story card, and nothing else can be done. The authority may still grant turns; nothing uses them.

**road:sea-arrival-in-italy** `on` from the `sea` step arrives: `place/move` to `country.italy` with `status.eu-irregular`, cash work only (ladders:cash-jobs-paid-in-hand), and no route from there except `return/home` by the assisted scheme. The debt stays open. From there the overstay runs on `status.eu-irregular`'s terms: no grace, an expulsion order on detection, and a ban only on removal ([`status.md`, Entries: overstaying, country by country](status.md#entries-overstaying-country-by-country); the real Italian rules are its Numbers row "Italy expulsion").

**road:road-earns-nothing** No achievement, collection entry, share card or japacity point is earned anywhere in the chain. The report lines are plain, with tone `bad`. No advert slot renders while the place is `road` (a rule the client obeys; the simulation marks `place.where === "road"`).

**road:real-story-card-after-chain** However the chain ends, the view's `card` then carries the real-story card: the credits and links in content for the journalism the chain follows. Nothing from that journalism is reproduced. Content carries each credit's link beside it, `road.real-story.link.N` beside `road.real-story.credit.N` in `route.text.ts`, where the research found one; a credit with no link is named only. The documentation site's sources page lists every credit with its link (guide:one-sources-page). The credits are the four below, by outlet, work and year, never a reporter's name (`../research/02-all-routes-and-timeline.md` section 1):

| Key | Credit | Link |
|---|---|---|
| `credit.1` | Foundation for Investigative Journalism, an undercover journey north, 2026 | the FIJ's part I |
| `credit.2` | The Sun, an undercover Sahara trek, 2010 | the award copy, award.wscij.org/?p=8058 |
| `credit.3` | CNN, migrants auctioned in Libya, 2017 | CNN, 14 Nov 2017, edition.cnn.com/2017/11/14/africa/libya-migrant-auctions/index.html |
| `credit.4` | BBC News, women held by debt and an oath, 2019 | the BBC News video of Feb 2019 |

**road:pitch-reaches-anyone-at-home** The pitch offers reach every character at home while `tuning.road.enabled` is on, and `take` needs the character to be at home when it is chosen: a pitch left open through a flight cannot start the chain abroad. Nothing on the profile locks the offers. A player with better options sees them less often (road:pitch-rises-with-pressure) and lower in the offer list (the offer view sorts by group, `road` last).

## Entries

| Id | Group | Chance | Cooldown | Lapses | Terms | Signs (honest, fraud) | Choices |
|---|---|---|---|---|---|---|---|
| `offer.road-radio` | road | 300 | 6 | 2 | `deposit` ₦400,000 to ₦800,000 by ₦100,000; `promise` "Europe, three weeks" | `too-cheap` (90, 95), `no-paper` (85, 90), `agency-warning` (60, 60) | `take`, `ignore` |
| `offer.road-park` | road | 500 | 4 | 1 | the same | `too-cheap`, `no-paper`, `cash-today` (80, 95), `returnee-said` (40, 40) | `take`, `ignore` |
| `offer.road-cousin` | road | 200 | 12 | 2 | `deposit` ₦300,000 to ₦600,000 | `cousin-vouches` (70, 70), `no-paper` | `take`, `ignore` |
| `offer.road-ransom-call` | road | opened by the compound | | 1 | `sum` ₦500,000 to ₦2,000,000 | | `pay`, `cannot` |
| `offer.road-exit` | road | opened by the chain each month on the road (road:exit-is-assisted-return), staged at `place.road-night` | | 1 | | | `ask`: the assisted return |

The `kinds` shares of every pitch: `fraud` 3000, `realish` 1000, `road` 6000. A `realish` connection runs the same chain with the `held` chances halved: it is still the road.

### Outcome tables (basis points)

| Step | `on` | `held` | `turned` | `lost` |
|---|---|---|---|---|
| desert | 6000 | 1500 | 2450 | 50 |
| compound | 4500 | 4000 | 1450 | 50 |
| coast | 5500 | 2500 | 1950 | 50 |
| sea | 6000 | 0 | 3850 | 150 |

This follows the record: of those who set out, well under half arrive, most come back and a few die. Over the four steps about 22 in 100 arrive and about 2 in 100 are lost; the rest are held, turned or leave by the exit.

### Sign texts

`too-cheap` "It costs less than the visa fee alone." `no-paper` "Nobody has mentioned a visa, a form or an office." `cash-today` "He wants the deposit today, in cash." `agency-warning` "A radio spot from the anti-trafficking agency ran straight after the advert." `returnee-said` "Someone who came back from that road is at the park. He is not saying much." `cousin-vouches` "Your cousin says his friend did it last year."

## Numbers

| Setting | Value | In content as | Source |
|---|---|---|---|
| Content switch | on; off turns the whole pool off (road:road-route-has-no-figure) | `tuning.road.enabled` true | Game choice |
| Family means fall one point for each | ₦100,000 the family pays | `tuning.road.meansStep` 10000000 | Working value |
| Pressure terms | refusal +200, default +300, standing under 30 +200, age over 30 +100 a year, a strong formal route -400 | each road offer's `pressure` field (`refusalBp`, `defaultBp`, `lowStandingBp`, `perYearOver30Bp`, `strongRouteBp`); the lines standing 30, age 30 and route figure 60 are `tuning.road.pressureStandingUnder`, `pressureAgeOver` and `pressureStrongRoute` | Working values |
| Deposit, more, ransom | stylised ranges above | the offer terms | Stylised |
| Death share across the chain | about 2 in 100 of those who set out | the outcome tables | Stylised on the record of `../research/02-all-routes-and-timeline.md` section 2: most do not arrive, most come back, some die |

## Sources

- The record: `../research/02-all-routes-and-timeline.md` section 2 (the undercover journey, deaths at sea and in the desert, detention, ransom, return and stigma), with its sources. Nothing from them is reproduced here.
- [Arise TV: 180 more Nigerians return from Libya under IOM, 2026](https://www.arise.tv/additional-180-nigerians-return-from-libya-under-iom-repatriation-programme/)

## Effects and requirements this kind handles

How these types are named and judged: [`engine.md` section 5](engine.md#_5-kinds).

| Type | | What it does |
|---|---|---|
| `route/road-step` | effect | Moves the chain to a step or ends it (road:road-truth-asks-more, road:chain-steps-monthly, road:exit-is-assisted-return, road:lost-is-final and road:sea-arrival-in-italy). Carried out by the `route` kind's road gate |
