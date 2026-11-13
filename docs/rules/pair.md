# Pairs: the shared record, invites, phrases, block and report

> Rests on `person.md`, `engine.md` and `../design/04-where-things-live.md` section 4. All numbers here are working values except where a source is named.
> Kind: `pair`, held by the server, one record per pair of characters, with the content table `phrase`. Background: `../design/01-concept.md` sections 6 and 16, `../design/03-structure-and-conventions.md` section 5, `../research/05-real-people-family-and-safety.md`.

Everything between two players lives in one record, never in a copy on each side. The record holds what the two have done together: when they met, what they said, what they agreed and how it ended. Each life sees it only through the authority commands of `person.md`.

This page also covers the invite card that starts a pair, the preset phrases a pair talks in, and the block and report on every interaction. The block's reach and the report queue belong to `moderation.md`.

## The pair record

**pair:one-record-per-two** There is one record for any two characters. Its id is the two character ids, sorted and joined by `~`, so a second record for the same two cannot exist. The pure helper `other(record, me)` gives the other side's id; `side(record, me)` gives `a` or `b`.

**pair:record-fields** A record holds:

- the two ids, `a` and `b`;
- `role`: `partner` or `sibling`;
- `stage`: `connected`, `courting`, `partner`, `married` or `ended` (a sibling pair is only ever `connected` or `ended`), and the tick each stage began;
- who invited whom;
- a pending proposal for each side;
- each side's consents (`countFunds`, `standInMay`);
- the moments, in order, each with its side, kind, spot, what and tick;
- the joint (`route`, and `lead` as `a` or `b`), or null;
- the interview (route, questions, each side's answers or null, result), or null;
- each side's block flag;
- each side's stand-in stage;
- how it ended (`by`: `a`, `b`, `absence`, `block` or `deleted`, and the tick), or null;
- `held`, true while a report on it is under review.

**pair:record-holds-no-personal-data** The record never holds money, a balance, a pay figure, a typed word, a real name, a contact detail or a photo. It holds only ids, ticks and choices from fixed lists.

**pair:only-server-writes-record** Only the server writes the record, and only from what an accepted command or its events say in either life:

- `people/courted` sets `courting`;
- `people/moment-added` appends a moment;
- `people/proposed`, `people/answered` and `people/withdrawn` set or clear that side's pending proposal;
- `people/consented` sets that side's consents;
- `people/ended` sets `ended`;
- the interview's events set its questions and answers (`interview.md`);
- a stored phrase appends a `said` moment (pair:conversation-phrases-stored).

Each write, and the authority commands it causes, happen in one transaction.

**pair:joint-steps-need-both-sides** A step that needs both sides (becoming partners, marrying, a joint application, a sponsor's agreement) takes effect only when both pending proposals name the same step with the same terms, or when one side's proposal is answered yes. Then, in the same transaction, the server clears both pending proposals and sends `people/agreed` to both lives (person:both-lives-step-together). A step named by one side alone changes nothing in either life except the pending flag.

**pair:who-may-read-a-record** Who may read a record:

- each of the two, through the pure `pairView(record, me)`. It gives everything except the other side's interview answers (until both sets are in) and the other side's report;
- a moderator, only while a report on it is open;
- nobody else.

A record never reaches the world, a place, a share card or a third player's view. An ended record stays readable to both while both accounts exist (person:ended-bond-record-kept, person:leaving-player-ends-bonds).

## The invite card

**pair:invite-card-contents** An invite card shows:

- the character's name (never the account's);
- the character's japacity and best route;
- the line "Looking for: {slot} {fill}", with `slot` `partner` or `sibling` and `fill` from a fixed list;
- the words "Japacity is a game";
- a link.

Fills for a partner: `already-in-uk`, `already-in-canada`, `abroad-anywhere`, `who-is-a-nurse`, `who-codes`, `to-start-out-with-me`. Fills for a sibling: `to-start-out-with-me`, `to-go-first`, `to-follow-me`. A card never shows a photo, a sum of money, a phone number or a link to anywhere but the game.

**pair:invite-link-single-use** The link is the game's address with the code, `https://japacity.app/invite/<code>` (the host of `SITE_URL`, the game's one address). The code is single-use, valid for `tuning.pair.inviteDays` days, and fills only the slot it was made for.

- Opening the link goes through sign-up and the date-of-birth screen. An account that does not pass the screen gets no pair.
- A sibling link starts a new character with the inviter's family (person:real-sibling-shares-family-draw).
- A partner link lets the friend pick one of their adult characters or start a new one. It creates the record at `connected`, and the inviter's life is sent `people/link`.
- A character may have at most `tuning.pair.maxOpenInvites` open cards.

The invite routes refuse with the same 4xx statuses the other routes use, never 200, with the refusal in the body: `too-many` is 429 (like the guest sign-up's and the reports' limits), `used` is 409 (a conflict, like a name taken) and `expired` is 403 (like an age pass that ran out). The client reads the refusal from the body whatever the status, and says it in words.

Every state of the invite page offers Open Japacity, including a used or old link and an unreachable server; when the server could not be reached it also offers Retry. The words say whether the link was used, is old or could not be checked. The invite card's Get the link opens the device's share sheet, or offers Copy where there is none.

**pair:invite-rewards-never-cash** Invite rewards come from what the invited friend goes on to do, never from sending the invite, and are never worth cash. When the friend's character finishes the prologue, closes the second chapter or departs, the inviter gets a card frame to show and a line. Each of the three counts at most once per friend, and only for up to `tuning.pair.rewardFriends` friends. Rewards give no game money, no turns and nothing that changes play. They are cosmetic only, because game money or turns given for sign-ups would be farmed with throwaway accounts, as cash referral bonuses were with cheap SIM cards.

## Preset phrases

**pair:preset-phrases-only** Players who did not invite each other, and invited friends too, talk in the game only in preset phrases: the `phrase` entries below. Each has at most one fill-in from a fixed list (a spot, a route the sender has heard of, a news story delivered to the sender, an event, a thing). No phrase asks for or offers money, a document, a contact detail, a meeting outside the game or a photo, and the content check fails any phrase that would.

**pair:conversation-phrases-stored** A phrase sent in a pair's conversation is stored as a row: message id, conversation id (the pair id), sender, phrase id, fill-in, sent at, read at. The server then nudges the other side, whose client fetches the conversation from where it left off. The row also appends a moment of kind `said` to the record, with the phrase id as `what` and the fill-in as `spot` when it is a spot, so talking becomes shared history (person:talking-adds-moments). Rows are kept while both accounts exist and are deleted with an account. The thread in Chats shows read and new marks.

**pair:place-phrases-not-stored** A phrase said in a place goes to whoever is there at that moment. It is not stored, makes no moment, and must be one of the phrases marked `place`.

**pair:phrase-checks-before-send** Before a phrase is stored or said, the server checks, in this order:

1. the two are connected (a record not ended), or, in a place, both are in it;
2. neither has blocked the other;
3. the sender is within `tuning.pair.phrasesPerHour` for that conversation, or `tuning.pair.placePhrasesPerMinute` in a place.

A failure stores nothing and delivers nothing. The sender is told which check failed, but never anything about the other side's settings beyond "not possible". The refusal is shown in words in the thread.

## Block and report

**pair:block-and-report-one-tap** Every surface that shows another player carries block and report, one tap from where that player appears: an invite card, a pair view, a conversation, a phrase heard in a place, a person met in a place, and their Chats thread. A Chats thread carries block and report in its head.

**pair:block-ends-every-bond** A block takes effect at once. It refuses, both ways, every phrase, sighting in a place, proposal and card between the two (moderation:block-refuses-both-ways). Every bond between the two ends as a block end in both lives (`people/ended` with `why: "block"`), costing nobody standing (person:ender-pays-in-standing), and every joint collapses (person:joint-collapses-with-bond). The blocked side is told only that the bond ended. Lifting a block restores nothing: a new invite is needed.

**pair:report-holds-conversation** A report cites the pair id and, for a conversation, the message ids. The reported conversation is held (`held` true) until a moderator closes the report, and nothing is deleted while it is held. The reporter may block in the same step. A report changes nothing in either life.

**pair:no-records-between-strangers** While `tuning.people.matchmaker` is false, no record is ever made between two players who did not invite each other.

**pair:everyone-meets-by-invite** Every player meets others the same way, wherever they are (region:same-contact-everywhere). A record is made between two accounts only when an invite connects them (pair:invite-link-single-use), and never between two who did not invite each other while the matchmaker is off (pair:no-records-between-strangers). Nothing in a pair depends on where either player signed up (`../design/01-concept.md` sections 16 and 17).

## Entries: phrases

The words below are a guide; `packages/content/src/phrase/phrase.text.ts` holds the words the game shows.

| Id | Words | Fill-in | Where |
|---|---|---|---|
| `phrase.hello` | "How far?" | | both |
| `phrase.evening` | "Good evening, everybody." | | place |
| `phrase.home` | "How is everybody at home?" | | conversation |
| `phrase.miss-you` | "I miss you." | | conversation |
| `phrase.thinking` | "I was thinking about you today." | | conversation |
| `phrase.meet-at` | "Let us meet at {spot}." | spot | conversation |
| `phrase.see-you` | "See you at {spot}." | spot | both |
| `phrase.call-later` | "I will call you later." | | conversation |
| `phrase.busy` | "Sorry, this month is tight. I have been busy." | | conversation |
| `phrase.looking-at` | "I am looking at {route}." | route | conversation |
| `phrase.did-you-hear` | "Did you hear? {news}" | news | both |
| `phrase.good-news` | "Good news: {event}." | event: `got-job`, `visa-came`, `passed-test`, `landed`, `got-papers` | conversation |
| `phrase.proud` | "Well done. I am proud of you." | | both |
| `phrase.good-luck` | "Good luck with {thing}." | thing: `interview`, `test`, `new-job`, `the-move` | both |
| `phrase.december` | "Are you coming home for December?" | | conversation |
| `phrase.serious` | "I am serious about us." | | conversation |
| `phrase.slowly` | "Let us take it slowly." | | conversation |
| `phrase.plan` | "Let us plan the papers together." | | conversation |
| `phrase.yes` | "Yes." | | conversation |
| `phrase.no` | "No." | | conversation |
| `phrase.thanks` | "Thank you." | | both |
| `phrase.sorry` | "I am sorry." | | conversation |
| `phrase.goodnight` | "Sleep well." | | conversation |

Spots are `person.md`'s shared list: `beach`, `suya-spot`, `church`, `cinema`, `mall`, `friends-wedding`, `campus`, `bus-stop`.

## Numbers

| Setting | Value | Source or "working value" | In content as |
|---|---|---|---|
| Days an invite link lasts | 14 | working value | `tuning.pair.inviteDays` |
| Open invite cards at once | 3 | working value | `tuning.pair.maxOpenInvites` |
| Friends whose progress can earn rewards | 10 | working value | `tuning.pair.rewardFriends` |
| Phrases an hour in one conversation | 30 | working value | `tuning.pair.phrasesPerHour` |
| Phrases a minute in a place | 6 | working value | `tuning.pair.placePhrasesPerMinute` |
| Contact for every player | invited friends, preset phrases | the concept, sections 6, 16 and 17 | fixed behaviour (region:same-contact-everywhere) |

## Why it is built this way

- Preset phrases leave nothing typed, so there is nothing to moderate, and a phrase reads in any language.
- No phrase can carry money or a contact. "My partner abroad needs money for fees" is the standard romance scam, and in one bank's cases 43% of scammers claimed to live abroad.
- A block costs the blocker nothing. Safety comes first, and a block that cost standing would be a reason not to use it.

## Sources

All read on 8 Oct 2026, through `../research/05-real-people-family-and-safety.md`:

- [WeeTracker: botched referral schemes in Nigeria](https://weetracker.com/2020/07/24/startups-botched-referral-schemes-nigeria/)
- [FinTech Global: TSB on romance fraud](https://fintech.global/2026/02/06/tsb-warns-romance-fraud-rising-sharply-across-social-media/)

## Contract

The people routes' refusal codes in `ServerCode` (`packages/api/src/reply.ts`): `not-possible`, `blocked`, `too-many`, `wrong-place`, `bad-fill`, `not-here`, `used`, `expired`, `wrong-slot`, `not-adult`, `moved-on`. Any refusal that depends on the other side's state is `not-possible` and nothing more (pair:invite-link-single-use, pair:phrase-checks-before-send).

The pair types live in the simulation package, where both the server and the simulation reach them, pure and with no platform feature: `packages/sim/src/engine/types.ts` and `packages/sim/src/pair/pair.logic.ts`. `pair` is not in `KindName` and has no slice in a character's state.

1. `PairRecord`: `{ id: string; a: string; b: string; role: "partner" | "sibling"; stage: "connected" | "courting" | "partner" | "married" | "ended"; since: Partial<Record<"connected" | "courting" | "partner" | "married" | "ended", number>>; invitedBy: "a" | "b"; pending: { a: Proposal | null; b: Proposal | null }; consent: { a: { countFunds: boolean; standInMay: boolean }; b: { countFunds: boolean; standInMay: boolean } }; moments: PairMoment[]; joint: { route: Id<"route">; lead: "a" | "b" } | null; interview: PairInterview | null; blocked: { a: boolean; b: boolean }; standIn: { a: "warned" | "on" | null; b: "warned" | "on" | null }; ended: { by: "a" | "b" | "absence" | "block" | "deleted"; tick: number } | null; held: boolean }`.
2. `PairMoment`: `{ n: number; by: "a" | "b"; kind: "met" | "call" | "said" | "wedding"; spot: string | null; what: string; tick: number }`. `Proposal` as in `person.md`.
3. `PairInterview` as in `interview.md`.
4. Pure functions: `pairId(x, y)`, `other(record, me)`, `side(record, me)`, `pairView(record, me)`, `writeEvent(record, side, event): PairRecord`, `agreed(record): Proposal | null`.
5. `ConversationRow` (pair:conversation-phrases-stored): `{ id: string; conversation: string; sender: string; phrase: Id<"phrase">; fill: string | null; sentAt: number; readAt: number | null }`. Times are the server's real time and never enter a state.
6. `KindName` has `phrase` for the content table. `PhraseEntry` (pair:preset-phrases-only, pair:conversation-phrases-stored, pair:place-phrases-not-stored and pair:phrase-checks-before-send): `{ id: Id<"phrase">; fill: "spot" | "route" | "news" | "event" | "thing" | null; options?: string[]; where: "conversation" | "place" | "both" }`. `Content` has `phrase: Record<Id<"phrase">, PhraseEntry>` and `people.spots: string[]`.
7. Tuning: `pair: { inviteDays: number; maxOpenInvites: number; rewardFriends: number; phrasesPerHour: number; placePhrasesPerMinute: number }`.
8. Server types, outside the simulation (`packages/store/src/pair.types.ts`): `InviteRow`: `{ code: string; from: string; account: string; slot: string; looking: "partner" | "sibling"; fill: string | null; card: unknown; madeAt: number; expires: number; used: boolean; by: string | null; pair: string | null; usedAt: number | null; before: InviteMilestone[] }`, where `InviteMilestone` is `"prologue" | "chapter-two" | "departed"`. A report is `moderation.md`'s `ReportRow`.
