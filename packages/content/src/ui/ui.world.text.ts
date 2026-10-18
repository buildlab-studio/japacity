// The world's own words (docs/rules/world.md), in the voice of docs/rules/text.md.
export const uiWorldText: Record<string, string> = {
  "ui.world.end-month": "Sleep",
  "ui.world.map": "Map",
  "ui.world.phone": "Phone",
  "ui.world.whole": "See the whole place",
  // The round button that turns a wide home a quarter round.
  "ui.world.other-side": "See another side",
  "ui.world.not-now": "Not now",
  "ui.world.close": "Close",
  "ui.world.left": "{amount} left",
  "ui.world.left-due": "{left} left, {due} due at the month's end",
  // A priced act's button and the balance under it (world:one-action-one-sheet): the act and its price, the balance before struck and after.
  "ui.act.priced": "{act} · {price}",
  "ui.act.balance": "{before} now, {after} after",
  "ui.world.due": "{due} due at the month's end",
  // The body on the band, only when it complains (quality:body-belly-and-energy): a word, never a number.
  "ui.body.hungry": "Hungry",
  "ui.body.tired": "Tired",
  "ui.body.both": "Hungry, tired",
  // What an act does, in words, beside the time it takes (world:one-action-one-sheet; quality:body-belly-and-energy: the body in words only).
  "ui.world.does": "Does",
  "ui.act.does.fills": "fills you",
  "ui.act.does.rests": "rests you",
  "ui.act.does.lifts": "lifts you",
  "ui.act.does.skill": "+{amount} {skill}",
  "ui.world.short": "{amount} short",
  "ui.world.short-label": "Short",
  "ui.world.costs": "Costs",
  "ui.world.after": "After",
  "ui.world.free": "Free",
  "ui.world.month-of": "Month {month}",
  "ui.world.clock": "{years} yrs {months} mo",
  "ui.world.age": "{years} yrs {months} mo",
  "ui.world.show-more": "Show more",
  "ui.world.show-less": "Show less",
  "ui.world.coming": "{what}, {when}",
  // The whole list from the chip (world:top-band-is-lively-pill): soonest first, each as months away.
  "ui.world.coming-up": "Coming up",
  "ui.world.coming.birthday": "Birthday, {age}",
  "ui.world.coming.age-limit": "The age limit for {route}",
  "ui.world.coming.rent": "The room's rent, {amount}",
  // text:show-then-tell: the box says the months once; the note beside the thing is two or three words.
  "ui.world.coming.months": "months",
  "ui.world.coming.months.one": "month",
  "ui.world.coming.now": "Now",
  "ui.world.coming.note.offer": "To answer",
  "ui.world.coming.note.paper": "On its way",
  "ui.world.coming.note.visa": "Visa decision",
  "ui.world.coming.note.plan": "Your plan",
  "ui.world.coming.note.rent": "A year's rent",
  "ui.world.ask-of": "{n} of {count}",
  "ui.world.ask-next": "Next",
  "ui.world.ask-back": "Back",

  "ui.world.planned": "{what}: planned.",
  // activity:now-acts-and-month-acts: the button that closes the place's answer to an act done at once.
  "ui.world.done": "Done",
  "ui.world.counts-at-end": "Counts when the month ends",
  // activity:now-acts-spend-half-days: the time an act done at once takes, in a person's words, never a number of days.
  "ui.world.takes": "Takes",
  "ui.world.time.morning": "A morning",
  "ui.world.time.day": "A day",
  "ui.world.time.weekend": "A weekend",
  "ui.world.time.half-week": "Half a week",
  "ui.world.time.week": "A week",
  "ui.world.depart-line": "The visa is in your passport. Board, and the next place is {country}.",
  "ui.world.deposit-line": "{school} holds your place on {route} once the deposit is paid. It goes from the naira in the bank.",
  "ui.world.full": "Free time all used: stop one in the Calendar",
  // A thing started carries on each month until it is stopped (world:things-are-tappable-models, world:month-acts-carry-on): its chip says so, with a stop.
  "ui.world.thing.planned": "Ongoing",
  "ui.world.stop": "Stop",
  "ui.world.stop-act": "Stop {what}",
  // The bag's Go home in the room abroad (return:standing-by-return-shape, return:return-reopens-home-charges; place:view-carries-way-home): the shape the return
  // would take today in one line, what ends and what waits as chips, the fare on the one button.
  "ui.world.go-home": "Go home",
  "ui.world.go-home.title.assisted": "Assisted return",
  "ui.world.go-home.button.assisted": "Take the ticket",
  "ui.world.go-home.line.by-choice": "You would land home by choice, and people will still ask why.",
  "ui.world.go-home.line.with-papers": "You would land home with your papers, and the door here stays open.",
  "ui.world.go-home.line.broke": "You would land home with the fare and not much more.",
  "ui.world.go-home.line.assisted": "The agency books the flight, and you go home with what you have.",
  "ui.world.go-home.line.removed": "You would be sent home.",
  "ui.world.go-home.line.none": "No way home today: the fare cannot be paid while your status here holds.",
  "ui.world.go-home.status": "Your status here ends",
  "ui.world.go-home.family": "The family house takes you back",
  "ui.world.go-home.standing.up": "Standing at home rises",
  "ui.world.go-home.standing.same": "Standing at home holds",
  "ui.world.go-home.standing.down": "Standing at home falls",
  "ui.world.go-home.december": "December fare",
  "ui.world.go-home.short": "Short of the fare",
  "ui.world.go-home.none": "No way home today",

  "ui.nudge.setpiece": "Answer what you were asked",
  "ui.nudge.offer": "Answer the person asking",
  "ui.nudge.report": "Read the month's news",
  "ui.nudge.dues": "Find {due} this month: {held} held",
  "ui.nudge.dues-visa": "Find {due} or lose your visa",
  "ui.nudge.better-job": "Look at the board for better work",
  // Nothing can be paid and the step is a ride away: a free step on foot, at most eight words.
  "ui.nudge.broke.home": "No fare: walk home",
  "ui.nudge.broke.racks": "No fare: work the racks",
  "ui.nudge.broke.job": "No fare: find work nearby",
  "ui.nudge.broke.wait": "No fare: end the month",
  // The care file counts the certificate (route-gates:care-route-needs-verification): named while she can pay it, else the gap.
  "ui.nudge.meanwhile.nurse-certification": "Sit the nursing certification at the clinic",
  "ui.nudge.meanwhile.nurse-certification.short": "Find {amount} more for the certification",
  "ui.nudge.meanwhile.nurse-certification.saving": "Payday first, then the certification",
  "ui.nudge.meanwhile.open-source": "Share your code at the hub",
  "ui.nudge.meanwhile.tech-posts": "Post what you know, at the laptops",
  "ui.nudge.meanwhile.be-noticed": "Get noticed: ask at the jobs board",
  // activity:now-acts-and-month-acts: an act done at once whose answer comes with the month.
  "ui.nudge.done-now": "Done. The answer is due this month.",
  "ui.nudge.hunt-planned": "Applied for better pay. Live the month.",
  // A chapter with every item met closes when the page turns.
  "ui.nudge.chapter-done": "That brief is done. Live the month.",
  // A set piece staged elsewhere waits there; the player goes to it (world:one-action-one-sheet).
  "ui.nudge.setpiece-away": "{what} is at {place}.",
  "ui.nudge.end": "Live the month, or sleep",
  // The world's night (clock:game-day-on-real-time; decision 0011): the bed's Sleep turns the month.
  "ui.nudge.night": "Night. Go to bed",
  // activity:spent-body-refuses-acts: where an act's button was, once the body is spent.
  "ui.act.spent": "You are spent. Sleep.",
  // The first night of a life, told once on a small card before the first sleep (world:sleep-ends-the-month).
  "ui.night.first": "Each night you sleep is a month of your life.",
  "ui.night.first.ok": "Sleep",
  "ui.night.first.title": "A night, a month",
  "ui.night.first.later": "Not yet",
  // The bed's timed sleep (world:sleep-ends-the-month): the chip under the band, the button that wakes, and the corner's
  // words when a sleep is cut short (the night still to be had after dark; by day, only that you are up).
  "ui.sleep.chip": "Asleep · tap to wake",
  "ui.sleep.wake": "Wake up",
  "ui.sleep.woke": "Up again. The night is still yours.",
  "ui.sleep.woke.day": "Up again.",
  // The news has closed every way out at once, as the pandemic does. Japa says when it opens.
  "ui.nudge.closed.every": "Every route is closed for now",
};
