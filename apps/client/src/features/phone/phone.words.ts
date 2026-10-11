// The phone's own words (docs/rules/world.md R-WORLD-018, 019), first drafts in the voice of
// docs/rules/text.md. Content's table wins over these, then the interface's, so each key can move
// into content to be rewritten.
import { text } from "@japacity/content";

import { formatMoney, formatNumber } from "../../shared/words/format";
import { hasWords, say, type Params } from "../../shared/words/text";

export const phoneText: Record<string, string> = {
  "phone.title": "Phone",
  "phone.apps": "Apps",
  "phone.back": "Back",
  "phone.close": "Put the phone away",
  "phone.grow": "Make the phone bigger",
  "phone.shrink": "Make the phone smaller",
  "phone.new": "Something new",
  "phone.wall.month": "Month {month}",

  "phone.app.calendar": "Calendar",
  "phone.app.bank": "Bank",
  "phone.app.chats": "Chats",
  "phone.app.japa": "Japa",
  "phone.app.papers": "Papers",
  "phone.app.jobs": "Jobs",
  "phone.app.lotto": "Lotto",
  "phone.app.bills": "Bills",
  "phone.app.news": "News",
  "phone.app.settings": "Settings",

  "phone.bank.balance": "In the bank",
  "phone.bank.cash": "Cash on you: {amount}",
  "phone.bank.also": "Also held: {amounts}",
  "phone.bank.also.bank": "{amount} in the bank",
  "phone.bank.also.cash": "{amount} in cash",
  "phone.bank.savings": "Saved for the move",
  "phone.bank.savings.line": "{shown} of {required}",
  // The figure met, and what it is for.
  "phone.bank.savings.met.fees": "{shown}. Enough for the move's fees, {required}.",
  "phone.bank.savings.met.funds": "{shown}. Enough to show the funds and pay the fees, {required}.",
  "phone.bank.savings.none": "No figure to save toward yet. A way out sets one.",
  // A plan whose way costs nothing to save for (the Gulf contract: the employer pays).
  "phone.bank.savings.paid": "Your plan costs nothing to save for. The employer pays the way.",
  "phone.bank.lines": "Lately",
  "phone.bank.lines.none": "No money moved last month.",
  "phone.bank.from": "From",
  "phone.bank.into": "Into",
  "phone.bank.how-much": "How much",
  "phone.bank.where": "Where",
  "phone.bank.quarter": "A quarter",
  "phone.bank.half": "Half",
  "phone.bank.all": "All of it",
  "phone.bank.limit": "Up to the limit",
  "phone.bank.limit.line": "The bank changes up to {amount} into foreign money for you this month.",
  "phone.bank.limit.none": "The bank has changed all it will for you this month. The FX man changes cash.",
  "phone.bank.to-bank": "Cash into the bank",
  "phone.bank.to-cash": "Bank out as cash",
  "phone.bank.nothing": "Nothing in that pocket to use.",
  "phone.bank.go": "Go on: {amount}",
  "phone.bank.change.who.bank": "At the bank",
  "phone.bank.change.who.aboki": "The FX man",
  "phone.bank.change.line": "{amount} into {currency}, at today's rate. The bank takes its charge; the FX man counts it in cash.",
  "phone.bank.change.button": "Change it",
  "phone.bank.move.who": "Your pockets",
  "phone.bank.move.line.bank": "{amount} of your cash goes into the bank.",
  "phone.bank.move.line.cash": "{amount} comes out of the bank as cash, in your hand now.",
  "phone.bank.move.button": "Move it",
  "phone.bank.changed": "Money changed",
  "phone.bank.moved": "Money moved",

  "phone.chats.family": "The family group",
  // The People row (world.md R-WORLD-020): the slots of this life, never a list of strangers.
  "phone.chats.slots": "People",
  "phone.chats.slots.line": "Partner, brothers and sisters, parents",
  "phone.chats.family.none": "The group is quiet.",
  "phone.chats.family.line": "{from}: {words}",
  "phone.chats.people": "This month",
  "phone.chats.with": "{name}",
  "phone.chats.say": "Say it",
  "phone.chats.pick": "Pick what to say",
  "phone.chats.computer": "Your talk with {name} happens when you meet. Their news reaches you here.",
  "phone.chats.moment": "{words}",

  "phone.japa.label": "Japacity",
  "phone.japa.gloss": "How ready you are to go",
  "phone.japa.none": "No plan yet",
  "phone.japa.plan": "Your plan: {route}",
  "phone.japa.others": "Other ways out",
  "phone.japa.steps": "The steps",
  "phone.japa.papers": "Papers",
  "phone.japa.official": "The full list for {route}, as it stands today",
  "phone.japa.official.free": "Free",
  "phone.japa.official-planned": "In this month's plan",
  "phone.japa.papers.line": "{held} of {count} in the box",
  "phone.japa.papers.none": "The box is empty for now.",
  "phone.japa.visa": "Visa decision",
  "phone.japa.paper-ready": "{paper} ready",
  "phone.japa.reminders": "Coming up",

  // The Papers app (R-WORLD-019): every paper with its state and the act that moves it.
  "phone.papers.title": "The box under the bed",
  "phone.papers.hint": "Calls and messages go from here. A visit opens the map.",
  "phone.papers.none": "No papers yet. A way out says which ones you need.",
  "phone.papers.pending": "Ready {when}",
  "phone.papers.valid": "Valid {when}",
  "phone.papers.not-yet": "Not yet",
  "phone.papers.visa": "Granted",
  "phone.papers.for": "Counts toward {routes}",
  "phone.papers.for.and": "{first} and {last}",
  "phone.papers.at": "At {place}",
  "phone.papers.back": "Papers",
  // A paper landing or moving, as the phone tells it (R-WORLD-030), with a paper's own words where it has them.
  "phone.papers.notices": "Papers",
  "phone.papers.notice.issued": "Your {paper} is ready.",
  "phone.papers.notice.issued.document.passport": "Your passport is ready to collect.",
  "phone.papers.notice.issued.document.transcript": "Your transcript is ready to collect.",
  "phone.papers.notice.issued.document.nmcn-verification": "The council has verified your licence.",
  "phone.papers.notice.issued.document.nursing-licence": "The council has renewed your licence.",
  "phone.papers.notice.issued.document.eca": "Your degree assessment is back.",
  "phone.papers.notice.issued-band": "Your English result is out: band {band}.",
  "phone.papers.notice.requested": "Your {paper} is on its way, ready {when}.",
  "phone.papers.notice.hastened": "Your {paper} comes sooner now, {when}.",
  "phone.papers.notice.expired": "Your {paper} has run out.",
  "phone.papers.notice.voided": "Your {paper} is no longer valid.",

  "phone.jobs.held": "Your job",
  // The raise from being noticed, and when it landed: "Raised last month" (R-ACTIVITY-013).
  "phone.jobs.raised": "Raised {when}",
  "phone.jobs.raised.unknown": "With a raise",
  "phone.jobs.side": "Side job",
  "phone.jobs.offers": "Offers",
  "phone.jobs.offers.none": "No job offers right now.",
  "phone.jobs.quit": "Quit",
  "phone.jobs.take": "Take it",
  "phone.jobs.answer-by": "Answer {when}",
  "phone.jobs.take.title": "Take the job?",
  "phone.jobs.take.button": "Take the job",
  "phone.jobs.quit.title": "Quit the job?",
  "phone.jobs.quit-side.title": "Quit the side job?",
  "phone.jobs.quit-side.line": "The side money stops this month.",
  "phone.jobs.taken": "You took the job",
  "phone.jobs.left": "You quit",

  "phone.lotto.next": "Next draw",
  "phone.lotto.offline": "Offline, the street kiosk runs its own draw",
  // R-LUCK-005: what this month's tickets cost, said once.
  "phone.lotto.month": "{count} tickets this month",
  "phone.lotto.month.one": "1 ticket this month",
  "phone.lotto.month-cost": "{amount} spent",
  "phone.lotto.won": "Your ticket {number} won.",
  "phone.lotto.lost": "None of your tickets won.",
  "phone.lotto.none-held": "You had no ticket in it.",
  "phone.lotto.winners": "Winning tickets",
  "phone.lotto.buy-where": "Tickets are sold at the kiosk.",

  "phone.bills.auto": "Taken at the month's end.",
  "phone.bills.pay": "Pay now",
  "phone.bills.notice": "{name}: {amount} due this month.",
  "phone.bills.loan.line": "This month's part, paid now. It comes off what you owe.",
  "phone.bills.loan.button": "Pay it",
  "phone.bills.held.line": "The money goes back to the lender and the funds close.",
  "phone.bills.car.line": "Clear what is behind on the car, all of it.",
  "phone.bills.car.button": "Clear it",
  "phone.bills.undertaking.line": "Pay off what is owed, all of it.",
  "phone.bills.undertaking.button": "Pay it off",
  "phone.bills.paid": "Paid",

  "phone.news.month": "{when}",

  "phone.settings.look": "Look",
  "phone.settings.sound": "Sound",
  "phone.settings.sound.on": "On",
  "phone.settings.sound.off": "Off",
  "phone.settings.graphics": "Graphics",
  "phone.settings.graphics.auto": "Let the game choose",
  "phone.settings.graphics.low": "Low",
  "phone.settings.graphics.high": "High",
  "phone.settings.graphics.when": "The city takes it the next time it opens.",
  "phone.settings.account": "Account",
};

/** Words for a phone key: content's first, then the interface's, then the phone's own drafts. */
export function phoneWords(key: string, params: Params = {}): string {
  if (text[key] !== undefined || hasWords(key)) return say(key, params);
  const template = phoneText[key] ?? key;
  return template.replace(/\{([A-Za-z][\w-]*)\}/g, (whole, name: string) => {
    const value = params[name];
    if (value === undefined) return whole;
    if (typeof value === "object") return formatMoney(value.amount, value.currency);
    return typeof value === "number" ? formatNumber(value) : value;
  });
}
