// The waiting months' words (docs/rules/activity.md R-ACTIVITY-013 and 014): the route each act counts
// toward as a person says it, the labels of the things that stage the acts, and a side job's pay by level.
// First drafts in the voice of docs/rules/text.md; content's table wins over these. No imports, so the
// interface's table can join it before anything that reads words is loaded.
export const profileText: Record<string, string> = {
  // "Counts toward: the talent route" (R-ACTIVITY-013).
  "ui.counts.toward": "Counts toward: {routes}",
  "ui.counts.and": "and",
  "ui.counts.route.route.uk-masters": "the study visa",
  "ui.counts.route.route.uk-talent": "the talent route",
  "ui.counts.route.route.uk-care": "care work in the UK",
  "ui.counts.route.route.uk-skilled": "the skilled worker visa",
  "ui.counts.route.route.canada-points": "Canada's points",
  "ui.counts.route.route.gulf-contract": "the Gulf contract",
  "ui.counts.route.route.road": "the road",

  // R-ACTIVITY-014: "₦60,000 a month; ₦90,000 once your tech is good". A quality is said by its band, never its figure (R-TEXT-005).
  "ui.tier.next": "{pay}; {lift}",
  "ui.tier.lift": "{next} once {band}",
  "ui.tier.lift-needs": "{next} with {needs}",

  // The things and acts that stage them (R-WORLD-005).
  "city.thing.laptops": "Laptops",
  "city.act.post": "Post about your work",
  "city.act.talk": "Give the talk",
  "city.act.certify": "Certification",
  "city.act.exam": "Sit the exam",
};
