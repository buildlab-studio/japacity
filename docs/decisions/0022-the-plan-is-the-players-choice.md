# 0022. The plan is the player's choice

Status: Accepted

## Context

- The chapters follow the way out a life leans to (chapter:chapters-follow-lean-route).
- Read only from the order in which routes were heard of, a life can lean to a way its player never meant, with no way to see or change it.
- A route only heard of has no figure in the view's `routes` (japacity:heard-routes-have-no-figure). Yet a player weighing a switch needs to know what it would do.

## Decision

**The choice, in state.** `ChapterSlice.chosen` is the way the player made the plan.

- It is absent until set, so no state hash moves before it.
- The player command `chapter/lean` (`route`) sets it.
- It can name a way of the player's own effort that has been heard of and has a file of its own, while the character is at home and before any visa is granted.
- A chosen way is read before the time order.

**The plan, in the view.** The view carries `plan` at its top level:

- `route`: the way the chapters follow, or null while none is heard of;
- `ways`: each way of the player's own effort heard of or further on, with the figure its checklist earns now.

**On the screen.** The Japa app names the plan. Another way's page says what switching would do to the figure, with the choice to keep the plan or make that way the plan.

## Consequences

- Making a heard way the plan does not make it known: the official page still has to be looked into.
- A heard route has no figure in `routes`; its figure is in `plan.ways` only.
- The chapter object keeps its own shape: the choice is on the slice and the plan on the view, so the tests that fix the chapter object hold.
