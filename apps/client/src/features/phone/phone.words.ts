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

  "phone.app.bank": "Bank",
  "phone.app.chats": "Chats",
  "phone.app.japa": "Japa",
  "phone.app.jobs": "Jobs",
  "phone.app.lotto": "Lotto",
  "phone.app.bills": "Bills",
  "phone.app.news": "News",
  "phone.app.settings": "Settings",

  "phone.bank.balance": "In the bank",
  "phone.bank.cash": "Cash on you: {amount}",
  "phone.bank.also": "Also held: {amounts}",
  "phone.bank.savings": "Saved for the move",
  "phone.bank.savings.line": "{shown} of {required}",
  "phone.bank.savings.none": "No figure to save toward yet. A way out sets one.",
  "phone.bank.lines": "Lately",
  "phone.bank.lines.none": "No money moved last month.",
  "phone.bank.from": "From",
  "phone.bank.into": "Into",
  "phone.bank.how-much": "How much",
  "phone.bank.where": "Where",
  "phone.bank.quarter": "A quarter",
  "phone.bank.half": "Half",
  "phone.bank.all": "All of it",
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
  "phone.bank.move.line.cash": "{amount} comes out of the bank as cash.",
  "phone.bank.move.button": "Move it",
  "phone.bank.changed": "Money changed",
  "phone.bank.moved": "Money moved",

  "phone.chats.family": "The family group",
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
  "phone.japa.none": "No way out yet. Keep your ears open.",
  "phone.japa.steps": "The steps",
  "phone.japa.papers": "Papers",
  "phone.japa.official": "Free, takes one slot this month. The full list for {route}, as it stands today.",
  "phone.japa.official-planned": "In this month's plan. You read the full list for {route} when the month ends.",
  "phone.japa.papers.line": "{held} of {count} in the box",
  "phone.japa.papers.title": "The box under the bed",
  "phone.japa.papers.hint": "The papers stay at home in the box under the bed. On the day of an appointment, you take them with you.",
  "phone.japa.papers.none": "The box is empty for now.",
  "phone.japa.visa": "Visa decision {when}.",
  "phone.japa.paper-ready": "{paper}: ready {when}.",
  "phone.japa.paper-pending": "Ready {when}",
  "phone.japa.paper-valid": "Valid {when}",
  "phone.japa.reminders": "Coming up",

  "phone.jobs.held": "Your job",
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
  "phone.lotto.offline": "The Friday draw runs online. Offline, the kiosk in the street has its own game.",
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

  "phone.news.month": "{when}, in short",

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
