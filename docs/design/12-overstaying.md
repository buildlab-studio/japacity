# Overstaying

> When a status abroad runs out, the life goes on. The game carries overstaying in three stages, a grace month, the overstay itself and a notice, with removal as the last case and every way out priced in real terms. The rules are in `../rules/status.md` (status:overstayer-risks-detection to status:uae-amnesty), `../rules/place.md` (place:leaving-an-overstay-bans, place:returns-service-takes-you-home), `../rules/route.md` (route:lapsed-route-known-again), `../rules/route-gates.md` (route-gates:in-country-grant-switches-status, route-gates:canada-return-asks-authorisation), `../rules/person.md` (person:partner-route-in-country), `../rules/abroad-money.md` (abroad-money:right-to-rent-check) and `../rules/road.md` (road:sea-arrival-in-italy).
> For game design. Not immigration advice.

## 1. The decision in one line

Losing status is a hard turn, not an ending: a month to fix it from inside, then a narrower life with the ways out still open, and removal only for someone who was told and chose nothing.

## 2. Why

Real enforcement is slow: the UK removed about 9,914 people in 2025 against an estimated 700,000 to 900,000 without papers, about 1% to 1.5% a year. Real life also keeps doors open: a late application within days, leaving by choice for a short ban, the returns service, a partner who is settled. So the game removes no one at once: the player can still redo a master's, go with someone on a visa, or go home by choice, and removal is the last case. Detection is 1% a month, 2% with cash work: about eight times real enforcement, so the risk is felt without ending lives at random.

## 3. The three stages

```mermaid
stateDiagram-v2
  [*] --> grace: the status lapses
  grace --> overstaying: the grace months pass
  grace --> lawful: a sponsor, a course or a partner, in country
  overstaying --> notice: detection
  overstaying --> lawful: a partner, in country
  notice --> lawful: a partner, in country
  notice --> removed: the notice ends and nothing was chosen
  grace --> home: own fare, no ban
  overstaying --> home: own fare, or the returns service
  notice --> home: own fare, or the returns service
```

**1. The grace.** The first month after a lapse (three in Canada, none for the road's arrival in Italy). Nothing has gone wrong yet. No one is looking, the room is safe, and three doors are open from inside: a job with a sponsor's certificate, a new course, or a partner or dependant visa with someone who holds the right status. An application sent in the grace holds it until the answer comes. Going home in the grace at your own fare carries no ban.

**2. Overstaying.** From the month after the grace. Work is cash only, as before. Each month carries a small chance of being noticed (1%, 2% with cash work), never shown. The life narrows: in the UK the landlord's check can end the room, and the next room asks no papers and asks more money; the hospital charges half as much again; the UAE's fine grows every month. The ways out stay open: home at your own fare, the returns service, a partner who is settled. Each costs a ban, said in plain words before the tap.

**3. The notice.** Detection gives a notice, not a removal: three months in the UK, one month elsewhere. Every way out stays open, and an application to a partner's route holds the notice until it is answered. Only at the notice's end, with nothing chosen and nothing pending, does removal come, with the country's full ban.

## 4. The ways out

| Way | When | What it costs | Ban (the UK) |
|---|---|---|---|
| A sponsor's job | The grace | A hunt, as any job | None: the job is the new status |
| A new course | The grace in country; from home after any ban | A school's offer, a deposit, the funds held a month: rarely ready within a month, as in life | None in country; from home, after the ban |
| A partner's or dependant's visa | Partner: any time on the overstay. Dependant: the grace | The partner route's needs; the overstay counts as one earlier refusal; a partner status granted after the grace settles in ten years, not five | None |
| Home at your own fare | Any time | The fare; standing by the shape of the return | None in the grace, 12 months after |
| The returns service | Any time | Nothing: the ticket is paid and £1,500 arrives in naira at home | 24 months |
| Removal | The notice's end, nothing chosen | Standing -20 | 120 months |

Every return past the grace, and a removal, stays on the record as one earlier refusal on the next application into that country. The flown route goes back to known on any loss of status, so the master's can be applied for again once the ban lifts.

## 5. Each country

**The UK.** As above: grace 1 month, notice 3, bans of none, 12, 24 and 120 months, the right to rent and the hospital charge, the returns service.

**Canada.** The grace is the 90-day restoration window, three months. The notice works as a departure order: leave inside it and there is no ban. Leaving at your own fare is never banned; an assisted return is an exclusion order, 12 months. Removal is a deportation order: 120 months, and then the first application into Canada also pays the Authorisation to Return and the removal costs. No Canadian status in the game lapses today (permanent residence does not), so these figures are ready for the day one does.

**The UAE.** Leaving the employer is absconding, and the grace is one month. After it the fine grows by AED 1,500 a month (AED 50 a day) and is paid with the fare at the airport; an assisted return carries it home as a debt in naira. Any return from an overstay brings the one-year labour ban; removal 60 months. An amnesty story, as in 2024, lets anyone leave for four months with no fine and no ban.

**Italy.** The road arrives with no papers, so there is no grace. Detection gives an expulsion order with a month to leave. The assisted return, before or inside it, carries no ban; removal bans 36 months, the real minimum.

## 6. Real life, the game, the factor

| Where | Real life | The game | The factor |
|---|---|---|---|
| UK grace for applying | 14 days, with a good reason (SUI 13.1) | 1 month, no reason asked | About twice as kind |
| UK grace for leaving | 30 days or less at your own expense, no ban (SUI 11.5) | 1 month | The same |
| UK own fare after the grace | 12 months (SUI 12.1) | 12 months | 1.0 |
| UK returns service ban | 2 years within 6 months of a notice, 5 years later | 24 months always | Kinder past six months |
| UK returns service money | The ticket if you cannot pay, and up to £3,000 | The ticket for anyone, and £1,500 at once | 0.5 of the most, paid to all |
| UK notice before removal | None set | 3 months | Kinder |
| UK removal ban | 10 years | 120 months | 1.0 |
| Detection | About 1% to 1.5% a year | 1% a month, about 11% a year | About 8 times real, so the risk is felt |
| UK in-country partner route | Only under EX.1: insurmountable obstacles abroad; then the ten-year route | No obstacles test; ten years to settle; one earlier refusal counted | Kinder on the test, 1.0 on the years |
| UK right to rent | Landlords must check; no figure for how often a room ends | 15% a month, and a room with no papers at £840 against £670 | Working values |
| UK hospital | 150% of the NHS tariff, A&E and GP free | 150% of the game's own hospital figure | 1.0 on the share |
| Canada grace | 90 days, with a fee of C$246.25 plus the permit's | 3 months, no fee | Kinder on the fee |
| Canada removal | Barred for good unless an Authorisation to Return is granted, after repaying C$3,840 | 120 months, then C$492.50 and C$3,840, certain | Finite where life is permanent |
| UAE grace | An absconding report can follow 7 days away | 1 month | Kinder |
| UAE fine | AED 50 a day | AED 1,500 a month | 1.0 |
| UAE unpaid fine | Must be paid before leaving | An assisted return carries it home as a debt | Kinder |
| UAE labour ban | One year on a new work permit | 12 months on routes into the UAE | 1.0 in effect |
| Italy order | 7 to 30 days to leave; ban 3 to 5 years, revocable on leaving in time | 1 month; no ban if you leave; 36 months removed | The real minimum |

## 7. What the player should feel

- A lapse is a jolt with a door still open. The month of grace says plainly what can still be done from inside.
- The overstay is narrow, never a trap: the ways out are on the room's bag with their price and their ban in words, and a person who chooses one is never removed.
- Removal is rare and fair: it follows a notice, and only a player who let the notice run out meets it.

## 8. The money

- `Cash work (energy, detection) -> cash`: linear, with the wage theft of ladders:cash-jobs-paid-in-hand.
- `The room with no papers -> rent`: constant, a quarter above the shared room.
- `The UAE's fine -> a debt`: linear, AED 1,500 a month past the grace, paid with the fare or carried home.
- `The returns service -> £1,500 in naira at home`: once, documented, unflagged.
- `Canada's authorisation -> C$4,332.50`: once, on the first application after a removal's ban.

## 9. Confidence

- Confirmed from the rules of each country as read on 23 Oct 2026 (sources on `../rules/status.md`): the UK's refusal periods, the 14-day and 30-day rules, the returns service, Canada's three orders and fees, the UAE's daily fine and amnesty, Italy's order and ban.
- Inferred: the detection rate's real anchor (enforced returns over an estimate of people without papers from 2017); the UAE's removal ban; the right to rent's chance; the hospital charge's current form.
