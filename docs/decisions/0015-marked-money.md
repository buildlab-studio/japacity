# 0015. Marked money: a top-up is kept apart from money earned

Status: Accepted

## Context

Real money could top up a life's naira. The Friday draw must stay a game of money earned by playing, with its odds as published, and must never be played with paid money. The engine has to tell the two apart in every debit, whatever takes the payment.

## Decision

- The wallet keeps `marked`, the topped-up naira not yet spent, absent while zero; the view carries `wallet.marked` (wallet:top-ups-are-marked).
- The ledger has the money-in reason `top-up`. The pure effect and the authority command `wallet/top-up { amount }` credit the naira bank, record a lot and raise `marked` (decision 0005).
- Every naira debit takes earned naira first and lowers `marked` only by what it takes beyond the earned share; a move between pockets never touches it; a prize never touches it.
- A Friday ticket or the kiosk's slip is paid from earned naira only (bank plus cash less `marked`), refused with `cannot-afford` when that is short (lottery:tickets-bought-with-earned-naira).
- The ledger report takes a ceiling for `top-up` that defaults to zero (wallet:ledger-report-raises-alarms).

## Consequences

- Switching top-ups on is a route and two screens, not a change to every debit path.
- No server route sends `wallet/top-up` and no content entry carries the effect (a test proves it); there is no cap and no Bank screen for it, and a life with no top-up is unchanged.
- Naira changed into a foreign currency and back comes back as earned naira less the bank's charge or the street's spread; with the ticket cap, that path is worth nothing to a cheat and is left as it is.
