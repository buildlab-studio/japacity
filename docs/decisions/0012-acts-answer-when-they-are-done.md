# 0012. Acts answer when they are done

Status: Accepted

## Context

A month built only of slots that resolve at its close makes every quick thing wait for the next month, lands every cost and gain at once, and brings every ask at the close, where the player answers with a month's hindsight. The game is the day lived between the room and the street, with the japa goal making each choice cost something.

## Decision

Money and effects move when an act is done, never when the month turns.

- **Now and month.** An activity entry says `when: "now"` or `when: "month"` (activity:now-acts-and-month-acts). The command `activity/now` runs a now-act at once where it is staged, with the slot's own checks, cost, effects and lines, refused with `unknown-id`, `not-legal` or `cannot-afford`; it fills no slot. A month-act fills time and stays a slot pick. What is waited on in life still comes with the month: payday, an employer's answer to a hunt, the draw, a paper's issue.
- **Acts that repeat.** An entry may carry `repeat: true` (activity:acts-may-repeat-in-month): a now-act that runs again within the month's free time, each time paid, applied and counted at once; a purchase runs as often as money allows. A repeat act kept as a commitment in a slot runs `tuning.turn.repeatPerSlot` times as the month turns, so every recorded life and strategy still plays.
- **The street.** The streets the player walks carry enjoyment and spending as priced now-acts with their own small lifts (streets:lagos-street-spending), paid under the money reason `enjoyment`, never as a fee. Which part of the world's day opens each is the interface's (decision 0011).
- **Asks arrive in the day.** As the month's free time crosses each of `tuning.turn.arrivalsBp` (a third and two thirds), the turn kind applies `offer/come-up` and the offer kind opens at most one offer, inside the month's cap (offer:day-arrivals-roll-offers); the close rolls what the cap still allows. Two fixed marks give every month the same shape, with no new state and the month's roll's determinism.

## Consequences

- An act answers where it is done: the kiosk sells the ticket, the park answers the question, the paper is started at the box.
- The month's lines a now-act says come from content (`line.activity.<slug>.now`), never from the shell.
- A roll per act would make the pace of arrivals depend on how finely a player slices the day; the marks do not.
- A now-act stands in a recorded life as its command at the tick it was planned.
