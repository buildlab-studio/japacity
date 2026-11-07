# 0037. The catch is its own stream

Status: Accepted

## Context

Every job's pay was a written figure: a month's salary, a side job's tier, own work's takings growing by the year. The boat work at Makoko (activity:catch-drawn-each-month) pays a share of the catch, which is lean, fair or good from one month to the next. That is a new random draw every month for whoever works a boat, and every draw of a character comes from a named stream (engine:randomness-from-named-streams). Drawing it on `job` or `gig` would move every hunt and every hustle drawn after it, and so every recorded life that never touched a boat.

## Decision

- **A new character stream, `catch`,** used only for the month's catch. A life that works no boat never draws on it, so its other draws are as they were.
- **One draw a month,** in the main phase, before the pay is credited, for the main job that is a boat rung. The draw picks a band (lean, fair or good) by the month's chances, and the band scales the job's written base pay; the base is what own work's yearly growth and the Jobs app read.
- **The bands and chances are content,** so a change to them is a content raise like any figure.

## Consequences

- Recorded lives that never fish keep their draws; a life that fishes moves only by its catch.
- The month's pay of a boat rung is not known before the month ends; the Jobs app shows its base with words saying it depends on the catch.
- A later variable pay (a market stall's takings, a harvest) can take the same shape: its own stream, a band on a written base.
