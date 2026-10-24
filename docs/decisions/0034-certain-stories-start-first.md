# 0034. Certain stories start first

Status: Accepted

## Context

The director starts at most `tuning.director.maxNewPerTick` stories a tick (director:stories-start-by-roll). It goes through the pool in id order and rolls each story on the world stream `shock`, so a story's place in the pool decides both when it is rolled and which numbers of the stream it takes.

Some stories are certain: the recruiting fair, the UK stories of the first tick, and the one-chance robbery warning that must be heard before the cash pile bites (wallet:cash-pile-warning). With one pass in id order, a rolled story with an earlier id that happens to succeed takes a place under the cap ahead of a certain one, and adding any story to the pool moves every later draw. A certain story could then slip by several ticks in some worlds, and the warning's timing rested on where its id sorts.

Alternatives weighed:

- **Name ids so they sort in the right place.** Holds only until the next story is added, and says nothing in the rules.
- **Raise the cap.** More news at once in the first months, and the order problem stays.
- **A priority field on each story.** More content to keep for one distinction the chance already carries.

## Decision

- **Two passes a tick.** The director first goes through the stories whose roll is certain (`chanceBp` times the running era's weight at 10000 or more over 10000), then the rest, each pass in id order; the cap counts across both. A certain story is never pushed back by a rolled one.
- **The warning is timed by being certain.** `news.warning-one-chance` is certain in the calm era, so it is heard by the third tick in every world.

## Consequences

- Every world's draws move from the first tick: the goldens and recorded lives are re-recorded and blessed with this change.
- A story added to the pool still moves later draws, but no longer delays a certain story.
