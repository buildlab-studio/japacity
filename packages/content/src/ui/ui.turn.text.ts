// The month's own words in the world (world:month-acts-carry-on, world:month-end-results-sheet): the Calendar app and the results, in
// the voice of docs/rules/text.md.
export const uiTurnText: Record<string, string> = {
  "turn.month.label": "Month {month}",
  "turn.month.title": "This month",
  "turn.month.free": "Free time",
  "turn.month.working": "Working: {job}",
  "turn.month.side": "Side job: {job}",
  "turn.month.hint": "Tap a thing in the world to start something. It carries on each month until you stop it.",
  "turn.month.end": "Next month",
  // The Calendar app (world:top-band-is-lively-pill, world:month-acts-carry-on): the month on the phone, in order.
  "turn.calendar.work": "Work",
  // What carries on into next month until it is stopped, and a month held by a burial or a stay in hospital (world:month-acts-carry-on).
  "turn.calendar.carrying": "Carrying on",
  "turn.calendar.done": "Done this month",
  "turn.calendar.chores.cook": "Cooked: {amount} less this month",
  "turn.calendar.chores.water": "Fetched water: {amount} less this month",
  "turn.calendar.chores.both": "Cooked and fetched water: {amount} less this month",
  "turn.calendar.chores.cooked": "Cooked for the week",
  "turn.calendar.chores.drum": "The drum is full",
  // The month's bus pass (place:country-pass-covers-ways): the bus asks nothing until the month ends.
  "turn.calendar.pass": "Bus pass bought: the bus is free till the month ends",
  // Calgary's transit pass and Dubai's zone pass (place:country-pass-covers-ways): each covers the bus and the train.
  "turn.calendar.pass.country.canada": "Transit pass bought: the bus and the CTrain are free till the month ends",
  "turn.calendar.pass.country.uae": "Zone pass bought: the bus and the metro are free till the month ends",
  "turn.calendar.at": "At {place}",
  // Where a dated ask is attended when no place of the city stages it (world:top-band-is-lively-pill).
  "turn.calendar.where.offer.village-burial": "In the village",
  // home:compound-room-is-a-home: the room's year falls due at this month's end and is not held.
  "turn.month.rent-short": "Rent {amount} due this month. You hold {held}.",

  "turn.results.title": "The month is done",
  "turn.results.birthday": "You turned {years} this month.",
  "turn.results.kept": "Kept this month",
  "turn.results.lost": "Down this month",
  "turn.results.nothing-moved": "Nothing moved",
  "turn.results.story": "This month",
  "turn.results.draw": "Draw {draw}",
  "turn.results.draw-matched": "One of yours came in",
  // The month the Friday draw's result comes, a player who held tickets in it and won nothing is told so (lottery.md
  // lottery:draw-result-on-front-page).
  "turn.results.draw-missed": "Your tickets did not win.",
  "turn.results.draw-missed.one": "Your ticket did not win.",
  "turn.results.savings": "Saved for the move",
  "turn.results.savings-line": "{shown} of {required}",
  "turn.results.ready": "Ready to move",
  "turn.results.news": "The rest of the month's news is on your phone, in News.",
  "turn.results.back": "Back to {place}",
};
