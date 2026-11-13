# 0010. What a first visit downloads has a budget

Status: Accepted

## Context

- Most players arrive on a phone on Nigerian mobile data.
- Every kilobyte before play costs them money and time.
- A budget only holds if a check enforces it.

## Decision

**The rule** (engine:first-download-has-budget)

- What a first visit downloads has a budget for each of its parts and for their total, in `tools/check/size-budget.json`.
- `pnpm check:size` measures it in every `pnpm check` and in the check workflow.
- A budget is lowered on purpose and never raised quietly.
- The rule holds the detail: the parts, how a budget is set, what a first visit may hold and what a failing check reports.

**Where the rule sits**

- It is on the engine page, because that page is the contract every kind is built against, and the download is the first cost a player pays.
- It stands beside the other engine limits (engine:browser-authority-for-dev-only), where a contributor reads it before adding a dependency.

## Consequences

- A feature that needs a bigger download says why in the budget file, and the budget rises only by that.
- The numbers are not a target to chase. They move when a piece makes the download smaller on purpose, or when a feature needs more and says so.
- A change to engine:first-download-has-budget itself needs a decision record.
