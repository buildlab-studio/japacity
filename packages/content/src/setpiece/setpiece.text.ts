// Questions and answers are from docs/rules/route.md. The table's outer double
// quotes mark speech and are not part of the words.
// Spoken and narrated answers are both kept as plain text, without
// speech quotes.
import type { Currency } from "@japacity/sim";

import { DECEMBER_COUNTRIES, decemberFare, decemberPrice } from "./setpiece.data";

/** Money in whole units as the page writes it, with the currency's sign. */
function shown(money: { currency: Currency; amount: number }): string {
  const sign: Record<Currency, string> = { NGN: "₦", GBP: "£", USD: "$", CAD: "C$", AED: "AED ", EUR: "€" };
  const whole = String(money.amount).slice(0, -2) || "0";
  const pence = String(money.amount).slice(-2);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign[money.currency]}${grouped}${pence === "00" ? "" : `.${pence}`}`;
}

/**
 * The December visit's words for each country (return:december-visit-set-piece). The
 * questions are the page's; each answer names what it costs in the country's
 * currency, since that is what it takes.
 */
function decemberText(): Record<string, string> {
  const words: Record<string, string> = {};
  for (const { country, suffix } of DECEMBER_COUNTRIES) {
    const price = (whole: number) => shown(decemberPrice(country, whole));
    const key = (question: string) => `setpiece.december.q.${question}-${suffix}`;
    const reply = (question: string, answer: string) => `setpiece.december.a.${question}-${suffix}.${answer}`;
    words[key("go")] = "December is coming. Everybody at home is asking if you will come.";
    words[reply("go", "go")] = `Book the flight: ${shown(decemberFare(country))} there and back`;
    words[reply("go", "stay")] = "Not this year";
    words[key("party")] = "Everybody is going out. Lagos in December is not cheap.";
    words[reply("party", "big")] = `Go big: ${price(400000)}`;
    words[reply("party", "small")] = `A few nights out: ${price(120000)}`;
    words[reply("party", "home")] = "Stay in with the family";
    words[key("gifts")] = "Your mother has a list. Your cousins have longer ones.";
    words[reply("gifts", "all")] = `Everyone on the list: ${price(600000)}`;
    words[reply("gifts", "some")] = `Your mother and the children: ${price(200000)}`;
    words[reply("gifts", "none")] = "Not this year";
    words[key("look")] = "People expect to see that it went well.";
    words[reply("look", "outfit")] = `New clothes and a haircut: ${price(250000)}`;
    words[reply("look", "plain")] = "Come as you are";
  }
  return words;
}

export const setpieceText: Record<string, string> = {
  "setpiece.credibility-interview.name": "The visa interview",

  "setpiece.credibility-interview.q.why-uk": "Why this university, and why not study in Nigeria?",
  "setpiece.credibility-interview.a.why-uk.course": "This course has modules I cannot get at home, and I can name them.",
  "setpiece.credibility-interview.a.why-uk.better": "Abroad is just better.",
  "setpiece.credibility-interview.a.why-uk.admission": "It was the course I could get admission for.",

  "setpiece.credibility-interview.q.who-pays": "Who is paying for your studies?",
  "setpiece.credibility-interview.a.who-pays.own": "My savings and my family. The statements show the history.",
  "setpiece.credibility-interview.a.who-pays.lender": "Part of it is a loan from a lender. I have the agreement.",
  "setpiece.credibility-interview.a.who-pays.sponsor": "A sponsor.",

  "setpiece.credibility-interview.q.after": "What will you do when the course ends?",
  "setpiece.credibility-interview.a.after.return": "Go back to my work in Lagos, better qualified.",
  "setpiece.credibility-interview.a.after.undecided": "I have not decided.",
  "setpiece.credibility-interview.a.after.stay": "Find any job there and stay.",

  "setpiece.credibility-interview.q.course": "Tell me what the course covers.",
  "setpiece.credibility-interview.a.course.detail": "Four modules, then a project. I can take you through each one.",
  "setpiece.credibility-interview.a.course.brief": "It is a one-year master's in my field.",

  "setpiece.credibility-interview.q.papers": "We checked your transcript with the university. They have no record of it. Explain.",
  "setpiece.credibility-interview.a.papers.genuine": "It is genuine. The university must have made a mistake.",
  "setpiece.credibility-interview.a.papers.agent": "An agent arranged it for me.",
  "setpiece.credibility-interview.a.papers.admit": "Someone sold it to me. I did not know it was not real.",
  "setpiece.credibility-interview.q.deposit": "A large sum reached your account recently. Explain it.",
  "setpiece.credibility-interview.a.deposit.agreement": "It is a loan. Here is the agreement and the lender's licence.",
  "setpiece.credibility-interview.a.deposit.gift": "A gift from an uncle.",
  "setpiece.credibility-interview.a.deposit.savings": "Savings I moved from another account.",

  "setpiece.credibility-interview.q.living": "Where will you live, and what will it cost you a month?",
  "setpiece.credibility-interview.a.living.figures": "A hall near the campus. The rent and the bus fare are in my budget.",
  "setpiece.credibility-interview.a.living.sort": "I will sort that out when I arrive.",

  // route:answer-may-ask-follow-up: the follow-ups.
  "setpiece.credibility-interview.q.sponsor-who": "Who is the sponsor, and what do they do?",
  "setpiece.credibility-interview.a.sponsor-who.relative": "My uncle. He runs a building supplies business, and I have his letter and his statements.",
  "setpiece.credibility-interview.a.sponsor-who.friend": "A family friend. I am not sure what he does.",
  "setpiece.credibility-interview.q.course-about": "Then what is the course about, in your own words?",
  "setpiece.credibility-interview.a.course-about.modules": "It builds on my work, and I can name the modules.",
  "setpiece.credibility-interview.a.course-about.leave": "Any course would do. I need to leave.",
  "setpiece.credibility-interview.a.course-about.little": "I would have to check the papers.",
  "setpiece.credibility-interview.q.gift-uncle": "Tell me about this uncle. Why did he send so much?",
  "setpiece.credibility-interview.a.gift-uncle.letter": "He has paid my fees before. He wrote a letter saying where the money came from.",
  "setpiece.credibility-interview.a.gift-uncle.unknown": "I did not ask him.",

  // The officer's own lines, spoken and shown. Neutral, and never drawn
  // from the score (route:view-shows-progress-not-score).
  "setpiece.credibility-interview.officer.greet": "Good morning. I have a few questions about your application.",
  "setpiece.credibility-interview.officer.react-1": "I see.",
  "setpiece.credibility-interview.officer.react-2": "Right.",
  "setpiece.credibility-interview.officer.react-3": "Thank you.",
  "setpiece.credibility-interview.officer.react-4": "Noted.",
  "setpiece.credibility-interview.officer.close": "That is all. You will receive a decision in writing.",

  // Report lines.
  "line.setpiece.opened": "{setpiece}: {questions} questions to answer.",
  "line.setpiece.closed": "{setpiece} is over.",
  "line.setpiece.dropped": "{setpiece} is behind you. You left before it was settled.",
  // luck:big-wins-are-staged: staged.
  "line.setpiece.december-go": "The ticket is booked. You are going home for December, and everybody already knows.",
  // road.md. The truth is said once, plainly.

  "setpiece.road-night.name": "The night meeting",
  "setpiece.road-night.q.night":
    "A bus park at night. Twenty people with one bag each. The man takes your phone number and says the bus leaves at four.",
  "setpiece.road-night.a.night.go": "Get on the bus",
  "setpiece.road-night.a.night.turn-back": "Go home. The deposit is gone",

  "setpiece.road-truth.name": "The truth",
  "setpiece.road-truth.q.truth":
    "Three days north, the bus stops for good. It is by road from here, across the desert, then a boat. They want more money before anyone moves.",
  "setpiece.road-truth.a.truth.pay": "Pay what they ask",
  "setpiece.road-truth.a.truth.call-home": "Call home for the money",
  "setpiece.road-truth.a.truth.exit": "Find the migration agency and go home",

  // return.md. Questions are the page's.

  // activity:waiting-months-build-profile. The quiz's facts are the care guide's.
  "setpiece.nurse-exam.name": "The certification exam",
  "setpiece.nurse-exam.q.register": "A nurse trained in Nigeria wants to work in the UK. Who must register her first?",
  "setpiece.nurse-exam.a.register.nmc": "The Nursing and Midwifery Council",
  "setpiece.nurse-exam.a.register.embassy": "The British High Commission",
  "setpiece.nurse-exam.a.register.agent": "The recruitment agent",
  "setpiece.nurse-exam.q.verify": "How long must a nurse work after licensing before the council here verifies her for a board abroad?",
  "setpiece.nurse-exam.a.verify.six-months": "Six months",
  "setpiece.nurse-exam.a.verify.two-years": "Two years",
  "setpiece.nurse-exam.a.verify.at-once": "No time. The letter comes at once",
  "setpiece.nurse-exam.q.sponsorship": "Who pays for a nurse's certificate of sponsorship?",
  "setpiece.nurse-exam.a.sponsorship.nurse": "The nurse, through an agent",
  "setpiece.nurse-exam.a.sponsorship.nobody": "Nobody. A nurse needs none",
  "setpiece.nurse-exam.a.sponsorship.employer": "The employer that sponsors her",

  // document:trade-papers. The sitting's facts are the accountant's trade.
  "setpiece.ican-exam.name": "The chartered exams",
  "setpiece.ican-exam.q.body": "Which body makes an accountant chartered in Nigeria?",
  "setpiece.ican-exam.a.body.ican": "The Institute of Chartered Accountants of Nigeria",
  "setpiece.ican-exam.a.body.cbn": "The Central Bank",
  "setpiece.ican-exam.a.body.firs": "The tax office",
  "setpiece.ican-exam.q.entry": "In double entry, what does every debit have?",
  "setpiece.ican-exam.a.entry.credit": "A credit of the same amount",
  "setpiece.ican-exam.a.entry.receipt": "A receipt from the bank",
  "setpiece.ican-exam.a.entry.signature": "The manager's signature",
  "setpiece.ican-exam.q.balance": "What does a balance sheet show?",
  "setpiece.ican-exam.a.balance.day": "What a business owns and owes on one day",
  "setpiece.ican-exam.a.balance.year": "What it sold over the year",
  "setpiece.ican-exam.a.balance.till": "The cash in the till",

  "setpiece.conference-talk.name": "The talk",
  "setpiece.conference-talk.q.open": "The room at the hub is full and the screen is on. You have twenty minutes. How do you start?",
  "setpiece.conference-talk.a.open.demo": "Run the code live",
  "setpiece.conference-talk.a.open.story": "Tell them about the bug that cost you a weekend",
  "setpiece.conference-talk.a.open.slides": "Read the slides as written",

  "setpiece.december.name": "December at home",
  ...decemberText(),
};
