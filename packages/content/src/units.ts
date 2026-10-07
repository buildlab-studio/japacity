// The pages give money in naira, pounds, dollars, Canadian dollars, dirhams and
// euros, and chances in percent. Content holds the smallest unit of each, and
// basis points. These keep the tables readable without a decimal literal. A
// percent with a fraction (2.5%) is written straight in basis points instead.

/** Naira to kobo. */
export function naira(whole: number): number {
  return whole * 100;
}

/** Pounds to pence. */
export function pounds(whole: number): number {
  return whole * 100;
}

/** Dollars to cents. */
export function dollars(whole: number): number {
  return whole * 100;
}

/** Canadian dollars to cents. */
export function cad(whole: number): number {
  return whole * 100;
}

/** Dirhams to fils. */
export function aed(whole: number): number {
  return whole * 100;
}

/** Euros to cents. */
export function euros(whole: number): number {
  return whole * 100;
}

/** A whole percent to basis points. */
export function pct(whole: number): number {
  return whole * 100;
}
