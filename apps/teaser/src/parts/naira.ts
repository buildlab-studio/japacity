// How the teaser writes an amount of money: as the game's cards show it, the naira sign and the digits in threes.

/** A whole number of naira as a card shows it: 2500000 is "₦2,500,000". */
export function naira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}
