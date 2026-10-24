# 0010. What a first visit downloads has a budget

Status: Accepted

## Context

Most players arrive on a phone on Nigerian mobile data, where every kilobyte before play costs money and time. A budget only holds if a check enforces it.

## Decision

engine:first-download-has-budget: what a first visit downloads carries a budget for each part in `tools/check/size-budget.json` (the main chunk, three.js's core, the simulation with the content, the model loader, the other shared chunks, and their total), measured by `pnpm check:size` in every `pnpm check` and in the check workflow. A part over its budget fails the check with its name and both numbers. Each budget is a measured size plus five percent. A budget is lowered on purpose and never raised quietly: every change to the file carries a line saying why. The admin page's code is never in a first-visit chunk.

The rule sits on the engine page because that page is the contract every kind is built against, and the download is the first cost a player pays: it stands beside the other engine limits (engine:browser-authority-for-dev-only), where a contributor reads it before adding a dependency.

## Consequences

- A feature that needs more download says why in the budget file, and the budget rises only by that.
- The numbers are not a target to chase: they move when a piece makes the download smaller on purpose or a feature needs more and says so.
- A change to engine:first-download-has-budget itself needs a decision record.
