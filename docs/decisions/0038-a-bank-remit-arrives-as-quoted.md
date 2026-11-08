# 0038. A bank remit arrives as quoted

Status: Accepted

## Context

Sending money home by the bank waits in the bank's queue and arrives the next month (abroad-money:remit-sends-money-home). The send sheet quotes the naira that will arrive on every channel (abroad-money:remit-quote-is-shared). Worked out on the day the remit leaves the queue, the naira would move with the rate in between, and what arrives would not be what was quoted. A quote the player cannot trust is worse than no quote.

## Decision

- **A bank remit's naira is fixed on the day it is sent,** at that day's official rate, after the bank's fee. The queued conversion carries it as `received` (`QueuedConversion` in the engine's types, read by the PlayerView's `queued`), and the month it is ready credits exactly that.
- **A purchase of foreign money at home keeps the rate of the day it arrives** (wallet:bank-queue-delays-purchases). It carries no `received`, and the queue settles it as before.
- **The informal channel's loss is the only gap** between a quote and what arrives.
- The change rides a content raise, so a life carries its own version's rule until it moves up.

## Consequences

- What the sheet quotes for the bank is what the home pocket gets, whatever the rate does by the next month.
- `received` is optional, so a queued conversion with none is settled at the day's rate; only a bank remit queued under the raised version carries it.
- The view's `queued` entries gain one optional field; a client that ignores it shows the same queue.
