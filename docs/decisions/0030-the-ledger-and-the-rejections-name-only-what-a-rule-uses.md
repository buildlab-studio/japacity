# 0030. The ledger and the rejections name only what a rule uses

Status: Accepted

## Context

Every credit and debit in a life carries a reason from the `Reason` union (`packages/sim/src/engine/types.ts`, with `ReasonSchema` in `packages/sim/src/engine/language.schema.ts`). The reasons are the ledger's vocabulary. These are all read by reason:

- the report lines (`REASON_LINE` in `packages/sim/src/wallet/wallet.logic.ts`);
- the money report's ceilings (`packages/sim/src/wallet/wallet.report.ts`);
- the server's alarms;
- the wallet's rule page.

Three reasons fit no rule of the game:

- **`pot-top-up`,** a house share added to a lottery prize. The Friday draw pays fixed odds and the house tops up nothing (decision 0016), so no rule credits it.
- **`ransom`,** money paid to free someone held on the road. The road's ransom sum is opened as `obligation.agent-debt` and paid under `agent-debt`, or met by the family's means and standing (road:chain-steps-monthly), so no rule debits it.
- **`build`,** money spent on a building at home. `goal.the-house` reads land and the naira held, and the game has no building project, so no rule debits it.

One rejection code fits no rule either:

- **`no-turns`** names a month refused for an empty bank. The bank never holds the month back (turn:month-turns-on-empty-bank), so no rule returns it.

A name in a union that nothing uses is a thing a reader looks for and never finds. Each would carry a report line, a counter or a word in content that no life can show.

## Decision

**The union holds only reasons a rule uses.**

- `pot-top-up`, `ransom` and `build` are not in `Reason` or `ReasonSchema`.
- Their report lines (`line.wallet.pot-top-up`, `line.wallet.ransom`, `line.wallet.build`) are not in `REASON_LINE` or in content's words.

**The rejection codes hold only codes a rule returns.** `no-turns` is not in `RejectionCode`, in the rejection counters (`packages/content/src/analytics/analytics.data.ts`) or in content's words (`reject.no-turns`).

**A name that is no reason can make nothing.** In the money report, a total under any name outside `ReasonSchema` has a ceiling of 0. So one kobo under it names the account as suspect (wallet:ledger-report-raises-alarms).

**The house part is refused at the step.**

- A `lottery/pay` whose prize carries a house part is refused whole with `not-legal`, and never reaches a life's log (lottery:winners-paid-by-authority).
- So the server's draw check reads the `win` paid and the `ticket` taken and nothing else (lottery:money-report-checks-draws).

## Consequences

- A new reason is added only with the rule that credits or debits it, with its report line and its word. A new rejection code is added only with the rule that returns it. Each comes with a record when AGENTS.md rule 9 asks for one.
- No golden or recorded life holds any of the three, so none moves. The content's words and the simulation's code change, so the content version is sealed again (server:content-version-sealed).
- The wallet, lottery, server and goal rule pages list the reasons the union holds and no others. The engine's and the words' pages list the rejection codes it holds.

## Alternatives

- **Keep them, marked as unused.** The ledger page would have to explain names that mean nothing, and every table keyed by reason would carry them.
- **Remove them and trust the types.** The simulation cannot credit a name outside the union, but a report that gives such a name no ceiling raises nothing for a tampered total under it.
