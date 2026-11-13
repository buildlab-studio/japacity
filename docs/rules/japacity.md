# Japacity

> Worked out from the state each time, never stored in it (the month report may quote it). Code: `packages/sim/src/japacity/`. Background: `../design/01-concept.md` section 4.

Japacity is the headline number: how ready the character is to leave, as a percentage. Each known route has its own figure, and the character's japacity is the best of them.

## Rules

**japacity:figure-sums-checklist-items** A route's figure is the sum of what each checklist item earns. A met item earns its whole weight. An unmet item that fills slowly earns its weight times (what the character has / what is needed), rounded down. Any other unmet item earns nothing.

**japacity:granted-route-scores-full** A route that is granted or departed has a figure of 100.

**japacity:best-open-route-is-japacity** The character's japacity is the highest figure among their routes that are either known with a window that is not closed, or applying, granted or departed. With no such route it is empty, shown as "no route yet". The view carries it as `japacity: { percent, route }`: `route` names the route the figure comes from (the first in content order on a tie) and is null when the figure is empty.

**japacity:figure-is-whole-percent** A figure is always a whole number from 0 to 100, and the weights of every route's checklist add up to exactly 100. The road is the one route with no checklist and no figure (road:road-route-has-no-figure).

**japacity:heard-routes-have-no-figure** A route that is only heard of has no figure in the view's `routes`. For such a way, the plan's `ways` (chapter:chapters-follow-lean-route) carry the sum its checklist earns now, so a switch can say what it would do.

**japacity:figure-derived-each-time** Japacity is worked out from the state and the world each time it is asked for. Two equal states under equal worlds give the same figure.

## What the player should feel

- The first time a route becomes known, the number appears already partly filled by things done for other reasons: the degree, the grade, the savings.
- The funds item is the long bar. It moves every payday, and it moves the wrong way when the naira falls or the rule changes.
