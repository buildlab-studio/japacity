# 0034. News stories that are certain to start go before rolled ones

Status: Accepted

## Context

**How stories start.**

- The director starts at most `tuning.director.maxNewPerTick` stories a tick (director:stories-start-by-roll).
- It went through the pool in id order and rolled each story on the world stream `shock`.
- So a story's place in the pool decided both when it was rolled and which numbers of the stream it took.

**Some stories are certain:**

- the recruiting fair;
- the UK stories of the first tick;
- the one-chance robbery warning, which must be heard before the cash pile costs anything (wallet:cash-pile-warning).

**The problem with one pass in id order.**

- A rolled story with an earlier id that happens to succeed takes a place under the cap ahead of a certain one.
- Adding any story to the pool moves every later draw.
- So a certain story could slip by several ticks in some worlds, and the warning's timing rested on where its id sorts.

## Decision

**Two passes a tick.**

- The director first goes through the stories whose roll is certain: `chanceBp` times the running era's weight for the story's group is 10000 or more (director:stories-start-by-roll).
- Then it goes through the rest.
- Each pass is in id order, and the cap counts across both.
- A certain story is never pushed back by a rolled one.

**The warning is timed by being certain.** `news.warning-one-chance` is certain in the calm era, so it is heard by the third tick in every world.

## Consequences

- Every world's draws move from the first tick: the goldens and recorded lives are re-recorded and blessed with this change.
- A story added to the pool still moves later draws, but no longer delays a certain story.

## Alternatives

- **Name ids so they sort in the right place.** It holds only until the next story is added, and says nothing in the rules.
- **Raise the cap.** More news at once in the first months, and the order problem stays.
- **A priority field on each story.** More content to keep, for one distinction the chance already carries.
