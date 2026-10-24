# 0014. Naira is paid and lands as it would in Lagos

Status: Accepted

## Context

The player sees one number for the naira (world:top-band-is-a-pill) and the ask cards count cash and bank together (world:one-action-one-sheet); a price that then refused the bank would be a card that lies. Yet cash is a pocket of its own: the street takes it, a theft or the one-chance robbery can take it, and some work pays in it. Where money comes from and where it lands decides what cash is on the character.

## Decision

Naira moves by how it is paid in Lagos and by its size, not by its source (wallet:money-lands-as-in-lagos and the page's Pockets section):

- **A transfer.** A price, a fee, a bill, a gift, a share or a flight is paid as a transfer (the debit pocket `transfer`): the bank first, then cash.
- **The street.** A ride's fare, the kiosk and the bet slip, the phone stall, and an agent at the park who wants it today are paid by hand (the debit pocket `any`): cash first at or under `tuning.wallet.cashUpTo` (₦10,000) and the bank first above it.
- **What lands.** A naira credit of work, a gig, a tip, a prize or the prologue's earnings lands in cash at or under `tuning.wallet.cashUpTo` and in the bank above it; salary always lands in the bank.
- **Named pockets keep their names.** A debit or credit that names a pocket uses it; the aboki, the street money changer, takes and gives cash only (wallet:aboki-trades-at-street-rate).
- Every debit is all or nothing and never touches locked money (wallet:no-pocket-below-zero). Abroad a fee is that currency's bank first (wallet:foreign-fee-payment-order), the tap of a phone.
- No ATM trip is needed: the Bank app's move between pockets (`wallet/move`) is free and uncapped, standing for the ATM and the POS stand.

## Consequences

- A life does not carry hundreds of thousands in cash for a robbery to take, as nobody in Lagos does today, and the cash it holds comes from gigs, wins and the street.
- The player sees one number; the order decides only what cash is on the character.
- The game names no real money app: the phone's Bank app is the game's own.
- No pocket goes below zero, and a robbery's forced transfer is not modelled beyond what activity:one-chance-bus-robbery takes from the bank.
