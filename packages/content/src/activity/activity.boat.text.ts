// The boat work at Makoko's net shed (activity:boat-work-at-the-net-shed), the catch (activity:catch-drawn-each-month) and the
// match (activity:watch-the-match), in the voice of docs/rules/text.md: Sewanu speaks Pidgin with an Egun greeting, and the
// match is "the match", with no club, league or broadcaster.
export const activityBoatText: Record<string, string> = {
  "activity.job-canoe-crew.name": "Third in the canoe",
  "activity.job-canoe-crew.blurb": "Out before light under the bridge with Sewanu's crew. You sort the fish and learn to throw, and he shares the catch.",
  "activity.job-own-canoe.name": "Your own canoe",
  "activity.job-own-canoe.blurb": "Your canoe, your net and your catch. Out before light, back by mid-morning.",
  "activity.mend-nets.name": "Mend nets",
  "activity.mend-nets.blurb": "Afternoons at the shed with a needle, mending what the water tore.",
  "activity.canoe-taxi.name": "The taxi canoe",
  "activity.canoe-taxi.blurb": "After the dawn's fishing, your canoe carries people between the houses and the shore.",

  "activity.ask-fisherman.name": "Ask about boat work",
  "activity.ask-fisherman.button": "Ask",
  "activity.ask-fisherman.blurb": "Sewanu mends his net at the shed. The men here go out before light.",
  "activity.take-net-work.name": "Mend nets at the shed",
  "activity.take-net-work.button": "Start",
  "activity.take-net-work.blurb": "Sewanu's nets need hands in the afternoon. Quiet work in the shade.",
  "activity.buy-canoe.name": "Buy a canoe",
  "activity.buy-canoe.button": "Buy",
  "activity.buy-canoe.blurb": "A second hand canoe from the shed, paid from your savings. From next month the catch is yours.",
  "activity.start-canoe-taxi.name": "Carry passengers",
  "activity.start-canoe-taxi.button": "Start",
  "activity.start-canoe-taxi.blurb": "Your canoe carries people between the houses and the shore in the afternoon.",
  "activity.watch-match.name": "Watch the match",
  "activity.watch-match.button": "Watch",
  "activity.watch-match.blurb": "A bench at the viewing centre, the fan going and the generator outside.",

  // The place's answers (activity:now-acts-and-month-acts). Sewanu's offer the first time; after that he talks.
  "line.activity.ask-fisherman.now.offer": "Sewanu puts the net down and says: kudo, you want learn the water? Third for my canoe dey free.",
  "line.activity.ask-fisherman.now": "Sewanu says: kudo. The water no dey give much this season.",
  "line.activity.take-net-work.now": "Sewanu hands you a needle and a heap of net: start from the torn side.",
  "line.activity.buy-canoe.now": "Sewanu runs his hand along the hull and says: she go carry you well. The canoe is yours.",
  "line.activity.start-canoe-taxi.now": "The boys at the pier shout come, come, and your first passenger steps in.",
  // The first watch names Sewanu and the boat work (activity:watch-the-match).
  "line.activity.watch-match.now.first": "A man on the bench says Sewanu at the net shed needs a third in his canoe.",
  "line.activity.watch-match.now": "The room shouts at every chance, and the fan pushes the heat around.",

  // The month's pay of a boat rung, led by the catch's word (activity:catch-drawn-each-month).
  "line.activity.salary.catch.good": "A good catch: {amount} for your share.",
  "line.activity.salary.catch.fair": "A fair catch: {amount} for your share.",
  "line.activity.salary.catch.lean": "A lean month on the water: {amount} for your share.",
  // The same as payday's label on the results, beside the share's figure.
  "line.activity.salary.catch.good.label": "A good catch",
  "line.activity.salary.catch.fair.label": "A fair catch",
  "line.activity.salary.catch.lean.label": "A lean month on the water",
};
