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
  "activity.ask-someone-who-went.blurb": "They tell you what the route asked when they left. Things may have changed since.",
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
  "offer.agent-stop.title": "I can help",
  "offer.agent-stop.body": "“I can sort the route for you fast, and my fee is {fee}.”",
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
  "offer.agent-stop.sign.no-passport": "He says: \"No passport needed, we will arrange everything.\"",
  "offer.agent-stop.sign.pay-today": "He says pay today or someone else takes it.",
  "offer.agent-stop.sign.price-low": "His price is far below the official fees.",
  "offer.agent-stop.sign.look-office": "You asked where his office is.",
  "offer.agent-stop.sign.look-licence": "You asked for his licence number.",
  "offer.agent-stop.sign.look-name": "You checked his name with someone you know.",
  // What he says he does (R-ADVICE-013).
  "offer.agent-stop.pitch.insider": "He says he knows someone inside the office.",
  "offer.agent-stop.pitch.chaser": "He says he will chase it for you: the calls, the queues, the follow-up.",

  // The desk in the agent's office.
  "offer.agent-office.name": "The travel desk upstairs",
  "offer.agent-office.title": "Papers, moved faster",
  "offer.agent-office.body": "“I can move your papers along, and my fee is {fee}.”",
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
  "offer.agent-office.sign.no-passport": "He says: \"No passport needed, we will arrange everything.\"",
  "offer.agent-office.sign.pay-today": "He says pay today or someone else takes it.",
  "offer.agent-office.sign.price-low": "His price is far below the official fees.",
  "offer.agent-office.sign.look-office": "You saw his office. His name is on the door.",
  "offer.agent-office.sign.look-licence": "You asked for his licence number.",
  "offer.agent-office.sign.look-name": "You checked his name with someone you know.",
  "offer.agent-office.pitch.insider": "He knows someone inside the office.",

  // The chaser a friend puts you onto, about the paper of yours being made (R-ADVICE-013).
  "offer.agent-chaser.name": "A chaser your friend knows",
  "offer.agent-chaser.title": "Terna's contact",
  "offer.agent-chaser.body": "Terna sends her number: “She follows up papers for people, and her fee is {fee}.”",
  "offer.agent-chaser.who.1.name": "Hadiza",
  "offer.agent-chaser.pitch.chaser": "She will chase it for you: the calls, the queues, the follow-up.",
  "offer.agent-chaser.choice.take": "Pay her",
  "offer.agent-chaser.choice.look-office": "Ask where she works from",
  "offer.agent-chaser.choice.look-licence": "Ask for her registration",
  "offer.agent-chaser.choice.look-name": "Check her name with someone you know",
  "offer.agent-chaser.choice.decline": "Not now",
  "offer.agent-chaser.sign.cash-only": "She wants cash. No transfer.",
  "offer.agent-chaser.sign.guarantee": "She says the visa is guaranteed.",
  "offer.agent-chaser.sign.no-office": "She has no office.",
  "offer.agent-chaser.sign.no-licence": "She has no registration to give.",
  "offer.agent-chaser.sign.holds-passport": "She wants to keep your passport.",
  "offer.agent-chaser.sign.no-passport": "She says: \"No passport needed, we will arrange everything.\"",
  "offer.agent-chaser.sign.pay-today": "She says pay today or someone else takes it.",
  "offer.agent-chaser.sign.price-low": "Her price is far below the official fees.",
  "offer.agent-chaser.sign.look-office": "She works from a desk by the gate. People know her there.",
  "offer.agent-chaser.sign.look-licence": "She gives a business registration number.",
  "offer.agent-chaser.sign.look-name": "You checked her name with someone you know.",

  // What an agent would bring forward, and where from (R-ADVICE-013).
  "advice.moves": "Your {document}, from {desk}: {count} months sooner.",
  "advice.moves.one": "Your {document}, from {desk}: a month sooner.",
  "advice.moves.none": "No paper of yours is being made yet, so there is nothing to bring forward.",
  "advice.desk": "the office",
  "advice.desk.document.transcript": "the registry",
  "advice.desk.document.police-certificate": "the police station",
  "advice.desk.document.tb-certificate": "the clinic",
  "advice.desk.document.passport": "the passport office",

  // What an overpromiser leaves behind (R-ADVICE-005).
  "offer.agent-promise.name": "The agent's promise",
  "offer.agent-promise.title": "Trust me",
  "offer.agent-promise.body": "“It will all be sorted by the month I told you, just wait.”",
  "offer.agent-promise.choice.wait": "Take his word",

  // What a scammer sells after the fee (R-ADVICE-008).
  "offer.agent-papers.name": "Papers made to order",
  "offer.agent-papers.title": "Papers, made fast",
  "offer.agent-papers.body": "“The real papers are slow, so I can make them for {fee} more,” but a route that checks will refuse them, and the mark stays on your record.",
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
  "advice.tell.no-passport.name": "he said no passport was needed",
  "advice.tell.pay-today.name": "he said pay today or lose it",
  "advice.tell.price-low.name": "his price was far below the official fees",

  // The four ways in the report (R-ADVICE-001).
  "line.route.looked-into-told": "Someone who went told you about {route}. Now you know what it takes, as far as they know.",
  "line.route.looked-into-advised": "The adviser went through {route} with you, item by item.",
  "line.route.looked-into-agent": "The agent told you what {route} takes. Only the official page is sure.",
  // The motor park asked around: the drivers' word, not a page read.
  "line.route.looked-into-asked": "The drivers told you what {route} asks. Only the official page is sure.",
  "line.activity.went-told": "Someone who went told you what {route} asked when they left. Things may have moved since.",
  "line.activity.went-item": "They said you need: {item}.",
  "line.activity.went-out-of-date": "You already have this one, and it is not as they said: {item}. The rules have changed since they left.",
  "line.activity.adviser-fits": "Her reading: {route} fits you now. Nothing is missing.",
  "line.activity.adviser-missing": "Her reading: {route} does not fit yet. {count} things are missing, at least {months} months away.",
  "line.activity.adviser-item": "Missing: {item}.",

  // The agents in the report (R-ADVICE-005, 006, 009).
  "line.offer.look-office-nothing": "You asked about the office. The answer held up.",
  "line.offer.look-office-found": "You asked about the office: {tell}.",
  "line.offer.look-licence-nothing": "You asked for the licence number. He gave one, and it checked out.",
  "line.offer.look-licence-found": "You asked for the licence number: {tell}.",
  "line.offer.look-name-nothing": "You checked his name. Nobody had heard anything bad.",
  "line.offer.look-name-found": "You checked his name: {tell}.",
  "line.offer.agent-paid": "You paid {agent} {amount}. He said he would move things along.",
  "line.offer.agent-paid-nothing-waiting": "You paid {agent} {amount}. He looked, but you had no paper in line to move.",
  "line.offer.agent-chaser-paid": "You paid {agent} {amount} to follow up your papers.",
  "line.offer.agent-chaser-paid-nothing-waiting": "You paid {agent} {amount}. You had no paper in line to follow up.",
  "line.offer.agent-scam": "{agent} was a scam. {amount} gone.",
  "line.offer.agent-scam-tell": "You had seen it: {tell}.",
  "line.offer.agent-promise-broken": "The month he promised came. Nothing moved. {agent} does not pick up.",

  // The genuine mark and the fixer's work (R-ADVICE-005, 008).
  "line.document.faked": "You have the papers: {document}. They are not real, and a route that checks will know.",
  "line.document.hastened": "Your {document} is now due {month}.",

  ...itemNames,
};
