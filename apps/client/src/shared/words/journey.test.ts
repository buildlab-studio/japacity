// The journey, not the wait (docs/rules/text.md R-TEXT-007): a line
// never narrates the player as idle, in dead time or waited on; it says what they do or what moves. A plain "wait for X"
// where X is truly on its way is allowed, so the scan looks only for the dead-time shapes, and the
// reworded lines are pinned so they do not come back.
import { text, textTables } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { routesUiText } from "../../features/activity/routes.words";
import { adviceUiText } from "../../features/advice/advice.words";
import { cityText } from "../../features/city/city.words";
import { sceneText } from "../../features/city/scene.words";
import { mapText } from "../../features/map/map.words";
import { phoneText } from "../../features/phone/phone.words";
import { roomText } from "../../features/setpiece/room.words";
import { turnText } from "../../features/turn/turn.words";
import { moderationText } from "../moderation/moderation.words";
import { soundText } from "../sound/sound.words";
import { jobsUiText } from "./jobs";
import { uiText } from "./ui";

// The admin tables are left out: they are the staff's tool, where a report's age in the queue is a measure, not the game's voice.
const clientTables: Record<string, Record<string, string>> = {
  ui: uiText,
  routes: routesUiText,
  advice: adviceUiText,
  city: cityText,
  scene: sceneText,
  map: mapText,
  phone: phoneText,
  room: roomText,
  turn: turnText,
  jobs: jobsUiText,
  sound: soundText,
  moderation: moderationText,
};

const every: { key: string; line: string }[] = [
  ...Object.values(textTables).flatMap((lines) => Object.entries(lines).map(([key, line]) => ({ key, line }))),
  ...Object.values(clientTables).flatMap((lines) => Object.entries(lines).map(([key, line]) => ({ key, line }))),
];
const all = new Map(every.map(({ key, line }) => [key, line]));

/** The dead-time shapes: the player idle, or something said to wait on them. A brace's name is a slot, never said. */
const DEAD_TIME = /\b(?:waiting for you|waits for you|while you wait|nothing to do but wait|dead time|still waiting|keep waiting|your life is waiting)\b/i;
const said = (line: string) => line.replace(/\{[^}]*\}/g, "");

/** Someone else's words, which keep their shape: a person speaking in character, and the signs painted in the world. */
const THEIRS: { pattern: RegExp; reason: string }[] = [
  { pattern: /^place\.[^.]+\.overheard\.\d+$/, reason: "a person's words overheard in a place (city.md R-CITY-024)" },
  { pattern: /^place\.[^.]+\.sign\.\d+$/, reason: "a sign painted in the world: KEYS CUT WHILE YOU WAIT" },
  { pattern: /^person\.amaka-nurse\.drifted$/, reason: "Amaka's own words, in quotes, when she has given up on you" },
];
const theirs = (key: string) => THEIRS.some(({ pattern }) => pattern.test(key));

/** The reworded lines, as they read: none may slide back into waiting. */
const REWORDED: Record<string, string> = {
  "city.act.look-barber.done": "Three on the bench for a cut, and the football on.",
  "city.act.look-typing.done": "Visa, ID and labour papers, typed on the spot.",
  "city.offer.here": "Asked of you here: {offer}",
  "city.asks.still": "Still yours to answer: {what}.",
  "city.asks.see": "See the rest",
  "ui.online.wait": "Too much at once. Try again in {seconds} seconds.",
  "ui.online.wait.one": "Too much at once. Try again in a second.",
  "ui.account.bot.failed": "The quick check did not go through. Let it finish, then try again.",
  "ui.account.fail.too-many": "Too many tries. Ask for a new code in a minute.",
  "ui.account.name.free": "Your first change is free. After that, changes come a while apart.",
  "ui.people.pending.mine": "You asked to {step}. It is with them now.",
  "ui.people.pending.mine.joint": "You asked to apply together on {route}. It is with them now.",
  "ui.people.drift.near": "No time together for {months} months. After {patience} with nothing, {name} moves on.",
  "ui.people.drift.near.one": "No time together this past month. After {patience} with nothing, {name} moves on.",
  "ui.people.drift.rule": "{name} gives it {patience} months without time together. No longer.",
  "ui.talk.failed.too-many": "That is a lot of talking for one hour. Say more in a while.",
  "ui.interview.waiting": "Your answers are in. Now the officer hears your partner. Back to your life.",
  "ui.world.ask-away": "Someone is asking for you at {place}.",
  "ui.world.ask-away.place.family-house": "Mama is asking for you at home.",
  "ui.world.ask-away.place.bode-thomas": "Your parcel is at the cargo office on Bode Thomas Street.",
  "ui.line.setpiece.opened.one": "{setpiece}: 1 question to answer.",
  "ui.route.school.pending": "Applied, answer by month {month}",
  "ui.offer.title": "Asked of you",
  "ui.offer.none": "Nothing else asked of you here.",
  "ui.req.not-pending": "Your {document} is already on the way",
  "ui.nudge.setpiece": "Answer what you were asked",
  "ui.nudge.meanwhile.nurse-certification.saving": "Payday first, then the certification",
  "ui.nudge.setpiece-away": "{what} is at {place}.",
  "activity.send-money.blurb": "Pick a channel and an amount. Home is counting on it.",
  "activity.get-passport.blurb": "You fill the form and pay the fee. The office has it now.",
  "activity.sit-english-test.blurb": "You book a date and sit the test. Your band comes in.",
  "activity.apply-to-school.blurb": "You send your papers to one university. Its answer comes in.",
  "activity.get-police-certificate.blurb": "You fill the form for a police character certificate and pay the fee. The station has it now.",
  "activity.request-verification.blurb": "You pay the nursing council to confirm your licence. The council writes to the board abroad.",
  "activity.enter-pool.blurb": "Your profile and score go in the pool. Each draw, the cut-off moves.",
  "offer.agent-promise.choice.wait": "Take his word",
  "line.offer.agent-paid-nothing-waiting": "You paid {agent} {amount}. He looked, but you had no paper in line to move.",
  "line.offer.agent-chaser-paid-nothing-waiting": "You paid {agent} {amount}. You had no paper in line to follow up.",
  "chapter.find-your-feet.item.heard.saving": "Payday first, then the meetup",
  "chapter.build-the-file.open": "A file is paper and legwork: a passport, a transcript, a score, a letter.",
  "chapter.build-the-file.item.passport.started": "Your passport comes {when}",
  "chapter.build-the-file.item.passport.saving": "Payday first, then the passport",
  "chapter.build-the-file.item.transcript.started": "Your transcript comes {when}",
  "chapter.build-the-file.item.transcript.saving": "Payday first, then the transcript",
  "chapter.build-the-file.item.english.started": "Your result comes {when}",
  "chapter.build-the-file.item.english.saving": "Payday first, then the test",
  "chapter.build-the-file.item.offer.started": "The school's answer comes {when}",
  "chapter.decision-day.item.tb.started": "Your TB certificate comes {when}",
  "chapter.decision-day.item.tb.saving": "Payday first, then the TB test",
  "chapter.decision-day.item.granted.nudge": "Back to your life: the embassy emails",
  "chapter.build-the-file-care.item.verification.started": "Your verification comes {when}",
  "chapter.build-the-file-care.item.verification.saving": "Payday first, then the verification",
  "chapter.build-the-file-care.item.licence.started": "Your licence comes {when}",
  "chapter.build-the-file-care.item.licence.saving": "Payday first, then the licence",
  "chapter.build-the-file-care.item.window.nudge": "Care visas are shut: watch the news",
  "chapter.build-the-file-talent.item.endorsement.started": "The endorsing body answers {when}",
  "chapter.build-the-file-points.item.eca.started": "Your ECA comes {when}",
  "chapter.build-the-file-points.item.english.started": "Your result comes {when}",
  "chapter.build-the-file-points.item.english.saving": "Payday first, then the test",
  "chapter.build-the-file-points.item.invited.nudge": "Each draw, the cut-off moves",
  "chapter.build-the-file-gulf.item.passport.started": "Your passport comes {when}",
  "chapter.build-the-file-gulf.item.passport.saving": "Payday first, then the passport",
  "chapter.build-the-file-gulf.item.medical.started": "Your medical result comes {when}",
  "chapter.build-the-file-gulf.item.medical.saving": "Payday first, then the medical",
  "chapter.decision-day-care.item.tb.started": "Your TB certificate comes {when}",
  "chapter.decision-day-care.item.tb.saving": "Payday first, then the TB test",
  "chapter.decision-day-care.item.police.started": "Your police certificate comes {when}",
  "chapter.decision-day-care.item.police.saving": "Payday first, then the police paper",
  "chapter.decision-day-care.item.granted.nudge": "Back to your life: the UK writes.",
  "chapter.decision-day-talent.open": "A chest X-ray, then the answer. The work has already done the talking.",
  "chapter.decision-day-talent.item.tb.started": "Your TB certificate comes {when}",
  "chapter.decision-day-talent.item.tb.saving": "Payday first, then the TB test",
  "chapter.decision-day-talent.item.granted.nudge": "Back to your life: the UK writes.",
  "chapter.decision-day-points.open": "Now the file they asked for. A police paper, the forms, then Canada's answer.",
  "chapter.decision-day-points.item.police.started": "Your police certificate comes {when}",
  "chapter.decision-day-points.item.police.saving": "Payday first, then the police paper",
  "chapter.decision-day-points.item.granted.nudge": "Back to your life: Canada answers",
  "chapter.decision-day-gulf.open": "A police paper, then the visa. The employer files it, and soon holds your passport.",
  "chapter.decision-day-gulf.item.police.started": "Your police certificate comes {when}",
  "chapter.decision-day-gulf.item.police.saving": "Payday first, then the police paper",
  "chapter.decision-day-gulf.item.granted.nudge": "Back to your life: the agent calls",
  "guide.uk-care.section.game": "In the game the care route starts closed and can open again with the news. A sponsor is an offer that may be real or a fraud, with signs you can read. The fees and salary lines are the real ones at the dates given, and the game keeps them fixed. The nursing council's verification comes in six to twelve months, drawn each time; the real time varies.",
  "guide.canada-points.section.game": "The game works out the score from your character each time it is asked, with a shorter points table than the real grid. The cut-off is a figure in the world that rises and falls with the news, and a healthcare cut-off reads your care score. The decision comes six months after you apply, an estimate.",
  "guide.global-talent.section.game": "In the game endorsement is a draw that your portfolio and network make more likely, and its answer comes in one to two months. After a refusal, some months pass before you can ask again. The real body reads a written case and letters, which the game does not model.",
  "guide.numbers.section.game": "Real figures are kept as they were on the day they were read, and the game's world then moves them with its own news. Chances, times and most amounts at home are estimates. Each page below says which is which.",
  "line.interview.waiting": "Your answers are in. Now the officer hears your partner.",
  "news.era-strike.in-force.body": "No transcripts, no results, until it ends.",
  "offer.parcel-shipped.away": "Your parcel is at the cargo office on Bode Thomas Street.",
  "offer.relative-sends.said.thank": "You call to thank her. The $500 lands with nothing to say where it came from, and a visa officer will ask. Ask her for a note saying it was a gift, or let it sit three months before you apply.",
  "line.people.wedding-december": "{who} said yes. The wedding is in December, when everybody is home.",
  "line.people.proposal-received": "Your partner asked: {step}. The answer is yours.",
  "line.people.drifted": "You stopped making time. {who} moved on.",
  "place.ojota.blurb": "A junction on the expressway, with the park where the buses load.",
  "place.allen-avenue.blurb": "Shops by day and a night life after dark. The ride drivers park outside both.",
  "place.obalende.blurb": "The bus park. Buses to the mainland, and a long line for the one you want.",
  "place.passport-office.blurb": "A full hall, a numbered ticket and a long bench. Come early.",
  "place.medical-centre.blurb": "Blood test, chest X-ray, eyes. The agent's people stand outside.",
  "place.mosque.blurb": "Friday prayer spills into the street, and the traffic stops.",
  "place.agent-office.blurb": "An office with a name on the door, a framed certificate and a list of names.",
  "place.road-night.blurb": "A walled yard, a lamp, people sitting on their bags. Nobody says where the next stop is.",
  "place.peckham-rye-station.blurb": "The station. Couriers outside, phones out for the next drop.",
  "place.via-domitiana.blurb": "The coast road where day labourers gather for work before sunrise.",
  "line.route.pool-entered": "Your profile for {route} went into the pool. Each draw, the cut-off moves.",
  "line.route.endorsement-refused": "The endorsing body did not back you for {route}. The letter was withdrawn. Build the work up, then ask again.",
  "line.route.road-compound": "You were taken to a compound behind a locked gate. Nobody said for how long.",
  "line.route.road-coast": "You reached the coast. There were more people than there was room in the boats.",
  "route.uk-masters.reminder.interview": "Your interview is now. The officer will see you.",
  "line.setpiece.opened": "{setpiece}: {questions} questions to answer.",
  "share.type.hustler.line": "I took the work that was there. Sleep came later.",
  "var.transcript-wait-extra.name": "Extra months for transcripts",
};

describe("the journey, not the wait", () => {
  test("[R-TEXT-007] given every words table, when each line is read, then none narrates the player as idle, in dead time or waited on, but for someone else's own words", () => {
    expect(every.length).toBeGreaterThan(5000);
    expect(every.filter(({ key, line }) => !theirs(key) && DEAD_TIME.test(said(line))).map(({ key, line }) => `${key}: ${line}`)).toEqual([]);
  });

  test("[R-TEXT-007] given the dead-time shapes, then the scan catches them, and passes a plain wait for a thing on its way", () => {
    for (const line of ["Your months are full. Your life is waiting.", "Still waiting on you: the bill.", "Visa papers, typed while you wait.", "Mama is waiting for you at home.", "Nothing to do but wait.", "Keep waiting", "Dead time at home"]) {
      expect({ line, caught: DEAD_TIME.test(said(line)) }).toEqual({ line, caught: true });
    }
    for (const line of ["Wait for your transcript, due in 2 months", "Next page in {wait}", "Payday first, then the meetup"]) {
      expect({ line, caught: DEAD_TIME.test(said(line)) }).toEqual({ line, caught: false });
    }
  });

  test("[R-TEXT-007] given the lines reworded on 11 Oct 2026, then each reads as it was reworded", () => {
    expect(Object.keys(REWORDED).length).toBeGreaterThan(100);
    expect(Object.entries(REWORDED).filter(([key, line]) => all.get(key) !== line).map(([key]) => key)).toEqual([]);
    expect(text["activity.get-passport.blurb"]).toBe(REWORDED["activity.get-passport.blurb"]);
  });
});
