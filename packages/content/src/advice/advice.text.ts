// The words of docs/rules/advice.md: the friend, the adviser, the agents and
// what they leave behind, and the report lines of the four ways. Bad news is
// told straight (R-ADVICE-009). The names of the people are listed against
// these keys in person.recurring.data.ts.
import { routeText } from "../route/route.text";

/** A checklist item named in a report line: `<route>.item.<item>.name`, the same words the route uses. */
const itemNames: Record<string, string> = Object.fromEntries(
  Object.entries(routeText)
    .filter(([key]) => /^route\.[a-z0-9-]+\.item\.[a-z0-9-]+$/.test(key))
    .map(([key, words]) => [`${key}.name`, words]),
);

export const adviceText: Record<string, string> = {
  // The friend (R-ADVICE-003).
  "activity.ask-someone-who-went.name": "Ask someone who went",
  "activity.ask-someone-who-went.blurb": "Free. They tell you what the route asked when they left. Things may have changed since.",
  // The adviser (R-ADVICE-004).
  "activity.see-adviser.name": "See the licensed adviser",
  "activity.see-adviser.blurb": "She reads your whole file and tells you the truth about every route you know of. It costs money.",
  // The two ways to an agent (R-ADVICE-005, 010).
  "activity.see-agent-stop.name": "Talk to the agents at the stop",
  "activity.see-agent-stop.blurb": "Men at the bus stop say they can sort your papers fast. Some can.",
  "activity.see-agent-office.name": "Go up to the travel desk",
  "activity.see-agent-office.blurb": "A desk in a shared office upstairs, with a name on the door.",

  // The agent at the stop.
  "offer.agent-stop.name": "An agent at the stop",
  "offer.agent-stop.title": "A man at the stop says he can help",
  "offer.agent-stop.body": "He says he can sort the route for you, fast. His fee is {fee}. Look before you pay.",
  "offer.agent-stop.who.1.name": "Efosa",
  "offer.agent-stop.who.2.name": "Timi",
  "offer.agent-stop.who.3.name": "Nsikak",
  "offer.agent-stop.choice.take": "Pay him",
  "offer.agent-stop.choice.look-office": "Ask where his office is",
  "offer.agent-stop.choice.look-licence": "Ask for his licence number",
  "offer.agent-stop.choice.look-name": "Check his name with someone you know",
  "offer.agent-stop.choice.decline": "Walk away",
  "offer.agent-stop.sign.cash-only": "He wants cash. No transfer.",
  "offer.agent-stop.sign.guarantee": "He says the visa is guaranteed.",
  "offer.agent-stop.sign.no-office": "He has no office. He tells a story about a cousin's place and meets you at the stop.",
  "offer.agent-stop.sign.no-licence": "He has no licence number to give.",
  "offer.agent-stop.sign.holds-passport": "He wants to keep your passport.",
  "offer.agent-stop.sign.pay-today": "He says pay today or the slot goes.",
  "offer.agent-stop.sign.price-low": "His price is far below the official fees.",
  "offer.agent-stop.sign.friend-warned": "Sounds like the one your friend warned about.",
  "offer.agent-stop.sign.look-office": "You asked where his office is.",
  "offer.agent-stop.sign.look-licence": "You asked for his licence number.",
  "offer.agent-stop.sign.look-name": "You checked his name with someone you know.",

  // The desk in the agent's office.
  "offer.agent-office.name": "The travel desk upstairs",
  "offer.agent-office.title": "The travel desk upstairs",
  "offer.agent-office.body": "He says he can move your papers along. His fee is {fee}.",
  "offer.agent-office.who.1.name": "Ameh",
  "offer.agent-office.choice.take": "Pay him",
  "offer.agent-office.choice.look-office": "Ask to see his office",
  "offer.agent-office.choice.look-licence": "Ask for his licence number",
  "offer.agent-office.choice.look-name": "Check his name with someone you know",
  "offer.agent-office.choice.decline": "Leave",
  "offer.agent-office.sign.cash-only": "He wants cash. No transfer.",
  "offer.agent-office.sign.guarantee": "He says the visa is guaranteed.",
  "offer.agent-office.sign.no-office": "He has no office of his own.",
  "offer.agent-office.sign.no-licence": "He has no licence number to give.",
  "offer.agent-office.sign.holds-passport": "He wants to keep your passport.",
  "offer.agent-office.sign.pay-today": "He says pay today or the slot goes.",
  "offer.agent-office.sign.price-low": "His price is far below the official fees.",
  "offer.agent-office.sign.friend-warned": "Sounds like the one your friend warned about.",
  "offer.agent-office.sign.look-office": "You saw his office. His name is on the door.",
  "offer.agent-office.sign.look-licence": "You asked for his licence number.",
  "offer.agent-office.sign.look-name": "You checked his name with someone you know.",

  // What an overpromiser leaves behind (R-ADVICE-005).
  "offer.agent-promise.name": "The agent's promise",
  "offer.agent-promise.title": "The agent's promise",
  "offer.agent-promise.body": "He says it will all be sorted by the month on this card. You wait.",
  "offer.agent-promise.choice.wait": "Keep waiting",

  // What a scammer sells after the fee (R-ADVICE-008).
  "offer.agent-papers.name": "Papers made to order",
  "offer.agent-papers.title": "He has another offer",
  "offer.agent-papers.body": "The real papers are slow, he says. He can make them for {fee} more. A route that checks will refuse them, and the mark stays on your record.",
  "offer.agent-papers.choice.transcript": "A transcript",
  "offer.agent-papers.choice.tb-certificate": "A TB certificate",
  "offer.agent-papers.choice.medical": "A medical",
  "offer.agent-papers.choice.decline": "Say no",

  // The tells, as a report line names them.
  "advice.tell.cash-only.name": "he wanted cash only",
  "advice.tell.guarantee.name": "he guaranteed the visa",
  "advice.tell.no-office.name": "he had no office",
  "advice.tell.no-licence.name": "he had no licence number",
  "advice.tell.holds-passport.name": "he wanted to keep your passport",
  "advice.tell.pay-today.name": "he said pay today or lose the slot",
  "advice.tell.price-low.name": "his price was far below the official fees",
  "advice.tell.friend-warned.name": "a friend had warned about one like him",

  // The four ways in the report (R-ADVICE-001).
  "line.route.looked-into-told": "Someone who went tells you about {route}. Now you know what it takes, as far as they know.",
  "line.route.looked-into-advised": "The adviser goes through {route} with you. Now you know what it takes.",
  "line.route.looked-into-agent": "The agent tells you what {route} takes. Only the official page is sure.",
  "line.activity.went-told": "Someone who went tells you what {route} asked when they left. Things may have moved since.",
  "line.activity.went-item": "They say you need: {item}.",
  "line.activity.went-out-of-date": "You already have this one, and it is not as they said: {item}. The rules have changed since they left.",
  "line.activity.adviser-fits": "The adviser says {route} fits you now. Nothing is missing.",
  "line.activity.adviser-missing": "The adviser says {route} does not fit yet. {count} things are missing, at least {months} months away.",
  "line.activity.adviser-item": "Missing: {item}.",

  // The agents in the report (R-ADVICE-005, 006, 009).
  "line.offer.look-office-nothing": "You ask about the office. The answer holds up.",
  "line.offer.look-office-found": "You ask about the office: {tell}.",
  "line.offer.look-licence-nothing": "You ask for the licence number. He gives one, and it checks out.",
  "line.offer.look-licence-found": "You ask for the licence number: {tell}.",
  "line.offer.look-name-nothing": "You check his name. Nobody has heard anything bad.",
  "line.offer.look-name-found": "You check his name: {tell}.",
  "line.offer.agent-paid": "You pay {agent} {amount}. He says he will move things along.",
  "line.offer.agent-paid-nothing-waiting": "You pay {agent} {amount}. He looks, but no paper of yours is waiting to be moved.",
  "line.offer.agent-scam": "{agent} was a scam. {amount} gone.",
  "line.offer.agent-scam-tell": "You had seen it: {tell}.",
  "line.offer.agent-promise-broken": "Month {month} has come. Nothing has moved. {agent} does not pick up.",

  // The genuine mark and the fixer's work (R-ADVICE-005, 008).
  "line.document.faked": "You have the papers: {document}. They are not real, and a route that checks will know.",
  "line.document.hastened": "Your {document} now comes in month {month}.",

  ...itemNames,
};
