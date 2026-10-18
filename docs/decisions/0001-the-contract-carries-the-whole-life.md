# 0001. The engine contract carries the whole life

Status: Accepted

## Context

Every kind is built against one contract: `docs/rules/engine.md` in words and `packages/sim/src/engine/types.ts` in types. A life starts in Lagos, may take one of several routes out, each with its own shape, lives abroad, and may come home. The contract has to hold all of it without a second engine for the life abroad.

## Decision

1. **Departure does not end the life.** `route/depart` applies `place/move` to `abroad` and `status/grant` for the route's status, and the life goes on abroad (route:departure-pays-flight). `turn/finish` is not applied at departure; the road's loss is the one thing that applies it (turn:finish-ends-the-life).
2. **Routes have gates.** A route entry names its `gate` (`study`, `sponsor`, `points`, `endorsement`, `contract`, `road`, and the people gates `partner` and `dependant`), and the route kind runs only that gate's steps (route-gates:route-runs-its-gate-steps). Every gate reuses the checklist, the window var and the decision draw.
3. **The contract is extended, never rewritten.** A new kind adds its slice; no slice is removed. An existing ledger reason keeps its meaning. A slice a stored state lacks is built by its kind's `initial` when the state is upgraded (decision 0004).
4. **Every money is its own currency.** `Currency` is naira and each country's money, each with an official and a street rate. The wallet's rules are the same for every currency; the rate rules carry an entry per currency.
5. **Content has no conditions.** An entry's effects are typed data carried out in order (`../design/03-structure-and-conventions.md` section 3). Where content needs an effect aimed at a target it cannot take from the slot, the effect names it: `route/look-into` takes an optional `route`, and the order of effects is the condition. `activity.ask-around` carries `route/look-into` for `route.gulf-contract` before its `route/hear`, so a life that has already heard of the Gulf looks it into at the motor park and the agent's pitch follows there, while a first-time asker only hears of it (guide:first-meetup-hears-fitting-route, route:looking-into-makes-known).

## Consequences

- The life abroad, the way home and every route share one turn loop, one ledger and one set of tests.
- Every exhaustive switch over `Currency` makes the compiler find each place a currency is assumed when one is added.
- The route kind carries a switch on `gate`, and a command of another gate does nothing or is refused with `not-legal`.
- An effect that names its target is a change to the contract's effect language; a conditional effect never is one, because content holds none.
- Determinism, the ledger identity and the random streams are untouched by the contract's growth.
