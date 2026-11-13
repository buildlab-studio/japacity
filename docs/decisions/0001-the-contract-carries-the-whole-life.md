# 0001. One engine contract holds the whole life, at home and abroad

Status: Accepted

## Context

- Every kind is built against one contract: `docs/rules/engine.md` in words and `packages/sim/src/engine/types.ts` in types.
- A kind is one part of the game with its own rules page, code and content (the wallet, a route, the home). Its slice is the part of a character's state it owns.
- A life starts in Lagos, may leave by one of several routes, each shaped differently, lives abroad, and may come home.
- The contract has to hold all of that without a second engine for the life abroad.

## Decision

**1. Leaving does not end the life** (route:departure-pays-flight, turn:finish-ends-the-life)

- `route/depart` applies `place/move` to `abroad` and `status/grant` for the route's status. The life goes on abroad.
- `turn/finish` is not applied at departure. Only the road's loss applies it.

**2. Routes have gates** (route-gates:route-runs-its-gate-steps, route-gates:gate-decision-draw-terms)

- A route entry names its `gate`: `study`, `sponsor`, `points`, `endorsement`, `contract`, `road`, and the people gates `partner` and `dependant`.
- The route kind runs only that gate's steps.
- Every gate reuses the same three parts:
  - the checklist;
  - the window, a world variable that opens or shuts the route to applicants;
  - the decision draw, the random draw that grants or refuses the visa.

**3. The contract grows, it is never rewritten**

- A new kind adds its slice. No slice is removed.
- An existing ledger reason keeps its meaning.
- When a stored state is upgraded, a slice it lacks is built by its kind's `initial` (decision 0004).

**4. Every money is its own currency**

- `Currency` is naira and each country's money, each with an official rate and a street rate.
- The wallet's rules are the same for every currency. The rate rules have an entry per currency.

**5. Content has no conditions** (route:looking-into-makes-known)

- An entry's effects are typed data, carried out in order (`../design/03-structure-and-conventions.md`, "Data stays plain").
- Sometimes content needs an effect aimed at a target it cannot take from the slot it fills. Then the effect names the target, and the order of the effects stands in for a condition.
- Example: `route/look-into` takes an optional `route` for this.

## Consequences

- The life abroad, the way home and every route share one turn loop, one ledger and one set of tests.
- When a currency is added, every exhaustive switch over `Currency` makes the compiler find each place that assumes a currency.
- The route kind has a switch on `gate`. A command of another gate does nothing or is refused with `not-legal`.
- An effect that names its target is a change to the contract's effect language. A conditional effect never is, because content holds none.
- Determinism, the ledger identity and the random streams do not depend on the contract's growth: a new kind or slice changes none of them.
