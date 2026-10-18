// The soft tints by kind of act (docs/design/09-the-lively-layer.md, section 2): food peach, study blue, money green, body
// lilac, people rose; anything else the sheet's own. Written out whole so Tailwind finds each class.
export type Tint = "food" | "study" | "money" | "body" | "people" | "plain";

export const TINTS: Readonly<Record<Tint, string>> = {
  food: "bg-tint-food",
  study: "bg-tint-study",
  money: "bg-tint-money",
  body: "bg-tint-body",
  people: "bg-tint-people",
  plain: "bg-tint-plain",
};
