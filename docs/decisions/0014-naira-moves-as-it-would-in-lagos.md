# 0014. Naira is paid and received in cash or bank as it would be in Lagos

Status: Accepted

## Context

- The player sees one number for the naira (world:top-band-is-a-pill).
- The ask cards count cash and bank together (world:one-action-one-sheet). A price that then refused the bank would be a card that lies.
- Yet cash is a pocket of its own:
  - the street takes it;
  - a theft or the one-chance robbery can take it;
  - some work pays in it.
- Where money comes from and which pocket it goes into decides how much cash the character carries.

## Decision

Naira moves by how it is paid in Lagos and by its size, not by its source (wallet:money-lands-as-in-lagos and the wallet page's Pockets section).

**Paid by transfer**

- A price, a fee, a bill, a gift, a share or a flight is paid as a transfer (the debit pocket `transfer`): the bank first, then cash.

**Paid by hand on the street**

- A ride's fare, the kiosk and the bet slip, the phone stall, and an agent at the park who wants it today are paid by hand (the debit pocket `any`).
- Cash first at or under `tuning.wallet.cashUpTo` (₦10,000); the bank first above it.

**Money received**

- A naira credit from work, a gig, a tip, a prize or the prologue's earnings goes into cash at or under `tuning.wallet.cashUpTo`, and into the bank above it.
- Salary is always paid into the bank.

**Named pockets keep their names**

- A debit or credit that names a pocket uses it.
- The aboki, the street money changer, takes and gives cash only (wallet:aboki-trades-at-street-rate).

**What holds for every payment**

- Every debit is all or nothing and never touches locked money (wallet:no-pocket-below-zero).
- Abroad, a fee is paid from that currency's bank first, the tap of a phone (wallet:foreign-fee-payment-order).
- No ATM trip is needed: the Bank app's move between pockets (`wallet/move`) is free and has no limit. It stands for the ATM and the POS stand.

## Consequences

- A life does not carry hundreds of thousands in cash for a robbery to take, as nobody in Lagos does today. The cash it holds comes from gigs, wins and the street.
- The player sees one number. The order decides only how much cash the character carries.
- The game names no real money app: the phone's Bank app is the game's own.
- No pocket goes below zero. A robbery's forced transfer is not modelled beyond what activity:one-chance-bus-robbery takes from the bank.
