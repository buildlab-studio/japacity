// The waiting months' words (activity:waiting-months-build-profile and activity:side-jobs-pay-by-tier): the route each act counts toward as a
// person says it, the labels of the things that stage the acts, and a side job's pay by level. In the voice of
// docs/rules/text.md.
export const uiProfileText: Record<string, string> = {
  // "Counts toward: the talent route" (activity:waiting-months-build-profile).
  "ui.counts.toward": "Counts toward: {routes}",
  "ui.counts.and": "and",
  "ui.counts.route.route.uk-masters": "the study visa",
  "ui.counts.route.route.uk-talent": "the talent route",
  "ui.counts.route.route.uk-care": "health care in the UK",
  "ui.counts.route.route.uk-skilled": "the skilled worker visa",
  "ui.counts.route.route.canada-points": "Canada's points",
  "ui.counts.route.route.gulf-contract": "the Gulf contract",
  "ui.counts.route.route.road": "the road",

  // activity:side-jobs-pay-by-tier: "₦60,000 a month; ₦90,000 once your tech is good". A quality is said by its band, never its figure (text:bands-not-figures).
  "ui.tier.next": "{pay}; {lift}",
  "ui.tier.lift": "{next} once {band}",
  "ui.tier.lift-needs": "{next} with {needs}",
  // A tier that asks months across the trade's jobs: "₦120,000 once your English is excellent and you have two years in the trade".
  "ui.tier.trade-months": "you have {time} in the trade",

  // The things and acts that stage them (world:things-are-tappable-models).
  "city.thing.laptops": "Laptops",
  "city.act.post": "Post about your work",
  "city.act.talk": "Give the talk",
  "city.act.exam": "Sit the exam",
};
