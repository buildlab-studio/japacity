# The clock: turns on real time, the world tick, nudges and presence

> Rests on `engine.md` (engine:stale-commands-rejected, engine:seed-never-leaves-authority, engine:simulation-reads-no-clock, engine:browser-authority-for-dev-only), `turn.md` (the bank), `director.md` (director:one-era-at-a-time, director:stories-start-by-roll, director:stories-pass-through-stages, director:policy-cycle-surge-backlash, director:december-and-inflation, director:stories-never-undo-player-gains and director:world-stepped-from-seed), `../design/01-concept.md` sections 7, 9 and 13, `../design/04-where-things-live.md` sections 2 and 7. Cloudflare limits read on 8 Oct 2026, linked below.
> Kinds: none. The clock lives in the server (`apps/server`) and the stores (`packages/store`); the simulation never reads a clock.

Two clocks run online. A character's life moves when the player plays, one banked turn a month. The world moves on the server's clock, the same for everyone, one tick every 12 real hours. The client shows both clocks and keeps neither.

## Rules: the server's clock

**clock:server-owns-the-clock** The server's clock is the only clock: the current tick is `floor((now - epoch) / worldTickMs)`, read by the server for each request, and a client never sends a tick, a time or a world.

**clock:world-tick-length-and-epoch** A world tick is 12 real hours (`worldTickMs`, `time.WORLD_TICK_MS`), and the epoch is a Friday at 18:00 UTC, so every tick begins at 06:00 or 18:00 UTC and every fourteenth tick begins on a Friday at 18:00 UTC, the lottery's close (`lottery.md`). The epoch is Friday 9 October 2026 at 18:00 UTC (`DEFAULT_EPOCH` in `apps/server/src/config.ts`), the same for every deployment, and game day 0 begins at it (`time.GAME_DAY_EPOCH_MS`).

**clock:reply-carries-the-clock** Each reply carries a `clock` beside the view: `tick`, `nextTickAt` (the real time the next tick begins) and `nextTurnAt` (the real time the next turn is earned, or null while the bank is full), all set by the server.

## Rules: the turn budget on real time

**clock:turns-earned-from-refill-time** The server keeps, for each character, `refilledAt`: the real time from which the next turn is being earned. Before it steps any command for that character, and before it answers a request for the view, it works out `earned = floor((now - refilledAt) / turnRefillMs)`.

**clock:earned-turns-granted-first** When `earned` is one or more and the bank is under `tuning.turn.cap`, the server first steps one `turns/grant` with `count` = the smaller of `earned` and the room left in the bank, sent by the authority and logged like any command (server:one-command-one-transaction). Then `refilledAt` moves on by `count` times `turnRefillMs`, or to `now` when the grant filled the bank.

**clock:full-bank-earns-nothing** A full bank earns nothing: while `banked` equals the cap, `refilledAt` is held at `now` on every request, so time spent full is never banked for later. The local authority keeps the same rule (`apps/client/src/authority/local.ts`, `earnTurns`).

**clock:no-month-countdown-shown** Nothing on the phone or in the world counts the months held or the time to the next one (decision 0011, the month is lived); `world.clock.test` proves it. The client never adds a turn to what it shows.

**clock:bonus-grants-keep-refill-time** A chapter's refill (turn:refill-fills-the-bank) and an apology's turns (server:apologies-never-currency) are grants on top of the clock and do not move `refilledAt`.

**clock:production-has-no-fast-clock** The production server has no fast clock. The development switch that grants freely (`turn.md`, "Outside the simulation") exists only in the local authority and in the test server's config, and a test proves the production config refuses it.

## Rules: the world on a schedule

**clock:world-is-stored-history** The world is a stored history: one row per tick holding the `World` the simulation is given, the director's book after that tick (its cooldowns, era, passes and draw counts) and the hash of both. A stored tick row is never rewritten.

**clock:tick-row-is-pure-step** A tick row is made by `stepWorld(previousBook, worldSeed, content, calendar)`, a pure function of the row before, the world seed, the content and the tick's calendar facts (clock:december-by-lagos-time). Tick 0 is made from the world seed alone, as the stand-in world makes it (director:world-stepped-from-seed).

**clock:cron-stores-missing-ticks** A scheduled trigger runs every 5 minutes. It stores every tick from the last stored one up to the current tick, in order, one transaction each, and so catches up after any missed run. A deployment may set `TICK_CRON` to a slower cron, and every job on the five-minute cron then runs on that one instead (server:production-and-staging). Staging runs on thirty minutes so its database can sleep between runs; the world there moves at that pace. Production ticks every five minutes with no `TICK_CRON`.

**clock:request-fills-missing-ticks** If a request finds its current tick not yet stored, the server makes the missing rows itself before stepping the command. Because a row is a pure function of the one before, two writers make the same row; the insert keeps the first and ignores the second.

**clock:december-by-lagos-time** Online, `var.season-december` is 1 for a tick whose start falls in December in Lagos time (UTC+1, no summer time), and 0 otherwise. Lagos time, because the December visit and the festive season are the Lagos ones.

**clock:online-lengths-scaled** Online, every length the director counts in ticks is multiplied by `tuning.director.onlineTickScale`: an era's `ticks`, each story's `rumourLead`, `forceLag`, `endsAfter` and `cooldown`, and `tuning.director.closedTicks` and `shockGapTicks`. The scale covers the story lags as well as the eras, because news:force-waits-after-announcement's two ticks are one real day online, and the concept's fairness rule 4 asks for two real days between an announcement and the law. With the scale at 2 the shortest gap is 4 ticks, 48 hours.

**clock:new-content-from-next-tick** A new content version takes effect from the first tick stored after the deploy. Stored ticks are never recomputed. A story new to the content starts unfired in the book; a story removed from it ends at its current stage on that tick.

**clock:command-uses-stamped-tick** A command is stepped against the stored world of the tick the server stamps on it. Replay (server:log-rows-hash-state) reads the same stored rows, so a replay months later sees the world the player saw.

**clock:client-gets-current-world-only** The client is sent the world of the current tick only. The world seed, the director's book and any tick after the current one stay on the server (server:secrets-stay-on-server).

**clock:world-fetch-is-jittered** The client fetches the new world at `nextTickAt` plus a random wait of up to 60 seconds, drawn on the device, so a tick does not arrive as one burst of requests. The world reply for a tick is the same for everyone. The browser may keep it until the next tick (`public, max-age`), and the server keeps it in the server's cache (the Cache API, beside the Worker, in London with placement, server:worker-placed-near-database), keyed by the tick, until the next tick, so a hit saves the database query, not the player's trip to the server (server:public-replies-cached). Behind Cloudflare Access there is no such cache, so there every fetch of the world reads the database. Cloudflare never caches a Worker's own reply in front of the Worker: the `public, max-age` header reaches the browser only.

## Rules: the nudge socket

**clock:socket-only-nudges** A socket only says that something changed. The server sends `{ nudge: kind, v? }` with `kind` one of `view` (this character's state moved without the player sending a command: a grant, a lottery payment, a pair change), `messages` and `presence`; `v` is the new state version when the kind is `view`. Game state never travels over the socket (`../design/04-where-things-live.md` section 2). The server reads a nudge exactly with `readNudge` (`packages/api/src/socket.ts`), a nudge with any other key refused; the client reads it with `readKnownNudge`, passing over a key it does not know, so a field a newer server adds never stops an older client fetching.

**clock:nudge-triggers-ordinary-fetch** On a nudge the client fetches what changed through an ordinary request. A nudge whose `v` is not above the version the client holds is ignored.

**clock:nudges-are-best-effort** Nudges are best effort. A lost nudge costs freshness only: the client also fetches on reconnect, when the tab regains focus, and at `nextTickAt` (clock:world-fetch-is-jittered), and a stale command is caught by engine:stale-commands-rejected in any case.

**clock:sockets-reconnect-with-backoff** Every deploy drops every socket. The client reconnects by itself with a wait that doubles from 1 second up to 60 seconds, plus a random part of up to half the wait, and fetches the view once connected.

**clock:client-sends-only-pings** The client sends nothing over the socket except protocol pings. The server answers them with an automatic reply that does not wake the object (`setWebSocketAutoResponse`), and a client sends one every 30 seconds.

## Rules: who is where

**clock:presence-held-in-memory** Who is in a place is held only in memory, by one small stateful object per place, and is never written to the database. The one thing the object keeps in its own storage is the day's seen list of city:players-shown-present-not-tracked (names and looks, no positions, no account ids), because it must survive the object sleeping; live presence never goes there.

**clock:attachments-rebuild-presence** Each socket carries an attachment of at most 1 KB: the account id, the character's display name and look, the place, and when it joined. After the object wakes from hibernation it rebuilds the list from the attachments of the sockets still open (`getWebSockets()`), never from memory it held before.

**clock:moving-switches-place-socket** Moving to another place closes the socket to the old place's object and opens one to the new place's. A closed or failed socket leaves the list at once.

**clock:presence-is-a-sample** A place shows a sample, not a roll call: the presence fetch returns at most `presence.sample` other characters in the place, chosen afresh on each fetch. The object sends the `presence` nudge at most once every `presence.nudgeEveryMs` however many players come and go.

**clock:busy-place-splits-rooms** A place's object holds at most `presence.maxPerObject` sockets. A place that would pass it is split into numbered rooms of the same place, and a newcomer joins the fullest room with space. A cap well under Cloudflare's 32,768 so that one busy place stays under the object's soft limit of about 1,000 requests a second.

**clock:presence-is-not-contact** A socket opens for every signed-in account, wherever it is. Who is in a place, by name and look, is presence, not contact (region:same-contact-everywhere). The socket carries only the nudges of clock:socket-only-nudges, never words between players; contact stays with the people routes of `pair.md`.

## Rules: telling a player the bank is full

**clock:full-bank-push-notification** When a character's bank reaches the cap while its player is away, the server sends one web push notification, the text key `notify.bank-full` ("Your months are full. Come and live them."; text:voice-by-surface: no line says the player's life waits), to every device that agreed, at most once for each fill. Permission is asked only after a good moment: the early win (guide:early-win-in-three-turns) or a later report line of tone `good` with attention. It is never asked on load, never before the early win, and after a dismissal not again for `notify.reaskDays`; after the browser's own refusal, never. A switch in the settings stops it. Not verified: an iPhone may allow a website's notifications only once the site is added to the home screen. A device's push address is kept only on Google's, Apple's, Mozilla's or Microsoft's push host, over https with no port or user info; anything else is refused as not a push service's address, so the server never sends a request to an address a player chose.

**clock:envelopes-show-real-waits** Envelopes: the one place the real clock shows in a lived month (decision 0011; `../design/08-the-lived-month.md`). A result real life makes you wait for, the English test's band, the endorsing body's answer, a visa decision, is worked out by the simulation as the month turns, as ever; the authority seals it until the world's next morning (clock:game-day-on-real-time: six o'clock of the game's own day, at most one game day away, decision 0011) and until then the view reads as it did before the result landed: the paper still on its way this month, the decision still pending, and the lines that told it kept back. The simulation never reads a clock and its state never changes: `sealFrom` finds the results that landed between the view before and after a `turn/end` (`REAL_WAIT_DOCUMENTS` for papers, applying to granted or refused for a decision), and `withhold` and `withholdLines` give the view and the lines the player may see now, both pure functions of the moment given. The clock view carries `morningAt`, that moment, which `nextGameMorning` works out. Play goes on meanwhile: only that one result waits, and nothing sells or skips it. Once the morning has come the result stands in the view and the authority gives the envelope once, with the lines it held, for the phone's lock screen to tell; the envelopes live beside the save, in the device's storage under the save's key. A passport or a transcript being made passes in life's time, never on the real clock. In development only, the device's `japacity.morning` set to `now` opens every envelope at once. The Lagos morning (`nextMorning`, the next seven in the morning in Lagos: `time.MORNING_HOUR_LAGOS`, Lagos at UTC+1 all year, clock:december-by-lagos-time) is kept as a one-line switch, for a result that should wait overnight. Online the server seals no result, so a result stands as the month turns.

**clock:game-day-on-real-time** The world's own clock (decision 0011), the same for every player while each defines their own life. One game day runs on real time, faster than life: `time.GAME_DAY_MS` (105 minutes, an hour and three quarters, so that the real day is not a whole number of game days and a player who sits down at the same real hour each evening meets a different hour of the game's day each day of the week) from `time.GAME_DAY_EPOCH_MS` (Friday 9 October 2026, 18:00 UTC, the ticks' epoch, so day 0 is a Friday), the same moment for everyone, so a sitting sees the sun move. `worldClockAt(now)` is pure: the game day since the epoch, the minute of the day (0 to 1439), the weekday (0 Sunday to 6 Saturday), the part of the day (morning from six, afternoon from noon, evening from six, night from ten) and the next morning's real moment; before the epoch the clock stands at its first midnight. The clock view carries it as `world` on every reply, and the client may read it on the device between replies with the same function, the server's reading winning on a reply. The simulation never sees it (engine:simulation-reads-no-clock): the city's day and night, what is open and shut, who is about and what the street does by the hour are the authority's and the interface's, and events hung on the hour are the director's at the online step. Each life's months turn only when that life sleeps (world:sleep-ends-the-month): the world's day and a life's months are two clocks, told once as "the world's day, your life's months". Nothing in a life moves on this clock while its player is away. In a home the lamps' real point lights (assets:lighting-set-by-place) are scaled by this clock as the paint is, full at night and zero by day.

## Numbers

| Setting | Value | Source | In config or content as |
|---|---|---|---|
| A turn is earned every | 2 real hours | `../design/01-concept.md` section 9, working value | `server.clock.turnRefillMs`, `time.TURN_REFILL_MS` |
| Most turns banked | 24 | `turn.md` | `tuning.turn.cap` |
| World tick | 12 real hours | concept section 13: rates "tick twice a real day" | `server.clock.worldTickMs`, `time.WORLD_TICK_MS` |
| Epoch | a Friday, 18:00 UTC | Friday 9 October 2026 (`DEFAULT_EPOCH`) | `server.clock.epoch` |
| Online scale on director lengths | 2 | `director.md` | `tuning.director.onlineTickScale` |
| Shortest announcement to law online | 4 ticks, 48 hours | concept section 7, fairness rule 4 | follows from the two above |
| Scheduled trigger | every 5 minutes | working value; Cloudflare's examples run cron every minute | `wrangler.jsonc` `triggers.crons` |
| Spread of the world fetch | up to 60 seconds | working value | `server.clock.worldFetchSpreadMs` |
| Reconnect wait | 1 s doubling to 60 s, plus up to half again | working value | `client.reconnect` |
| Client ping | every 30 seconds | working value; pings do not end hibernation | `client.pingMs` |
| Attachment | at most 1 KB | Cloudflare allows 16,384 bytes | `presence.attachmentBytes` |
| Sockets per place object | 2,000 | working value; Cloudflare's ceiling is 32,768 | `presence.maxPerObject` |
| Presence sample | 20 others | working value | `presence.sample` |
| Presence nudge at most every | 10 seconds | working value | `presence.nudgeEveryMs` |
| Wait before asking again after a dismissal | 14 days | working value | `notify.reaskDays` |
| A push notice lives for | 1 day | working value | `notify.pushTtlDays` |
| Devices an account may register | 10 | working value | `notify.maxDevices` |
| A notice token lives for | 12 hours | working value | `notify.tokenHours` |

## Sources

All read on 8 Oct 2026.

- [Cloudflare: Durable Objects state API](https://developers.cloudflare.com/durable-objects/api/state/): 32,768 sockets per object with hibernation, ten tags of 256 characters, automatic replies without waking.
- [Cloudflare: Durable Objects WebSocket API](https://developers.cloudflare.com/durable-objects/api/websockets/): an attachment of at most 16,384 bytes, kept through hibernation while the socket is healthy.
- [Cloudflare: Durable Objects lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/): memory is discarded on hibernation, which comes after 10 seconds idle.
- [Cloudflare: WebSockets best practices](https://developers.cloudflare.com/durable-objects/best-practices/websockets/): code updates disconnect every socket; pings do not interrupt hibernation.
- [Cloudflare: hibernation server example](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/): rebuild sessions from `getWebSockets()` and the attachments in the constructor.
- [Cloudflare: Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/): a soft limit of about 1,000 requests a second per object.
- [Cloudflare: Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/): no duration charge while hibernating; incoming messages billed at 20 to 1.
- [Cloudflare: Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/): UTC, five-field cron, a local endpoint `/cdn-cgi/local/scheduled`; no published timing guarantee.
- [Cloudflare: Workers limits](https://developers.cloudflare.com/workers/platform/limits/): 30 seconds of CPU for a cron under an hourly interval on the paid plan.
- [Cloudflare: Vitest test APIs](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/): `createScheduledController`, `evictDurableObject` with sockets hibernated, for the tests of clock:cron-stores-missing-ticks and clock:attachments-rebuild-presence.

## Not verified

- A published minimum interval for Cron Triggers. The docs show every minute in an example, which is more often than this page needs.
- How late a cron run can be. clock:cron-stores-missing-ticks and clock:request-fills-missing-ticks make lateness harmless.
- iPhone behaviour for website notifications (clock:full-bank-push-notification): whether permission can be asked only once the site is on the home screen. A messaging app channel may reach more players.

## Contract

What the contract holds for this page:

1. `packages/sim/src/world/director.ts`: a resumable director. `DirectorBook` as plain data (the era, eras run, shocks this era, each story's pass, stage and since, last fired, the values, the world draw counts), and `stepWorld(book: DirectorBook | null, worldSeed: string, content: Content, calendar: WorldCalendar, scale: number) -> { book: DirectorBook; world: World }`. The stand-in world is a loop over it with `scale` 1 and `december` from `tick mod 12` (director:december-and-inflation).
2. `packages/sim/src/engine/time.ts`: `WORLD_TICK_MS` and `TURN_REFILL_MS`; the server reads them through its config, never a second copy.
3. `packages/api/src/reply.ts`: `ServerReply = (Reply & { clock: ClockView }) | ServerRejection`, with `ClockView = { tick: number; nextTickAt: number; nextTurnAt: number | null }` (milliseconds since the epoch of 1970).
4. `packages/store/src/types.ts`: `Nudge = { nudge: "view"; v: number } | { nudge: "messages" } | { nudge: "presence" }`.
5. `packages/store`: `WorldStore` with `tick(n)`, `latest()`, `insertTick(row)` that keeps the first row for a tick; `WorldTickRow = { tick: number; world: World; book: DirectorBook; content: string; hash: string }`.
6. `packages/store`: `PresenceStore` with `join(place, socket, member)`, `leave(place, socket)`, `sample(place, n)`; `PresenceMember = { account: string; name: string; look: string; place: string; joinedAt: number }`.
7. `packages/store`: the character row carries `refilledAt: number`.
8. Server config: `server.clock = { epoch, worldTickMs, turnRefillMs, worldFetchSpreadMs }`, `presence = { maxPerObject, sample, nudgeEveryMs, attachmentBytes }`.
9. Notifications (clock:full-bank-push-notification): `packages/store` `PushStore` with `subscribe(account, subscription)`, `unsubscribe(account, endpoint)`, `forAccount(account)`; the character row carries `fullNotifiedAt: number | null`, cleared when a turn is spent; the scheduled trigger of clock:cron-stores-missing-ticks also sends the notices for banks that filled since its last run; server config `notify = { reaskDays }` and the push signing keys as secrets; text key `notify.bank-full`; an account setting `notifyBankFull: boolean`.
