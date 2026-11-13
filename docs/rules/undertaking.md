# Sponsoring a partner: the long promise

> Every immigration number is the real UK or Canadian one, from the Sources at the end; the rest are working values.
> Kinds: `person` (the sponsor's checks and the bar) and `obligation` (the undertaking, type `undertaking`). Builds on `person.md` (the partner gate, facts, person:partner-gate-needs, person:partner-application-decided, person:partner-status-renews and person:tied-status-clock-on-breakup), `obligation.md`, `abroad-money.md`, `credit.md`. Background: `../design/01-concept.md` section 6, `../research/05-real-people-family-and-safety.md` section 5.
> For game design. Not immigration advice.

Sponsoring a partner is a long promise, as in the real rules:
- The sponsor must earn above a floor.
- In Canada the sponsor signs an undertaking that runs for three years after the partner lands. A break-up or a divorce does not end it.
- Someone who arrived in Canada through a partner cannot sponsor a new partner for five years.

Each of these is checked in the sponsor's own life, and none of them moves money to the partner.

## Agreeing to sponsor

**undertaking:agreeing-to-sponsor** A character agrees to sponsor by proposing, or answering yes to, a joint on a `partner`-gate route with themselves as lead (person:joint-application-proposed, person:partner-gate-needs). The agreement runs undertaking:sponsor-settled-in-country, undertaking:sponsor-earnings-floor, undertaking:sponsored-arrivals-wait-to-sponsor and undertaking:defaults-bar-sponsoring in the sponsor's own life. If one fails, the command is rejected with `not-legal` and the detail names the check. A stand-in never agrees to sponsor (person:stand-in-acts-narrowly).

**undertaking:sponsor-settled-in-country** The sponsor must be abroad in the route's country holding a status in the route's `sponsorStatuses`: `status.uk-settled` or `status.uk-citizen` for `route.uk-partner`; `status.canada-resident` or `status.canada-citizen` for `route.canada-spouse`.

**undertaking:sponsor-earnings-floor** The sponsor's gross yearly pay from the job held, in the country's currency, must be at or above the route's `floorVar`: `var.uk-partner-income` (£29,000) for the UK. Canada has no floor for a spouse with no dependent children (`floorVar` null). A job marked `cash: true` counts as no pay, because it cannot be shown. `factsOf` reports the same check as `meetsFloor` for each partner route, so the floor is judged again when the partner applies and at the partner's renewal (person:partner-status-renews).

**undertaking:sponsored-arrivals-wait-to-sponsor** The five-year bar. A sponsor whose `arrived` (person:partner-application-decided) names a `partner`-gate route into the same country may not agree to sponsor before their own month reaches `arrived.month` plus the country's `partnerBarMonths`: 60 for Canada (five years as a resident or citizen before a new spousal sponsorship), 0 for the UK. The view's `barUntilMonth` gives the month the bar lifts, and Bills shows it as months away. The bar is set per country because it is Canada's rule and no such UK rule was found; giving the UK one would teach a rule that does not exist.

**undertaking:defaults-bar-sponsoring** A sponsor may not agree while any undertaking of theirs is in default, while an earlier partner undertaking of theirs is still running (Canada), or while interview:caught-sponsor-carries-bar's bar stands.

## The undertaking

**undertaking:landing-opens-undertaking** When the sponsored partner departs on `route.canada-spouse`, the authority sends `people/agreed` with `step: "landed"` to the sponsor's life. That opens `obligation.undertaking-canada` naming the bond, with a term of `tuning.undertaking.months` (36) of the sponsor's months from that month. Nothing is owed on the day it opens.

**undertaking:assistance-charged-to-sponsor** In each `due` phase, the undertaking compares the sponsored partner's `assistanceTaken` fact (months of social assistance taken since landing) with the months it has already charged. For each month not yet charged it charges `var.canada-assistance` in Canadian cents, with the reason `undertaking`, from the sponsor's Canadian bank pocket, then cash. Charges are paid in full or missed (obligation:charges-paid-whole-or-missed). A month with nothing new charges nothing and records nothing.

**undertaking:missed-charges-lead-to-default** A missed charge stays owed and costs standing -3. Missed more than `grace` (2) times in a row, the undertaking is in default:
- standing -10;
- the credit file takes the default figure (credit:payments-move-the-mark);
- the default bars sponsoring (undertaking:defaults-bar-sponsoring);
- from the next `due` phase, what is owed is taken from the Canadian bank pocket, as obligation:loan-default-and-recovery takes a defaulted loan.

`obligation/pay` on an undertaking pays down what is owed, and paying it all lifts the default.

**undertaking:undertaking-outlives-relationship** The undertaking outlives the relationship. None of these close it: ending the bond, a divorce, the partner finding work or becoming a citizen, the sponsor leaving Canada or going home. It closes only when its term has passed and nothing is owed. Until then it follows the sponsor wherever they live, in Canadian dollars.

**undertaking:social-assistance-offer** Social assistance is an offer, the same for every resident. `offer.canada-assistance` comes up for a character in Canada holding `status.canada-resident` or `status.canada-citizen` whose Canadian bank and cash together are under `tuning.undertaking.assistanceUnder`. `take` credits `var.canada-assistance` to the Canadian bank with the reason `assistance`. It also adds one to the people slice's `assistanceTaken`, while the character's `arrived` names `route.canada-spouse` and fewer than `tuning.undertaking.months` of their months have passed since. The amount is fixed by content, so no player chooses what reaches the other side, and the sponsor's charge leaves the game rather than reaching the partner's wallet (person:money-counted-never-moved).

**undertaking:uk-partner-has-no-undertaking** The UK partner route opens no undertaking. The real rules ask the sponsor for the earnings floor, judged at application and again at each extension, and give the partner no public funds, so the game has no UK assistance.

**undertaking:view-lists-undertaking** The view lists the undertaking with the obligations: months left, months charged and what is owed. The people view shows the sponsor's agreement, `barUntilMonth`, and whether the floor is met. The partner sees only `meetsFloor`, never the figure.

## Entries

| Id | Values |
|---|---|
| `obligation.undertaking-canada` | type `undertaking`; where `any`; currency CAD; amount `var.canada-assistance` for each new month of assistance; rate 0; term 36; grace 2; sink `undertaking`; `onMiss` standing -3; `onDefault` standing -10, `credit/mark` default |
| `offer.canada-assistance` | group `abroad`; where abroad; when in Canada with `status.canada-resident` or `status.canada-citizen` and Canadian bank and cash under C$1,000; chance 100%; cooldown 1; lapses 1. "The social assistance office: '{amount} a month for basic needs and shelter, while you look.'" `take`: `money/add` C$733 to the bank, reason `assistance`; wellbeing +2, standing -2. `leave`: nothing |
| `route.uk-partner` partner block | `floorVar` `var.uk-partner-income` |
| `route.canada-spouse` partner block | `floorVar` null |
| `country.canada` | `partnerBarMonths` 60 |
| `country.uk` | `partnerBarMonths` 0 |

## Numbers

| Setting | Value | Source or "working value" | In content as |
|---|---|---|---|
| UK partner earnings floor | £29,000 a year, since 11 Apr 2024 | gov.uk, proof of income | `var.uk-partner-income` 2900000 |
| UK floor recommended by the advisory committee | £23,000 to £25,000, not adopted | committee report, 10 Jun 2025 (secondary) | a director story may move the var |
| Canada floor for a spouse with no dependent children | none | IRPR s. 133(4) | `route.canada-spouse` `floorVar` null |
| Canada undertaking for a spouse or partner | 3 years from permanent residence | IRPR s. 132(1) | `tuning.undertaking.months` 36 |
| Canada undertaking for a child, for parents | 10 years or to age 25; 20 years | IRPR s. 132(1) | not used |
| Undertaking survives separation and divorce | yes | Justice Canada | undertaking:undertaking-outlives-relationship |
| Five-year bar after arriving through a partner | 5 years | IRPR s. 130(3) | `country.canada.partnerBarMonths` 60 |
| Earlier spouse's undertaking still running | bars a new spousal sponsorship | canada.ca, spouse sponsorship eligibility | undertaking:defaults-bar-sponsoring |
| Default on an undertaking | bars sponsoring | IRPR s. 133(1)(g) | undertaking:defaults-bar-sponsoring |
| Social assistance, single adult, Ontario | C$733 a month, unchanged since 2018 | Wealth North, 2026, a secondary source (Not verified) | `var.canada-assistance` 73300 |
| Assistance offered under | C$1,000 in the bank and cash | working value | `tuning.undertaking.assistanceUnder` 100000 |
| Grace on undertaking charges | 2 | working value | `obligation.undertaking-canada.grace` |
| Standing on a miss, on default | -3, -10 | working values | the obligation's `onMiss`, `onDefault` |

## Why it is built this way

- **The promise is to the state, not to the partner.** Canada's undertaking is an obligation between the sponsor and the government, separate from support between the spouses. That is why the charge is a sink and never a transfer.
- **The floor is judged in the sponsor's life.** The partner learns only yes or no, so a sponsor's pay is never a number one player can read off another.
- **The bar teaches the real rule where it exists.** Canada added it in 2012 against marriages of convenience; no UK equivalent was found.

## Sources

All read on 8 Oct 2026.

- [GOV.UK: Family visa, proof of income for a partner](https://www.gov.uk/uk-family-visa/proof-income-partner): £29,000; £18,600 only for extensions of visas first applied for before 11 Apr 2024.
- [Vialto Partners: the Migration Advisory Committee's recommendations on family income](https://vialtopartners.com/regional-alerts/united-kingdom-immigration-migration-advisory-committee-publishes-its-recommendations-on-family-route-income-requirements) and [JPS Immigration: is it still £29,000 in 2026](https://www.jpsimmigration.com/uk-spouse-visa-income-requirement-2026-is-it-still-29000/)
- [Justice Laws: IRPR s. 132, length of the undertaking](https://laws-lois.justice.gc.ca/eng/regulations/SOR-2002-227/section-132.html)
- [Justice Laws: IRPR s. 130, the five-year requirement](https://laws-lois.justice.gc.ca/eng/regulations/SOR-2002-227/section-130.html)
- [Justice Laws: IRPR s. 133, default and minimum necessary income](https://laws-lois.justice.gc.ca/eng/regulations/SOR-2002-227/section-133.html)
- [canada.ca: who can sponsor a spouse, partner or child](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/family-sponsorship/spouse-partner-children/eligibility.html)
- [Justice Canada: about divorce and separation](https://justice.gc.ca/eng/fl-df/divorce/sd.html): the undertaking remains in effect for three years after permanent residence, even after separation or divorce.
- [CIC News: when a sponsorship relationship breaks down](https://cicnews.com/2023/03/family-law-in-canada-what-happens-when-a-sponsorship-relationship-breaks-down-0333589.html)
- [Wealth North: Ontario Works at a glance](https://wealthnorth.ca/taxes/benefits/ontario-works/)
- [canada.ca: sponsorship restriction against marriage fraud, 2012](https://www.canada.ca/en/news/archive/2012/03/minister-kenney-introduces-sponsorship-restriction-address-marriage-fraud.html) (through `../research/05-real-people-family-and-safety.md`)

## Not verified

- No UK rule barring a sponsor who settled as a partner from sponsoring a new one was found in the Immigration Rules or guidance searched. If one exists, `country.uk.partnerBarMonths` takes it.
- Ontario's assistance rate is from secondary sources; the provincial page was not opened.
- The UK maintenance undertaking for adult dependent relatives (form SU07) is said to run five years under older rules; the current length was not confirmed. Bringing parents is not among the game's routes, so the game does not use it.

## Contract

1. `Reason` has `undertaking` (out) and `assistance` (in).
2. `ObligationState` has `bond: string | null` and `charged: number` (months of assistance already charged). `obligation/pay` accepts an undertaking.
3. The route `partner` block (`person.md` contract item 4) has `floorVar: Id<"var"> | null`.
4. `CountryEntry` has `partnerBarMonths: number`.
5. `PersonFacts.assistanceTaken` and `PeopleSlice.assistanceTaken` are listed in `person.md`, contract items 11 and 12.
6. Vars: `var.uk-partner-income` 2900000 pence, `var.canada-assistance` 73300 cents.
7. Tuning: `undertaking: { months: number; assistanceUnder: number }`.
8. Content: `obligation.undertaking-canada`, `offer.canada-assistance`.
9. View: `PlayerView.people.sponsoring`: `{ bond: string; route: Id<"route">; month: number } | null` and `barUntilMonth: number | null`; the undertaking appears in `obligations` with `charged`.
