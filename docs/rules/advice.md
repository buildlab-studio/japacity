# Finding out where you stand

> Rules for the four ways to look into a route and the agents who can dupe you. Rests on `route.md` (route:hearing-a-route, route:friend-tells-by-month and route:looking-into-makes-known: hearing and looking into), `offer.md` (offer:opening-fixes-terms-and-fraud, offer:fraud-effects-replace-ordinary, offer:fraud-hidden-signs-shown: terms, fraud effects, signs), `luck.md` (luck:luck-never-reads-money), `document.md`, `interview.md`, `person.md` and `world.md`. The official page and the friend are the two ways the concept names; the adviser and the agents belong to this page.
> Kinds: `route` (route:looking-into-makes-known), `offer` (the agent family), `activity` (the official page, the adviser, the friend), `document` (the genuine mark). No kind of its own.

A player who has heard of a route can find out more in four ways, each with its own cost in money, time and risk. Asking a friend is free, so nobody is ever stuck without a way to learn about a route.

## Rules: the four ways to look into a route

**advice:four-ways-to-learn-route** A heard route is looked into by one of four acts, each a thing in a place in the game (world:things-are-tappable-models): the official page, someone who went, a licensed adviser, an agent. Any of the four moves the route from heard to known (route:looking-into-makes-known). `activity.look-into-route` is the official page; the other three are this page's entries. Each look-into's line is keyed by its cause, so asking around at the motor park that moves a route to known is told as the drivers' word (`line.route.looked-into-asked`), never as a reading of the official page.

**advice:official-page-shows-checklist** The official page is free and answers at once (activity:now-acts-and-month-acts); the player never sees the word "slot" (text:bands-not-figures). It shows the route's true checklist (the requirements as the route entry holds them) and says nothing about the player's own chances. Its result line says so once (`line.route.looked-into`), and the act's card says only what the page is, never a chance. It is read at the hub's desk or on the phone's Japa screen.

**advice:someone-who-went-answers-free** Asking someone who went is free and costs no slot; they answer at once, by `activity/now`, in the place (activity:now-acts-and-month-acts). It needs a relationship: a bond at `courting` or later with a person who is abroad, or `quality.network` at `tuning.advice.networkToAsk` or more, or a recurring person met in a place. They give the checklist as it stood in the month they left, so it is not guaranteed true: where the route's rules have changed since (a route's `changedMonth`, moved by the era's variables), one item they name is wrong. Reading the official page corrects any wrong item the player has from a friend or an agent (advice:official-page-shows-checklist).

**advice:licensed-adviser-is-truthful** The licensed adviser costs `tuning.advice.adviserFee`, paid from the naira by transfer, the bank first (decision 0014), reason `fee-advice`. They answer at once, as a now-act, once a month, and fill no slot (activity:now-acts-and-month-acts). They are always truthful. They read the whole file and say, for every route heard or known, whether it fits now, what is missing, and how many months away it is. Months away is the longest wait among the missing items (a document's ready months, a school's answer month, the window's next opening), given as "at least N months"; it is never a promise. Only the official page and the adviser give a checklist that is guaranteed true.

**advice:agent-kind-drawn-on-offer** An agent is an offer of the `agent` family: cheap and fast. Its kind is drawn on the `offer` stream when the offer opens, the way offer:opening-fixes-terms-and-fraud draws a fraud, with the shares in `tuning.advice.agentKindsBp` (see Numbers; the chaser is described in advice:chaser-runs-around-cheaper). The fee never reveals the kind: each kind's fee is drawn from its range in `tuning.advice.fees` (the chaser's from `tuning.advice.chaserFee`), and the ranges overlap, so a scammer can cost as much as a fixer or more. The kinds:
- a fixer brings the next appointment or paper forward by `tuning.advice.fixerMonths`;
- an overpromiser promises a month they cannot keep, so nothing moves, and the player finds out when the promised month passes;
- a scammer gives nothing and may offer fake papers for `tuning.advice.fakePapersFee` more.

An overpromiser's or a scammer's version of the checklist understates what is needed; a fixer's is true.

**advice:scams-show-their-tells** A scam is never a hidden dice roll: the player can see it coming, and being careful is something the player does. Every agent entry carries the full list of tells in content:
- asks for cash only;
- no office, meets at the stop;
- guarantees the visa;
- wants to hold the passport;
- a price far below the official fees;
- pay today or the slot goes;
- no licence number;
- "no passport needed, we will arrange everything": carried by scammers only, and found by checking the name (the Gulf file asks for the passport, chapter:chapters-follow-lean-route).

The kind fixes which tells are there: a scammer carries at least `tuning.advice.scamTells`, an overpromiser at least `tuning.advice.overpromiseTells`, a fixer at most one. One tell shows at once on the sheet. The others are found by looking, with three free acts on the sheet that cost no slot and always find what is there: ask for the office, ask for the licence number, and check the name with someone the player knows (a bond, or `quality.network` at `tuning.advice.networkToAsk`). Each look shows, in words and before any fee, every tell it can find. The chance draw of offer:fraud-hidden-signs-shown does not apply to the agent family.
Other offer cards follow the same idea: of the signs the offer opened with, the first shows at once and the others sit behind one look on the card, "Look closer", which costs nothing, takes no time and shows every sign the offer carries; a card with one sign or none has no look. An ask that may be a scam (any offer whose entry has a fraud share: the road's pitch, the message that says you have won, a sponsor that may not be one) shows every answer as a plain button and none as the main one, so the player reads before choosing. The answers that cost nothing come first, the way to say no before the way to pay. The agent's own sheet keeps its form: its three free looks come before any fee.

**advice:agents-never-read-money** Whether an agent appears, and which kind it is, never depends on money in any form (luck:luck-never-reads-money applies). The offer's `when` reads routes, documents, the place and the chapter only. `checkContent` fails an agent entry that reads money.

**advice:agent-loss-is-the-fee** The loss is the fee, paid from the naira by its size (decision 0014: cash first at or under `tuning.wallet.cashUpTo`, the bank first above it). The fee can never take the last `tuning.advice.floorNaira` of naira in cash and bank together: if the player cannot cover an agent's fee, the offer is declined by default. Fake papers, if the player uses them (chooses them for a route's requirement), set `genuine: false` on that document record. Routes whose gates check (`document/genuine` in `route-gates.md`) refuse the application, and the genuineness interview reads the mark. The mark is never cleared. A fake paper never used in an application is replaced by requesting the genuine one, which replaces the whole record; once used, the record keeps the mark for the life. Nothing here ends a life, opens a debt or takes a status.

**advice:bad-news-told-straight** Bad news is told straight: the report line names the agent, says the fee is gone, and says what the player saw ("The agent was a scam. ₦8,000 gone. He had no office and wanted cash."). No euphemism, no joke.

**advice:advisers-are-invented-people** Every adviser and agent is a `person` entry with an invented name from the name pool, drawn as recurring people are; never a real name or a real firm. Where they are found:
- the adviser at the hub's long desk;
- the official page at the hub's desk and in the phone;
- every agent at Ojuelegba's stop, where fixers, overpromisers and scammers all find their customers; a fixer may also keep a desk in the agent's office.

A scammer never has a desk: asking for his office (advice:scams-show-their-tells) gets a story, which is the tell.

**advice:free-ways-pointed-first** A new player is pointed at the free ways first. No agent offer opens before `chapter.find-your-feet` is done, and the chapter's "look into it" nudge names the official page and someone who went, never the adviser or an agent. The adviser's fee is above a starting life's cash by design.

**advice:chaser-runs-around-cheaper** The chaser is a second honest kind of agent, beside the fixer of advice:agent-kind-drawn-on-offer. The fixer is an insider who moves a paper's date himself: faster and dearer. The chaser follows up with the school or the office and handles the running around: slower and cheaper. An agent offer drawn as a chaser (`tuning.advice.agentKindsBp.chaser`, 2000) brings the paper forward by `tuning.advice.chaserMonths` (one month), where the fixer brings it forward by two. Its fee comes from `tuning.advice.chaserFee`; the ranges overlap so the fee never reveals the kind. Its signs are the fixer's. Both are found through a person (a friend's chat line, asking around at the park), one per paper where it makes sense: the transcript, the police certificate, the TB test. Neither depends on money (luck:luck-never-reads-money). The chaser is shown as a plain fact of how things get done, never as a crime and never with a lecture.

## Numbers

| Setting | Value | Source | In content as |
|---|---|---|---|
| The official page | free, a now-act once a month | the real official pages are free | advice:official-page-shows-checklist |
| Network to ask someone who went | 40 | Working value | `tuning.advice.networkToAsk` (advice:someone-who-went-answers-free) |
| The adviser's fee | ₦80,000, above every starting life's cash and near a month's upkeep, so the free official page comes first in play (advice:free-ways-pointed-first); paid by its size, the bank first at the adviser's price (decision 0014) | Working value | `tuning.advice.adviserFee` (advice:licensed-adviser-is-truthful) |
| Agent kinds, fixer / chaser / overpromiser / scammer | 30% / 20% / 30% / 20% | Working value | `tuning.advice.agentKindsBp` (advice:agent-kind-drawn-on-offer, advice:chaser-runs-around-cheaper) |
| Fees, drawn from overlapping ranges: fixer, chaser, overpromiser, scammer | ₦10,000 to ₦30,000; ₦8,000 to ₦25,000; ₦8,000 to ₦25,000; ₦8,000 to ₦30,000 (the ranges share most of their span, so no fee tells the kind; the chaser is only the cheapest at both ends) | Working value | `tuning.advice.fees`, the chaser's `tuning.advice.chaserFee` |
| Months a fixer brings forward; a chaser | 2; 1 | Working value | `tuning.advice.fixerMonths`, `chaserMonths` |
| Fake papers | ₦20,000 | Working value | `tuning.advice.fakePapersFee` |
| Tells a scammer carries, an overpromiser carries, a fixer at most | at least 2, at least 1, 1 | Working value | `tuning.advice.scamTells`, `overpromiseTells` (advice:scams-show-their-tells) |
| Tells shown at once | 1 | Working value | advice:scams-show-their-tells |
| Cash an agent's fee can never take | the last ₦2,000 | Working value | `tuning.advice.floorNaira` (advice:agent-loss-is-the-fee) |
