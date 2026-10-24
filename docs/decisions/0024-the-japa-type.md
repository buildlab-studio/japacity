# 0024. A life is shared as a japa type, never a score

Status: Accepted

## Context

A life's end is shared with friends. A number invites ranking and turns a hard life into a low score; a label is the part of a life a friend can compare against their own. A label read from the life has to agree with what the results sheet showed, month by month.

## Decision

- **The japa type.** A life has a japa type, one of six labels, never a number: The Careful Saver, The Hustler, The Night Reader, The Family Anchor, The Gambler, The Long Way Round (share:cards-due-at-set-moments, share:card-contents). It is read from the view when the send-off card is due, from what the view carries: the way out the chapters followed (the plan), the share of the months the character kept more than they spent, the risks taken (the road's pitch, an agent paid, the kiosk), how the family was held (standing), the returns home on record, a refusal before the grant, and the acts done most, which the send-off card carries. The first reading that holds wins, the rarest and most telling first; each type has one line in a person's voice. It is kept on the data page and is a label for the stub, the type card and the data page, never a figure, never money as a sum, and it never changes the simulation.
- **The months kept.** The simulation counts, as each month closes, the months whose net in the money of the place where the month ended was above zero: the figure the results sheet shows as kept or down, from the same ledger, so the two never disagree (wallet:months-kept-counted). A change of money counts for nothing either way: the `convert` legs are left out, while the bank's charge and the aboki's short count stay as money out. The view carries `keptMonths`, and the Careful Saver is a life whose kept months are at least two thirds of its months played.

## Consequences

- No card celebrates harm (share:no-card-for-harm): The Long Way Round names a refusal or a return and still going, the hard part told straight.
- The count is never shown as a stat: the data page and the stub show the type, not the count.
- The type is the client's reading of the view (`apps/client/src/shared/words/japaType.ts`); the count is the simulation's.
