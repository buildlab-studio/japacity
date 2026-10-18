# Analytics

> Rests on `../design/04-where-things-live.md` section 2 (the client sends batched counters, the server receives and checks them, a separate store), `server.md` (the command log and the money report).
> Kind: `analytics`, server and client. The simulation counts nothing.

Analytics answers a few questions: are people playing, where do they stop, and is anything broken. It does that with counts, never with a record of a person.

## Rules: what is counted, and where

**analytics:game-counters-from-server** Game counters come from the server, not the client. A nightly job reads the events the authority accepted that day (`server.md`'s command log) and adds to the counters in analytics:nightly-game-counters. The client never reports a game event, so a client cannot inflate one.

**analytics:client-sends-interface-counts** The client sends only what the server cannot see: screens opened, the share button pressed and the share completed (`share.md`), advert impressions and taps (advert:impression-counted-when-seen), sound and graphics settings changed, the time a load took (in bands), and client errors by code. A screen that throws while it draws is caught by the app's boundary, counted once as `client/error` keyed `render`, and said in the console with the error's name, message and component stack and the build stamp (`<meta name="japacity-build">`, server:production-and-staging). The screen says the line from content and offers two buttons: Reload, and Tell us, which opens the feedback box (moderation:feedback-box-in-settings) with the error's name and the build written in, never the message, the stack or anything of the player's; the player sends it or not. Offline, where the feedback box does not exist, Reload stands alone. Nothing of the error is counted or sent by itself. Each phone app opening counts its screen once (`APP_SCREEN`), keyed by the feature that leads it; the Market counts under the wallet's screen.

**analytics:client-batches-counters** The client keeps counters in memory and sends them as one batch of `{ name, key, count }` rows every `tuning.analytics.batchSeconds`, and when the page is hidden, by `navigator.sendBeacon` to `/api/counters`. A batch is at most `tuning.analytics.maxBatchBytes`. Nothing is written to the device for analytics: no cookie, no local storage, no identifier.

**analytics:server-checks-every-batch** The server checks every batch before counting it: it comes from a signed-in session, every `name` is on the fixed list in `analytics.data.ts` and its `key` on that name's list of allowed keys, every count is a whole number from 1 to `tuning.analytics.maxCount`, and the session has sent at most `tuning.analytics.batchesPerHour` batches this hour. A row that fails is dropped and counted under `analytics/dropped`. A failed batch is never an error the player sees. The door's three keys may arrive signed out, since the door is before any account; nothing else may. A batch with no session is looked at only within the anonymous address limit (`ANON_60S`, server:anonymous-limit-by-address); its `screen/opened` rows keyed `door-1`, `door-2` or `page` are counted under the request's region, and anything else in it is dropped as `signed-out`. The client holds nothing back: it flushes as analytics:client-batches-counters says.

**analytics:rows-stored-as-day-totals** On arrival the server strips the account and session and adds each row to the day's total for `(day, region, name, key)`. Only the totals are stored. The store is a separate database (or a separate schema with its own role) that the game's routes cannot read and the analytics routes cannot write game state through.

**analytics:player-can-stop-usage-counts** A setting "Send usage counts" lets a player stop analytics:client-sends-interface-counts's counters; it is on by default and stored on the account. The game counters of analytics:game-counters-from-server still run, because they are counts the server makes from its own records. The switch is the "simple means of objecting" the UK's statistics exemption asks for, though with nothing stored on the device the exemption is not needed.

## Rules: what is never counted

**analytics:store-holds-nothing-personal** The analytics store never holds: an account id, a session id, an IP address, a user agent string, a device or advertising id, a fingerprint, a precise location (region is the finest), a display name, who talked to whom, which phrases a pair sent, a report's content, any money figure for one player, or a per-player timeline. A test proves the counter route discards every field not in `{ name, key, count }`. The one third-party script allowed is Cloudflare's Web Analytics beacon, cookieless, loaded only when the build carries its tag; it reports visits, referrers and countries to Cloudflare and nothing to us; no other third-party script is ever loaded.

## Rules: the counters and the dashboard

**analytics:nightly-game-counters** The game counters, made nightly from the accepted events, are:

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

A second set of counters feeds the admin's numbers (analytics:admin-stats-for-admins-only), since data not collected can never be recovered. Each is a `(day, region, name, key)` total as analytics:rows-stored-as-day-totals stores it and shown through analytics:small-counts-shown-as-fewer. The page's shares (stickiness, sessions per player, errors per 1,000 sessions, departures per new player, conversion by sign-up week, arrivals per share, revenue per player) are divisions made by analytics:admin-stats-for-admins-only and never stored. `players/returned` also carries the keys `d3` and `d14`, so the returns make a curve.

| Name | Key | Counts | Source |
|---|---|---|---|
| `players/weekly` | region | distinct accounts with a command their player sent in the 7 days ending with the day | nightly, the command log |
| `players/monthly` | region | the same over the 30 days ending with the day | nightly, the command log |
| `players/online-peak` | `peak` | the region's highest five-minute sample of online now that day, and the whole game's under the region `all` (analytics:session-split-by-command-gaps) | the five-minute tick, the command log |
| `players/guest` | region | guest accounts made that day; every account is born a guest (account:guest-and-secured-states) | nightly, the accounts |
| `players/secured` | region | guests secured that day (account:guest-secures-the-life) | the server, as it secures |
| `players/secured-by-signup` | region | the same, kept on the account's sign-up day, so conversion reads by sign-up week | the server, as it secures |
| `players/total` | region | every account made by the day's end | nightly, the accounts |
| `sessions/count` | region | sessions that day (analytics:session-split-by-command-gaps) | nightly, the command log |
| `sessions/length` | `under-2`, `2-5`, `5-15`, `15-30`, `over-30` | sessions by length in minutes | nightly, the command log |
| `funnel/step` | `begin`, `world`, `month-1`, `chapter-1`, `secured` | the onboarding funnel's server steps that day: a life's first accepted command, its years before closed, its first month ended, its first chapter closed (nightly, the command log), and a guest secured (the server) | as said |
| `share/arrival` | card kind | a page of the game opened with `?card=<kind>`, by kind only | not written: the platform serves the game's pages without running its Worker, and nothing counts an arrival |
| `lives/started` | region | lives whose first accepted command came that day | nightly, the command log |
| `lives/secured` | region | lives granted settlement or citizenship that day, once a life (status:lawful-months-reach-settlement) | nightly, the command log |
| `japa/departed` | region | `route/moved` to `departed` that day | nightly, the command log |
| `economy/held` | month band and naira band, as `1-3:under-50k` | lives played that day, past the years before, by the month they are in (`1-3`, `4-12`, `13+`) and the naira they held as it ended (`0`, `under-50k`, `50k-500k`, `over-500k`): counts of lives, never a life | nightly, the command log |
| `wallet/topped-up` | `count`, `kobo` | top-ups credited that day (wallet:top-ups-are-marked) and their sum; named apart from the authority command `wallet/top-up`, which content never holds | nightly, the command log |
| `advert/revenue` | `kobo` | what advertisers paid for the day | not written: no campaign holds a paid amount (`advert.md`) |
| `moderation/open` | report reason | reports open as the day ends, under the reporter's region | nightly, the reports |
| `feedback/sent` | region | feedback kept that day (moderation:feedback-box-in-settings) | the server, as it keeps it |
| `client/csp` | the directive (`CSP_DIRECTIVES` in `analytics.data.ts`, `other` for any else) | violations the page's content policy reported that day, under the request's region; a count and nothing of the report (server:csp-reports-to-own-origin) | the server, as each report arrives |
| `lives/playing` | `home`, `abroad`, `road` | the lives being played as the day ends: each character whose life has not ended (turn:finish-ends-the-life) and whose account still exists and still names it, by where it stands (place:new-character-at-home; `road` while on the way), under the account's region and once more under the whole game's region `all`, whose three keys are written even at 0 so a run that found no life still shows; the two lights read it (account:two-lights-and-wink-lines) | nightly at 00:00 UTC, the characters store, a page at a time |

The onboarding funnel runs, in order: `door-1`, `door-2`, `page`, `begin`, `world`, `month-1`, `chapter-1`, `secured` (`FUNNEL_STEPS` in `analytics.data.ts`). The front door's three screens (`door-1`, `door-2`, and `page`, which is Where you live, the screen before Begin) only the client sees, so they are `screen/opened` keys under analytics:client-sends-interface-counts; the rest are `funnel/step`.

**analytics:dashboard-shows-fixed-list** The dashboard shows these and only these, for today and the last 30 days: daily players, new accounts, day-1 and day-7 return, turns ended per active player, the share of new players who closed each chapter, departures by route, reports opened and decided and the oldest open report's age (moderation:reports-decided-within-target), advert impressions per slot, rejected and failed commands per 1,000, the authority's p95 time per command, and the money report's alarm state (`server.md`). It is a page in the admin view (moderation:admin-view-for-admin-list). The admin view's dashboard has a Numbers tab beside it, which reads analytics:admin-stats-for-admins-only's endpoint and nothing else.

**analytics:small-counts-shown-as-fewer** A counter for one region on one day with fewer than `tuning.analytics.minShown` behind it is shown as "fewer than" that number, so a small region cannot be read as one person's play.

## Rules: the first session's measures

**analytics:day-one-and-seven-return** Day 1 and day 7 are the first session's measures (guide:early-win-in-three-turns). They are the `players/returned` counters of analytics:nightly-game-counters with keys `d1` and `d7`, shown on the dashboard by sign-up week beside the reference lines `tuning.analytics.refD1Bp` and `refD7Bp`. The nightly job also counts `first/early-win`, keyed `1`, `2`, `3` or `later` by the turn of each new account's first early win, and `none` for an account with no early win by the end of its first day. Asks are counted on the client as `ask/shown` and `ask/accepted`, keyed `sign-in` or `notify` and `before` or `after` the early win; a `before` key above 0 is a fault in guide:nothing-asked-before-early-win, shown on the dashboard in red.

## Rules: the admin's numbers

**analytics:admin-stats-for-admins-only** `GET /api/admin/stats` answers the admin accounts of moderation:admin-view-for-admin-list only; to anyone else it does not exist, as the other admin routes. It answers `{ ok: true, stats }`, and `stats` has the frozen shape `{ now: { online, peakToday }, today, last7, last30, totals, funnel, retention, sessions, shares, adverts, economy }` held in `packages/api/src/admin.analytics.ts`, which the server and the admin page share. `now` is read live; `today` is the UTC day so far; `last7` and `last30` are the whole days ending yesterday, the last day the nightly job counted; `totals`, `economy` are that day's. Every figure is a count or a sum. analytics:small-counts-shown-as-fewer's "fewer than" applies to each region and to the whole game's sum, and a share is given only when both its sides are shown; the sum of top-ups is given only when their count is shown, so it is never one player's money (analytics:store-holds-nothing-personal). The shares are made on the server for the page and never stored. There is no public page of these numbers: three whole-game figures made from these totals are public, rounded to the nearest ten, as the two lights over the start screen (account:two-lights-and-wink-lines), and nothing else. The game's page carries Cloudflare Web Analytics' beacon when the build has a site token (`VITE_ANALYTICS_TOKEN`): the host's own count of page views, with no cookie and nothing on the device, and the page's policy lets in its script and its reports and no other outside host. The lights' home and abroad are the lives being played, read from analytics:nightly-game-counters's `lives/playing` (the whole game's rows of the last day counted), rounded to the nearest ten and public; the third is the lives that came back this month. While no nightly count has run, the figures made from the lives started and the departures stand in.

**analytics:session-split-by-command-gaps** A session is one account's commands sent by its player (never a stand-in's or the authority's) with no gap over `SESSION_GAP_MINUTES`, cut at the UTC day's edges; its length runs from its first command to its last, so a session of one command is 0 minutes long, and it falls in the band whose start is the largest at or under it. Online now is the number of accounts with a command their player sent in the last `ONLINE_MINUTES`, read by one query over the command log by region, with no table of its own. The five-minute tick takes that sample, and `players/online-peak` keeps each region's highest sample of the UTC day and the whole game's highest sample under the region `all`. `all` is the convention for a whole-game figure kept beside the regions: no account's region is ever `all`, and a whole-game peak is its own sample, never the sum of the regions' peaks, which may come at different times.

## Numbers

| Setting | Value | Source | In content as |
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

The simulation's `types.ts` holds nothing of it. The client and server hold:

- **Content**: `packages/content/src/analytics/analytics.data.ts`, the fixed list `CounterDef { name: string; keys: string[] | "region" | "id"; source: "server" | "client" }`, and `tuning.analytics = { batchSeconds; maxBatchBytes; maxCount; batchesPerHour; minShown }`. This lives in content so client and server read one list.
- **Types** (`packages/api/src/analytics.ts`, the stored total in `packages/store`): `CounterRow { name: string; key: string; count: number }`; `CounterBatch { rows: CounterRow[] }`; stored `CounterTotal { day: string; region: string; name: string; key: string; count: number }` (`region` is the account's sign-up country, `XX` when none, account:country-comes-from-cloudflare).
- **Route**: `POST /api/counters` (accepts a beacon, answers 204 whatever it dropped).
- **Account field**: `sendUsageCounts: boolean`.
- **Nightly job**: reads the command log and writes `CounterTotal` rows for analytics:nightly-game-counters, and `first/early-win` for analytics:day-one-and-seven-return.
- **Counter list**: `first/early-win` (server) and `ask/shown`, `ask/accepted` (client); `tuning.analytics` also holds `refD1Bp`, `refD7Bp`.
- **The count of lives**: the counter list holds `lives/playing` (`home`, `abroad`, `road`). The player store has `page(after, limit)`: the stored character rows after an id, in ascending id order, which the nightly count of lives reads a page at a time (account:two-lights-and-wink-lines). The Worker's 00:00 cron runs the job `lives` beside the other nightly jobs.
- **The admin's numbers**: the counter list holds analytics:nightly-game-counters's second set, and `screen/opened` the keys `door-1`, `door-2`, `page`. The store has `NumbersLog { players(start, end); accounts(end) }`, counts by region read from the game's tables (Postgres: one query over `command_log` by `at`, which has an index for it, joined to the account for its region only). Routes: `GET /api/admin/stats` (analytics:admin-stats-for-admins-only). The five-minute cron samples online now (analytics:session-split-by-command-gaps).
