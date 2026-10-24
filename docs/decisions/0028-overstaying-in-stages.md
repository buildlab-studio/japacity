# 0028. Overstaying in stages

Status: Accepted

## Context

A status abroad that lapsed became the country's overstayer status, and a detection draw of a few percent a month sent the character home at once with the country's longest ban. Real enforcement is far slower and leaves ways out: a late application within days, leaving by choice for a short ban or none, a paid return scheme, a partner who is settled. `docs/design/12-overstaying.md` gives the design; the rules are in `status.md`, `place.md`, `route.md`, `route-gates.md`, `person.md`, `abroad-money.md` and `road.md`.

The design needs the simulation's contract to grow in five places, which engine.md reserves for a decision.

## Decision

- **A ledger reason, `fine`**: the UAE's overstay fine, paid with the fare home or carried home as a debt (status:uae-fine-accrues). It is not a fee for a service, so `fee-*` would mislabel it in the bank's lines and the month's results.
- **A command field, `return/home`'s `scheme`**: `true` asks the UK's returns service (place:returns-service-takes-you-home). Absent means the return as before, so every recorded command replays unchanged.
- **View fields**: `status.overstay` (`graceLeft`, `noticeLeft`, `fine`, `pending`; status:view-shows-status) and, on `wayHome`, `banMonths`, `fine` and `scheme` (place:view-carries-way-home), so the screens say the cost of each way out before the tap.
- **A route state arrow, `departed` to `known`** (route:lapsed-route-known-again): a route flown and then lost can be applied for again once any ban lifts. Its school, deposit, confirmation and sponsor are cleared; its record stays.
- **Carried with them**: an effect `route/lapse` that turns a lost country's departed route back to known; an optional `grace: true` on the requirement `status/is`; optional state fields for the overstay (`StatusState.overstay`, `StatusState.settleMonths`, `PlaceSlice.overstays`, `VisaApplication.inCountry`, `RouteState.authorisedMonth`); an optional `RouteView.authorisation` for the Canadian return's fees; and `SchoolEntry.minBand` removed, since no school asks a band.
- **A draw on stream `status`** for the right-to-rent check (abroad-money:right-to-rent-check), after the detection draw, so the order of draws on that stream is fixed by the rule.

## Consequences

- Recorded lives that lapse into an overstay, return home after departing, or fly at all move from that month: the goldens and recorded lives are re-recorded and blessed with the change, and the commit says which and why.
- Content version "1" is resealed in place while the live databases hold no lives; once a life exists, a change like this freezes the content and raises the version (server:older-content-frozen).
- A screen that shows a way home reads its ban and fine from the view, never from content, so the numbers can be tuned without a client change.
