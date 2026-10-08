// Words for the people around the character: the slots, the bonds, courting,
// proposals, the invite card, the stand-in, the interview, the undertaking and
// the conversation in preset phrases. First drafts in the voice of
// docs/rules/text.md, to be rewritten. Kept apart from ui.ts so the
// people screens can be read in one place; ui.ts takes them in whole.
import { text } from "@japacity/content";

export const peopleText: Record<string, string> = {
  "ui.tab.people": "People",
  "ui.people.title": "Your people",
  "ui.people.intro": "Partner, siblings, parents. A friend who plays can take a slot. The game plays anyone a friend has not taken.",

  // The slots (R-PEOPLE-007)
  "ui.people.slot.partner": "Partner",
  "ui.people.slot.sibling": "Sibling",
  "ui.people.slot.mother": "Mother",
  "ui.people.slot.father": "Father",
  "ui.people.slot.state.empty": "Nobody yet",
  "ui.people.slot.state.computer": "Played by the game",
  "ui.people.slot.state.invited": "Your card is out",
  "ui.people.slot.state.player": "A friend",
  "ui.people.slot.state.stand-in": "A stand-in answers while they are away",
  "ui.people.parent.name.mother": "Your mother",
  "ui.people.parent.name.father": "Your father",
  "ui.people.parent.blurb.mother": "At home, as she has always been. She calls when there is news.",
  "ui.people.parent.blurb.father": "At home, as he has always been. He calls when there is news.",
  "ui.people.mark.computer": "Computer",
  "ui.people.mark.player": "Player",
  "ui.people.mark.stand-in": "Stand-in",
  "ui.people.mark.computer.long": "A computer character, not a player.",
  "ui.people.who.player": "your friend",
  "ui.people.who.partner": "your partner",
  "ui.people.who.sibling": "your sibling",
  "ui.people.sibling.friend": "A friend took your card. This sibling is a real player now.",
  "ui.people.sibling.facts.home": "At home.",
  "ui.people.sibling.facts.abroad": "In {country}, on {status}.",
  "ui.people.sibling.facts.abroad-plain": "In {country}.",
  "ui.people.sibling.older": "{name}, the older one",
  "ui.people.sibling.younger": "{name}, the younger one",
  "ui.people.sibling.middle": "{name}, the middle one",
  "ui.people.sibling.other": "{name} ({number})",
  "ui.people.sibling.invite": "Ask a friend to be this sibling",

  // Candidates (R-PEOPLE-009, R-PEOPLE-054)
  "ui.people.candidates": "Someone to see",
  "ui.people.candidates.none": "Nobody new for now. People come into your life as it moves.",
  "ui.people.court": "Start seeing {name}",
  "ui.people.chosen": "{name} is a computer character. They live in the game.",
  "ui.people.lives.home": "Lives at home",
  "ui.people.lives.abroad": "Lives in {country}",

  // The invite card (R-PAIR-007, R-PAIR-008)
  "ui.people.invite.title": "Ask a friend",
  "ui.people.invite.intro": "Make a card for a friend who plays. It carries your character's name, never your own, and nothing else about you.",
  "ui.people.invite.fill": "Who you are looking for",
  "ui.people.invite.fill.none": "Anyone",
  "ui.people.invite.make": "Make the card",
  "ui.people.invite.withdraw": "Take the card back",
  "ui.people.invite.out": "Your card is out",
  "ui.people.invite.link": "Your link: {link}",
  "ui.people.invite.link-days": "It works once, for {days} days.",
  "ui.people.invite.link-get": "Get the link",
  "ui.people.invite.offline": "Links work when you play online. The card is saved for then.",
  "ui.people.invite.failed": "The link could not be made: {why}",
  "ui.people.invite.japacity": "Japacity {percent}",
  "ui.people.invite.japacity-none": "Japacity not counted yet",

  // Bonds (R-PEOPLE-013 to 018, R-PEOPLE-051)
  "ui.people.bonds": "Who you are seeing",
  "ui.people.stage.connected": "Connected",
  "ui.people.stage.courting": "Seeing each other",
  "ui.people.stage.partner": "Together",
  "ui.people.stage.married": "Married",
  "ui.people.stage.ended": "Over",
  "ui.people.ended.title": "Before",
  "ui.people.ended.recourt": "You may start again after {months} months.",
  "ui.people.moments": "Your time together",
  "ui.people.moments.none": "Nothing yet. Plan time together in the month plan.",
  "ui.people.moments.hidden": "Hidden while {piece} is open. You answer from memory.",
  "ui.people.moments.more": "and {count} more before that",
  "ui.people.moment.met": "{what} at {spot}",
  "ui.people.moment.call": "Kept in touch: {what}",
  "ui.people.moment.said": "Said: {what}",
  "ui.people.moment.wedding": "The wedding, at {spot}",
  "ui.people.moment.by-them": "{moment} (their side)",
  "ui.people.moments.count": "{count} moments so far",
  "ui.people.moments.count.one": "1 moment so far",
  "ui.people.moments.count.zero": "No moments yet",
  "ui.people.courting.next": "{count} more moments before you can ask to be together.",
  "ui.people.courting.next.one": "1 more moment before you can ask to be together.",
  "ui.people.cooldown": "You can ask again in month {month}.",
  "ui.people.time-with": "with {name}",
  "ui.people.see.how": "To spend time together, plan \"{see}\" when you are in the same place, or \"{call}\" when you are not.",

  // What is known of the other side (R-PEOPLE-051): no funds unless consent, pay only as the floor met
  "ui.people.facts": "What you know",
  "ui.people.facts.age": "{years} years old",
  "ui.people.facts.home": "At home in Nigeria",
  "ui.people.facts.abroad": "Abroad in {country}",
  "ui.people.facts.road": "On the road",
  "ui.people.facts.status": "Holds {status}",
  "ui.people.facts.status-left": "Holds {status}, {months} months left",
  "ui.people.facts.job": "Works as {job}",
  "ui.people.facts.no-job": "Not working",
  "ui.people.facts.from.city": "Family from the city",
  "ui.people.facts.from.town": "Family from a town",
  "ui.people.facts.english": "English test {band}",
  "ui.people.facts.floor.met": "Earns above the floor for {route}",
  "ui.people.facts.floor.not": "Does not earn enough for {route}",
  "ui.people.facts.funds": "Funds they let your application count: {amount}",
  "ui.people.facts.joint": "On {route}: {state}",

  // Proposals and answers (R-PEOPLE-016, R-PEOPLE-021)
  "ui.people.step.partner": "be together",
  "ui.people.step.marry": "get married",
  "ui.people.step.joint": "apply together",
  "ui.people.step.landed": "the landing",
  "ui.people.propose.partner": "Ask to be together",
  "ui.people.propose.marry": "Ask to marry",
  "ui.people.propose.marry-share": "Each side pays {amount} for the wedding.",
  "ui.people.propose.joint": "Ask to apply together",
  "ui.people.propose.joint.route": "On which route",
  "ui.people.propose.joint.lead": "Who leads",
  "ui.people.propose.joint.lead.me": "I lead, they come with me",
  "ui.people.propose.joint.lead.them": "They lead, I go with them",
  "ui.people.propose.joint.send": "Ask",
  "ui.people.propose.joint.none": "None of the routes you know brings a partner yet.",
  "ui.people.pending.mine": "You asked to {step}. Waiting for their answer.",
  "ui.people.pending.mine.joint": "You asked to apply together on {route}. Waiting for their answer.",
  "ui.people.pending.theirs": "They ask to {step}.",
  "ui.people.pending.theirs.joint": "They ask to apply together on {route}, with {lead} leading.",
  "ui.people.lead.me": "you",
  "ui.people.lead.them": "them",
  "ui.people.withdraw": "Take it back",
  "ui.people.answer.yes": "Say yes",
  "ui.people.answer.no": "Say no",
  "ui.people.declined.cooldown": "They will not hear the same question for {months} months.",
  "ui.people.declined.cooldown.one": "They will not hear the same question until next month.",

  // The joint (R-PEOPLE-021, R-PEOPLE-030, R-PEOPLE-004)
  "ui.people.joint": "Applying together",
  "ui.people.joint.on": "On {route}. {lead} leads.",
  "ui.people.joint.lead.me": "You",
  "ui.people.joint.lead.them": "They",
  "ui.people.joint.scores": "Your score {mine}, theirs {theirs}.",
  "ui.people.consent": "What their application may count of yours",
  "ui.people.consent.funds.yes": "Count my funds",
  "ui.people.consent.funds.no": "Do not count my funds",
  "ui.people.consent.funds.help": "Your money is never moved. It is counted for one application at a time, and while it counts for theirs it does not count for yours.",
  "ui.people.consent.stand-in.yes": "Let a stand-in say yes for me",
  "ui.people.consent.stand-in.no": "No stand-in for me",
  "ui.people.consent.stand-in.help": "If you go quiet for two weeks, a stand-in may say yes to a step of this application for you. It never spends, sponsors or ends anything.",
  "ui.people.consent.said": "Last set here: {choice}.",

  // The sponsor's side (R-UNDERTAKING-001 to 004, R-UNDERTAKING-012)
  "ui.people.sponsoring": "You agreed to sponsor them in month {month}. Their route: {route}.",
  "ui.people.bar": "You cannot sponsor a new partner before month {month}.",

  // Ending it (R-PEOPLE-035 to 039)
  "ui.people.end": "End it",
  "ui.people.end.cost": "Ending it costs you {standing} standing and {wellbeing} wellbeing.",
  "ui.people.end.cost-wellbeing": "Ending it costs you {wellbeing} wellbeing.",
  "ui.people.end.joint": "Your application together is withdrawn: the surcharge comes back, the fee does not.",
  "ui.people.end.absence": "A stand-in is answering for them. Ending it now costs nobody anything.",
  "ui.people.end.confirm": "End it for good",
  "ui.people.end.keep": "Keep it",

  // Gossip and drift (R-PEOPLE-041, R-PEOPLE-042)
  "ui.people.gossip": "You have a partner and you are seeing someone else. People talk: about {chance} a month. If your partner hears, you lose standing, and they may leave.",
  "ui.people.drift.near": "No time together for {months} months. After {patience} with nothing, {name} stops waiting.",
  "ui.people.drift.near.one": "No time together this past month. After {patience} with nothing, {name} stops waiting.",
  "ui.people.drift.rule": "{name} will wait {patience} months without time together. No longer.",

  // The stand-in (R-PEOPLE-043, R-PEOPLE-044)
  "ui.people.stand-in.warned": "Your partner has gone quiet for a week. If they stay quiet for two weeks, a stand-in answers for them.",
  "ui.people.stand-in.on": "Your partner has been away two weeks. A stand-in answers {piece} for them, and says yes only where they allowed it.",

  // Block and report (R-PAIR-014 to 016, R-MODERATION-003, 006)
  "ui.pair.block": "Block",
  "ui.pair.report": "Report",
  "ui.pair.block.title": "Block this player",
  "ui.pair.block.help": "They can no longer reach you. Anything between you ends, and it costs you nothing. They are told only that it ended.",
  "ui.pair.block.confirm": "Block",
  "ui.pair.blocked": "Blocked. It is over between you.",
  "ui.pair.report.title": "Report this player",
  "ui.pair.report.help": "Tell the team what happened. Nothing is deleted while they look.",
  "ui.pair.report.reason": "What happened",
  "ui.pair.report.also-block": "Block them too",
  "ui.pair.report.send": "Send the report",
  "ui.pair.reported": "Report received. You will hear when it is decided.",
  "ui.pair.failed": "That did not go through: {why}",
  "ui.pair.reason.scam": "Asked for money or a scam",
  "ui.pair.reason.harassment": "Harassment",
  "ui.pair.reason.impersonation": "Pretending to be someone",
  "ui.pair.reason.underage": "Seems under age",
  "ui.pair.reason.sexual": "Sexual",
  "ui.pair.reason.hate": "Hate",
  "ui.pair.reason.self-harm": "Self-harm",
  "ui.pair.reason.illegal": "Something illegal",
  "ui.pair.reason.cheating": "Cheating",
  "ui.pair.reason.other": "Something else",

  // The conversation (R-PAIR-010, R-PAIR-011, R-PAIR-013)
  "ui.talk.title": "Talk",
  "ui.talk.help": "Say it with the phrases. Nobody types here.",
  "ui.talk.empty": "Nothing said yet.",
  "ui.talk.phrase": "Phrase",
  "ui.talk.fill": "Fill in",
  "ui.talk.send": "Say it",
  "ui.talk.you": "You",
  "ui.talk.read": "Read",
  "ui.talk.unread": "New",
  "ui.talk.more": "Show newer",
  "ui.talk.offline": "Talk opens when you both play online.",
  "ui.talk.failed.not-possible": "That is not possible right now.",
  "ui.talk.failed.blocked": "You blocked them. Lift the block to talk again.",
  "ui.talk.failed.too-many": "That is a lot of talking for one hour. Wait a while, then say more.",
  "ui.talk.failed.region": "Talking is not open where you are.",
  "ui.talk.failed.not-here": "You are not there any more.",
  "ui.talk.failed.wrong-place": "That one is for saying in a place.",
  "ui.talk.failed.bad-fill": "Pick something to fill it in.",
  "ui.talk.failed.other": "That did not go through: {why}",
  "ui.talk.fill.news": "the news about {name}",

  // The interview (R-INTERVIEW-004, 005, 011)
  "ui.interview.for": "For {route}",
  "ui.interview.blocks": "Answer before the month can end. Your partner answers in another room.",
  "ui.interview.question": "Question {n} of {total}",
  "ui.interview.waiting": "Your answers are in. The officer waits for your partner's. Carry on with your life.",
  "ui.interview.stand-in": "A stand-in answered for your partner.",
  "ui.interview.result": "{piece} for {route}",
  "ui.interview.result.pass": "Passed",
  "ui.interview.result.doubt": "In doubt",
  "ui.interview.result.fail": "Not believed",
  "ui.interview.result.caught": "Caught",
  "ui.interview.matched": "Your answers agreed on {matched} of {asked}.",
  "ui.interview.not-sure": "Something else",

  // The undertaking (R-UNDERTAKING-006 to 012)
  "ui.undertaking.months-left": "{months} months left of the promise",
  "ui.undertaking.months-left.one": "1 month left of the promise",
  "ui.undertaking.months-left.zero": "The promise runs out once nothing is owed",
  "ui.undertaking.charged": "Charged so far for {months} months of assistance",
  "ui.undertaking.charged.one": "Charged so far for 1 month of assistance",
  "ui.undertaking.charged.zero": "Nothing charged yet",
  "ui.undertaking.owed": "Owed now: {amount}",
  "ui.undertaking.nothing-owed": "Nothing owed now.",
  "ui.undertaking.assistance": "Any month your partner takes social assistance, {amount} is charged to you here. Ending the relationship does not end it.",
  "ui.undertaking.pay": "Pay what is owed",

  // The partner and dependant gates (route-gates.md, R-PEOPLE-022, R-PEOPLE-026)
  "ui.gate.partner.title": "Your sponsor",
  "ui.gate.dependant.title": "Going with your partner",
  "ui.gate.bond.none": "Nobody to apply with yet. This needs a partner and an agreement to apply together.",
  "ui.gate.bond.with": "With {name}, {stage}.",
  "ui.gate.bond.ended": "The relationship this rested on has ended.",
  "ui.gate.lead.none": "Their application has not started.",
  "ui.gate.lead.state": "Their application: {state}.",
};

/** A country as it reads after "in": "the United Kingdom", "Canada". */
export function countryWords(id: string): string {
  const name = text[`${id}.name`] ?? id;
  return name.startsWith("United ") ? `the ${name}` : name;
}

/** A job as it reads after "works as": "a bank officer", "an analyst". */
export function jobWords(job: string): string {
  return `${/^[aeiou]/i.test(job) ? "an" : "a"} ${job}`;
}

/** Words for a person's id when content names it, else null. */
function personName(id: string): string | null {
  return text[`${id}.name`] ?? null;
}

/**
 * The people lines' own params as words (docs/rules/people.md "Lines"): a spot,
 * what was done, the step asked, the slot, and `player` for a friend. Null when
 * the param is not one of these, so the usual formatting applies.
 */
export function peopleParam(name: string, value: string, midSentence: boolean): string | null {
  switch (name) {
    case "spot":
      return text[`people.spot.${value}`] ?? text[`people.wedding-spot.${value}`] ?? null;
    case "what":
      return text[`people.what.${value}`] ?? text[`people.call.${value}`] ?? null;
    case "step":
      return peopleText[`ui.people.step.${value}`] ?? null;
    case "slot":
      return peopleText[`ui.people.slot.${value.startsWith("sibling") ? "sibling" : value}`]?.toLowerCase() ?? null;
    case "who": {
      if (value !== "player") return personName(value);
      const friend = peopleText["ui.people.who.player"] ?? value;
      return midSentence ? friend : friend.charAt(0).toUpperCase() + friend.slice(1);
    }
    default:
      return null;
  }
}
