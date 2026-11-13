# 0015. A top-up is marked and kept apart from money earned

Status: Accepted

## Context

- The engine has a way for naira to arrive from outside play: a top-up, which only the authority credits.
- The Friday draw must stay a game of money earned by playing, with its odds as published.
- It must never be played with money from outside the game.
- So the engine has to tell the two kinds of money apart in every debit, wherever a top-up comes from.

## Decision

**The mark** (wallet:top-ups-are-marked)

- The wallet keeps `marked`: the topped-up naira not yet spent. It is absent while zero.
- The view carries `wallet.marked`.

**The top-up** (decision 0005)

- The ledger has the money-in reason `top-up`.
- The pure effect and the authority command `wallet/top-up { amount }`:
  - credit the naira bank;
  - record it as a lot, a deposit a visa officer would ask about (wallet:large-deposits-record-lots);
  - raise `marked`.

**Spending**

- Every naira debit takes earned naira first. It lowers `marked` only by what it takes beyond the earned share.
- A move between pockets never touches the mark. A prize never touches it.
- A Friday ticket or the kiosk's slip is paid from earned naira only (bank plus cash, less `marked`). It is refused with `cannot-afford` when that is short (lottery:tickets-bought-with-earned-naira).

**The report**

- The ledger report takes a ceiling for `top-up` that defaults to zero (wallet:ledger-report-raises-alarms).

## Consequences

- Every debit path respects the mark, so no other code needs to know where a top-up came from.
- No server route sends `wallet/top-up` and no content entry carries the effect; a test proves it. There is no cap and no Bank screen for it, and a life with no top-up has no `marked` at all.
- Naira changed into a foreign currency and back returns as earned naira, less the bank's charge or the street's spread. With the ticket cap, that path is worth nothing to a cheat, so it is left as it is.
