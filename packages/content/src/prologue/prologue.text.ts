// Cards are from docs/rules/prologue.md, "The steps". Answer labels and the words for
// each draw's outcome are first drafts. Keys: `prologue.<step>.card`,
// `prologue.<step>.answer.<answer>`, `prologue.<step>.outcome.<outcome>`, and
// `prologue.<step>.answer.<answer>.why` for why an answer is not open: the situation,
// never the threshold.
export const prologueText: Record<string, string> = {
  "prologue.draw.card": "This is where you start: your family, your town, your brothers and sisters.",
  "prologue.draw.answer.begin": "Begin",

  "prologue.subjects.card": "SS2. You pick your subjects.",
  "prologue.subjects.answer.science": "Science",
  "prologue.subjects.answer.arts": "Arts",
  "prologue.subjects.answer.commercial": "Commercial",

  "prologue.after-school.card": "WAEC is written. What now?",
  "prologue.after-school.answer.jamb": "Sit the entrance exam",
  "prologue.after-school.answer.apprentice": "Learn a trade under a master",
  "prologue.after-school.answer.work": "Take a shop job in the city",
  "prologue.after-school.answer.apprentice.why": "your family would not have it.",

  "prologue.exam.card": "The exam hall at 6am.",
  "prologue.exam.answer.study": "Study properly",
  "prologue.exam.answer.cram": "Cram the week before",
  "prologue.exam.answer.expo": "Buy the expo",
  "prologue.exam.outcome.pass": "You pass. Admission letters go out next month.",
  "prologue.exam.outcome.pass-caught": "You pass, but someone saw the expo. Your family heard.",
  "prologue.exam.outcome.fail": "You did not reach the cut-off.",
  "prologue.exam.outcome.fail-caught": "You did not reach the cut-off, and someone saw the expo. Your family heard.",

  "prologue.retake.card": "150 was the cut-off. You did not reach it.",
  "prologue.retake.answer.again": "Sit it again next year",
  "prologue.retake.answer.apprentice": "Learn a trade instead",
  "prologue.retake.answer.work": "Find work",
  "prologue.retake.answer.again.why": "you are past the age for another try.",
  "prologue.retake.answer.apprentice.why": "you are past the age to start under a master.",

  "prologue.course.card": "Admission. The course is not the one you wanted, but it is a course.",
  "prologue.course.answer.computer-science": "Computer science",
  "prologue.course.answer.nursing": "Nursing",
  "prologue.course.answer.accounting": "Accounting",
  "prologue.course.answer.mass-comm": "Mass communication",
  "prologue.course.answer.nursing.why": "nursing wants the sciences, and you did not take them.",

  "prologue.university.card": "Which university will it be?",
  "prologue.university.answer.federal": "The federal university",
  "prologue.university.answer.private": "A private university your family can pay for",
  "prologue.university.answer.private.why": "your family cannot pay the fees.",

  "prologue.strike.card": "Two hundred level. The lecturers' union has given the government a deadline.",
  "prologue.strike.answer.wait": "If it comes, wait at home",
  "prologue.strike.answer.learn": "If it comes, learn something online",
  "prologue.strike.answer.hustle": "If it comes, find work",
  "prologue.strike.outcome.strike": "The strike comes.",
  "prologue.strike.outcome.no-strike": "The deadline passes. Lectures go on.",

  "prologue.strike-drag.card": "The lecturers are on strike. Nobody knows for how long.",
  "prologue.strike-drag.answer.back": "Eight months later, the gates open",

  "prologue.side-skill.card": "Three hundred level. Everybody has a side thing.",
  "prologue.side-skill.answer.code": "Learn to code",
  "prologue.side-skill.answer.trade": "Buy and sell",
  "prologue.side-skill.answer.content": "Make content",
  "prologue.side-skill.answer.books": "Stay with your books",

  "prologue.hustle.card": "Final year. Money is tight.",
  "prologue.hustle.answer.freelance": "Freelance",
  "prologue.hustle.answer.campus-shop": "Run a shop on campus",
  "prologue.hustle.answer.focus": "Focus on the degree",
  "prologue.hustle.answer.freelance.why": "you do not have a skill to sell yet.",

  "prologue.graduation.card": "Results are out.",
  "prologue.graduation.answer.results": "Open the results",
  "prologue.graduation.answer.results-nurse": "Open the results and collect your licence",
  "prologue.graduation.answer.results.why": "you trained as a nurse, and your licence comes with them.",
  "prologue.graduation.answer.results-nurse.why": "you did not train as a nurse.",

  "prologue.service.card": "Call-up letter. Your posting is not Lagos.",
  "prologue.service.answer.serve": "Serve where they post you",
  "prologue.service.answer.redeploy": "Get redeployed",
  "prologue.service.answer.skip": "Skip it and work",
  "prologue.service.answer.redeploy.why": "your family does not know anyone who can move a posting.",

  "prologue.friend.card": "Terna's send-off. Everybody is talking about where they are going.",
  "prologue.friend.answer.uk": "Listen to the ones going to the UK",
  "prologue.friend.answer.canada": "Listen to the ones going to Canada",
  "prologue.friend.answer.tech": "Listen to the developers",
  "prologue.friend.answer.nowhere": "Dance and go home",
  "prologue.friend.answer.tech.why": "you do not know enough tech to follow them.",

  "prologue.home.card": "You are on your own feet now. Where do you sleep?",
  "prologue.home.answer.family-house": "In the family house",
  "prologue.home.answer.room": "In a room of your own",
  "prologue.home.answer.room.why": "a room needs {amount} in cash, and you do not have it.",

  "prologue.master.card": "Your uncle has spoken to a man with a shop.",
  "prologue.master.answer.electronics": "Electronics",
  "prologue.master.answer.textiles": "Textiles",
  "prologue.master.answer.spare-parts": "Spare parts",

  "prologue.years.card": "Year three. You know the trade and the customers know you.",
  "prologue.years.answer.stay": "Stay for the settlement",
  "prologue.years.answer.leave": "Leave now",

  "prologue.settlement.card": "Settlement day.",
  "prologue.settlement.answer.settle": "Hear what your master gives you",
  "prologue.settlement.outcome.generous": "Your master is generous: capital for your own shop, and a plot.",
  "prologue.settlement.outcome.fair": "Your master is fair: enough to start small.",
  "prologue.settlement.outcome.cheated": "Your master finds reasons. You leave with little.",

  "prologue.shop.card": "Four years behind the counter. the owner trusts you with the keys.",
  "prologue.shop.answer.stay": "Stay and know everybody",
  "prologue.shop.answer.save": "Save every naira you can",

  "scenario.prologue.name": "A life from sixteen",
  "scenario.prologue.blurb": "Secondary school to the end of the service year. Your choices build where you start.",

  "line.prologue.drawn": "You grow up in a {town}. Brothers and sisters: {siblings}.",
  "line.prologue.parents-educated": "Your parents went to school. People pick up when they call.",
  "line.prologue.graded": "Your degree comes out at grade {grade}.",
  "line.prologue.headline": "On the radio at home: {story}.",
  "line.prologue.closed": "That is how you got here. Your story starts now.",

  // The prologue's screen, in the situation's words: content's
  // table wins over the interface's drafts, so these replace "Not open to you:" and "Start month {month}".
  "ui.prologue.not-open": "Not for you:",
  "ui.prologue.start": "Go",
  "prologue.handover.first": "Your first step: {step}.",
  "prologue.line.level": "{quality} now: {level}.",
  "prologue.line.graded": "Your degree comes out: {grade}.",
  "prologue.line.quality.land.gain": "You have a plot of land to your name now.",
  "prologue.line.moved.gain": "{quality} up.",
  "prologue.line.moved.loss": "{quality} down.",
  "prologue.line.moved.drift": "{quality} settles.",
};
