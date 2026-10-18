# Life goals

> The long game after the main journey: goals in any order.
> Kind: `goal`. Many per character. Background: `../design/01-concept.md` section 11.

A goal is a thing worth doing that the game notices: a car, a home, a career step, the house back home, the December visit, a return with capital. It is open when its `openIf` holds, done when its `doneIf` holds, and it is never required.

## Rules

**goal:goals-open-and-complete** A goal entry has `openIf` and `doneIf` requirements, a `reward` (standing and wellbeing effects applied once), and a `where`. In the `chapter` phase, after chapters are judged, every goal not yet open whose `openIf` holds opens, and every open goal whose `doneIf` holds is done: the reward applies and a line with attention is given. A goal's done date is said as months ago in Japa.

**goal:goals-need-the-real-deed** `goal.december` is done only when the visit was taken: its `doneIf` reads `setpiece/answered-with` for the going answer (route:last-answers-remembered), so staying home one December does not finish it. `goal.own-door` is done only in a flat in the character's own name (`obligation/has` with type `rent` whose entry is a flat), never a shared room.

**goal:done-goal-stays-done** A done goal stays done. Goals do not refill the turn bank and do not gate anything. They are the view's "what you could do next" once the chapters are over.

**goal:view-shows-goal-items** The view shows open goals with their items (each `doneIf` requirement as met or not, the way the chapter view does) and the done list with the month each was done.

## Entries

| Id | Where | Opens when | Done when | Reward |
|---|---|---|---|---|
| `goal.first-car` | abroad | credit 20 | `obligation/has` type `car` (car:open-finance-gives-the-car) | standing +4, wellbeing +4 |
| `goal.own-door` | abroad | 6 months abroad | a flat open (`obligation.rent-flat-uk` or `obligation.rent-flat-ca`) | wellbeing +6 |
| `goal.step-up` | abroad | 12 months abroad | a job abroad paying 20% or more above the entry job of its ladder: one of `activity.job-uk-nurse`, `activity.job-uk-senior-dev`, `activity.job-uk-graduate`, `activity.job-ca-professional`, `activity.job-ca-dev` held (`job/is`) | standing +5 |
| `goal.clean-file` | abroad | credit 10 | credit 60 | wellbeing +3 |
| `goal.send-well` | abroad | any remit | ₦2,000,000 sent home in total (`wallet/total`, flow `in`, reason `remit`, in naira: the naira that arrived home, abroad-money:remit-sends-money-home) | standing +6 |
| `goal.december` | abroad | 12 months abroad | `setpiece.december` answered once | wellbeing +5 |
| `goal.settled` | abroad | a status that counts to settlement | a settled or citizen status | standing +10, wellbeing +8 |
| `goal.home-with-capital` | any | a return recorded | a return `with-papers` or `by-choice` recorded, and ₦10,500,000 or more in the naira bank (the capital bonus's cap of return:standing-by-return-shape above the broke line), judged at any month's end after the return | standing +8 |
| `goal.the-house` | any | ₦5,000,000 in naira in the bank | `quality.land` 1 or more and ₦15,000,000 or more in the naira bank | standing +10 |
| `goal.second-route` | home | a return recorded | any route granted after the return | wellbeing +8 |

`goal.the-house` reads land and the money held for the house; no building project pays under the reason `build`.

## Numbers

| Setting | Value | In content as |
|---|---|---|
| Goals shown at once | all open ones, the view sorts by the month they opened | none |

## Effects and requirements this kind handles

The part before the slash names the kind that carries an effect out or judges a requirement (`engine.md` section 5). The types are in `packages/sim/src/engine/types.ts`.

| Type | | What it does |
|---|---|---|
| `goal/open` | effect | Opens the goal whatever its `openIf` says |
| `goal/done` | effect | Finishes the goal, open or not, with its reward once (goal:done-goal-stays-done) |
| `goal/done` | requirement | The goal is done |
