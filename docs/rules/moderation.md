# Block, report, the queue and the admin view

> Rests on `../design/01-concept.md` section 6 (safety rule 7: block and report on every interaction), `../design/04-where-things-live.md` section 4 (a report cites message ids; a reported conversation is held until reviewed), server:rollback-check-finds-divergence, server:rollback-apply-one-account and server:no-mass-rollback (the rollback tool).
> Kind: `moderation`, server only. The simulation holds no moderation state. Pair records, invites and preset phrases are `pair.md` and `person.md`; the rollback tool and the money report are `server.md`. This page names them and does not define them.

Players meet each other through invites, preset phrases, characters in a place, pair records and shared cards. Every one of those has a block and a report beside it. A report goes into one queue, a person decides it, and every decision is written down.

## Rules: block

**moderation:block-refuses-both-ways** `moderation/block` names another account. From then on the server refuses, in both directions, every phrase, invite, pair request and joint application between the two (the "not blocked" check that `pair.md` runs before storing), and neither sees the other's character in a place. A block needs no reason and is never shown to the blocked account as a block: their sends are refused with the same code as a lapsed connection.

**moderation:block-ends-pair-records** A block ends any pair record the two share the way a break-up does (`person.md`), with no standing cost to the one who blocked. `moderation/unblock` lifts the block and restores nothing.

## Rules: report

**moderation:report-from-every-surface** `moderation/report` can be sent from every surface where a player meets another player or anything the game did not write: a conversation, a phrase said in a place, a character seen in a place, a display name, an invite card, a pair record, a stand-in's behaviour, and an advert. The client shows the report control on each of them; a test walks every surface in the interface list and finds it. The terms of play say so: a player can block or report another wherever they meet. A friend's thread in Chats carries block and report, citing their messages.

**moderation:report-carries-subject-and-reason** A report carries a `subject` (an account, or an advert's campaign), a `reason` from a fixed list (`scam`, `harassment`, `impersonation`, `underage`, `sexual`, `hate`, `self-harm`, `illegal`, `cheating`, `advert`, `other`), and what it cites: message ids for a conversation (`../design/04-where-things-live.md` section 4), the place, phrase id and time for a phrase said aloud, the card or pair record id, or the campaign and slot for an advert. A report takes no typed text: nothing the reporter types goes with it.

**moderation:spoken-phrases-not-stored** A phrase said aloud in a place is not stored (`../design/04-where-things-live.md`). Its report records what the reporter's client heard, marked unverified, because storing every spoken phrase to check reports would keep far more about everyone than the reports need.

**moderation:report-offers-block** Sending a report offers a block in the same step, ticked by default. A player may file at most `config.moderation.reportsPerDay` reports a day; a report over that is refused with `rate-limited`.

**moderation:reporter-told-outcome-only** The reporter is told the report was received at once, and told the outcome (acted on, or no action) when it is decided, never what was done to whom.

## Rules: the hold

**moderation:reports-hold-cited-records** A report holds what it cites. The cited messages, the conversation they are in, and the pair record if one is cited are kept unchanged until the report is decided, even if either account is deleted meanwhile; the hold lasts at most `config.moderation.holdDays`, and then deletion goes ahead.

**moderation:open-report-pauses-conversation** While a report on a conversation is open, the conversation is paused in the reported account's direction: nothing new reaches the reporter from them. The reporter's own sends are not paused, unless they chose the block.

## Rules: the queue

**moderation:one-queue-by-reason-weight** Every report, every advert submission (advert:named-person-approves-creatives) and every appeal (moderation:actioned-player-told-and-appeals) enters one queue, ordered by reason weight then age: `underage`, `self-harm`, `sexual` and `illegal` first, then `scam`, then the rest.

**moderation:reports-decided-within-target** The target is a decision within `config.moderation.decideHours` of a report arriving. The admin view shows the oldest open item's age, and the dashboard carries it (`analytics.md`).

## Rules: the admin view

**moderation:admin-view-for-admin-list** The admin view is a separate set of server routes and screens, reached only by accounts on the admin list in the server's configuration (the deployment's `ADMIN_ACCOUNTS` Worker secret, server:ledger-alarm-lists-suspects), each signed in with a passkey. Once an admin account holds a passkey, a new passkey is added to it only from a session opened with a passkey, and every addition is logged and the account's email told (account:passkey-needs-signed-in-session). The admin page's code is its own chunk, fetched only at `/admin`; the game's shell imports only its address, so a player never downloads the page (engine:first-download-has-budget's size check fails if it is ever back in a first visit). The operator decides who is on the list; by default, the operator alone. On a phone the admin page's tabs wrap to a second row rather than run off the edge unseen.

**moderation:queue-item-shows-context** For an item in the queue the view shows: the report and its reason, the cited messages rendered as their phrases with times, both accounts' sign-up country, account age and past reports (made and received) with their outcomes, and any earlier moderation action on either. It never shows a seed, a hidden simulation field, an email address, or another player's character state beyond what that player's own view would show.

**moderation:fixed-admin-actions** An admin may take only these actions: `dismiss`, `warn`, `mute` (no phrases or invites for `days`), `suspend` (no sign-in for `days`), `ban` (the account is closed and its sign-in identity barred), `reset-name` (the display name returns to a generated one, and the player may choose their own at once: the reset never costs them a rename), `pull-advert` (advert:reported-advert-pulled-at-once), `approve-advert`, `refuse-advert`, `refer` (record that the matter was passed to a named outside body), and `rollback`, which opens the rollback tool of `server.md` for that one account. No admin action edits a balance, a state or a world value directly. The terms of play say that what breaks them may be removed and that an account may be closed for it. Two more actions, `approve-light` and `refuse-light` (account:name-a-light-for-yours, moderation:dedication-lights-await-approval), are taken on a dedication light and never on a report; a report cannot be closed with them.

**moderation:admin-actions-logged-append-only** Every admin action is written to an append-only log with the admin, the time, the item, the action, its parameters and a reason chosen from a list, plus an optional note. The log has no update and no delete route; a test proves the routes refuse both. The privacy notice names the log among what is kept, for `config.moderation.logYears`. The log's reasons are the report reasons of moderation:report-carries-subject-and-reason plus `dedication`, the reason of the two light actions (`LOG_REASONS` in `apps/server/src/moderation/reports.ts`); a player cannot report under it.

**moderation:actioned-player-told-and-appeals** A warned, muted, suspended or banned player is told the action, the reason from the list and how to appeal, by the route that reaches them (the game, or the sign-in email). An appeal enters the queue and is decided by an admin other than the one who acted when there is more than one admin. Beyond the game, the terms of play give the complaints route: a player writes to the operator's address (`region.md`, "Who runs the game") and has a reply within 14 days. The notice is a row in Settings.

**moderation:upheld-underage-closes-account** A report with the reason `underage` that an admin upholds closes the account and deletes its data, keeping only what the hold and the log need. The account cannot be reopened by a new date-of-birth answer from the same sign-in identity.

**moderation:ban-survives-as-hash** A ban survives deletion as a salted hash of the sign-in identity, so the same Google account or email cannot sign up again. Nothing else about a banned account is kept beyond the log.

## Rules: the rollback tool's place

**moderation:rollback-through-admin-view** The rollback tool belongs to `server.md`: replay one account from its seed and commands, compare with what is stored, correct only that account, never a mass freeze. The admin view is its only door: it opens on one account from a queue item or a money report alarm, shows the comparison, and records its use in the log of moderation:admin-actions-logged-append-only.

## Rules: feedback

**moderation:feedback-box-in-settings** The feedback box is a row in Settings (`shared/moderation/Feedback.tsx`). One tap opens a box for a short text of at most `config.feedback.maxChars` characters and a send button; it asks for nothing else. The server stores the text with the build number the client was built from, the screen it was sent from, the graphics mode, the day and the request's country, and nothing else: no account, no session, no character. A session may send at most `config.feedback.perDay` a day. Feedback is read in the admin view, is never shown to another player, never enters the report queue or the analytics store, and is deleted after `config.feedback.keepDays`. It lives on this page, not `analytics.md`, because analytics stores only counts and holds no typed text, while the admin view already reads what players send. It is one of the two typed texts the game takes, and it goes only to the team; the other is a dedication light's name (account:name-a-light-for-yours), which reaches other players only through moderation:dedication-lights-await-approval.

**moderation:dedication-lights-await-approval** The lights list. The admin page's moderation tab carries the dedication lights whose names await a look (account:name-a-light-for-yours): the name, the years, the account's username and sign-up country, when lit, oldest first, from `GET /api/admin/dedication/pending`. "Approve" (`POST /api/admin/dedication/:account/approve`) sets the approval and the name shows to everyone from the next read; "Refuse" (`POST /api/admin/dedication/:account/refuse`) puts the light out. Both are written to the log of moderation:admin-actions-logged-append-only with the admin's account, the reason list carrying `dedication`. The look is by hand: no process approves on the makers' behalf.

## Numbers

| Setting | Value | Source | In content as |
|---|---|---|---|
| Reports a player may file a day | 20 | working value | `config.moderation.reportsPerDay` (server config) |
| Longest hold on cited material | 90 days | working value | `config.moderation.holdDays` |
| Target time to a decision | 24 hours | working value | `config.moderation.decideHours` |
| Records of decisions kept | 3 years | working value | `config.moderation.logYears` |
| Longest feedback text | 500 characters | working value | `config.feedback.maxChars` |
| Feedback a session may send a day | 5 | working value | `config.feedback.perDay` |
| Feedback kept | 180 days | working value | `config.feedback.keepDays` |
| Reply to a complaint written to the operator | within 14 days | a working value | written on the terms of play, not in config |

These live in the server's configuration (`config.moderation`), not the game's content, since the simulation never reads them.

## Contract

The simulation's `types.ts` holds nothing for this page. The server holds:

- **Commands to the server** (not to `step`): `moderation/block { account }`, `moderation/unblock { account }`, `moderation/report { subject, reason, cites }`, `moderation/appeal { action }`.
- **Rejection code** `rate-limited` for the server's own routes (shared with `server.md`'s rate limits).
- **Types**: `ReportReason` (the list in moderation:report-carries-subject-and-reason); `ReportCite = { messages: string[] } | { place: string; phrase: string; at: number } | { card: string } | { pair: string } | { campaign: string; slot: Id<"advert"> }`; `Report { id; reporter; subject: { account: string } | { campaign: string }; reason; cites: ReportCite; unverified: boolean; at; status: "open" | "decided"; outcome?: "acted" | "no-action" }`; `Hold { report; messages: string[]; pair?: string; until }`; `Block { from; to; at }`; `AdminAction = "dismiss" | "warn" | "mute" | "suspend" | "ban" | "reset-name" | "pull-advert" | "approve-advert" | "refuse-advert" | "refer" | "rollback"`; `ModerationLogEntry { id; admin; at; item; action: AdminAction; params; reason; note? }`; `BannedIdentity { hash; at }`.
- **Tables**: `reports`, `holds`, `blocks`, `moderation_log` (insert only), `banned_identities`, `feedback`.
- **Feedback**: `POST /api/feedback { text, build, screen, mode }`; `Feedback { id; text; build: string; screen: string; mode: "low" | "high"; day: string; region: string }`; config `config.feedback = { maxChars, perDay, keepDays }`; the build number is injected into the client at build time.
- **A check** in the pair checks of `pair.md`: "neither has blocked the other" reads `blocks`.
