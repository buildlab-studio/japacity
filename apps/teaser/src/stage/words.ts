// Every word the stageshow teaser shows, each as the game says it on main: the content key it is read from and the
// values that fill its braces. words.test.ts reads packages/content and holds each one to the game's own text, so a
// change of words in the game fails the test until the teaser follows it.

/** A word as shown, with the key of content it comes from and what fills its braces. */
export interface Word {
  readonly key: string;
  readonly text: string;
  readonly params?: Readonly<Record<string, string>>;
  /** How the game turns the content's text into what it shows: raised first letter, or lowered. */
  readonly shown?: "raised" | "lowered";
  /** A part of the content's text the game shows on its own (a way the door's tile opens, taken from its list). */
  readonly part?: true;
}

function word(key: string, text: string, params?: Readonly<Record<string, string>>, shown?: Word["shown"]): Word {
  return { key, text, ...(params === undefined ? {} : { params }), ...(shown === undefined ? {} : { shown }) };
}

/** The player's own name, typed at the door: a name of the player's choosing, not the game's words. */
export const PLAYER = "Tobi";

export const WORDS = {
  // The front door's second screen.
  doorTitle: word("ui.door.life", "Your life so far"),
  doorLine: word("ui.door.life.line", "Pick one and live it from school."),
  skip: word("ui.door.skip", "Skip"),
  tag: word("ui.door.tag.developer", "Balanced"),
  developer: word("prologue.archetype.developer.name", "The developer"),
  life: word("prologue.archetype.developer.life", "Codes at night"),
  was: word("prologue.archetype.developer.was", "Science, then computer science"),
  savings: word("ui.door.tile.savings", "Savings ₦500,000", { amount: "₦500,000" }),
  wayTech: { key: "prologue.archetype.developer.opens", text: "Tech work in the UK", shown: "raised", part: true },
  wayMasters: { key: "prologue.archetype.developer.opens", text: "A master's", shown: "raised", part: true },
  age: word("prologue.door.age", "Your age"),
  ageFrom: word("ui.door.age.from", "From 23, or older", { years: "23" }),
  next: word("ui.door.next", "Next"),
  nextThen: word("ui.door.next.home", "Where you live"),
  // The world: the band, the brief's chip, the thumbs and the giver's toast.
  morning: word("ui.day.part.morning", "Morning"),
  ageStart: word("ui.world.age", "23 yrs 4 mo", { years: "23", months: "4" }),
  home: word("place.family-house.name", "The family house", undefined, "raised"),
  brief: word("chapter.find-your-feet.brief.title", "Work first, abeg"),
  giver: word("chapter.find-your-feet.brief.giver", "Lanre"),
  toast: word("chapter.brief.toast.last", "Good. One more and we move."),
  map: word("ui.world.map", "Map"),
  phone: word("ui.world.phone", "Phone"),
  // The phone's Japa app.
  japa: word("phone.app.japa", "Japa"),
  plan: word("phone.japa.plan", "Your plan: A master's in the UK", { route: "A master's in the UK" }),
  ready: word("phone.japa.gloss", "How ready you are to go"),
  official: word("activity.look-into-route.name", "Read the official page"),
  officialRead: word("line.activity.look-into-route.now", "The official page for a master's in the UK, read to the end. Now you know what it asks.", { param: "a master's in the UK" }),
  free: word("phone.japa.official.free", "Free"),
  officialLine: word("phone.japa.official", "The full list for a master's in the UK, as it stands today", { route: "a master's in the UK" }),
  others: word("phone.japa.others", "Other ways out"),
  coming: word("phone.japa.reminders", "Coming up"),
  birthday: word("ui.world.coming.birthday", "Birthday, 24", { age: "24" }),
  inMonths: word("ui.in-months", "in 8 months", { count: "8" }),
  calendar: word("phone.app.calendar", "Calendar"),
  bank: word("phone.app.bank", "Bank"),
  chats: word("phone.app.chats", "Chats"),
  papers: word("phone.app.papers", "Papers"),
  jobs: word("phone.app.jobs", "Jobs"),
  market: word("phone.app.market", "Market"),
  lotto: word("phone.app.lotto", "Lotto"),
  bills: word("phone.app.bills", "Bills"),
  news: word("phone.app.news", "News"),
  settings: word("phone.app.settings", "Settings"),
  masters: word("route.uk-masters.name", "A master's in the UK"),
  skilled: word("route.uk-skilled.name", "Skilled work in the UK"),
  care: word("route.uk-care.name", "Health care in the UK"),
  gulf: word("route.gulf-contract.name", "A contract in the Gulf"),
  heard: word("ui.route.state.heard", "Heard of"),
  known: word("ui.route.state.known", "Looked into"),
  // The month's results and the ask in them.
  ageLater: word("ui.world.age", "25 yrs 2 mo", { years: "25", months: "2" }),
  done: word("turn.results.title", "The month is done"),
  salary: word("line.activity.salary", "Salary from junior developer: ₦320,000.", { job: "junior developer", amount: "₦320,000" }),
  kept: word("turn.results.kept", "Kept this month"),
  saved: word("turn.results.savings", "Saved for the move"),
  savedLine: word("turn.results.savings-line", "£1,139 of £1,270", { shown: "£1,139", required: "£1,270" }),
  asked: word("turn.results.asked", "Asked of you"),
  back: word("turn.results.back", "Back to the family house", { place: "the family house" }),
  firm: word("offer.sponsor-tech-firm.who", "A tech firm"),
  sponsor: word("offer.sponsor-tech-firm.title", "We will sponsor"),
  offer: word("offer.sponsor-tech-firm.body", "“We liked your take-home task: £48,000 a year in Manchester, and we will sponsor the visa.”", { salary: "£48,000" }),
  within: word("ui.by-months", "within 2 months", { count: "2" }),
  answer: word("ui.offer.expires", "Answer within 2 months", { when: "within 2 months" }),
  signVideo: word("offer.sponsor-tech-firm.sign.video-interview", "There was an interview on video with the manager."),
  signChat: word("offer.sponsor-tech-firm.sign.whatsapp-only", "Everything happens in a chat app."),
  look: word("ui.offer.look", "Look closer"),
  decline: word("offer.sponsor-tech-firm.choice.decline", "Decline"),
  take: word("offer.sponsor-tech-firm.choice.take", "Take the offer"),
  where: word("place.family-house.name", "the family house"),
} as const satisfies Readonly<Record<string, Word>>;

/** The words by name, as the scenes show them. */
export const W: { readonly [name in keyof typeof WORDS]: string } = Object.fromEntries(Object.entries(WORDS).map(([name, one]) => [name, one.text])) as {
  readonly [name in keyof typeof WORDS]: string;
};
