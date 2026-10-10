// Who runs the game (docs/rules/region.md, "Who runs the game"). The terms of
// play and the privacy notice read the name, the place and the address from
// here, and nowhere else in the repository spells them, so a change of
// operator is a change to this one constant.
export interface Operator {
  /** Who runs the game and answers for it. */
  readonly name: string;
  /** Where it is run from: a town and a country, never a street. */
  readonly place: string;
  /** The one address for help, privacy requests and complaints. */
  readonly email: string;
}

export const OPERATOR: Operator = { name: "Al-Ameen Ogundiran", place: "Lekki, Lagos, Nigeria", email: "social@japacity.app" };
