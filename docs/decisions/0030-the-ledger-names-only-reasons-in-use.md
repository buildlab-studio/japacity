# 0030. The ledger names only the reasons a rule uses

Status: Accepted

## Context

Every credit and debit in a life carries a reason from the `Reason` union (`packages/sim/src/engine/types.ts`, with `ReasonSchema` in `packages/sim/src/engine/language.schema.ts`). The reasons are the ledger's vocabulary: the report lines (`REASON_LINE` in `packages/sim/src/wallet/wallet.logic.ts`), the money report's ceilings (`packages/sim/src/wallet/wallet.report.ts`), the server's alarms and the wallet's rule page are all read by reason.

Three names fit no rule of the game:

- `pot-top-up`, a house share added to a lottery prize. The Friday draw pays fixed odds and the house tops up nothing (decision 0016), so no rule credits it.
- `ransom`, money paid to free someone held on the road. The road's ransom sum is opened as `obligation.agent-debt` and paid under `agent-debt`, or met by the family's means and standing (road:chain-steps-monthly), so no rule debits it.
- `build`, money spent on a building at home. `goal.the-house` reads land and the naira held, and the game has no building project, so no rule debits it.

A name in the union that nothing uses is a thing a reader looks for and never finds, and each would carry a report line and a word in content that no life can show.

Alternatives weighed:

- **Keep them, marked as unused.** The ledger page would have to explain names that mean nothing, and every table keyed by reason would carry them.
- **Remove them and trust the types.** The simulation cannot credit a name outside the union, but a report that gives such a name no ceiling raises nothing for a tampered total under it.

## Decision

- **The union holds only reasons a rule uses.** `pot-top-up`, `ransom` and `build` are not in `Reason` or `ReasonSchema`, and their report lines (`line.wallet.pot-top-up`, `line.wallet.ransom`, `line.wallet.build`) are not in `REASON_LINE` or in content's words.
- **A name that is no reason can make nothing.** In the money report a total under any name outside `ReasonSchema` has a ceiling of 0, so one kobo under it names the account as suspect (wallet:ledger-report-raises-alarms).
- **The house part is refused.** A `lottery/pay` whose prize carries a house part is refused whole, and the server's draw check raises the world alarm for a logged payout that carries one (lottery:winners-paid-by-authority, lottery:money-report-checks-draws). These read the payout's own field, not a ledger reason.

## Consequences

- A new reason is added only with the rule that credits or debits it, with its report line and its word, and a record when AGENTS.md rule 9 asks for one.
- No golden or recorded life holds any of the three, so none moves; the content's words and the simulation's code change, so the content version is sealed again (server:content-version-sealed).
- The wallet, lottery, server and goal rule pages list the reasons the union holds and no others.
