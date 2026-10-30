// Cards are from docs/rules/prologue.md, "The steps". Keys: `prologue.<step>.card`,
// `prologue.<step>.answer.<answer>`, `prologue.<step>.outcome.<outcome>`,
// `prologue.<step>.answer.<answer>.hint` for the one line under an answer, and
// `prologue.<step>.answer.<answer>.why` for why an answer is not open: the situation,
// never the threshold (text:bands-not-figures). A card is at most ten words and an answer
// at most four.
const words: Record<string, string> = {
  "prologue.draw.card": "Where you start: your family, your town, your siblings.",
  "prologue.draw.answer.begin": "Begin",

  "prologue.subjects.card": "SS2. You pick your subjects.",
  "prologue.subjects.answer.science": "Science",
  "prologue.subjects.answer.arts": "Arts",
  "prologue.subjects.answer.commercial": "Commercial",

  "prologue.after-school.card": "WAEC is written. What now?",
  "prologue.after-school.answer.jamb": "Sit the entrance exam",
  "prologue.after-school.answer.apprentice": "Learn a trade",
  "prologue.after-school.answer.apprentice.hint": "Under a master in Onitsha or Lagos.",
  "prologue.after-school.answer.work": "Take a shop job",
  "prologue.after-school.answer.work.hint": "Behind a counter in the city.",
  "prologue.after-school.answer.apprentice.why": "your family would not have it.",

  "prologue.exam.card": "The exam hall at 6am.",
  "prologue.exam.answer.study": "Study properly",
  "prologue.exam.answer.cram": "Cram the week before",
  "prologue.exam.answer.expo": "Buy the expo",
  "prologue.exam.answer.expo.hint": "Answers sold the night before. Some get caught.",
  "prologue.exam.outcome.pass": "You pass. Admission letters go out next month.",
  "prologue.exam.outcome.pass-caught": "You pass, but someone saw the expo. Your family heard.",
  "prologue.exam.outcome.fail": "Your score comes back.",
  "prologue.exam.outcome.fail-caught": "Your score comes back, and someone saw the expo. Your family heard.",

  "prologue.retake.card": "150 was the cut-off. You did not reach it.",
  "prologue.retake.answer.again": "Sit it again",
  "prologue.retake.answer.again.hint": "One more year at home.",
  "prologue.retake.answer.apprentice": "Learn a trade instead",
  "prologue.retake.answer.work": "Find work",
  "prologue.retake.answer.again.why": "you are past the age for another try.",
  "prologue.retake.answer.apprentice.why": "you are past the age to start under a master.",

  "prologue.course.card": "Admission. Not the course you wanted, but a course.",
  "prologue.course.answer.computer-science": "Computer science",
  "prologue.course.answer.nursing": "Nursing",
  "prologue.course.answer.accounting": "Accounting",
  "prologue.course.answer.mass-comm": "Mass communication",
  "prologue.course.answer.nursing.why": "nursing wants the sciences, and you did not take them.",

  "prologue.university.card": "Which university will it be?",
  "prologue.university.answer.federal": "The federal university",
  "prologue.university.answer.private": "A private university",
  "prologue.university.answer.private.hint": "Your family pays the fees.",
  "prologue.university.answer.private.why": "your family cannot pay the fees.",

  "prologue.strike.card": "Lecturers threaten a strike. If it comes, what then?",
  "prologue.strike.answer.wait": "Wait at home",
  "prologue.strike.answer.learn": "Learn something online",
  "prologue.strike.answer.hustle": "Find work",
  "prologue.strike.outcome.strike": "The strike comes.",
  "prologue.strike.outcome.no-strike": "The strike deadline passes. Lectures go on.",

  "prologue.strike-drag.card": "The lecturers are on strike. Nobody knows how long.",
  "prologue.strike-drag.answer.back": "The gates open again",

  "prologue.side-skill.card": "Three hundred level. Everybody has a side thing.",
  "prologue.side-skill.answer.code": "Learn to code",
  "prologue.side-skill.answer.trade": "Buy and sell",
  "prologue.side-skill.answer.content": "Make content",
  "prologue.side-skill.answer.books": "Stay with your books",

  "prologue.hustle.card": "Final year. Money is tight.",
  "prologue.hustle.answer.freelance": "Freelance",
  "prologue.hustle.answer.freelance.hint": "Sell what you can build.",
  "prologue.hustle.answer.campus-shop": "Run a campus shop",
  "prologue.hustle.answer.focus": "Focus on the degree",
  "prologue.hustle.answer.freelance.why": "you do not have a skill to sell yet.",

  "prologue.graduation.card": "Results are out.",
  "prologue.graduation.answer.results": "Open the results",
  "prologue.graduation.answer.results-nurse": "Results and licence",
  "prologue.graduation.answer.results-nurse.hint": "Your nursing licence comes with them.",
  "prologue.graduation.answer.results.why": "you trained as a nurse, and your licence comes with them.",
  "prologue.graduation.answer.results-nurse.why": "you did not train as a nurse.",

  "prologue.service.card": "Call-up letter. Your posting is not Lagos.",
  "prologue.service.answer.serve": "Serve where posted",
  "prologue.service.answer.redeploy": "Get redeployed",
  "prologue.service.answer.redeploy.hint": "Someone knows someone.",
  "prologue.service.answer.skip": "Skip it and work",
  "prologue.service.answer.redeploy.why": "your family does not know anyone who can move a posting.",

  "prologue.friend.card": "Terna, your friend from school, takes you to a send-off.",
  "prologue.friend.answer.uk": "The UK crowd",
  "prologue.friend.answer.uk.hint": "They talk of a master's there.",
  "prologue.friend.answer.canada": "The Canada crowd",
  "prologue.friend.answer.canada.hint": "They talk of points and a profile.",
  "prologue.friend.answer.tech": "The developers",
  "prologue.friend.answer.tech.hint": "They talk of tech work abroad.",
  "prologue.friend.answer.care": "The nurses",
  "prologue.friend.answer.care.hint": "They talk of care homes abroad that sponsor.",
  "prologue.friend.answer.care.why": "you have no care behind you to follow them.",
  "prologue.friend.answer.nowhere": "Dance and go home",
  "prologue.friend.answer.drivers": "The drivers",
  "prologue.friend.answer.drivers.hint": "They talk of Dubai.",
  "prologue.friend.answer.tech.why": "you do not know enough tech to follow them.",

  // The age cards (prologue:age-advances-with-steps, prologue:front-door-builds-a-person; decision 0023): one for each path after school, sent by the tile with the age
  // picked on the door; they show only in the full prologue. Their answers are the years, written below.
  // The years worked after the path's end are never a card; their words name them where they are told.
  "prologue.work.card": "You work until your story starts.",
  "prologue.work.answer.first-year": "A year of work",
  "prologue.work.answer.second-year": "A second year",
  "prologue.work.answer.later-year": "Another year",
  // What a year older does, under the age on the door: the years worked and what they saved, or at the path's own age
  // the years left before Canada's points for age fall.
  "prologue.age.older": "+{amount} saved",
  "prologue.age.older.passport": "+{amount} saved, the passport held",
  "prologue.age.as-is": "{count} years before Canada's age points fall",
  "prologue.age.as-is.one": "One year before Canada's age points fall",
  "prologue.age.as-is.zero": "Canada's age points are falling",

  "prologue.home.card": "On your own feet now. Where do you sleep?",
  "prologue.home.answer.family-house": "The family house",
  "prologue.home.answer.family-house.hint": "Living costs: {amount} a month.",
  "prologue.home.answer.compound-room": "A room in Ojuelegba",
  "prologue.home.answer.compound-room.why": "you do not have the year's rent, the fees and a month to live on.",
  "prologue.home.answer.compound-room.hint": "Rent: {amount} a year, paid upfront with the fees. Living costs every month.",
  "prologue.home.answer.hostel-room": "A hostel room",
  "prologue.home.answer.hostel-room.why": "you do not have a month's rent.",
  "prologue.home.answer.hostel-room.hint": "Rent: {amount} a month. No year's rent to find.",
  "prologue.home.answer.makoko": "A room in Makoko",
  "prologue.home.answer.makoko.hint": "Living costs: {amount} a month. Some months the settlement is cleared.",

  "prologue.master.card": "Your uncle has spoken to a man with a shop.",
  "prologue.master.answer.electronics": "Electronics",
  "prologue.master.answer.textiles": "Textiles",
  "prologue.master.answer.spare-parts": "Spare parts",

  "prologue.years.card": "Year three. You know the trade. Customers know you.",
  "prologue.years.answer.stay": "Stay for the settlement",
  "prologue.years.answer.leave": "Leave now",

  "prologue.settlement.card": "Settlement day.",
  "prologue.settlement.answer.settle": "See what you get",
  "prologue.settlement.outcome.generous": "Your master is generous: capital for your own shop, and a plot.",
  "prologue.settlement.outcome.fair": "Your master is fair: enough to start small.",
  "prologue.settlement.outcome.cheated": "Your master finds reasons. You leave with little.",

  "prologue.shop.card": "Four years behind the counter. You hold the keys.",
  "prologue.shop.answer.stay": "Stay and know everybody",
  "prologue.shop.answer.save": "Save every naira",

  // The archetypes (prologue:archetype-presets-answers): the tile's name, what it was, what it opens with the age it starts at, in words a new player knows
  // (the age its path reaches with no setback, the lowest its age card opens: prologue:age-advances-with-steps; the archetypes' test reads it); the naira its life holds at
  // the close, in whole naira, the door's "what it leaves in the pocket" (prologue:front-door-three-screens: the savings test keeps it within a
  // quarter of its lives' median); the handover's line; and the life in a few words under the name on the door's card
  // (`life`).
  "prologue.archetype.developer.name": "The developer",
  "prologue.archetype.developer.was": "Science, then computer science",
  "prologue.archetype.developer.opens": "Opens: tech work in the UK, a master's. Starts at 23, or older",
  "prologue.archetype.developer.savings": "500000",
  "prologue.archetype.developer.life": "Codes at night",
  "prologue.archetype.nurse.name": "The nurse",
  "prologue.archetype.nurse.was": "Science, then nursing school",
  "prologue.archetype.nurse.opens": "Opens: health care in the UK, a Gulf contract, Canada's points. Starts at 23, or older",
  "prologue.archetype.nurse.savings": "500000",
  "prologue.archetype.nurse.life": "Nurse on shifts",
  "prologue.archetype.accountant.name": "The accountant",
  "prologue.archetype.accountant.was": "Commercial, then accounting",
  "prologue.archetype.accountant.opens": "Opens: Canada's points, skilled work in the UK. Starts at 23, or older",
  "prologue.archetype.accountant.savings": "1050000",
  "prologue.archetype.accountant.life": "Counts the money",
  "prologue.archetype.writer.name": "The writer",
  "prologue.archetype.writer.was": "Arts, then mass communication",
  "prologue.archetype.writer.opens": "Opens: a UK master's, Canada's points. Starts at 23, or older",
  "prologue.archetype.writer.savings": "500000",
  "prologue.archetype.writer.life": "Tells the story",
  "prologue.archetype.trader.name": "The trader",
  "prologue.archetype.trader.was": "Six years under a spare parts master",
  "prologue.archetype.trader.opens": "Opens: a Gulf contract, the road through the desert to Europe. Starts at 23, or older",
  "prologue.archetype.trader.savings": "2500000",
  "prologue.archetype.trader.life": "Sells spare parts",
  "prologue.archetype.shop-worker.name": "The shop worker",
  "prologue.archetype.shop-worker.was": "Straight from school to a shop counter",
  "prologue.archetype.shop-worker.opens": "Opens: a Gulf contract, the road through the desert to Europe. Starts at 21, or older",
  "prologue.archetype.shop-worker.savings": "500000",
  "prologue.archetype.shop-worker.life": "Minds the counter",
  // prologue:makoko-start-never-a-trap: the child of the water starts in a room in Makoko. Its nudges, for the first chapter's table:
  // `job` while it has no work, `heard` while no way out is heard of, `shop` once a shop's capital is in hand.
  "prologue.archetype.water.name": "The child of the water",
  "prologue.archetype.water.was": "Grew up in Makoko. A canoe to school, then the fish racks",
  "prologue.archetype.water.opens": "Opens: a Gulf contract, the road through the desert to Europe. Starts at 21, or older",
  "prologue.archetype.water.savings": "500000",
  "prologue.archetype.water.life": "Born on the water",
  "prologue.archetype.water.nudge.job": "Find work in town. The rent on the water is small, so most of the pay stays.",
  "prologue.archetype.water.nudge.heard": "Paddle to the bridge and ask around at the motor park.",
  "prologue.archetype.water.nudge.shop": "That is a shop's capital. Take a stall at the market.",
  // The begin card by tile: a tile with its own two lines says them in place of the draw's town
  // and means, so a life that grew up in Makoko never opens in a small town.
  "prologue.archetype.water.begin.where": "You grow up on the lagoon, in a house on stilts in Makoko.",
  "prologue.archetype.water.begin.home": "A canoe takes you to school. The fish racks feed the house.",
  // prologue:tile-path-open-from-start: where a life cannot be started over (online, one life an account), the tiles say the draw may
  // turn the years, and a handover whose life left its tile's path reads the life as lived on its page, never the tile.
  "prologue.archetype.once": "One life. The family you are born to may send the years another way.",
  // The page's "So far" for a life that went another way than its tile (prologue:printed-page-hands-over): short, as the tile's `was` is.
  "prologue.page.lived.degree": "School, then university",
  "prologue.page.lived.capital": "Six years under a master, a shop's capital",
  "prologue.page.lived.trade": "Work from school on",

  // The front door's run (prologue:front-door-builds-a-person): one question a screen, then the page printed and stamped.
  "prologue.door.step": "{n}/{count}",
  "prologue.door.drag": "Drag to turn",
  "prologue.door.pick": "Pick",
  "prologue.door.age": "Your age",
  "prologue.door.age.hint": "Older has worked longer and saved more. Younger has more years before the age limits.",
  "prologue.door.age.years": "{years}",
  "prologue.door.age.younger": "Younger",
  "prologue.door.age.older": "Older",
  "prologue.door.page.title": "Your page",
  // The front door's typed name (prologue:front-door-builds-a-person): what the box says, and why a name is refused.
  "prologue.door.name.title": "Character name",
  "prologue.door.name.hint": "What people in your story call you. Type or take one.",
  "prologue.door.name.suggested": "Names to take",
  "prologue.door.name.placeholder": "Name",
  "prologue.door.name.short": "A name needs at least {shortest} letters.",
  "prologue.door.name.long": "Keep it to {longest} letters.",
  "prologue.door.name.letters": "Letters only. No numbers, spaces or signs.",
  "prologue.door.name.reserved": "That name belongs to the game. Pick another.",
  "prologue.door.name.blocked": "Not that name. Pick another.",

  // The data page (prologue:front-door-builds-a-person): the travel data page the front door prints and the band opens. Its fields, its
  // stamps for the steps taken toward leaving, and each way out in the few words a stamp holds.
  "prologue.page.head": "Travel data page",
  "prologue.page.name": "Name",
  "prologue.page.age": "Age",
  "prologue.page.age.years": "{years} yrs",
  "prologue.page.path": "So far",
  "prologue.page.ready": "Ready",
  "prologue.page.type": "Japa type",
  // How ready, in words by the fifth part of the figure it stands in, never a percentage on the page.
  "prologue.page.ready.band.0": "Just starting",
  "prologue.page.ready.band.1": "On the way",
  "prologue.page.ready.band.2": "Past halfway",
  "prologue.page.ready.band.3": "Nearly there",
  "prologue.page.ready.band.4": "All set",
  "prologue.page.empty": "· · ·",
  "prologue.page.photo": "Your photo",
  "prologue.page.open": "Your page",
  // account:person-kept-with-character: the band's name until a person is read; a ready life has none of its own.
  "prologue.page.you": "You",
  "prologue.page.close": "Close",
  "prologue.page.stamp.granted": "Visa granted",
  "prologue.page.way.route.uk-masters": "a UK master's",
  "prologue.page.way.route.uk-care": "health care",
  "prologue.page.way.route.uk-skilled": "skilled work",
  "prologue.page.way.route.canada-points": "Canada's points",
  "prologue.page.way.route.uk-talent": "the talent visa",
  "prologue.page.way.route.gulf-contract": "the Gulf",
  "prologue.page.way.route.road": "the road",
  "prologue.page.way.route.uk-partner": "joining your partner",
  "prologue.page.way.route.canada-spouse": "your spouse in Canada",
  "prologue.page.way.route.uk-dependant": "with your partner",
  "prologue.page.way.route.canada-accompany": "with your spouse",

  "scenario.prologue.name": "A life from sixteen",
  "scenario.prologue.blurb": "Secondary school to the end of the service year. Your choices build where you start.",

  "line.prologue.drawn": "Your family is from {hometown}. Brothers and sisters: {siblings}.",
  "line.prologue.parents-educated": "Your parents went to school. People pick up when they call.",
  "line.prologue.graded": "Your degree came out at grade {grade}.",
  "line.prologue.headline": "On the radio at home: {story}.",
  "line.prologue.closed": "That is how you got here.",

  // The prologue's screen, in the situation's words.
  "prologue.not-for-you": "Not for you:",
  "prologue.handover.first": "Your first step: {step}.",
  // The handover keeps the story the prologue built: a first step in the handover's own words where the nudge's do not fit.
  "prologue.handover.step.heard": "Go to the meetup in Yaba and hear of a way out",
  // A life's own first step where its archetype has a place for it: `step.<step>.<way>`.
  "prologue.handover.step.job.clinic": "Apply for the staff nurse job at the clinic",
  "prologue.handover.step.heard.motor-park": "Ask around at the motor park",
  // The master's settlement, said as itself and not as side work.
  "prologue.line.settlement": "The settlement: {amount}.",
  "prologue.line.level": "{quality} now: {level}.",
  "prologue.line.graded": "Your degree comes out: {grade}.",
  "prologue.line.quality.land.gain": "You have a plot of land to your name now.",
  "prologue.line.moved.gain": "{quality} up.",
  "prologue.line.moved.loss": "{quality} down.",
  "prologue.line.moved.drift": "{quality} settles.",
};

/** The age cards and their years, 18 to 29 (prologue:age-advances-with-steps): the card's question, each year, and why a year is shut. */
const AGE_CARDS = ["age-degree", "age-trade", "age-shop"] as const;
const START_YEARS = Array.from({ length: 12 }, (_, at) => 18 + at);

const ageWords: Record<string, string> = Object.fromEntries(
  AGE_CARDS.flatMap((card): [string, string][] => [
    [`prologue.${card}.card`, "How old are you when your story starts?"],
    ...START_YEARS.flatMap((year): [string, string][] => [
      [`prologue.${card}.answer.start-${String(year)}`, String(year)],
      [`prologue.${card}.answer.start-${String(year)}.why`, "your years at school and after run past it."],
    ]),
  ]),
);

export const prologueText: Record<string, string> = { ...words, ...ageWords };
