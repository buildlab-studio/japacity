# 0012. An act takes effect when it is done, not when the month ends

Status: Accepted

## Context

- A month has a few free slots: the commitments a player plans for the month (turn:free-slots-per-month).
- If a month were built only of slots settled when it ends:
  - every quick thing would wait for the next month;
  - every cost and gain would arrive at once;
  - every ask would come at the end, where the player answers with a month's hindsight.
- The game is the day lived between the room and the street, with the japa goal making each choice cost something.

## Decision

Money and effects move when an act is done, never when the month ends.

**Now-acts and month-acts** (activity:now-acts-and-month-acts)

- An activity entry says `when: "now"` or `when: "month"`.
- A now-act is anything quick, a purchase or a conversation. It takes effect where it is done.
- The command `activity/now` runs a now-act at once where it is staged:
  - with the slot's own checks, cost, effects and lines;
  - refused with `unknown-id`, `not-legal` or `cannot-afford`;
  - it fills no slot.
- A month-act is a commitment picked into a slot. It takes effect when the month ends.
- What life makes you wait for comes with the month: payday, an employer's answer to a job hunt, the draw, a paper's issue.

**Acts that repeat** (activity:acts-may-repeat-in-month)

- An entry may carry `repeat: true`: a now-act that may run again in the same month, each time paid, applied and counted at once.
- A purchase runs as often as money allows.
- A repeat act kept as a commitment in a slot runs `tuning.turn.repeatPerSlot` times when the month ends. So a recorded life or a strategy that plans it in a slot plays as it was recorded.

**The street** (streets:lagos-street-spending)

- The streets the player walks offer enjoyment and spending as priced now-acts, each with its own small lift.
- They are paid under the money reason `enjoyment`, never as a fee.
- Which part of the world's day opens each is the interface's choice (decision 0011).

**Asks arrive during the day** (offer:day-arrivals-roll-offers)

- The month's free time passes two marks, `tuning.turn.arrivalsBp` (a third and two thirds).
- At each mark the turn kind applies `offer/come-up`, and the offer kind opens at most one offer, inside the month's cap.
- The month's end rolls what the cap still allows.
- Two fixed marks give every month the same shape, with no state of their own, and keep the determinism of the month's roll.

## Consequences

- An act takes effect where it is done: the kiosk sells the ticket, the park answers the question, the paper is started at the box.
- The lines a now-act says come from content (`line.activity.<slug>.now`), never from the client's code.
- A now-act stands in a recorded life as its command at the tick it was planned.

## Alternatives

- **Every act settled at the month's end, as a slot.** The quick things wait a month, and every cost, gain and ask arrives at once.
- **A roll for arrivals on every act.** The pace of arrivals would depend on how finely a player slices the day. The two marks do not.
