# Screenshot moments

> Rests on `share.md`, `text.md`, world:world-fills-the-screen and world:month-end-results-sheet, route:grant-moves-to-granted, route:refusal-refunds-and-resets, route:refusal-reasons-recorded and route:departure-pays-flight, advice:agent-kind-drawn-on-offer and advice:bad-news-told-straight, activity:one-chance-bus-robbery, luck:big-wins-are-staged, `lottery.md`, `chapter.md`, road:road-earns-nothing.
> Kind: none new. The simulation holds nothing for these rules: the client picks the moment from the lines it receives and draws the card from the view; content holds every word (`packages/content/src/moment/moment.text.ts`).

This page covers moment cards: every big outcome in the game is shown as one clean card over the scene, worth a screenshot, with one line and a big number, often a loss, and the game's name on it.

## Rules

**moment:outcomes-that-are-moments** These outcomes are moments, each made by its report line:

| Moment | Report line |
|---|---|
| A visa refused | `line.route.refused` |
| The endorsing body's refusal | `line.route.endorsement-refused` (route-gates:endorsement-decided-by-draw) |
| A visa granted | `line.route.granted` |
| The one chance on the bus home | `line.activity.robbed` |
| The agent who was a scam | `line.offer.agent-scam` |
| The deposit a road pitch took for nothing | `line.route.road-fraud` |
| A big win on the draw | `line.lottery.letter` or `line.activity.lotto-won`, when staged as big by luck:big-wins-are-staged (a jackpot or a mid prize) |
| Landing abroad | the flight's `line.route.departed` |
| A chapter closing | `line.chapter.closed` |
| A stamp reached on the passbook (`held`) | `line.passbook.stamped`, `line.passbook.ready` (wallet:savings-stamps) |

- **One list.** The list lives in the client: `MOMENTS` in `apps/client/src/shared/moment/moment.ts`. The card is `apps/client/src/features/moment/MomentCard.tsx`.
- **One card per batch.** The moments rank, most telling first: refused, granted, robbed, the agent, the deposit, the win, the landing, the chapter, held. A batch of lines (a month's report, a command's answer, or the authority's own lines such as the draw's letter) gives at most one card, the first in that order. So decision day closing beside the grant, or a chapter closing beside the flight, never stacks a second card.
  - Of several chapters closed at once, the last is told.
  - The road's own figure comes before a fixed stamp, and the highest stamp of a batch makes the card.
- **Not moments.** Nothing on the road chain (road:road-earns-nothing). A life that has ended has its own card.
- **The endorsement refused** is a refusal and makes the refused card itself. The screen tells the endorsement's story once, by the body's line, and folds away the route's refusal noted beside it.
- **The road deposit** (road:taking-pitch-pays-deposit's fraud, which ends the chain before it begins, with the life still at home) is a loss in the agent's style. Its figure is the deposit, read from the month's lines where the pitch was taken. A deposit the month's lines do not hold makes no card.

**moment:moment-card-contents** A moment card holds:

- a kicker naming the outcome ("Visa refused");
- a title (the route, the country, the chapter, the agent's name, the bus home, the draw);
- one line in the game's voice;
- the figure, with its caption under it;
- at most one small fact beside it;
- in its corner, the game's small mark with the address japacity.app. The mark is the seal's drawing picked by size through `markFile`: up to 48 px the small drawing, up to 192 px the medium, above that the full (`apps/client/public/brand/japacity-mark-small-<ground>.svg`, `japacity-mark-medium-<ground>.svg`, `japacity-mark-<ground>.svg`).

The figure is a whole number, said whole: money in whole naira, pounds or dollars with its currency sign, a share as a whole percent, or a count. Unlike a share card, a moment card may show money, as part of the story.

| Moment | Kicker and title | Figure | Beside it |
|---|---|---|---|
| Granted | | The months played | |
| Refused | | When the letter refused on the funds: the share of the funds that could not be traced on the file it judged (route:unexplained-share-of-funds, route:refusal-reasons-recorded), using the route's figure in the view while it was being decided, because once refused the figure is worked against the funds a new file would need. Otherwise the months played | "Refusal 2 on this route", from the second refusal |
| Endorsement refused | Kicker "Endorsement refused" | The months played | |
| The agent | | The fee gone | |
| The deposit | Kicker "The deposit is gone"; the pitch's own name as the title ("Your cousin's friend") | The deposit gone | |
| One chance | | The cash taken (the phone's cost when no cash was on you) | The new phone |
| The win | | The sum won | For a kiosk win, the tickets and their cost |
| The landing | | The months from Lagos | |
| A chapter | | Japacity at home while a route has a figure, otherwise the months played | |
| Held | Kicker "Held for the road" or "Money ready at the target"; title "Mama heard" or the way's name | The stamp's naira | |

A win is drawn light (the sheet under the band's head) and a loss dark (the band's colour throughout), in either look.

**moment:card-reads-when-cropped** A moment card reads in a cropped screenshot.

- It stands centred over the dimmed scene, no wider than 380 px, at least 16 px from each side of the screen and clear of the safe areas, so nothing it says is at an edge.
- The line is at least 24 px and bold. The figure is at least 44 px, sized by its length so the longest sum stays on one line. The kicker is at least 12 px and the address at least 16 px.
- It fits a 360 by 640 screen without scrolling.

**moment:card-never-looks-official** A moment card never looks like a bank alert, a transfer receipt, a payment app or a letter from a government (share:card-never-looks-official's list, `text.md` "Money on screen").

- No alert layout, reference number, bank name, account, balance, crest, barcode, stamp, or tick beside a figure.
- The figure carries no plus or minus sign and stands in the card's own ink, never green or red.
- No word on a card says alert, credit, debit, transaction, receipt, reference, account, balance, transfer, bank or stamp.

**moment:words-in-game-voice** The words are content's, in the voice of `text.md` ("Voice").

- A loss is said straight, with no joke (text:bad-news-never-joked; the agent is told as advice:bad-news-told-straight says, naming him and the fee gone). Its punch is the plain fact and the figure.
- A win may carry a wink.
- Money is said in the game's own words for it ("the cash on you", "paid to him, and gone"), and the line never repeats the figure the card already shows.

**moment:card-shows-when-outcome-lands** A moment card shows when its outcome lands, over the scene as it is then, and changes nothing else about the flow.

- **Where.** At a month's end it stands over the results sheet once that sheet is up, as a dialog inside the sheet's own, so the sheet stays as it was under it (world:month-end-results-sheet). After an act, or when the draw's letter comes, it stands over the world once the staged lines told in the corner have passed. A big line the card tells is not told again in the corner.
- **Dismissing.** One tap anywhere on it or around it, Close, or Back dismisses it, and the sheet under it is there as before. If a run of months brought more than one card, the next follows.
- **Waiting.** A share card that is due waits until no moment card is left (`apps/client/src/shared/ui/stage.ts`). While a card stands, the corner, the bubble and the rise wait, as under a share card (world:street-talk-budget, world:japacity-bag-by-door).
- **Chapter closes.** A chapter's close is told twice, by the results line and the moment card, and never a third time. When a moment card is queued for a chapter closing and the view's share card is that chapter's (share:cards-due-at-set-moments), the share card is set aside as closed and kept in the gallery without opening. Where no moment card stands, the chapter's share card opens.
- **One close in view.** While a moment card stands over a world sheet (the results), the sheet's head (its small line, its title and its close) steps back, so only one close is in view. The rest of the sheet stays as it was, and its head comes back when the card goes.

**moment:moment-is-not-share-card** All the rules of `share.md` hold, except for the chapter's share card that a moment card has told (moment:card-shows-when-outcome-lands). A moment card is not a share card:

- it is drawn on screen only, never to an image;
- nothing on it is offered, shared or sent, and it has no share button;
- nothing about it is counted beyond what the screen under it counts;
- it is never stored on the server.

**moment:new-moments-join-same-way** A new moment joins the same way: an entry in `MOMENTS` and its words under `moment.<kind>` in content, drawn by the same card. So it holds the line, the figure, the mark and the address of moment:moment-card-contents, and obeys moment:card-reads-when-cropped, moment:card-never-looks-official, moment:words-in-game-voice, moment:card-shows-when-outcome-lands and moment:moment-is-not-share-card. A new system designs its key moments as moments from the start.

## The lines

Every line is in `moment.text.ts`.

| Moment | Line chosen by |
|---|---|
| Granted | the route (`moment.granted.line.<route>`), else the plain line |
| Refused | the letter's first reason (`moment.refused.line.<reason>`) |
| The agent | one line, his name in the title |
| The deposit | the pitch (`moment.deposit.line.<offer>`), else the plain line; the pitch's name in the title |
| One chance | one line |
| The win | one line |
| Landed | the country (`moment.landed.line.<country>`), else the plain line |
| Chapter done | the chapter's own closing line (`chapter.<id>.close`, `chapter.md`) |
| Held | the stamp: the road's own figure (`moment.held.line.ready`, the way's name in the title), else the plain line (`moment.held.line`, Mama heard) |
