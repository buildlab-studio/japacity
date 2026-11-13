# Life goals

> Goals for after the main journey, done in any order.
> Kind: `goal`. Many per character. Background: `../design/01-concept.md` section 11.

A goal is something worth doing that the game notices: a car, a home, a career step, the house back home, the December visit, a return with capital. It is open when its `openIf` holds and done when its `doneIf` holds. No goal is ever required.

## Rules

**goal:goals-open-and-complete** A goal entry has `openIf` and `doneIf` requirements, a `reward` (standing and wellbeing effects, applied once) and a `where`. In the `chapter` phase, after chapters are judged, every goal not yet open whose `openIf` holds opens, and every open goal whose `doneIf` holds is done: its reward applies and a line with attention is given. Japa says a goal's done date as months ago.

**goal:goals-need-the-real-deed** `goal.december` is done only when the visit was taken: its `doneIf` reads `setpiece/answered-with` for the going answer (route:last-answers-remembered), so staying home one December does not finish it. `goal.own-door` is done only with a flat in the character's own name (`obligation/has` with type `rent` whose entry is a flat), never a shared room.

**goal:done-goal-stays-done** A done goal stays done. Goals do not refill the bank of turns (`turn.md`) and gate nothing. Once the chapters are over, they are the view's "what you could do next".

**goal:view-shows-goal-items** The view shows the open goals with their items (each `doneIf` requirement as met or not, as the chapter view does) and the done list with the month each was done.

## Entries

| Id | Where | Opens when | Done when | Reward |
|---|---|---|---|---|
| `goal.first-car` | abroad | credit 20 | `obligation/has` type `car` (car:open-finance-gives-the-car) | standing +4, wellbeing +4 |
| `goal.own-door` | abroad | 6 months abroad | a flat open (`obligation.rent-flat-uk` or `obligation.rent-flat-canada`) | wellbeing +6 |
| `goal.step-up` | abroad | 12 months abroad | a job abroad paying 20% or more above the entry job of its ladder: one of `activity.job-uk-nurse`, `activity.job-uk-senior-developer`, `activity.job-uk-graduate`, `activity.job-canada-professional`, `activity.job-canada-developer` held (`job/is`) | standing +5 |
| `goal.clean-file` | abroad | credit 10 | credit 60 | wellbeing +3 |
| `goal.send-well` | abroad | any remit | ₦2,000,000 sent home in total (`wallet/total`, flow `in`, reason `remit`, in naira: the naira that arrived home, abroad-money:remit-sends-money-home) | standing +6 |
| `goal.december` | abroad | 12 months abroad | `setpiece.december` answered with the going answer once | wellbeing +5 |
| `goal.settled` | abroad | a status that counts to settlement | a settled or citizen status | standing +10, wellbeing +8 |
| `goal.home-with-capital` | any | a return recorded | a return `with-papers` or `by-choice` recorded, and ₦10,500,000 or more in the naira bank (the capital bonus's cap of return:standing-by-return-shape above the broke line), judged at any month's end after the return | standing +8 |
| `goal.the-house` | any | ₦5,000,000 in naira in the bank | `quality.land` 1 or more and ₦15,000,000 or more in the naira bank | standing +10 |
| `goal.second-route` | home | a return recorded | any route granted after the return | wellbeing +8 |

`goal.the-house` reads land and the money held for the house. The view lists the open goals in the order they opened.

## Effects and requirements this kind handles

The part before the slash names the kind that carries out an effect or judges a requirement (`engine.md` section 5). The types are in `packages/sim/src/engine/types.ts`.

| Type | | What it does |
|---|---|---|
| `goal/open` | effect | Opens the goal whatever its `openIf` says |
| `goal/done` | effect | Finishes the goal, open or not, with its reward once (goal:done-goal-stays-done) |
| `goal/done` | requirement | The goal is done |
