# 0029. Statuses kept on a trip home

Status: Accepted

## Context

A move back to Nigeria (`return/home`) is a different thing for each kind of permission. A UK permission stays in force outside the UK until it ends or until two years in a row away (Immigration (Leave to Enter and Remain) Order 2000, article 13), and the eVisa shows it at the border. What ends a temporary permission on a move home is the reason it was given: a job or a course left behind. Settlement and citizenship then read how long the holder was away.

The real rules, as read on the dates in `../rules/return.md` and `../rules/status.md`:

| Status | Real life | The game | Factor |
|---|---|---|---|
| Graduate visa | Valid abroad until it ends; no settlement | Kept from home until its end month | 1.0 |
| Global Talent | Valid abroad until it ends or two years in a row away; settlement after 3 or 5 years of continuous residence | Kept until its end month or 24 months in a row at home | 1.0 |
| Partner, dependant | As Global Talent; a dependant's permission is normally cut with the main holder's | Kept the same; the dependant's only while the main status is held | 1.0 |
| Skilled Worker, Health and Care | The employer stops sponsoring; the permission is cancelled; unpaid leave past 4 weeks in a year is grounds to cancel | Ends with the move home; a short visit is the December visit, read as paid leave | 1.0 |
| Student | The sponsor withdraws the student; the permission is cancelled | Ends with the move home | 1.0 |
| Settled (UK) | Kept abroad; lapses after two years in a row away | Kept until 24 months in a row at home | 1.0 |
| Canada permanent resident | 730 days in Canada in any five years; lost on an officer's decision | Lost after 36 months in a row at home, for certain | 1.0, certain where life asks an officer |
| UAE employment residence | Cancelled with the job; also after 180 days in a row outside | Ends with the move home | 1.0 |

Settlement: absences of more than 180 days in any 12 months break continuous residence for the UK's settlement routes (Appendix Continuous Residence); absences inside the limit still count.

## Decision

- **Kept statuses**: `status.uk-graduate`, `status.uk-talent`, `status.uk-partner`, `status.uk-dependant` survive a move home as `heldAbroad`, with their end month running, and the character flies back on them with the flight alone (return:papers-return-keeps-status). The return's shape is `with-papers` (place:return-shape-decided-at-once).
- **Job and course statuses end** with the move home: `status.uk-sponsored`, `status.uk-student`, `status.gulf-worker`.
- **Two years away**: any kept UK status, settled included, lapses after 24 months in a row at home; citizenship never lapses. Canada's resident token lapses after 36.
- **Settlement**: months at home count nothing toward settlement or citizenship, and 6 months or more at home inside any 12 starts the road to settling again (status:absence-breaks-settlement). Counting nothing for the months away is stricter than life, where short absences still count; it keeps one plain line the player can read.
- **Partner**: the same 6-month line stands in for the partner route's own test, that the couple has lived together in the UK.
- **Not modelled**: cancellation of a kept permission while its holder is away, the returning resident's visa, the research absences Appendix Continuous Residence leaves out, and Global Talent's need to have earned in the UK before settling; a dependant's kept status where the main holder is also home on a kept one (it ends with the main holder's presence abroad), and a partner's kept status when the relationship ends at home.

## Consequences

- The contract holds `heldAbroad`, which carries the kept status's end month, its settlement months and the months away; `StatusState.away`; `RouteState.grantedMonth`; the requirement `route/state` with `afterReturn`; the view's `place.kept` (`until`, `restarts`); the event `place/token-ended`; and the tuning `tuning.status.absenceMonths`, `tuning.status.absenceWindowMonths`, `tuning.return.ukKeptLapseMonths` and `tuning.return.residentLapseMonths`.
- A kept status gives way to the status of a route granted at home; a settled status outranks any route.
- The Secure chapter's `home` path is reached by a `with-papers` return on these statuses as well as a settled one, and its `second` path reads only a route granted after the latest return (`../rules/chapter.md`, row 6).
- The view and the screens say a kept status's end month and that the character can fly back on it; a stay past six months says the road to settling starts again.
- Recorded lives that move home on one of these statuses replay these rules from the month they do.
- The tuning carries the lines (`tuning.return.residentLapseMonths` 36, `tuning.return.ukKeptLapseMonths` 24), so they can be tuned without a rule change.
