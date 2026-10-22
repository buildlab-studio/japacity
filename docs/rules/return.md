# Coming home

> The fares and the shapes are from `../research/03-life-abroad-and-return.md`; the standing numbers are working values. Sources at the end.
> Kinds: `place` (place:return-home-paid-or-assisted, place:return-shape-decided-at-once, place:fare-home-in-local-currency, place:family-takes-you-back and place:removal-bans-the-country hold the mechanics), `setpiece`, `quality`, `offer`. Background: `../design/01-concept.md` section 14.

How you leave decides what you come back to. The family house is always there. Everyone has an opinion.

## Rules

**return:return-record-in-words** The shapes of a return are the five in place:return-shape-decided-at-once. The record keeps every return, and the view shows the record in words, newest first.

**return:standing-by-return-shape** Standing moves by the shape on the day of return (place:family-takes-you-back): `with-papers` +10, `by-choice` 0, `broke` -8, `assisted` -12, `removed` -20. Standing then recovers through visible capital: each ₦1,000,000 of naira in the bank on the day of return above the broke line adds +1, capped at +10, applied once. In the world the room abroad's bag carries Go home, the one surface that sends `return/home`: a card in the ask's dress with the shape in one line, chips for the status ending, the family house taking you back and the standing rising, holding or falling (in words, never the figure), the fare on the one yellow button in the local money or in naira when bought from naira ("Assisted return" takes the ticket at no cost), shut with "Short of the fare" or "No way home today"; offered only abroad, while a way home exists and the life runs.

**return:returnee-offers-for-a-year** For 12 months after any return the home offer pool gains the group `return`: `offer.returnee-question` (the question everyone asks), `offer.returnee-business` (a cousin with a shop idea), `offer.returnee-hire` (a company that wants the foreign experience), `offer.returnee-leave-again` (a friend's connection). Each is rolled as the offer kind rolls, with the shape of the last return in its `when`.

**return:papers-return-keeps-status** A `removed` return bans the country (place:removal-bans-the-country). A `with-papers` return keeps a status token: `status.uk-settled`, `status.uk-citizen`, `status.canada-resident` or `status.canada-citizen` is kept as `heldAbroad` on the place slice, and `route/depart` on the matching country is legal again at once with no gate and no fee but the flight: the door is still open. A `canada-resident` token lapses after 24 months away (the residency obligation, 730 days in five years, read as two years of absence).

**return:december-visit-set-piece** The December visit is a set piece while abroad: in the tick `var.season-december` is 1, the place kind's `month` phase opens `setpiece.december` with `route` null, once a year (route:answers-carry-effects). Its first question is whether to go: the answer that goes carries the fare both ways times the December factor as an effect, and the answer that stays carries nothing and ends the scene. The three spending questions follow (the party, the gifts, the look), each answer trading money abroad for standing, wellbeing and network through its effects, paid in the country's currency. It blocks `turn/end` like any set piece (route:open-set-piece-holds-month). No activity opens it. Beside it, in the same tick, three free slots fly home for December without the set piece: `activity.december-home-uk`, `activity.december-home-canada` and `activity.december-home-uae` each take the fare both ways times the December factor (£3,100, C$5,940, AED 6,840) with the reason `fare` and give standing +12 and wellbeing +6; none is offered on the country's overstayer or irregular status, and none from Italy. The visit opens at most once in any twelve months of the character's own time, read from `decemberMonth` against the month (not the tick), so a December that spans many world ticks online opens it once.

**return:return-reopens-home-charges** A return of any shape reopens `obligation.upkeep` at the starting life's amount, and `obligation.home-support` reopens at its old amount if the starting life had it (place:family-takes-you-back is the one source for what reopens). The obligations of type `upkeep`, `support`, `rent`, `phone`, `surcharge`, `tuition` and `car` close; a loan, held funds, the agent's debt, an undertaking, a group loan and an ajo stay open wherever they were taken. A car is handed back (car:car-handed-back-after-half whether or not half is paid; the shortfall, if any, follows you as `obligation.car-shortfall-home`, in naira at the day's official rate). The Go home card carries no warning of the month's dues abroad, since those bills close on the way home.

**return:routes-run-again-from-home** From home again, every route runs as before. Earlier refusals and bans stay on the record. `quality.standing` and the capital you came with are what changed.

## The December set piece: `setpiece.december`

| Question | Answers | Effect |
|---|---|---|
| `party`: "Everybody is going out. Lagos in December is not cheap." | `big` ₦400,000 | standing +6, wellbeing +6, network +4 |
| | `small` ₦120,000 | standing +2, wellbeing +4, network +2 |
| | `home` nothing | standing -3, wellbeing +1 |
| `gifts`: "Your mother has a list. Your cousins have longer ones." | `all` ₦600,000 | standing +8, wellbeing +2 |
| | `some` ₦200,000 | standing +3 |
| | `none` nothing | standing -6, wellbeing -3 |
| `look`: "People expect to see that it went well." | `outfit` ₦250,000 | standing +4, wellbeing +3 |
| | `plain` nothing | standing -1 |

Amounts are paid with `money/take` from the `transfer` pocket (the bank first, then cash) of the character's country currency, reason `social` for the party and the look and `family` for the gifts. Each naira amount is converted into that currency once, at the content's starting official rate (`tuning.rate.start`), so the live rate does not move it. If those pockets cannot cover an answer, that answer is not `allowed` (offer:choice-needs-conditions-and-funds shape). "Not this year" is always allowed.

## Fares

| Country | Off peak, one way | December factor | Source |
|---|---|---|---|
| uk | £620 | 2.5 | Virgin and Ethiopian listings 2025: £516 to £732 off peak, £886 to £1,334 in December (see `place.md`) |
| canada | C$1,350 | 2.2 | working value |
| uae | AED 1,900 | 1.8 | working value |
| italy | €480 | 2.0 | working value |

## Numbers

| Setting | Value | In content as |
|---|---|---|
| Standing by shape | +10, 0, -8, -12, -20 | `tuning.return.standing` keyed by shape: `with-papers`, `by-choice`, `broke`, `assisted`, `removed` |
| Capital bonus | +1 per ₦1,000,000 above the broke line, cap +10 | `tuning.return.capitalPer` 100000000, `capitalCap` 10 |
| Returnee offers window | 12 months | `tuning.return.offerMonths` |
| Resident token lapses after | 24 months away | `tuning.return.residentLapseMonths` |

## Sources

- [New Lines: Nigeria's returnees are not always welcome](https://newlinesmag.com/reportage/nigerias-returnees-arent-always-welcome/)
- [The New Humanitarian: returnees treated alike](https://www.thenewhumanitarian.org/news-feature/2020/07/28/Nigeria-migrants-return-Europe)
- [GOV.UK: Voluntary Returns Service, up to £3,000](https://www.gov.uk/return-home-voluntarily/who)
- [BusinessDay: Detty December 2025 arrivals and spending](https://businessday.ng/business-economy/article/us-uk-top-lagos-detty-december-arrivals-as-diaspora-spending-hits-n396bn/)
- [Intercity: London to Lagos fares by season, 2026](https://intercity.ng/blog/flights-london-to-lagos)
- [IRCC: physical presence requirements](https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/operational-bulletins-manuals/canadian-citizenship/grant/residence/physical-presence-intent-reside-requirements.html)
