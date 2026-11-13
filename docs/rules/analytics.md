# Analytics

> Rests on `../design/04-where-things-live.md` section 2 (where analytics lives), `server.md` (the command log and the money report).
> Kind: `analytics`, server and client. The simulation counts nothing.

Analytics answers three questions: are people playing, where do they stop, and is anything broken. It uses counts only, never a record of a person.

## Rules: what is counted, and where

**analytics:game-counters-from-server** Game counters come from the server, never the client. A nightly job reads the events the authority accepted that day (`server.md`'s command log) and adds to the counters of analytics:nightly-game-counters. The client never reports a game event, so it cannot inflate one.

**analytics:client-sends-interface-counts** The client sends only what the server cannot see:

- screens opened;
- the share button pressed and the share completed (`share.md`);
- advert impressions and taps (advert:impression-counted-when-seen);
- sound and graphics settings changed;
- load time, in bands;
- client errors, by code.

Each phone app opening counts its screen once (`APP_SCREEN`), keyed by the feature behind the app; the Market counts under the wallet's screen.

A screen that throws while drawing is caught by the app's error boundary. It is counted once as `client/error` keyed `render`, and logged to the console with the error's name, message, component stack and the build stamp (`<meta name="japacity-build">`, server:production-and-staging). The screen shows its line from content and two buttons: Reload, and Tell us. Tell us opens the feedback box (moderation:feedback-box-in-settings) with the error's name and the build filled in, never the message, the stack or anything of the player's; the player chooses whether to send it. Offline, where there is no feedback box, only Reload shows. Apart from that one count, nothing about the error is counted or sent without the player.

**analytics:client-batches-counters** The client keeps counters in memory and sends them as one batch of `{ name, key, count }` rows by `navigator.sendBeacon` to `/api/counters`, every `tuning.analytics.batchSeconds` and when the page is hidden. A batch is at most `tuning.analytics.maxBatchBytes`. Nothing is written to the device for analytics: no cookie, no local storage, no identifier.

**analytics:server-checks-every-batch** The server checks every batch before counting it:

- it comes from a signed-in session;
- every `name` is on the fixed list in `analytics.data.ts`, and its `key` on that name's list of allowed keys;
- every count is a whole number from 1 to `tuning.analytics.maxCount`;
- the session has sent at most `tuning.analytics.batchesPerHour` batches this hour.

A row that fails is dropped and counted under `analytics/dropped`. A failed batch is never an error the player sees.

One exception: the front door comes before any account, so its three keys may arrive signed out, and nothing else may. A batch with no session is read only within the anonymous per-address limit (`ANON_60S`, server:anonymous-limit-by-address). Its `screen/opened` rows keyed `door-1`, `door-2` or `page` are counted under the request's region; any other row is dropped as `signed-out`. The client holds nothing back for this: it flushes as analytics:client-batches-counters says.

**analytics:rows-stored-as-day-totals** On arrival the server strips the account and session and adds each row to the day's total for `(day, region, name, key)`. Only the totals are stored. The store is a separate database, or a separate schema with its own role: the game's routes cannot read it, and the analytics routes cannot write game state through it.

**analytics:player-can-stop-usage-counts** A setting, "Send usage counts", lets a player stop the counters of analytics:client-sends-interface-counts. It is on by default, stored on the account, and sits in the quiet foot of the account sheet, with a quiet "What is this?" beside it that says what it counts. The game counters of analytics:game-counters-from-server still run, because the server makes them from its own records. The switch is the "simple means of objecting" the UK's statistics exemption asks for, though with nothing stored on the device the exemption is not needed.

## Rules: what is never counted

**analytics:store-holds-nothing-personal** The analytics store never holds:

- an account id or a session id;
- an IP address or a user agent string;
- a device or advertising id, or a fingerprint;
- a precise location (region is the finest);
- a display name;
- who talked to whom, or which phrases a pair sent;
- a report's content;
- any money figure for one player;
- a per-player timeline.

A test proves the counter route discards every field not in `{ name, key, count }`.

The one third-party script allowed is Cloudflare's Web Analytics beacon: cookieless, loaded only when the build carries its site token (`VITE_ANALYTICS_TOKEN`), and reporting visits, referrers and countries to Cloudflare and nothing to us. No other third-party script is ever loaded. The privacy notice names it under who else handles the information, in plain words: it counts visits to the game's page, sets no cookie, keeps nothing on the device and builds no profile of anyone.

## Rules: the counters and the dashboard

**analytics:nightly-game-counters** The game counters, made nightly from the accepted events:

| Name | Key | Counts |
|---|---|---|
| `players/active` | region | distinct accounts with at least one accepted command that day |
| `players/new` | region | accounts created that day |
| `players/returned` | `d1`, `d7`, `d30` | accounts created on day D that sent a command on day D+1, D+7, D+30 (an ordinary query over the command log by sign-up day) |
| `turns/ended` | region | `turn/end` commands accepted |
| `chapter/closed` | chapter id | chapters closed |
| `chapter/reopened` | chapter id | chapters reopened by a grant withdrawn before the flight (chapter:done-chapter-stays-done) |
| `route/moved` | route id and state | route state changes |
| `route/refused` | reason | refusals by their first reason (route:refusal-reasons-recorded) |
| `offer/chosen` | offer id and choice | choices made |
| `place/returned` | shape | returns home by shape |
| `command/rejected` | code | rejections by code, `bad-light` (server:dedication-routes) among them |
| `lottery/tickets` | region | tickets bought in the Friday draw (`lottery.md`) |

A second set feeds the admin's figures (analytics:admin-stats-for-admins-only), because data not collected can never be recovered. Each is a `(day, region, name, key)` total as analytics:rows-stored-as-day-totals stores it, shown through analytics:small-counts-shown-as-fewer. `players/returned` also carries the keys `d3` and `d14`, so the returns make a curve. The admin page's ratios (stickiness, sessions per player, errors per 1,000 sessions, departures per new player, conversion by sign-up week, revenue per player) are worked out by analytics:admin-stats-for-admins-only and never stored.

| Name | Key | Counts | Source |
|---|---|---|---|
| `players/weekly` | region | distinct accounts with a command their player sent in the 7 days ending with the day | nightly, the command log |
| `players/monthly` | region | the same over the 30 days ending with the day | nightly, the command log |
| `players/online-peak` | `peak` | the region's highest five-minute sample of online now that day, and the whole game's under the region `all` (analytics:session-split-by-command-gaps) | the five-minute tick, the command log |
| `players/guest` | region | guest accounts made that day; every account starts as a guest (account:guest-and-secured-states) | nightly, the accounts |
| `players/secured` | region | guests secured that day (account:guest-secures-the-life) | the server, as it secures |
| `players/secured-by-signup` | region | the same, kept on the account's sign-up day, so conversion reads by sign-up week | the server, as it secures |
| `players/total` | region | every account made by the day's end | nightly, the accounts |
| `sessions/count` | region | sessions that day (analytics:session-split-by-command-gaps) | nightly, the command log |
| `sessions/length` | `under-2`, `2-5`, `5-15`, `15-30`, `over-30` | sessions by length in minutes | nightly, the command log |
| `funnel/step` | `begin`, `world`, `month-1`, `chapter-1`, `secured` | the onboarding funnel's server steps that day: a life's first accepted command, its prologue closed, its first month ended, its first chapter closed (nightly, the command log), and a guest secured (the server) | as said |
| `lives/started` | region | lives whose first accepted command came that day | nightly, the command log |
| `lives/secured` | region | lives granted settlement or citizenship that day, once per life (status:lawful-months-reach-settlement) | nightly, the command log |
| `japa/departed` | region | `route/moved` to `departed` that day | nightly, the command log |
| `economy/held` | month band and naira band, as `1-3:under-50k` | lives played that day and past their prologue, by the month they are in (`1-3`, `4-12`, `13+`) and the naira they held at its end (`0`, `under-50k`, `50k-500k`, `over-500k`): counts of lives, never one life | nightly, the command log |
| `wallet/topped-up` | `count`, `kobo` | top-ups credited that day (wallet:top-ups-are-marked) and their sum; named apart from the authority command `wallet/top-up`, which content never holds | nightly, the command log |
| `advert/revenue` | `kobo` | what advertisers paid for the day | not written: no campaign holds a paid amount (`advert.md`) |
| `moderation/open` | report reason | reports open at the day's end, under the reporter's region | nightly, the reports |
| `feedback/sent` | region | feedback kept that day (moderation:feedback-box-in-settings) | the server, as it keeps it |
| `client/csp` | the directive (`CSP_DIRECTIVES` in `analytics.data.ts`, `other` for any other) | violations either content policy reported that day, under the request's region; a count and nothing of the report (server:csp-reports-to-own-origin) | the server, as each report arrives |
| `client/csp-blocked` | `<disposition>:<directive>:<kind>` (`enforce`, `report` or `other`; `CSP_DIRECTIVES`; `CSP_BLOCKED_KINDS`) | the same violations, by whether the policy refused or only reported them and by the kind of thing blocked, never an address (server:csp-reports-to-own-origin) | the server, as each report arrives |
| `lives/playing` | `home`, `abroad`, `road` | lives being played at the day's end: each character whose life has not ended (turn:finish-ends-the-life) and whose account still exists and still names it, by where it stands (place:new-character-at-home; `road` while on the way). Counted under the account's region and again under the whole game's region `all`, whose three keys are written even at 0 so a run that found no life still shows. The two lights read it (account:two-lights-and-wink-lines) | nightly at 00:00 UTC, the characters store, a page at a time |

The onboarding funnel's steps, in order: `door-1`, `door-2`, `page`, `begin`, `world`, `month-1`, `chapter-1`, `secured` (`FUNNEL_STEPS` in `analytics.data.ts`). Only the client sees the front door's three screens (`door-1`, `door-2`, and `page`, which is Where you live, the screen before Begin), so they are `screen/opened` keys under analytics:client-sends-interface-counts. The rest are `funnel/step` keys.

**analytics:dashboard-shows-fixed-list** The dashboard's data is `GET /api/admin/analytics`, for the day asked and the 30 before it. It holds these and nothing else:

- daily players, new accounts and turns ended;
- by sign-up week: new players, day 1 and day 7 return beside the reference lines, and the first good moment by turn;
- the asks made before the first good moment, as counts by ask and day (`askedEarly`);
- every counter total of the window.

The admin page (moderation:admin-view-for-admin-list) reads it, and its Players, Money and Health sections show these figures beside those of analytics:admin-stats-for-admins-only's endpoint (admin:sections-alarms-first). The page reads no other analytics route.

**analytics:small-counts-shown-as-fewer** A counter for one region on one day with fewer than `tuning.analytics.minShown` behind it is shown as "fewer than" that number, so a small region cannot be read as one person's play.

## Rules: first-session measures

**analytics:day-one-and-seven-return** Day 1 and day 7 return measure the first session (guide:early-win-in-three-turns). They are the `players/returned` counters of analytics:nightly-game-counters with keys `d1` and `d7`, shown on the dashboard by sign-up week beside the reference lines `tuning.analytics.refD1Bp` and `refD7Bp`.

- The nightly job counts `first/early-win`, keyed `1`, `2`, `3` or `later` by the turn of each new account's first early win, and `none` for an account with no early win by the end of its first day.
- The client counts asks as `ask/shown` and `ask/accepted`, keyed `sign-in` or `notify` and `before` or `after` the early win.
- The dashboard gives the `before` counts by ask and day as `askedEarly`, and the admin page shows them as "asked too early". A count above 0 is a fault in guide:nothing-asked-before-early-win, and the asked-too-early check raises it (admin:checks-have-three-states).

**analytics:first-lead-counted** The lead that a starting life's first missed hunt opens (activity:missed-hunt-opens-a-lead) is counted the way asks are, shown and answered. The nightly job counts `first/lead` from the accepted events, keyed by the outcome (`shown`, `taken`, `declined` or `lapsed`) and the month of the life the lead opened in, as `shown:1` or `declined:3`, for `offer.job-lead` and `offer.job-word` alike. A lead that never becomes a job shows on the dashboard's counters beside the early win. It is a game counter, so the server counts it (analytics:game-counters-from-server), never the client.

## Rules: admin figures

**analytics:admin-stats-for-admins-only** `GET /api/admin/stats` answers only the admin accounts of moderation:admin-view-for-admin-list; to anyone else it does not exist, like the other admin routes. It answers `{ ok: true, stats }`. `stats` has a fixed shape, `{ now: { online, peakToday }, today, last7, last30, totals, funnel, retention, sessions, shares, adverts, economy }`, held in `packages/api/src/admin.analytics.ts` and shared by the server and the admin page.

- `now` is read live.
- `today` is the UTC day so far.
- `last7` and `last30` are the whole days ending yesterday, the last day the nightly job counted.
- `totals` and `economy` are that day's.

Every figure is a count or a sum. The "fewer than" of analytics:small-counts-shown-as-fewer applies to each region and to the whole game's sum. A ratio is given only when both its sides are shown, and the sum of top-ups only when their count is shown, so it is never one player's money (analytics:store-holds-nothing-personal). The server works out the ratios for the page and never stores them.

There is no public page of these numbers. The only public figures are the three whole-game counts of the two lights over the start screen, made from these totals (account:two-lights-and-wink-lines).

**analytics:session-split-by-command-gaps** A session is one account's commands sent by its player (never by a stand-in or the authority) with no gap over `SESSION_GAP_MINUTES`, cut at the edges of the UTC day. Its length runs from its first command to its last, so a one-command session is 0 minutes long. It falls in the band with the largest start at or under its length.

Online now is the number of accounts with a command their player sent in the last `ONLINE_MINUTES`, read by one query over the command log by region, with no table of its own. The five-minute tick takes that sample, and `players/online-peak` keeps each region's highest sample of the UTC day and the whole game's highest under the region `all`.

`all` marks a whole-game figure kept beside the regions. No account's region is ever `all`. A whole-game peak is its own sample, never the sum of the regions' peaks, which may come at different times.

## Numbers

| Setting | Value | Source | Held in |
|---|---|---|---|
| Seconds between batches | 60 | working value | `tuning.analytics.batchSeconds` |
| Largest batch | 16 KB | under the 64 KiB `sendBeacon` queue limit, leaving room for other beacons | `tuning.analytics.maxBatchBytes` |
| Largest count in one row | 500 | working value | `tuning.analytics.maxCount` |
| Batches a session may send an hour | 90 | working value: 60 timed plus page-hidden sends | `tuning.analytics.batchesPerHour` |
| Smallest number shown as itself | 10 | working value | `tuning.analytics.minShown` |
| Day 1 reference line | 30% | Segwise, from Mistplay's benchmarks: 30.10% for mobile simulation games | `tuning.analytics.refD1Bp` 3000 |
| Day 7 reference line | 9% | the same: 8.71% | `tuning.analytics.refD7Bp` 900 |
| Longest gap inside a session | 30 minutes | working value | `SESSION_GAP_MINUTES` in `analytics.data.ts` |
| Online now looks back | 5 minutes | working value: one five-minute tick | `ONLINE_MINUTES` in `analytics.data.ts` |
| Session length bands | from 0, 2, 5, 15 and 30 minutes | working value | `SESSION_BANDS` in `analytics.data.ts` |
| Naira held bands | 0, under 50,000, 50,000 to 500,000, over 500,000 naira | working value | `HELD_BANDS` in `analytics.data.ts` (kobo) |
| Month bands | 1 to 3, 4 to 12, 13 on | working value | `MONTH_BANDS` in `analytics.data.ts` |

## Sources

All read 8 Oct 2026.

- [MDN: `Navigator.sendBeacon()` (for analytics, on `visibilitychange`, 64 KiB queue limit)](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)
- [Segwise: mobile game retention benchmarks by genre](https://segwise.ai/blog/mobile-gaming-app-user-retention-strategies.md)

## Not verified

- The retention figures are for mobile games, from one industry source. A browser game may differ.

## Contract

The simulation's `types.ts` (`packages/sim/src/engine/types.ts`) holds only `CounterDef`, the type of content's counter list. The client and server hold the rest:

- **Content**: `packages/content/src/analytics/analytics.data.ts`, the fixed list of `CounterDef { name: string; keys: string[] | "region" | "id"; source: "server" | "client" }`, and `tuning.analytics = { batchSeconds; maxBatchBytes; maxCount; batchesPerHour; minShown; refD1Bp; refD7Bp }`. It lives in content so client and server read one list.
- **Types**: `CounterRow { name: string; key: string; count: number }` and `CounterBatch { rows: CounterRow[] }` in `packages/api/src/analytics.ts`; the stored `CounterTotal { day: string; region: string; name: string; key: string; count: number }` in `packages/store/src/analytics.ts` (`region` is the account's sign-up country, `XX` when none, account:country-comes-from-cloudflare).
- **Route**: `POST /api/counters` (accepts a beacon, answers 204 whatever it dropped).
- **Account field**: `sendUsageCounts: boolean`.
- **Counter list**: the counters above, including `first/early-win` and `first/lead` (server), `ask/shown` and `ask/accepted` (client), `lives/playing` (`home`, `abroad`, `road`), the second set of analytics:nightly-game-counters, and the `screen/opened` keys `door-1`, `door-2`, `page`.
- **Nightly job**: reads the command log and writes `CounterTotal` rows for analytics:nightly-game-counters, `first/early-win` for analytics:day-one-and-seven-return and `first/lead` for analytics:first-lead-counted.
- **Count of lives**: the player store has `page(after, limit)`, the stored character rows after an id in ascending id order, which the nightly count of lives reads a page at a time (account:two-lights-and-wink-lines). The Worker's 00:00 cron runs the job `lives` beside the other nightly jobs.
- **Admin figures**: the store has `NumbersLog { players(start, end); accounts(end) }`, counts by region read from the game's tables (Postgres: one query over `command_log` by `at`, which has an index for it, joined to the account for its region only). Route: `GET /api/admin/stats` (analytics:admin-stats-for-admins-only). The five-minute cron samples online now (analytics:session-split-by-command-gaps).
