# The admin page

> Numbers are working values unless a source is given.
> Kind: `admin`. One page, outside the simulation. Background: `moderation.md` (the admin view), `server.md` (the alarms, the switches), `analytics.md` (the figures).

The admin page is the operator's console: the checks that watch the game, the figures that say how it is doing, and the actions that change it. It is reached only as moderation:admin-view-for-admin-list says, reads and acts only through the admin routes, and carries nothing a first visit downloads (engine:first-download-has-budget).

## Rules: the page

**admin:sections-alarms-first** The page is seven sections in a rail, in this order, the first being the one an admin lands on: Health, Overview, Players, Money, Moderation, Adverts, Settings. Health holds the checks (admin:checks-have-three-states) under a headline that says "All clear" or how many are in alarm, then the server's figures: refused commands by code, client errors for every thousand sessions, blocked scripts, load time. Overview holds the period's figures as cards (players, new accounts, months played, return on day 1 and day 7, advert revenue, online now with today's peak), what is waiting for a person (open reports, appeals, lights, adverts to review, feedback) and players a day. Players holds growth, the funnel, return by sign-up week, the first good moment by turn, sessions, shares and journeys (lives at home, on the road and abroad, roads taken, why lives came back). Money holds the period's revenue and top-ups, the economy by month played and naira held, the day's ledger (server:daily-money-report), the draws (lottery:money-report-checks-draws) and the rollback check (server:rollback-check-finds-divergence). Moderation holds the queue, the appeals, the lights, the feedback and the log; Adverts the campaigns and creatives to review and the advert figures; Settings the switches, the dials and their change log (server:four-off-switches, server:private-settings-and-dials). The rail carries two counts: the checks in alarm and the items waiting for a person. On a desktop the rail stands at the left; on a phone it is one row of chips under the title.

**admin:titles-and-values** A figure is shown under a title of two or three words; a sentence appears only where it says what to do. A count the server hid under the floor (analytics:small-counts-shown-as-fewer) reads "<" and the floor's figure as the server gave it; zero reads "0"; a figure the server does not have reads "No data", never a blank. A date reads as its day and month ("11 Nov"), a time in West Africa Time ("14:05 WAT"), money as the game's formatter writes it. No internal name is shown: the page says "first good moment", "return on day 1", "asked too early"; rules and code keep their ids. Every word of the page is in its words table.

**admin:period-is-today-7-or-30** The period picker offers today, the last 7 whole days and the last 30 whole days, the three periods analytics:admin-stats-for-admins-only gives, and nothing else. A card shows its change against the previous period of the same length where the daily series holds one, and no change where it does not.

**admin:actions-confirm-with-reason** Every action (a switch, a dial, a decision on a queue item, an advert decision, a rollback check, a handled check) opens a dialog whose button names the act ("Turn off adverts") and whose words say what will happen. A switch, a dial and a handled check carry "Reason for the change" in the dialog, with an example that fits the act, and cannot be sent without one. The answer, done or refused, shows beside the control.

## Rules: the checks

**admin:checks-have-three-states** The server keeps one list of checks, each with a name, what it measures and its limit, all run on the five-minute cron (clock:cron-stores-missing-ticks): money suspects (the accounts the ledger report of the counted day named, server:ledger-alarm-lists-suspects), draw payouts (the draws of the counted day that paid or took other than their result gives, lottery:money-report-checks-draws), diverged lives (the lives whose load found a different hash, server:log-rows-hash-state), asked too early (the `ask/*` counters' `:before` keys of the counted day, analytics:day-one-and-seven-return), reports past target (the open queue items older than moderation:reports-decided-within-target's target) and nightly counts (the counted day has its `players/total` total, which the nightly job writes on every run whoever played, analytics:nightly-game-counters). The counted day is the day that ended once the time is past 02:00 UTC, and the day before it until then, so a day is read only after its nightly jobs have had time to finish. A check counts only what was raised after it was last handled (admin:check-handled-with-reason). A check is always in one of three states: OK, In alarm (its value is over its limit) or No data (what it measures is not there to read). Each change of state is a row in the audit store under one fixed name, holding the check, the state, the value, the limit and the time; the newest row is the check's state and the rows are its history. A row names no account: what a check found (accounts, draws, days) is read from the alarms when the page asks. `GET /api/admin/checks` answers every check with its state, its value against its limit, since when, what it found and its history; it is an admin route as moderation:admin-view-for-admin-list says.

**admin:check-handled-with-reason** An admin may mark a check in alarm as handled, with a reason, through `POST /api/admin/checks/:check/handle`. The check is OK from that moment; its row carries the admin's account id and the reason, and the check's next measurement counts only what came after it, so a check whose measurement finds something newer goes back into alarm. Without a reason the request is refused and nothing is written.

**admin:check-change-sends-email** When a check goes into alarm, and when it clears to OK, every account in `ADMIN_ACCOUNTS` whose auth user holds a verified email is sent one short mail through the game's own send (the one account:passkey-needs-signed-in-session's notice uses): the check's name, its value against its limit, since when, and the link to `/admin`. One mail for each check for each change; none while the state holds, none for a change into No data or from No data to OK, none to an admin with no verified email. The checks are evaluated inside the five-minute cron the server already has (clock:cron-stores-missing-ticks); a deployment on a slower tick cron evaluates them at its pace.

## Numbers

| Setting | Value | Source | In config as |
|---|---|---|---|
| A check's limit | 0 for every check | working value | `apps/server/src/ops/checks.ts` |
| The counted day is the day that ended from | 02:00 UTC | working value: the nightly jobs start at 00:00 and a slow day is counted well before | `apps/server/src/ops/checks.ts` |

## Contract

- **Routes**: `GET /api/admin/checks` answers `{ ok: true, checks: CheckView[] }`; `POST /api/admin/checks/:check/handle` with `{ reason }` answers the same; both in `packages/api/src/admin.checks.ts`.
- **Store**: the check rows are audit entries under one fixed name, each note a `CheckRow` as JSON; no table of their own.
- **Mail**: the notice kind `check-changed`, its words `mail.check-changed.subject` and `mail.check-changed.body` in content's account text.
- **Analytics**: the dashboard's `askedEarly` is the counts of the `ask/*` counters' `:before` keys by ask and day (analytics:day-one-and-seven-return).
