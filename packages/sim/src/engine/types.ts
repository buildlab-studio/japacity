// The engine contract in types. The words are in docs/rules/engine.md.
// A change here is a change to the contract.
//
// Conventions:
// - Money is a whole number of the smallest unit: kobo, pence, cents.
// - A month number counts turns played. The first turn played is month 1.
// - "Bp" means basis points: 10000 is 100%.
// - Rates are kobo per one pound or one dollar.

// ---------------------------------------------------------------------------
// Ids and small enums
// ---------------------------------------------------------------------------

export type KindName =
  | "advert"
  | "guide"
  | "turn"
  | "quality"
  | "activity"
  | "wallet"
  | "document"
  | "school"
  | "route"
  | "setpiece"
  | "obligation"
  | "offer"
  | "chapter"
  | "news"
  | "var"
  | "scenario"
  // The whole life: docs/decisions/0001-the-contract-carries-the-whole-life.md.
  | "place"
  | "status"
  | "credit"
  | "goal"
  | "prologue"
  // Online: docs/rules/lottery.md.
  | "lottery"
  // People: docs/rules/person.md, pair.md, interview.md.
  | "people"
  | "person"
  | "interview"
  | "phrase"
  | "era"
  | "country"
  | "points"
  // Living at home: docs/rules/home.md.
  | "home"
  // The market: the things a life owns at home: `thing` names an entry, `things` the slice.
  | "thing"
  | "things";

/** An entry id: the kind, a dot, then a lower-case slug with hyphens. */
export type Id<K extends KindName> = `${K}.${string}`;

export type Currency = "NGN" | "GBP" | "USD" | "CAD" | "AED" | "EUR";
export type ForeignCurrency = Exclude<Currency, "NGN">;
export type Pocket = "bank" | "cash";

/** Every way money enters or leaves a pocket. The ledger totals are kept per reason. */
export type Reason =
  // sources
  | "opening"
  | "salary"
  | "gig"
  | "gift"
  | "sale"
  | "loan"
  | "held-funds"
  | "refund"
  // sinks
  | "upkeep"
  | "family"
  | "fee-document"
  | "fee-test"
  | "fee-school"
  | "fee-visa"
  | "fee-surcharge"
  | "fee-agent"
  /** A licensed adviser's fee (advice:licensed-adviser-is-truthful), a sink. */
  | "fee-advice"
  /** A meal or the water bought and eaten today (home:living-by-hand, decision 0013), a sink. */
  | "food"
  /** Foodstuff bought for the family house's pot, the share a child at home gives, a sink. */
  | "foodstuff"
  /** Enjoyment and spending on the street, paid as it is had (streets:lagos-street-spending, decision 0012), a sink. */
  | "enjoyment"
  | "bank-charge"
  | "loan-repay"
  | "loan-interest"
  | "held-funds-return"
  | "held-funds-interest"
  | "study"
  | "social"
  | "mishap"
  | "flight"
  | "short-count"
  // abroad (docs/rules/abroad-money.md, car.md, return.md, road.md)
  | "rent"
  | "deposit-return"
  | "phone"
  | "car-payment"
  | "car-deposit"
  | "remit"
  | "remit-fee"
  | "cash-work"
  | "tax"
  | "agent-debt"
  | "fare"
  /** The UAE's overstay fine, paid with the fare home (status:uae-fine-accrues, decision 0028), a sink. */
  | "fine"
  /** A lottery, bet or draw win (docs/rules/luck.md). Never flagged: a letter explains it. */
  | "win"
  /** A lottery ticket bought (docs/rules/lottery.md), a sink. */
  | "ticket"
  /** A thing bought from the market for the home, a sink; selling it back comes in under `sale`. */
  | "goods"
  /** What a thing owned costs to run a month: the generator's fuel, the data plan, the decoder's bouquet, the AC's light, a sink. */
  | "running"
  /** A wedding's share paid (docs/rules/person.md), a sink. */
  | "wedding"
  /** An undertaking charge paid by a sponsor (docs/rules/undertaking.md), a sink. */
  | "undertaking"
  /** Social assistance received abroad (docs/rules/undertaking.md), a source. */
  | "assistance"
  /** Naira bought with real money, credited only by the authority's `wallet/top-up` (wallet:top-ups-are-marked), a source. Marked until spent. */
  | "top-up"
  // transfers: always in matched pairs
  | "convert"
  | "move";

export type Stream =
  | "job"
  | "gig"
  | "test"
  | "school"
  | "document"
  | "visa"
  | "offer"
  | "fraud"
  | "street"
  | "prologue"
  | "status"
  | "credit"
  | "road"
  | "lotto"
  | "health"
  /** The people kind's draws: courting, a computer's answers, gossip (docs/rules/person.md). */
  | "people"
  /** The settlement cleared (home:makoko-eviction-draw), on its own stream so living in Makoko moves no other draw. */
  | "home";

/** Where a character is. `road` is the chain in docs/rules/road.md. */
export type Where = "home" | "abroad" | "road";
/** Where an entry applies. */
export type WhereEntry = "home" | "abroad" | "any";
/**
 * The way home today, as `return/home` would take it (place:view-carries-way-home): the fare now and off peak, where it
 * would come from (the country's money, naira through the bank, or nobody), the naira it takes when bought from
 * naira, the shape the return would take (null when it would be refused) and the standing it would bring.
 */
export interface WayHome {
  fare: MoneyParam;
  offPeak: MoneyParam;
  paidFrom: "local" | "naira" | null;
  naira: number;
  shape: ReturnShape | null;
  standing: number;
  /** The ban the return would record on the country, in months, 0 for none (place:leaving-an-overstay-bans). */
  banMonths: number;
  /** How much of `fare` is the UAE's overstay fine (status:uae-fine-accrues); null where none is asked. */
  fine: MoneyParam | null;
  /** The returns service's way, where the status has one: the grant in naira at the day's rate and its ban (place:returns-service-takes-you-home); null elsewhere. */
  scheme: { grant: MoneyParam; banMonths: number } | null;
}

/**
 * The status kept from a return with papers, as the view carries it beside `heldAbroad` (return:papers-return-keeps-status, status:absence-breaks-settlement):
 * `until`, the month it ends, null for one that never does; `restarts`, whether a flight back this month would set the lawful months toward settlement back to 0.
 * Missing while nothing is kept.
 */
export interface KeptView {
  until: number | null;
  restarts: boolean;
}

/** The shapes of a return home: place:return-shape-decided-at-once. */
export type ReturnShape = "removed" | "assisted" | "broke" | "by-choice" | "with-papers";
/** Why the home card's move is shut (home:moves-carry-cost-and-reason): a move made this month, or what the move takes at once not held. */
export type HomeMoveShut = "moved" | "short";

/** Where the character lives at home: home:home-slice-fields, the three home places. */
export type HomePlace = "place.family-house" | "place.makoko" | "place.compound-room" | "place.hostel-room";
/** Who takes the character in after an eviction (home:taken-in-after-eviction). */
export type HomeHost = "friend" | "someone";
/** What a status lets you do for work: status:status-sets-work-rule. */
export type WorkRule = "any" | "part" | "one-employer" | "cash" | "none";
/** A route's gate: docs/rules/route-gates.md. */
export type RouteGate = "study" | "sponsor" | "points" | "endorsement" | "contract" | "road" | "partner" | "dependant";

export type Phase =
  | "spend"
  | "main"
  | "slots"
  | "due"
  | "settle"
  | "papers"
  | "clocks"
  | "expire"
  | "news"
  | "hear"
  | "month"
  | "come-up"
  | "chapter"
  | "close";

export type RouteStateName = "unknown" | "heard" | "known" | "applying" | "granted" | "refused" | "departed";
export type NewsStage = "rumour" | "announced" | "in-force" | "ended";

// ---------------------------------------------------------------------------
// Amounts, requirements, effects: the plain-data language content is written in
// ---------------------------------------------------------------------------

/**
 * A number fixed in content, a number read from the world, or a number read
 * from the terms of the offer or obligation in hand, optionally scaled.
 */
export type Amount = number | { var: Id<"var"> } | { term: string; bp?: number };

export interface Money {
  currency: Currency;
  amount: Amount;
}

/** A price with the ledger reason it is paid under. */
export interface Cost extends Money {
  reason: Reason;
}

export type Requirement =
  | { type: "quality/min"; quality: Id<"quality">; value: number }
  | { type: "quality/max"; quality: Id<"quality">; value: number }
  | { type: "job/any" }
  | { type: "job/none" }
  | { type: "job/is"; activities: Id<"activity">[] }
  /** Months spent across the listed jobs, added together. An empty list means every job. */
  | { type: "activity/tenure"; activities: Id<"activity">[]; months: number }
  /** Held and in date. With `min`, its value must be at least that. */
  | { type: "document/held"; document: Id<"document">; min?: number }
  /** Neither held nor being made. */
  | { type: "document/absent"; document: Id<"document"> }
  /** Being made now. */
  | { type: "document/pending"; document: Id<"document"> }
  /** The document is held and did not come from a scammer (advice:agent-loss-is-the-fee). */
  | { type: "document/genuine"; document: Id<"document"> }
  /** With `afterReturn`, the route's grant also came in a month after the latest return home; with no return on record it is not met. */
  | { type: "route/state"; route: Id<"route">; in: RouteStateName[]; afterReturn?: true }
  /** Holds an offer from at least one school on this route. */
  | { type: "route/offer"; route: Id<"route"> }
  /** The deposit for a school is paid. */
  | { type: "route/deposit"; route: Id<"route"> }
  /** The funds check passed at the last month end for at least this many months in a row, and passes now. */
  | { type: "route/funds"; route: Id<"route">; heldMonths: number }
  /** The share of shown funds that arrived recently from flagged sources is at most this. */
  | { type: "route/unexplained-max"; route: Id<"route">; bp: number }
  /** Without a pocket: bank and cash together. Locked money never counts. */
  | { type: "money/min"; currency: Currency; amount: Amount; pocket?: Pocket }
  /** The amount could be paid now: naira from cash and bank, a foreign fee by wallet:foreign-fee-payment-order. */
  | { type: "money/can-pay"; currency: Currency; amount: Amount }
  | { type: "var/min"; var: Id<"var">; value: number }
  | { type: "var/max"; var: Id<"var">; value: number }
  | { type: "month/min"; value: number }
  | { type: "chapter/done"; chapter: Id<"chapter"> }
  /**
   * status:graduate-visa-applied-for: the course is passed and the application it leads to may be made now: from the course's `anyFrom` month on its status,
   * or in the grace after it, with the status applied for lasting more than 0 months and its fee and surcharge payable.
   */
  | { type: "status/course-done" }
  /** The way the plan follows is this route (decision 0022, chapter:chapters-follow-lean-route); with none heard of, the master's is read as the plan (route-gates:family-gift-counts-with-deed). */
  | { type: "chapter/plan"; route: Id<"route"> }
  // whole life
  | { type: "place/is"; where: Where; country?: Id<"country"> }
  /**
   * With `grace`, the status is also in an overstay's grace (status:grace-allows-in-country-applications); with `withdrawn`, it is a withdrawn
   * student's, in the months its permission is cut to (status:course-passed-or-withdrawn).
   */
  | { type: "status/is"; statuses: Id<"status">[]; grace?: true; withdrawn?: true }
  /** A status is held whose clock is running and under this many months. */
  | { type: "status/clock-under"; months: number }
  /** The credit mark in the current country. */
  | { type: "credit/min"; value: number }
  | { type: "goal/done"; goal: Id<"goal"> }
  | { type: "era/is"; eras: Id<"era">[] }
  /**
   * An open obligation of this type exists, not in default. The car is `obligation/has` with type `car`. `obligation`
   * narrows the check to one entry (goal.own-door, the repeatable flat); `defaulted` counts only one in default
   * and `localCurrency` only one owed in the currency of the country the character is in (offer.court-date).
   */
  | { type: "obligation/has"; obligationType: ObligationType; obligation?: Id<"obligation">; defaulted?: boolean; localCurrency?: boolean }
  /** A route's gate has reached the named step: docs/rules/route-gates.md. */
  | { type: "route/gate-step"; route: Id<"route">; step: string }
  /** Months in any job in the current country. */
  | { type: "activity/local-tenure"; months: number }
  /** The activity filled a slot in the month just played: a free slot sent with it, or the job or side job held (streets:sleeping-under-the-bridge). */
  | { type: "activity/played"; activity: Id<"activity"> }
  /** The set piece has closed at least `times` times (default 1): route:answers-carry-effects. */
  | { type: "setpiece/answered"; setpiece: Id<"setpiece">; times?: number }
  /** The last answer given to this question of this set piece was this one (route:last-answers-remembered). */
  | { type: "setpiece/answered-with"; setpiece: Id<"setpiece">; question: string; answer: string }
  /** The prologue's step was answered with this answer, kept after the prologue closes: the course read, for a job that takes the degree (activity:each-trade-climbs-its-ladder). */
  | { type: "prologue/answered"; step: string; answer: string }
  /** The world runs the Friday draw (`online` true) or not (docs/rules/lottery.md). */
  | { type: "world/lottery"; online: boolean }
  /** A bond of this role at one of these stages, and where the other is (person:computer-is-a-person-entry). */
  | { type: "people/bond"; role: "partner" | "sibling"; stages: BondStage[]; where?: Where; country?: Id<"country">; statuses?: Id<"status">[] }
  /** A sibling in this country with one of these statuses, old enough (person:canada-sibling-bonus). */
  | { type: "people/sibling-abroad"; country: Id<"country">; statuses: Id<"status">[]; minAgeMonths: number }
  /** A joint application on this route with the character as lead or dependant (person:tied-status-clock-on-breakup). */
  | { type: "people/joint"; route: Id<"route">; as: "lead" | "dependant" }
  /** The ledger's total under a reason, in or out, in one currency, is at least this: wallet:ledger-total-requirement. */
  | { type: "wallet/total"; flow: "in" | "out"; reason: Reason; currency: Currency; amount: Amount }
  /** A return of one of these shapes is on record: docs/rules/place.md. */
  | { type: "place/returned"; shapes: ReturnShape[] }
  /** The character has been where they are, in `where`, for at least this many months. */
  | { type: "place/months-here"; where: Where; months: number }
  /** A removal's ban holds on the country this month (place:removal-bans-the-country). */
  | { type: "place/banned"; country: Id<"country"> }
  /** A host of this kind would take the character in now (home:taken-in-after-eviction). */
  | { type: "home/host"; host: HomeHost }
  | { type: "not"; of: Requirement }
  | { type: "any"; of: Requirement[] };

/** What evaluating a requirement gives. `have` and `need` let a checklist show progress. */
export interface RequirementResult {
  met: boolean;
  have?: number;
  need?: number;
}

/**
 * Effects are how kinds talk to each other. The part before the slash names
 * the kind that carries the effect out.
 */
export type Effect =
  // wallet
  | { type: "money/add"; currency: Currency; pocket: Pocket; amount: Amount; reason: Reason; flagged?: boolean; locked?: boolean }
  /** `any`: the street, cash first at or under `tuning.wallet.cashUpTo` and bank first above it (wallet:money-lands-as-in-lagos); `transfer`: bank first, then cash (decision 0014: how Lagos pays by transfer, and abroad by tap). */
  | { type: "money/take"; currency: Currency; pocket: Pocket | "any" | "transfer" | "locked"; amount: Amount; reason: Reason }
  /** Pay a foreign-currency fee from whatever the character holds: see wallet:foreign-fee-payment-order. */
  | { type: "money/pay-fee"; currency: ForeignCurrency; amount: Amount; reason: Reason }
  /** The lot of this currency, amount and reason is dropped: its source is explained by a paper (route-gates:family-gift-counts-with-deed). */
  | { type: "money/drop-lot"; currency: Currency; amount: number; reason: Reason }
  /** Naira bought with real money (wallet:top-ups-are-marked): to the naira bank as `top-up`, a lot recorded, and the marked figure raised by the amount. Only the authority's `wallet/top-up` applies it. */
  | { type: "wallet/top-up"; amount: number }
  // quality
  | { type: "quality/add"; quality: Id<"quality">; amount: number }
  // activity
  | { type: "activity/hunt" } // the slot's param names the job
  | { type: "activity/start-job"; job: Id<"activity"> | { term: string } }
  /** `side` names the side slot (the home side job ends at the flight, activity:side-job-holds-a-slot). */
  | { type: "activity/end-job"; why: string; side?: true }
  | { type: "activity/gig"; min: number; max: number; perTech: number }
  /** The open set piece is the named activity's quiz: its right answers are counted and a pass applies the quiz's effects (activity:waiting-months-build-profile). */
  | { type: "activity/exam"; activity: Id<"activity"> }
  // document
  | { type: "document/request"; document: Id<"document"> }
  | { type: "document/grant"; document: Id<"document"> }
  | { type: "document/void"; document: Id<"document"> }
  // route
  | { type: "route/hear"; route: Id<"route">; chanceBp?: number; via: string }
  /** Looks into a route heard of. `route` names it (decision 0001); without it, the slot's param or a string term does. */
  | { type: "route/look-into"; route?: Id<"route"> }
  | { type: "route/apply-school" } // the slot's param names the school
  | { type: "route/apply"; route: Id<"route"> }
  | { type: "route/support"; route: Id<"route">; currency: Currency; amount: Amount }
  /** route:education-loan-pays-the-school: what a regulated education loan paid the school on this route, in pence. */
  | { type: "route/loan"; route: Id<"route">; amount: Amount }
  /** route:family-pledge-pays-tuition: a charge abroad the student's own money cannot meet, in its currency, met from the family's pledge while it stands. */
  | { type: "route/pledge-pay"; currency: ForeignCurrency; amount: number }
  /** The family's gift for the route is recorded on it, in naira (route-gates:family-gift-counts-with-deed). */
  | { type: "route/gift"; route: Id<"route">; amount: Amount }
  /** The set piece finished: its score goes on the route's open visa application (route:answers-score-and-close). */
  | { type: "route/interview-scored"; route: Id<"route">; score: number }
  /** A sponsor, agent or connection is recorded on a gate route. `fraud` is hidden on the route. */
  | { type: "route/record-sponsor"; route: Id<"route">; employer: string; salary: number; fraud: boolean }
  /** The road chain moves to a step or ends: docs/rules/road.md. */
  | { type: "route/road-step"; step: string }
  /** The pool entered on the points route, from `activity.enter-pool` (route-gates:entering-the-pool). */
  | { type: "route/enter-pool"; route: Id<"route"> }
  // setpiece
  /** Open a set piece. With a route, the score goes to its visa application; with none, nothing is scored (route:answers-carry-effects). */
  | { type: "setpiece/open"; setpiece: Id<"setpiece">; route: Id<"route"> | null }
  /** Closes the open scene unscored (a flight during a road scene, road:road-night-allows-turn-back). */
  | { type: "setpiece/close"; setpiece: Id<"setpiece"> }
  /** A moment with the bond the slot's param names (person:talking-adds-moments). */
  | { type: "people/moment"; kind: Moment["kind"] }
  /** Withdraws an application in progress (person:one-left-keeps-own-gains). */
  | { type: "route/withdraw"; route: Id<"route"> }
  /** Permission in the country is lost: every route into it that was flown is known again (route:lapsed-route-known-again). */
  | { type: "route/lapse"; country: Id<"country"> }
  /** A student in the country is withdrawn: the study route flown is known again, its course set aside (status:course-passed-or-withdrawn). */
  | { type: "route/set-aside"; country: Id<"country"> }
  /** A withdrawn student is reinstated: the course set aside is the route's again, and it is departed (status:course-passed-or-withdrawn). */
  | { type: "route/reinstate"; country: Id<"country"> }
  /** The application just sent on this route, resting on this bond, opens the genuineness interview (interview:partner-application-opens-interview, interview:thin-record-triggers-interview). */
  | { type: "interview/open"; route: Id<"route">; bond: string }
  /** The interview open for this route closes unscored (person:joint-collapses-with-bond, interview:players-answer-at-own-pace). */
  | { type: "interview/close"; route: Id<"route"> }
  /** The character arrived on this route, as the people slice records it (person:partner-application-decided). */
  | { type: "people/arrived"; route: Id<"route"> }
  /** One month of social assistance taken, counted while `arrived` names this route (undertaking:social-assistance-offer). */
  | { type: "people/assistance-taken"; route: Id<"route"> }
  // obligation
  /** `bond`: the bond an undertaking is for (undertaking:landing-opens-undertaking). */
  | { type: "obligation/open"; obligation: Id<"obligation">; principal?: Amount; amount?: Amount; bond?: string }
  /** abroad-money:missed-tuition-runs-in-stages: the open obligation of this entry is turned into a payment plan to course month 12. */
  | { type: "obligation/plan"; obligation: Id<"obligation"> }
  // offer: opens nothing when the offer's own `when` does not hold
  | { type: "offer/open"; offer: Id<"offer"> }
  /** Closes an open offer unanswered, as a family request handled in another life (person:family-requests-shared). */
  | { type: "offer/close"; offer: Id<"offer"> }
  /** The day's arrivals (offer:day-arrivals-roll-offers): rolls as the come-up phase does and opens at most `max` offers inside the month's cap. */
  | { type: "offer/come-up"; max: number }
  // obligation, whole life
  /** With `obligation`, only that entry's (route:education-loan-pays-the-school: the loan closed by a refusal). */
  | { type: "obligation/close"; obligationType: ObligationType; obligation?: Id<"obligation"> }
  /** The next charge of the open obligation of this type that applies where the character lives falls by `bp` of its amount, once (obligation:cooking-and-fetching-water). */
  | { type: "obligation/relief"; obligationType: ObligationType; bp: number }
  // place (docs/rules/place.md)
  | { type: "place/move"; to: Where; country: Id<"country"> | null }
  /** The authority sends the character home with this shape, as `return/home` would (place:return-home-paid-or-assisted, road:exit-is-assisted-return, status:removal-sends-home-banned). */
  | { type: "place/return"; shape: ReturnShape }
  // status (docs/rules/status.md)
  /** `kept`: a status kept from a return with papers carries on with the months it had (return:papers-return-keeps-status). */
  | { type: "status/grant"; status: Id<"status">; job?: Id<"activity">; kept?: KeptStatusMonths }
  | { type: "status/lose" }
  /** status:graduate-visa-applied-for: the fee and the surcharge for the months are paid, and the status the course leads to is granted in country. */
  | { type: "status/graduate" }
  /** status:course-passed-or-withdrawn: the student is withdrawn: the permission is cut to end `tuning.status.curtailMonths` on. */
  | { type: "status/withdraw" }
  /** status:course-passed-or-withdrawn: everything owed is paid, the student is reinstated with the status's own end. */
  | { type: "status/reinstate" }
  | { type: "status/remove" }
  | { type: "status/clock-start" }
  // credit (docs/rules/credit.md)
  | { type: "credit/mark"; amount: number }
  | { type: "credit/judgment" }
  // goal (docs/rules/goal.md)
  | { type: "goal/open"; goal: Id<"goal"> }
  | { type: "goal/done"; goal: Id<"goal"> }
  // turn
  | { type: "turn/refill" }
  /** A now-act spends free time of the month, in half-days (turn:month-lived-in-half-days, activity:now-acts-spend-half-days). */
  | { type: "turn/spend-days"; halfDays: number }
  /** Locks free slots for some months (turn:slots-can-be-locked). */
  | { type: "turn/lock"; slots: number; months: number; why: string }
  /** The one final ending: the road's `lost` (road:lost-is-final). Departure does not end the life. */
  | { type: "turn/finish" }
  // home (docs/rules/home.md)
  /** The move an answer makes, as `home/move` does (home:move-home-once-a-month, home:taken-in-after-eviction). */
  | { type: "home/move"; place: HomePlace }
  /** The character is taken in by a host of this kind for `tuning.home.guestMonths` (home:taken-in-after-eviction). */
  | { type: "home/guest"; host: HomeHost }
  // things
  /** Leaving Lagos, what is owned is sold at its resale figure, as the room is let go (place:departure-moves-abroad). */
  | { type: "things/sell-off" };

export type EffectType = Effect["type"];

/** Why an effect is being carried out. Passed to the kind that handles it. */
export interface Cause {
  /** The activity, offer choice or obligation that produced the effect. */
  source: string;
  /** The slot pick's param, when the effect came from a slot. */
  param: string | null;
  /** The terms of the offer or obligation in hand, for amounts that read a term. */
  terms: Terms;
}

export type Terms = Record<string, number | string>;

// ---------------------------------------------------------------------------
// Content entries
// ---------------------------------------------------------------------------

export interface QualityEntry {
  id: Id<"quality">;
  group: "education" | "work" | "skills" | "proof" | "people" | "self";
  min: number;
  max: number;
  /** Shown on the profile. Hidden ones still follow every other rule. */
  shown: boolean;
  /** Routes a gain in this quality counts toward. Shown beside every gain. */
  counts: Id<"route">[];
  /** Where a life starts when its scenario says nothing (quality:body-belly-and-energy, the body). Missing: `min`. */
  start?: number;
}

export interface ActivityEntry {
  id: Id<"activity">;
  /** `side` holds one free slot while kept: activity:side-job-holds-a-slot. `none` fills no slot: it rides with the month (turn:free-slots-per-month, advice:someone-who-went-answers-free). */
  slot: "main" | "free" | "side" | "none";
  /** A job that keeps paying through a sick month (health:sick-pay-unless-sick-leave). Missing means no. */
  sickLeave?: boolean;
  /** Where it applies. Missing means `home`. ladders:activities-filtered-by-where. */
  where?: WhereEntry;
  /** Abroad: the country it belongs to. Null or missing: every country. */
  country?: Id<"country"> | null;
  /** A job within the student cap (ladders:student-holds-one-part-job). */
  part?: boolean;
  /** Cash work: paid to cash, untaxed, pay may be withheld (ladders:cash-jobs-paid-in-hand). */
  cash?: boolean;
  withheldBp?: number;
  /** A job that carries its own sponsorship certificate (ladders:sponsor-job-ties-status). */
  sponsor?: boolean;
  /** Needs the car (car:open-finance-gives-the-car). */
  needsCar?: boolean;
  /** Yearly bonus paid while the character has the car, in the pay's currency. */
  carBonus?: number;
  /** A side job's pay by level: the highest tier whose `needs` all hold pays, else `pay` (activity:side-jobs-pay-by-tier). Missing: no tiers. */
  tiers?: ActivityTier[];
  /** A naira job's employer, read by the yearly pay review (activity:naira-pay-reviewed-yearly): `own` work grows by its own rule. Missing: not reviewed. */
  employer?: "formal" | "informal" | "own";
  /**
   * A tech study's gain a month by band of `quality.tech` (quality:skill-bands-slow-gains), one figure for each band of
   * `tuning.quality.techBands` from the first; a band with no figure gives nothing. Missing: no gain by band.
   */
  bandGains?: number[];
  /** The figure a gain by band never takes tech past (activity:paid-tech-courses, "up to 59"). Missing: no ceiling beyond the bands. */
  bandUntil?: number;
  /**
   * A tech study path of so many months (activity:paid-tech-courses): held from its first month until its months are done, one at a time,
   * then `effects` and its line. Missing: not a path.
   */
  course?: ActivityCourse;
  /** True: one slot a month at most; a second pick in the same month is not legal (activity:waiting-months-build-profile). Missing: no limit. */
  once?: true;
  /** When it answers (activity:now-acts-and-month-acts): `now` runs at once by `activity/now`, `month` stays a slot pick. Missing: `month`. */
  when?: "now" | "month";
  /** The month's free time a now-act spends, in half-days (activity:now-acts-spend-half-days): 1 a morning, 2 a day, 4 a weekend, 10 a week. Missing: a morning for a now-act, none for a purchase or a month-act. */
  halfDays?: number;
  /** A now-act that may run again in the same month, each time counted as played, until the month's free time is spent (activity:acts-may-repeat-in-month). Missing: once a month. */
  repeat?: true;
  /** A now-act that is a purchase runs as often as money allows; any other now-act once a month (activity:now-acts-and-month-acts). Missing: no. */
  purchase?: true;
  /** Effects applied in the month the activity fills a slot for the `at`th time, and every `at`th time with `repeat` (activity:waiting-months-build-profile). Missing: none. */
  onMonth?: ActivityMilestone[];
  /** A quiz sat as a set piece: `pass` right answers or more apply `effects` when the paper is marked (activity:waiting-months-build-profile). Missing: no quiz. */
  exam?: ActivityExam;
  requires: Requirement[];
  /** What the player picks along with a free-slot activity. `route` lists routes heard of; `known-route` lists routes known (the sponsor's find). */
  param: "job" | "route" | "known-route" | "school" | null;
  /** Taken when the activity resolves. If it cannot be paid the activity fails and nothing else happens. */
  cost: Cost[];
  /** Jobs only: monthly pay, to the bank. */
  pay: Money | null;
  /** Jobs only: the chance one month of hunting lands it, before the network bonus. */
  hireBp: number | null;
  effects: Effect[];
  counts: Id<"route">[];
}

/** One rung of a side job's pay (activity:side-jobs-pay-by-tier): it pays once every one of its `needs` holds. */
export interface ActivityTier {
  needs: Requirement[];
  pay: Money;
}

/** A tech study path's length and what finishing it gives (activity:paid-tech-courses). */
export interface ActivityCourse {
  months: number;
  effects: Effect[];
}

/** Effects tied to the count of months an activity has filled a slot (activity:waiting-months-build-profile). */
export interface ActivityMilestone {
  at: number;
  repeat?: true;
  effects: Effect[];
}

/** A quiz: the set piece it is sat as, the right answers that pass, and what a pass gives (activity:waiting-months-build-profile). An answer is right when its `score` is above zero. */
export interface ActivityExam {
  setpiece: Id<"setpiece">;
  pass: number;
  effects: Effect[];
  /** The sittings to pass before `effects` apply, each pass short of it counted (document:trade-papers). Missing: one. */
  sittings?: number;
}

export interface DocumentEntry {
  id: Id<"document">;
  /** Months until it is issued: a draw between the two, both included. Zero means at once. */
  wait: [min: number, max: number];
  /** Null means it never expires. */
  validMonths: number | null;
  /** How its value is set when issued. */
  result: "english-band" | null;
}

export interface SchoolEntry {
  id: Id<"school">;
  route: Id<"route">;
  /** Pence. */
  tuition: number;
  deposit: number;
  minGrade: number;
  offerBp: number;
  /** Given to everyone at or above the grade. Pence. */
  autoDiscount: { minGrade: number; amount: number } | null;
  /** A draw. Pence. */
  meritDiscount: { bp: number; amount: number } | null;
  answerMonths: [min: number, max: number];
}

export interface ChecklistItem {
  id: string;
  weight: number;
  requirement: Requirement;
  /** A slow item earns part of its weight as it fills: weight * have / need, rounded down. */
  partial: boolean;
}

export interface RouteEntry {
  id: Id<"route">;
  /** Which steps the route runs through: route-gates:route-runs-its-gate-steps. */
  gate: RouteGate;
  country: Id<"country"> | null;
  /** The status held abroad after departure. Null for the road. */
  status: Id<"status"> | null;
  /** The route's own refusal base, in place of the tuning base (route-gates:gate-decision-draw-terms). */
  refusalBaseBp: number;
  flightPaidByEmployer: boolean;
  hearIf: Requirement[];
  /** A character who meets `hearIf` has heard by this month at the latest. Null: never by itself. */
  hearBy: number | null;
  /** Null for the road, which has no window. */
  window: Id<"var"> | null;
  checklist: ChecklistItem[];
  /** Study gate. */
  schools: Id<"school">[];
  interview: Id<"setpiece"> | null;
  /** Sponsor gate: the salary bar and the maintenance line, as vars. */
  sponsor?: {
    salaryVar: Id<"var">;
    maintenanceVar: Id<"var"> | null;
    findBp: number;
    bandMin: number;
    documents: Id<"document">[];
    strictnessVar: Id<"var">;
    surchargeYears: number;
    job: Id<"activity">;
    /** The employers who may sponsor while the route's window is shut (route-gates:nurses-sponsored-while-care-shut). Empty: none. */
    openWhileShut: string[];
  };
  /** Points gate. `spouseTable`: the lead's columns with a spouse and the spouse's factors (person:canada-spouse-points). Null: no spouse counts. */
  points?: { table: Id<"points">; spouseTable: Id<"points"> | null; fundsVar: Id<"var">; cutoffVar: Id<"var">; careCutoffVar: Id<"var"> | null; educationCutoffVar: Id<"var"> | null; feeVar: Id<"var">; decisionVar: Id<"var">; profileMonths: number };
  /** Endorsement gate. */
  endorsement?: { document: Id<"document">; baseBp: number; perPortfolioBp: number; perNetworkBp: number; capBp: number; cooldown: number; feeVar: Id<"var">; surchargeYears: number };
  /** Contract gate. */
  contract?: { medical: Id<"document">; maxAgeMonths: number };
  /** The route a partner may follow as a dependant, or null when this route brings none (person:dependant-status-ends-with-lead). */
  dependants: Id<"route"> | null;
  /** The partner gate (person:partner-gate-needs, person:partner-application-decided and person:partner-status-renews). */
  partner?: { sponsorStatuses: Id<"status">[]; bandMin: number | null; feeVar: Id<"var">; surchargeYears: number; decisionMonths: number; livingTogetherMonths: number | null; floorVar: Id<"var"> | null };
  /** The dependant gate (person:dependant-gate-needs, person:dependant-application-decided, person:dependant-status-ends-with-lead and person:partner-routes-heard-via-bond). */
  dependant?: { maintenanceVar: Id<"var"> | null; leadMonthsExempt: number | null; feeVar: Id<"var"> | null; feeFromLead: boolean; decisionMonths: number };
  /** Road gate: the outcome tables by step, in basis points. */
  road?: { steps: { id: string; months: [min: number, max: number]; on: number; held: number; turned: number; lost: number }[] };
}

/** One row of a points table: docs/rules/route-gates.md. */
export interface PointsEntry {
  id: Id<"points">;
  /** Age in whole years to points. The last row's age is a floor. */
  age: { years: number; points: number }[];
  /** `quality.education-level` to points. */
  education: { level: number; points: number }[];
  /** English band (times ten) to points per ability; the last row's band is a floor. */
  language: { band: number; points: number }[];
  transfer: { educationLowBand: number; educationHighBand: number; workLowBand: number; workHighBand: number; workLongLowBand: number; workLongHighBand: number; highBand: number; workMonths: number; longMonths: number; cap: number };
  /** Points for a sibling in the country (person:canada-sibling-bonus). */
  siblingBonus: number;
  /** The spouse's factors when applying with a partner (person:canada-spouse-points). */
  spouse?: { education: { level: number; points: number }[]; language: { band: number; points: number }[]; canadianWork: { years: number; points: number }[]; cap: number };
  /** `quality.care` at or above this reads the care cut-off (route-gates:pool-draws-invite). */
  careMin: number;
  /** Months across `educationJobs` that read the education cut-off while it stands (route-gates:pool-draws-invite). */
  educationMonths: number;
  /** The teacher jobs whose months the education cut-off reads. */
  educationJobs: Id<"activity">[];
}

export interface SetpieceAnswer {
  id: string;
  score: number;
  /** When these hold, `thenScore` is used instead of `score`. */
  when: Requirement[];
  thenScore: number | null;
  /** Applied the moment the answer is given (route:answers-carry-effects). */
  effects: Effect[];
  /** Judged when the answer is given; an answer whose requirements fail is rejected `not-legal` (route:set-piece-answers-in-order). Missing: always allowed. */
  requires?: Requirement[];
  /** True: giving this answer closes the set piece with the questions after it unasked (route:answers-score-and-close). */
  closes?: true;
  /** The id of a question in the entry's `followUps`, asked next when this answer is given (route:answer-may-ask-follow-up). */
  followUp?: string;
}

export interface SetpieceQuestion {
  id: string;
  /** Asked only when these hold. */
  when: Requirement[];
  answers: SetpieceAnswer[];
}

export interface SetpieceEntry {
  id: Id<"setpiece">;
  /** How many questions are asked. */
  ask: number;
  /** `fixed`: the first `ask` questions whose conditions hold, in the order written. Missing: drawn on `visa` (route:set-piece-draws-questions). */
  order?: "fixed";
  questions: SetpieceQuestion[];
  /** Questions asked only after an answer that names one, never drawn (route:answer-may-ask-follow-up). Missing: none. */
  followUps?: SetpieceQuestion[];
}

export type ObligationType =
  | "upkeep"
  | "support"
  | "loan"
  | "held-funds"
  | "rent"
  | "phone"
  | "car"
  | "surcharge"
  | "tuition"
  | "agent-debt"
  | "undertaking"
  | "group-loan"
  | "ajo";

export interface ObligationEntry {
  id: Id<"obligation">;
  type: ObligationType;
  where?: WhereEntry;
  currency: Currency;
  /** Months between charges. Missing means every month. */
  everyMonths?: number;
  /** With `everyMonths`: the first period was paid when it opened, so the first charge falls `everyMonths` on (obligation:prepaid-entries-skip-first-charge). */
  prepaid?: boolean;
  /** Abroad: the credit mark needed to open it (credit:approval-reads-the-mark). */
  creditMin?: number;
  /** Paid and missed months move the credit file (credit:payments-move-the-mark). */
  reportsToCredit?: boolean;
  /** Paid by the activity that opens it, and returned when it closes by any way but its own default (abroad-money:arrival-opens-upkeep-and-room). */
  deposit?: number;
  /** The monthly rate by credit mark, first rung whose `min` the mark reaches (credit:rate-follows-credit-ladder). */
  rateByCredit?: { min: number; rateBp: number }[];
  /** The car: deposit, final payment, resale and thresholds (docs/rules/car.md). */
  car?: {
    price: number;
    depositBp: number;
    finalBp: number;
    resaleBp: number;
    courtThirdBp: number;
    handBackBp: number;
    courtMonths: number;
    /** The loan opened for what is still owed after the car goes (car:missed-payments-take-the-car, car:final-payment-owns-the-car). */
    shortfall: Id<"obligation">;
  };
  /** The group loan's named asset, taken on default (obligation:group-covers-misses-at-cost). */
  seize?: Effect[];
  /** A fixed charge each month. A scenario or an effect may override it. */
  amount: number;
  /** Monthly interest on the opening principal. */
  rateBp: number;
  /** Months over which the principal is repaid in equal parts. Null: no schedule. */
  term: number | null;
  sink: Reason;
  interestSink: Reason;
  /** Months a charge may be missed before `onDefault`. */
  grace: number;
  onMiss: Effect[];
  onDefault: Effect[];
  /**
   * abroad-money:tuition-paid-in-instalments: the share of the principal due in each course month, in basis points, the last rounded so the whole
   * is paid. With a schedule a miss runs abroad-money:missed-tuition-runs-in-stages in place of the grace count. Missing: `term` and `everyMonths` set the charges.
   */
  schedule?: number[];
  /** abroad-money:missed-tuition-runs-in-stages: applied when access is cut, the second month in arrears with no plan. */
  onCut?: Effect[];
  /** route:education-loan-pays-the-school: the loan is paid to the school, so opening it credits nothing. */
  paysSchool?: true;
  /** route:education-loan-pays-the-school: nothing is charged before this status is held, nor while it is; charges start the month after it ends. */
  deferWhile?: Id<"status">;
}

export type TermSpec =
  | number
  | { from: "quality"; quality: Id<"quality">; times: number }
  | { from: "pay"; times: number; cap: number }
  | { from: "range"; min: number; max: number; step: number }
  /** route:education-loan-pays-the-school: the tuition the route's school still asks: its tuition less its discount, the deposit and what a loan paid. */
  | { from: "tuition-left"; route: Id<"route"> };

export interface OfferChoice {
  id: string;
  requires: Requirement[];
  /** The player picks an amount between the two terms named here. It becomes the term `amount`. */
  pick: { minTerm: string; maxTerm: string } | null;
  effects: Effect[];
  /** Used in place of `effects` when the offer is secretly a fraud. */
  fraudEffects: Effect[] | null;
}

export interface OfferEntry {
  id: Id<"offer">;
  group: "family" | "job" | "money" | "life" | "road" | "abroad" | "return";
  where?: WhereEntry;
  /** The road: how the chance moves with the character's situation (road:pitch-rises-with-pressure). */
  pressure?: { refusalBp: number; defaultBp: number; lowStandingBp: number; perYearOver30Bp: number; strongRouteBp: number };
  /** The road pitch: what the offer really is, in basis points (road:taking-pitch-pays-deposit). */
  kinds?: { fraud: number; realish: number; road: number };
  /** A win from the world or the profile; its `when` may never read money (luck:luck-never-reads-money). */
  luck?: boolean;
  /** A blow; rolls at half chance while the character is down (luck:no-kicking-while-down). */
  bad?: boolean;
  /** What the choice that takes the slot will lock, said a month ahead; the choice's own `turn/lock` effect does the locking (health:forced-months-warned-ahead). */
  lockNext?: { slots: number; months: number; why: string };
  /** Rolled each month while these hold. */
  when: Requirement[];
  /** Zero: never rolled. It opens only when an effect opens it. */
  chanceBp: number;
  /** Months before it may come up again. */
  cooldown: number;
  maxTimes: number | null;
  expiresAfter: number;
  terms: Record<string, TermSpec>;
  /** The chance it is a fraud, decided when it opens and kept in `secret`. */
  fraudBp: number;
  /**
   * Things an attentive player can notice. Each is shown or not when the offer
   * opens, with one chance if the offer is honest and another if it is a fraud.
   */
  signs: { key: string; honestBp: number; fraudBp: number }[];
  choices: OfferChoice[];
  /** The choice applied if it lapses. Null: nothing happens. */
  onExpire: string | null;
}

export interface ChapterEntry {
  id: Id<"chapter">;
  order: number;
  items: { id: string; requirement: Requirement }[];
  /** An item that closes the chapter alone when it is met, whatever the others say (chapter:met-items-close-the-chapter). */
  closesOn?: string;
  /** advert:no-adverts-on-protected-screens: no advert shows while this chapter is open. */
  noAdverts?: boolean;
  /** chapter:chapters-follow-lean-route: the way out this variant is for. Set with `variantOf`, never alone. */
  route?: Id<"route">;
  /** chapter:chapters-follow-lean-route: the base chapter this one stands in for when the life leans to `route`. */
  variantOf?: Id<"chapter">;
}

/** docs/rules/advert.md: a slot an advert may fill. The simulation never reads it. */
export interface AdvertSlotEntry {
  id: Id<"advert">;
  surface: "billboard" | "poster" | "phone-tile" | "shopfront";
  place: string;
  width: number;
  height: number;
  maxBytes: number;
}

/** docs/rules/guide.md: a guide, with its sources and sections as text keys. The simulation never reads it. */
export interface GuideEntry {
  id: Id<"guide">;
  routes: Id<"route">[];
  /** Kind names; the content check proves each is one (the schema keeps strings so the proof holds). */
  kinds: string[];
  sources: { url: string; title: string; readOn: string }[];
  checkedOn: string;
  sections: string[];
}

/** docs/rules/analytics.md: one counter the client or the server may count. */
export interface CounterDef {
  name: string;
  keys: string[] | "region" | "id";
  source: "server" | "client";
}

/** The fixed emote set of a player's own figure (docs/design/09-the-games-look.md, section 5); no screen uses it. */
export type Emote = "wave" | "clap" | "sit" | "dance";

export interface VarEntry {
  id: Id<"var">;
  start: number;
}

/**
 * Where a story is heard, shown beside it on News as a small icon and a word. A person is named in the words,
 * `<id>.<stage>.source`. The engine never reads it.
 */
export type NewsSource = "radio" | "paper" | "official" | "street" | "person";

export interface NewsEntry {
  id: Id<"news">;
  /**
   * Where each stage past the rumour is heard: the announcement's, unless a later stage names its own. A rumour
   * has none: the screen marks it a rumour, so talk never reads like a changed rule. Content gives one for every
   * story (the content check); a test's own story may leave it out.
   */
  source?: { announced: NewsSource; "in-force"?: NewsSource; ended?: NewsSource };
  /** Routes it matters to. Decides the "for you" mark. */
  touches: Id<"route">[];
  /** Routes a character hears of by reading it. */
  hear: Id<"route">[];
  /** The director's fields: docs/rules/director.md. Missing means the fixed schedule in `standIn` is used. */
  director?: {
    group: string;
    needs: Requirement[];
    cooldown: number;
    once: boolean;
    shock: boolean;
    /** The story whose coming into force ends this one. */
    endedBy: Id<"news"> | null;
    /** Values added to variables (rather than set) when it comes into force. */
    adds: { var: Id<"var">; value: number }[];
  };
  /** How the stand-in world schedules it. */
  standIn: {
    chanceBp: number;
    /** Ticks between which it is announced, or the lag after another story reaches a stage. */
    announce: { between: [min: number, max: number] } | { after: Id<"news">; stage: NewsStage; lag: [min: number, max: number] };
    /** Ticks of rumour before the announcement. Zero: no rumour. */
    rumourLead: number;
    /** Ticks from announcement to in force. Never less than two. */
    forceLag: number;
    /** Ticks in force before it ends. Null: it stays. */
    endsAfter: number | null;
    /** Values the world's variables take while it is in force. They stay after it ends unless `revert` is true. */
    sets: { var: Id<"var">; value: number }[];
    revert: boolean;
  };
}

export interface CountryEntry {
  id: Id<"country">;
  currency: Currency;
  /** The fare home, one way, in the currency's smallest unit (place:fare-home-in-local-currency). */
  fare: number;
  decemberFactorBp: number;
  taxFreeLine: number;
  taxBp: number;
  upkeep: Id<"obligation"> | null;
  rentRoom: Id<"obligation"> | null;
  rentFlat: Id<"obligation"> | null;
  phone: Id<"obligation"> | null;
  overstayer: Id<"status"> | null;
  deceptionBanMonths: number;
  /** Months after arriving through a partner before sponsoring a new one (undertaking:sponsored-arrivals-wait-to-sponsor). */
  partnerBarMonths: number;
  /**
   * Where the room abroad stands on the country's painted map, in thousandths of a degree (design pages 10 and 11,
   * world:painted-maps-abroad): a made-up spot, since the room is country-less and has no position of
   * its own. Null for a country with no painted map.
   */
  homeSpot: { latE3: number; lonE3: number } | null;
}

export interface StatusEntry {
  id: Id<"status">;
  country: Id<"country">;
  /** Months it lasts. Null: it does not expire. A var id reads the length from the world; `lead`: as long as the lead's status (person:dependant-status-ends-with-lead). */
  months: number | Id<"var"> | "lead" | null;
  work: WorkRule;
  /** Who may come as a dependant: none, anyone, or holders of these jobs (person:dependant-status-ends-with-lead). */
  dependants: "none" | "any" | Id<"activity">[];
  /** A status that ends when the partnership ends, with the clock (person:ender-pays-in-standing). */
  tiedTo: "partner" | null;
  /** Months on the clock when the job goes. Null: no clock; `lapsesAtOnce` says the status lapses instead. */
  clockMonths: number | null;
  lapsesAtOnce: boolean;
  renewMonths: number;
  /** The employer's renewal chance on the status stream in the contract's last month (status.md, the Gulf renewal). */
  renewBp?: number;
  renewFeeVar: Id<"var"> | null;
  surchargeYearVar: Id<"var"> | null;
  /**
   * The course a student status runs (status:status-sets-work-rule, status:graduate-visa-applied-for): the course months whose `part` job pays full time,
   * the course month from which any job may be held, the status applied for once the course is passed, with its fee and surcharge vars, and the
   * course month from which the view carries the application's cost.
   */
  course?: { vacations: number[]; anyFrom: number; graduate: Id<"status">; feeVar: Id<"var">; surchargeYearVar: Id<"var">; costFrom: number };
  /** status:renewing-a-status: held with one of these jobs, the renewal is at `feeVar` with no surcharge (the Health and Care fee). Missing: every job renews at `renewFeeVar`. */
  renewByJob?: { jobs: Id<"activity">[]; feeVar: Id<"var"> };
  next: Id<"status"> | null;
  nextIf: Requirement[];
  countsToSettlement: boolean;
  countsFromBefore: boolean;
  settleMonthsVar: Id<"var"> | null;
  settleFeeVar: Id<"var"> | null;
  settled: Id<"status"> | null;
  citizenAfter: number | null;
  citizenFeeVar: Id<"var"> | null;
  citizen: Id<"status"> | null;
  banMonths: number;
  detectBp: number;
  holdsPassport: boolean;
  /** The overstayer's fields (status.md, "Entries: overstaying, country by country"), read on the overstayer only; missing reads as 0 or none. Months of grace, the lapse's own month the first (status:grace-before-overstaying). */
  graceMonths?: number;
  /** Months a notice gives before removal (status:detection-gives-notice). */
  noticeMonths?: number;
  /** The ban for going home at one's own fare after the grace (place:leaving-an-overstay-bans). */
  ownFareBanMonths?: number;
  /** The ban for the assisted return or the returns service (place:leaving-an-overstay-bans). */
  assistedBanMonths?: number;
  /** The landlord's check a month past the grace, in basis points (abroad-money:right-to-rent-check). */
  rentCheckBp?: number;
  /** The returns service's grant, in the country's smallest unit (place:returns-service-takes-you-home). */
  returnGrant?: number;
  /** The overstay fine a month past the grace, in the country's smallest unit (status:uae-fine-accrues). */
  finePerMonth?: number;
}

export interface GoalEntry {
  id: Id<"goal">;
  where: WhereEntry;
  openIf: Requirement[];
  doneIf: Requirement[];
  reward: Effect[];
}

/** One place of the city: city:place-shows-only-the-view, city:overheard-talk-from-view, city:place-entry-fields, city:four-kinds-of-name, city:namesakes-never-shown, city:made-up-names-checked, city:positions-rough-on-purpose, city:positions-not-for-geometry, city:places-stage-their-acts, city:set-piece-shown-where-staged, city:enterable-places-follow-view, city:ojuelegba-is-the-hub, city:crowd-sample-capped, city:players-fill-the-crowd, city:dress-mix-by-place, city:sample-seeded-by-date, city:places-load-on-entry, city:two-graphics-modes, city:landmarks-built-to-outline, city:credits-screen-attributions, city:sponsor-shows-name-only, city:road-places-are-stylised and city:place-words-are-text-keys. Read by the city and the content check, never by a kind. */
export interface PlaceEntry {
  id: Id<"place">;
  where: Where;
  /** Null at home and on the road. */
  country: Id<"country"> | null;
  /** A slug such as "lagos" or "calgary". */
  city: string | null;
  /** A slug; null for a stylised place. */
  area: string | null;
  nameKind: "public" | "institution" | "business" | "stylised";
  /** The real name of a public place, else null (city:four-kinds-of-name). */
  realName: string | null;
  /** Thousandths of a degree, or null. */
  position: { latE3: number; lonE3: number } | null;
  data: { source: "osm" | "overture" | "own"; licence: "ODbL-1.0" | "CDLA-Permissive-2.0" | null; checked: string } | null;
  sponsor: { key: string } | null;
  scope: "exterior" | "interior";
  hub: boolean;
  occasion: boolean;
  /** What is staged here, by id (city:places-stage-their-acts). */
  stages: (Id<"activity"> | Id<"offer"> | Id<"setpiece"> | Id<"chapter">)[];
  crowd: { low: number; high: number; target: number };
  traditionalBp: number;
  /** The folder under `public/assets/places/`. */
  assets: string;
  /** place:employer-shuttle-rides-free (decision 0017): the employer's shuttle serves it, so a ride by bus to or from it asks no fare. */
  shuttle: boolean;
}

// ---------------------------------------------------------------------------
// People, pairs and the interview: docs/rules/person.md, pair.md, interview.md
// ---------------------------------------------------------------------------

export type BondStage = "connected" | "courting" | "partner" | "married" | "ended";
export type PersonLabel = "player" | "computer" | "stand-in";

/** A computer character who can fill a slot: docs/rules/person.md "Entries". */
export interface PersonEntry {
  id: Id<"person">;
  role: "partner" | "sibling";
  weight: number;
  when: Requirement[];
  profile: {
    ageGapMonths: [min: number, max: number];
    eduLevel: number;
    englishBand: number | null;
    care: number;
    tech: number;
    home: "city" | "town";
    job: Id<"activity"> | null;
    pay: Money | null;
    country: Id<"country"> | null;
    status: Id<"status"> | null;
    abroadFromMonth: number | null;
    settledStatus: Id<"status"> | null;
    settledFromMonth: number | null;
  };
  behaviour: { courtMonths: number; agreeBp: number; marryAfterMonths: number; marryInDecember: boolean; patienceMonths: number | null; jealousBp: number; recallBp: number; plan: string; papers: boolean };
  spots: string[];
  whats: string[];
  calls: string[];
}

/** What one life knows of another person (person:both-lives-step-together): facts, never state. */
export interface PersonFacts {
  label: PersonLabel;
  ageMonths: number;
  where: Where;
  country: Id<"country"> | null;
  status: Id<"status"> | null;
  statusMonthsLeft: number | null;
  monthsInCountry: number;
  job: Id<"activity"> | null;
  meetsFloor: Partial<Record<Id<"route">, boolean>>;
  eduLevel: number;
  englishBand: number | null;
  home: "city" | "town";
  joint: { route: Id<"route">; state: RouteStateName } | null;
  funds: Money | null;
  assistanceTaken: number;
  sponsorReady: Id<"route"> | null;
}

export interface Moment {
  n: number;
  by: "me" | "them";
  kind: "met" | "call" | "said" | "wedding";
  spot: string | null;
  what: string;
  tick: number;
}

export interface Proposal {
  step: "partner" | "marry" | "joint" | "landed";
  route: Id<"route"> | null;
  lead: "me" | "them" | null;
}

export interface Bond {
  with: { kind: "computer"; entry: Id<"person"> } | { kind: "player"; pair: string };
  role: "partner" | "sibling";
  stage: BondStage;
  firstMonth: number | null;
  partnerMonth: number | null;
  marriedMonth: number | null;
  lastMomentMonth: number | null;
  moments: Moment[];
  facts: PersonFacts | null;
  pending: { mine: Proposal | null; theirs: Proposal | null };
  standIn: "warned" | "on" | null;
  ended: { month: number; by: "me" | "them" | "absence" | "block" | "drift" | "restart" } | null;
  cooldownUntil: number | null;
  /** This life's own consents for a joint on the bond, agreed or pending (person:money-counted-never-moved, person:stand-in-acts-narrowly). Null before any was given. */
  consent: { countFunds: boolean; standInMay: boolean } | null;
}

export interface PeopleSlice {
  slots: Record<string, { state: "empty" | "computer" | "invited" | "player" | "stand-in"; bond: string | null; person: Id<"person"> | null; invite: { looking: string; fill: string | null } | null }>;
  bonds: Record<string, Bond>;
  /** The view reads the two scores of person:canada-spouse-points fresh from the state: the slice holds none. */
  joint: { bond: string; route: Id<"route">; lead: "me" | "them"; countFunds: boolean; standInMay: boolean } | null;
  sponsoring: { bond: string; route: Id<"route">; month: number } | null;
  arrived: { route: Id<"route">; month: number } | null;
  assistanceTaken: number;
  /** Hidden. A computer partner's interview answers (interview:answers-scored-without-draw). */
  secret: { computerAnswers: Record<string, string> | null };
}

export type InterviewResult = "pass" | "doubt" | "fail" | "caught";

/** The genuineness interview's questions: docs/rules/interview.md "Entry". */
export interface InterviewEntry {
  id: Id<"interview">;
  ask: number;
  questions: {
    id: string;
    about: "couple" | "other";
    truth: "first-spot" | "first-what" | "last-spot" | "times-met" | "wedding-spot" | "calls" | "job" | "home" | "last-said" | null;
    needs: { met?: number; calls?: number; saidEach?: number; married?: boolean };
    options: string[] | "spots" | "whats" | "calls" | "wedding-spots" | "jobs" | "phrases";
  }[];
}

export interface InterviewSlice {
  /** `thin`: the record measured once, in the applicant's life at opening, and carried to the other life (interview:draws-made-in-one-life). */
  open: { pair: string; route: Id<"route">; questions: { id: string; options: string[] }[]; answers: string[]; standIn: boolean; thin: boolean } | null;
  /** `standIn` marks whose answers were a stand-in's, so the result view can say so (interview:stand-in-answers-when-absent). */
  last: { route: Id<"route">; result: InterviewResult; matched: number; asked: number; month: number; standIn: { a: boolean; b: boolean } } | null;
  /** Hidden. The true answers for the questions asked (interview:answers-taken-in-order). */
  secret: { truths: (string | null)[] | null };
}

/** The interview as the pair record holds it (interview:computer-answers-by-recall). */
export interface PairInterview {
  route: Id<"route">;
  questions: { id: string; options: string[] }[];
  answers: { a: string[] | null; b: string[] | null };
  standIn: { a: boolean; b: boolean };
  result: InterviewResult | null;
}

/** A preset phrase (pair:preset-phrases-only, pair:conversation-phrases-stored, pair:place-phrases-not-stored and pair:phrase-checks-before-send). */
export interface PhraseEntry {
  id: Id<"phrase">;
  fill: "spot" | "route" | "news" | "event" | "thing" | null;
  options?: string[];
  where: "conversation" | "place" | "both";
}

export interface PairMoment {
  n: number;
  by: "a" | "b";
  kind: "met" | "call" | "said" | "wedding";
  spot: string | null;
  what: string;
  tick: number;
}

/** The one row per pair the server keeps (pair:one-record-per-two, pair:record-fields, pair:record-holds-no-personal-data, pair:only-server-writes-record, pair:joint-steps-need-both-sides and pair:who-may-read-a-record). Pure data; the simulation's pair module reads and writes it. */
export interface PairRecord {
  id: string;
  a: string;
  b: string;
  role: "partner" | "sibling";
  stage: BondStage;
  since: Partial<Record<BondStage, number>>;
  invitedBy: "a" | "b";
  pending: { a: Proposal | null; b: Proposal | null };
  consent: { a: { countFunds: boolean; standInMay: boolean }; b: { countFunds: boolean; standInMay: boolean } };
  moments: PairMoment[];
  joint: { route: Id<"route">; lead: "a" | "b" } | null;
  interview: PairInterview | null;
  blocked: { a: boolean; b: boolean };
  standIn: { a: "warned" | "on" | null; b: "warned" | "on" | null };
  ended: { by: "a" | "b" | "absence" | "block" | "deleted"; tick: number } | null;
  held: boolean;
}

/** A stored phrase between two players (pair:conversation-phrases-stored). Times are the server's and never enter a state. */
export interface ConversationRow {
  id: string;
  conversation: string;
  sender: string;
  phrase: Id<"phrase">;
  fill: string | null;
  sentAt: number;
  readAt: number | null;
}

export interface EraEntry {
  id: Id<"era">;
  ticks: [min: number, max: number];
  /** Weight for each story group while this era runs. Missing group: 1. */
  weights: Record<string, number>;
  /** Weight of this era following each other era. Missing: 0. */
  after: Record<string, number>;
  once: boolean;
  story: Id<"news">;
}

/** A step of the prologue: docs/rules/prologue.md. */
export interface PrologueStep {
  id: string;
  months: number;
  /** The step after this one when no answer or draw says otherwise. Null: the prologue closes. */
  next: string | null;
  answers: {
    id: string;
    requires: Requirement[];
    effects: Effect[];
    flags: string[];
    gradeBase: number;
    /** Overrides `next`. */
    next: string | null;
    /** A draw after the answer: each outcome's basis points, its effects and where it leads. */
    draw: { id: string; bp: number; effects: Effect[]; next: string | null }[] | null;
  }[];
}

export interface ScenarioEntry {
  id: Id<"scenario">;
  /** True for `scenario.prologue`: the life is built by the prologue's choices (prologue:prologue-life-starts-empty). */
  prologue?: boolean;
  qualities: Record<Id<"quality">, number>;
  job: Id<"activity"> | null;
  tenure: Record<Id<"activity">, number>;
  /** Siblings the life starts with (person:invite-fills-a-slot). */
  siblings: number;
  /** A fixed life's hometown, `hometown.<slug>` (prologue:family-draw-on-first-answer); a life from sixteen reads its own from the family drawn. */
  hometown?: string;
  /** The character's sex, where the life says (streets:sex-optional-with-neutral-path); the prologue's life does not. */
  sex?: "f" | "m";
  pockets: Partial<Record<Currency, { bank: number; cash: number }>>;
  documents: { document: Id<"document">; monthsLeft: number | null; value: number | null }[];
  obligations: { obligation: Id<"obligation">; amount: number }[];
}

/** Numbers that are rules more than entries. Each is named in a rule page. */
export interface Tuning {
  turn: {
    cap: number;
    start: number;
    freeSlots: number;
    freeSlotsNoJob: number;
    maxLocked: number;
    /** The month's free time in half-days (turn:month-lived-in-half-days): the whole month lived by hand with no job; a job takes its own days and leaves the rest. */
    halfDays: { noJob: number; withJob: number };
    /** An act that repeats, kept as a commitment in a slot, runs this many times as the month turns (activity:acts-may-repeat-in-month). */
    repeatPerSlot: number;
    /** The day's coding class runs at most this many times a month (activity:study-days-capped). */
    studyDaysCap: number;
    /** The day's arrivals (offer:day-arrivals-roll-offers): shares of the month's free time, in basis points, at which one offer may come up as the time is lived. */
    arrivalsBp: number[];
    /** The body (quality:body-belly-and-energy): what each half-day lived takes off the belly and the energy, where the month's rest brings each back to, and what a hungry or spent month takes off wellbeing. */
    body: { bellyPerHalfDay: number; energyPerHalfDay: number; restTo: number; restBy: number; lowBelow: number; hungryWellbeing: number; spentWellbeing: number; spentBelow: number };
  };
  quality: {
    wellbeingRest: number;
    wellbeingDriftTo: number;
    wellbeingDrift: number;
    burnoutBelow: number;
    networkHireBp: number;
    hireMaxBp: number;
    /** A gain to a skill is halved, rounding up, once the skill is at or above this. */
    skillSoftAt: number;
    /** The share of a skill gain kept at or above the soft cap, rounding up (quality:high-skills-gain-slower). */
    skillSoftBp: number;
    /** The share of a skill gain kept while a side job is held, rounding up (activity:side-job-holds-a-slot). */
    sideJobSkillBp: number;
    /** The lowest figure of each band of tech, from the first (quality:skill-bands-slow-gains). */
    techBands: number[];
  };
  wallet: {
    bankChargeBp: number;
    /** The aboki buys foreign currency this far under the street rate. */
    streetSpreadBp: number;
    streetShortBp: number;
    streetShortLossBp: [min: number, max: number];
    lotMonths: number;
    flagDepositAbove: number;
    /** A naira credit of work, a gig, a prize or the prologue's earnings at or under this lands in cash, above it in the bank; a street debit at or under it is cash first (wallet:money-lands-as-in-lagos). */
    cashUpTo: number;
    /** Naira cash over this at a month's close draws the once-in-a-life warning (wallet:cash-pile-warning). */
    cashWarnAt: number;
    /** The passbook's stamps, in kobo held for the road, lowest first; the road's own target is the last stamp (the passbook). */
    stamps: number[];
  };
  rate: {
    start: Record<ForeignCurrency, number>;
    driftBp: number;
    noiseBp: number;
    premiumFloorBp: number;
    premiumPerSupplyBp: number;
    premiumNoiseBp: number;
    floatPremiumBp: number;
  };
  /** `bandStep`: bands move in steps of this, a band times ten (document:english-test-band-value). */
  english: { base: number; perHundred: number; noiseSteps: number; min: number; max: number; bandStep: number };
  route: {
    /** route:school-answers-by-grade: an offer's chance rises this much for each grade above the school's minimum, up to `offerMaxBp`. */
    offerPerGradeBp: number;
    offerMaxBp: number;
    /** route:visa-refusal-chance: the grade from which the good-grade figure comes off the chance of refusal. */
    goodGrade: number;
    /** route:refusal-reasons-recorded: an unexplained share at or above this makes `funds` a refusal reason. */
    fundsReasonBp: number;
    /** route:applying-to-a-school: months after a school's refusal before it takes a new application. */
    reapplyMonths: number;
    refusalPerStrictnessBp: number;
    refusalPerUnexplainedBp: number;
    refusalPerRefusalBp: number;
    refusalPerInterviewPointBp: number;
    refusalGoodGradeBp: number;
    refusalMinBp: number;
    refusalMaxBp: number;
    depositAdminFee: number;
    depositRefundMonths: number;
    decisionMonths: number;
    flight: Money;
    hintPrep: number;
    /** route:education-loan-pays-the-school: the lender's processing fee, in pence, and its fee added to the loan, in basis points. */
    loanProcessing: number;
    loanFeeBp: number;
  };
  offer: { maxNewPerMonth: number; maxOpen: number };
  place: { brokeLine: number; fareFromNaira: boolean };
  /** The streets' life (streets:buy-phone-at-computer-village, streets:phone-sales-job, streets:apprentice-learns-repair, streets:sleeping-under-the-bridge, streets:street-shopping-abroad, streets:street-finds-abroad, streets:peckham-talks-like-lagos and streets:stadium-morning-run). */
  street: { phonePrice: number; phoneMood: number; phoneNetwork: number; salesPay: number; salesHireBp: number; apprenticeTech: number; apprenticeUntil: number; theftBp: number; theftNaira: number; mosquitoBp: number; harassBp: number; harassMood: number; shoppingGbp: number; shoppingAed: number; shoppingMood: number; findBp: number; findMood: number; runMood: number };
  /** Things shipped home: the cargo office's handling charge, and what a laptop and clothes give (the parcel offer, `offer.parcel-shipped`). */
  parcel: { handling: number; laptopMood: number; clothesPrep: number };
  /** `absenceMonths` and `absenceWindowMonths`: the first or more months at home inside any run of the second sets the lawful months back to 0 (status:absence-breaks-settlement). */
  status: {
    courseMonths: number;
    hospitalChargeBp: number;
    overstayPartnerSettleMonths: number;
    rentCheckWellbeing: number;
    absenceMonths: number;
    absenceWindowMonths: number;
    /** status:status-sets-work-rule: what a `part` job pays in a vacation course month, in basis points of its month (37.5 hours for 20). */
    vacationPayBp: number;
    /** status:course-passed-or-withdrawn: the months a withdrawn student's permission runs on. */
    curtailMonths: number;
    /** abroad-money:missed-tuition-runs-in-stages: the payment plan's fee, in pence. */
    planFee: number;
  };
  /**
   * `judgmentCap`: while a judgment stands, `credit/min` above it is never met (credit:judgment-blocks-credit).
   * `cleanMonths`: months without a miss before the file drifts up (credit:clean-mark-drifts-up).
   */
  credit: { onTime: number; onMiss: number; onDefault: number; drift: number; driftTo: number; judgmentMonths: number; judgmentCap: number; returnPenalty: number; cleanMonths: number };
  car: { lessons: number; testFee: number; passBp: number; passPerAttemptBp: number; passCapBp: number };
  remit: { appFeeBp: number; appMarginBp: number; bankFeeBp: number; informalLossBp: number; abroadBp: number };
  return: { standing: Record<ReturnShape, number>; capitalPer: number; capitalCap: number; offerMonths: number; residentLapseMonths: number; ukKeptLapseMonths: number };
  director: { surgePerTick: number; closedTicks: number; maxNewPerTick: number; shockGapTicks: number; onlineTickScale: number };
  /**
   * `meansStep`: family means fall one point for each this much the family pays (road:road-truth-asks-more). The pressure
   * lines (road:pitch-rises-with-pressure): standing under `pressureStandingUnder`, each year of age over `pressureAgeOver`, and a
   * formal route at a japacity figure of `pressureStrongRoute` or more.
   */
  road: { enabled: boolean; meansStep: number; pressureStandingUnder: number; pressureAgeOver: number; pressureStrongRoute: number };
  /** `robberyWellbeing`: wellbeing lost to the one chance (activity:one-chance-bus-robbery). */
  ladder: { cashDetectBp: number; accountRent: number; overtimeBp: number; oneChanceBp: number; phone: number; robberyWellbeing: number };
  prologue: {
    startAgeMonths: number;
    siblings: [min: number, max: number];
    familyMeans: [min: number, max: number];
    cityBp: number;
    /** The parents' chance of schooling: this plus `parentsEducatedPerPoint` for each point of family means (prologue:family-draw-on-first-answer). */
    parentsEducatedBp: number;
    parentsEducatedPerPoint: number;
    /** Starting network by town, plus the educated parents' share; starting standing. */
    network: { city: number; town: number; educated: number };
    standing: number;
    /** The school certificate fee strains a family under `under`: standing changes by `standing` (prologue:steps-offer-legal-answers). */
    waecStrain: { under: number; standing: number };
    /** The degree's grade: base plus the grade base, up one at `upBp`, down one at `downBp`, kept between min and max. */
    grade: { base: number; upBp: number; downBp: number; min: number; max: number };
    /** A private university's session, passed through the account by the family (prologue:steps-offer-legal-answers). */
    privateSession: number;
    /** home:starting-charges-from-one-function: the family support a life from sixteen sends home once abroad, in kobo, before the remit share. */
    homeSupport: number;
    /**
     * prologue:family-draw-on-first-answer: the hometowns a family drawn in the city or in a town may be from, as
     * `hometown.<slug>` with words in content; one is read from the family drawn, never drawn on its own. `byHome`:
     * the hometown a home answer says the life was born to, the child of the water's Lagos (prologue:makoko-start-never-a-trap).
     */
    hometowns: { city: string[]; town: string[]; byHome: Record<string, string> };
  };
  /** advice.md: the four ways to look into a route, and the agents. */
  advice: { networkToAsk: number; adviserFee: number; agentKindsBp: { fixer: number; chaser: number; overpromiser: number; scammer: number }; fees: { fixer: [number, number]; overpromiser: [number, number]; scammer: [number, number] }; chaserFee: [number, number]; fixerMonths: number; chaserMonths: number; fakePapersFee: number; scamTells: number; overpromiseTells: number; floorNaira: number };
  /** `downUnder`: wellbeing or standing under this is "down" (luck:no-kicking-while-down); `rescueAfterMonths`: months played before the whip-round (luck:whip-round-once-per-life). */
  luck: {
    downUnder: number;
    rescueAfterMonths: number;
    rescue: number;
    rescueUnder: number;
    rescueRatio: number;
    drySpellMonths: number;
    drySpellBp: number;
    drySpellCapBp: number;
    /** Wellbeing gained on a won bet slip and lost on a lost one (luck:bet-slip-stake-and-odds). */
    betWellbeing: number;
    ticket: number;
    maxTickets: number;
    prizeSmall: number;
    prizeSmallBp: number;
    prizeMid: number;
    prizeMidBp: number;
    prizeJackpot: number;
    /** The jackpot's chance, in draws per million. */
    jackpotPerMillion: number;
    stake: number;
    betOddsBp: number;
    betWinBp: number;
    promo: number;
  };
  health: {
    runDownBelow: number;
    illnessBp: number;
    hospital: number;
    chemist: number;
    hospitalWorse: number;
    relapseChemistBp: number;
    relapseIgnoreBp: number;
    sickPayBp: number;
    gapMonths: number;
  };
  /** `cardLines`: the lines the send-off card names (chapter:send-off-card-on-close). `sendOffNaira`: the party at the house the month of the grant, in kobo (chapter:family-marks-the-grant). */
  chapter: { cardLines: number; sendOffNaira: number };
  /** `visit`: the second miss in a row, the officer and the group at the house (obligation:group-covers-misses-at-cost). */
  groupLoan: { feeBp: number; savingsBp: number; vanishBp: number; visit: { standing: number; wellbeing: number } };
  /** The waiting months' acts (activity:waiting-months-build-profile): a raise's size and its chance each month the player tries to be noticed. */
  /**
   * activity:waiting-months-build-profile's raise, activity:naira-pay-reviewed-yearly's review, activity:free-path-keeps-a-streak's path and
   * activity:paid-tech-courses and activity:bootcamp-paid-after-a-job's bootcamp.
   */
  activity: {
    raiseBp: number;
    raiseChanceBp: number;
    reviewFormalBp: number;
    reviewShareBp: number;
    reviewCapBp: number;
    reviewInformalBp: number;
    freePathData: number;
    freeStreakMonths: number;
    freeCertTech: number;
    bootcampFee: number;
    bootcampHireBp: number;
    bootcampHireMonths: number;
  };
  /** The room's basics (obligation:cooking-and-fetching-water): the share of the upkeep's next charge that cooking and fetching water take off. */
  room: { cookedBp: number; waterBp: number };
  /** The Friday draw (docs/rules/lottery.md): the ticket price, the cap per player, and the odds a draw takes when it opens (lottery:odds-fixed-at-draw-open). */
  lottery: { ticket: number; maxTickets: number; odds: LotteryOdds };
  /** docs/rules/advert.md Numbers. */
  advert: { maxSlotsPerPlace: number; maxPhoneTiles: number; impressionMs: number };
  /** docs/rules/share.md Numbers. */
  share: { width: number; height: number; maxBytes: number; previewWidth: number; previewHeight: number; previewMaxBytes: number };
  /** docs/rules/guide.md Numbers. */
  guide: { staleMonths: number };
  /** docs/rules/analytics.md Numbers. */
  analytics: { batchSeconds: number; maxBatchBytes: number; maxCount: number; batchesPerHour: number; minShown: number; refD1Bp: number; refD7Bp: number };
  /** The city's crowd bands, the graphics modes' switches and the screen split (docs/rules/city.md). The simulation never reads it. */
  city: { crowdLow: number; crowdHigh: number; fridayBp: number; saturdayBp: number; raiseAfterMs: number; raiseFrameMs: number; dropAfterMs: number; dropFrameMs: number; maxPixelRatio: number; desktopMinWidth: number; walkMmPerS: number; stopShortMm: number; roam: boolean; ride: { fareKobo: { danfo: number; keke: number; okada: number; walk: number }; farePerKmKobo: { danfo: number; keke: number; okada: number; walk: number }; metresPerMinute: { danfo: number; keke: number; okada: number; walk: number }; waitMinutes: number; scarcityBp: number; walkMetres: number; lonMetresPerE3: number; abroad: Record<Id<"country">, CountryRides> } };
  /** The people around the character (docs/rules/person.md Numbers). */
  people: { matchmaker: boolean; maxCourting: number; partnerMoments: number; marryAfterMonths: number; weddingShare: number; proposeCooldown: number; recourtMonths: number; gossipBp: number; weddingStanding: number; gossipStanding: number; endStanding: { courting: number; partner: number; married: number; applying: number }; endWellbeing: number; leftWellbeing: number; couchMonths: number; warnDays: number; standInDays: number; computerAfterMonths: number };
  /** Invites and phrases (docs/rules/pair.md Numbers). */
  pair: { inviteDays: number; maxOpenInvites: number; rewardFriends: number; phrasesPerHour: number; placePhrasesPerMinute: number };
  /** The genuineness interview (docs/rules/interview.md Numbers). */
  interview: { ask: number; decoys: number; passBp: number; failBp: number; caughtBelowBp: number; thinMoments: number; thinMonths: number; doubtBp: number; standInRecallBp: number; caughtStanding: number };
  /** The sponsor's undertaking (docs/rules/undertaking.md Numbers). */
  undertaking: { months: number; assistanceUnder: number };
  /** Living at home (docs/rules/home.md Numbers). `returnStanding` is the standing change of a move back to the family house. */
  home: {
    makokoUpkeep: number;
    evictionBp: number;
    evictionLossNaira: number;
    guestMonths: number;
    hostBp: number;
    returnStanding: number;
    /** The room in a compound (home:compound-room-is-a-home): a year's rent upfront, the agent's and the agreement's fees on it, and the month's living there. */
    compound: { rentYear: number; feesBp: number; upkeep: number };
    /** The self-contain's rent a year, shown on the door as a goal (prologue:front-door-three-screens). */
    selfContainRentYear: number;
    /** A hostel room's rent a month, in kobo: about half the room in a compound's month of rent. */
    hostelRentKobo: number;
    /** home:living-by-hand (decision 0013): the share of a naira upkeep that is lived by hand (meals, water, fares, data) and never charged as the month turns. */
    livingByHandBp: number;
  };
  /** The market's things: the car's own way on the map, priced by distance as the rides are (place:rides-between-city-places). */
  thing: { drive: { fareKobo: number; farePerKmKobo: number; metresPerMinute: number } };
}

/**
 * The ways of a ride in the city: the three vehicles, on foot, and the car of your own while the life has one; abroad
 * the ways a country lists (decision 0017): the bus, the train and the taxi.
 */
export type RideWay = "danfo" | "keke" | "okada" | "walk" | "drive" | AbroadWay;

/** The ways a country abroad may list (place:rides-between-city-places). */
export type AbroadWay = "bus" | "train" | "taxi";

/** One way of a country's rides, in that country's smallest unit: the flag-down figure, the figure a kilometre, and the pace. */
export interface RideFigures {
  fare: number;
  farePerKm: number;
  metresPerMinute: number;
}

/**
 * A country's rides (place:rides-between-city-places, place:country-pass-covers-ways, decision 0017): the ways it lists, the step every
 * fare is rounded up to, the month's pass, null where there is none, the ways the pass covers, the metres a thousandth
 * of a degree of longitude is worth there, and the pace on foot (the heat of the Gulf slows a walk). A country with no
 * ways listed refuses a ride.
 */
export interface CountryRides {
  ways: { bus?: RideFigures; train?: RideFigures; taxi?: RideFigures };
  step: number;
  pass: number | null;
  /** The ways the month's pass makes ask nothing (place:country-pass-covers-ways): the UK the bus, Canada and the UAE the bus and the train, Italy none. */
  passWays: AbroadWay[];
  lonMetresPerE3: number;
  /** Metres a minute on foot in that country (docs/design/11-calgary-dubai-and-castel-volturno.md section 4: the UAE 60, elsewhere 80). */
  walkMetresPerMinute: number;
}

/**
 * One way the ride sheet offers where the character is (place:rides-between-city-places): its figures in `currency`'s
 * smallest unit, as `rideFare` takes them, and `passed` when this month's pass covers it and it asks nothing (place:country-pass-covers-ways:
 * every way the country's `passWays` names).
 */
export interface RideWayView {
  way: RideWay;
  currency: Currency;
  fare: number;
  farePerKm: number;
  step: number;
  /** The metres a thousandth of a degree of longitude is worth where the character is (place:rides-between-city-places). */
  lonMetresPerE3: number;
  metresPerMinute: number;
  passed: boolean;
}

/** A quality a thing adds to: once when it lands, each month it is lived with, or each time an act is done. */
export interface ThingAdd {
  quality: Id<"quality">;
  amount: number;
}

/**
 * What a thing does to an act the simulation already has: `adds` given each time the act is done, `halfDays` the act's
 * time with the thing (never more than without it), `costBp` its naira price with the thing, in basis points.
 */
export interface ThingMod {
  activity: Id<"activity">;
  adds?: ThingAdd[];
  halfDays?: number;
  costBp?: number;
}

/** One thing of the market. Money in kobo. */
export interface ThingEntry {
  id: Id<"thing">;
  price: number;
  /** What it sells for when sold back or when the life leaves Lagos, in basis points of the price. */
  resaleBp: number;
  /** What it costs to run a month, taken at the month's close while lived with; 0 for nothing. */
  running: number;
  /** The homes it may stand in: the family house only for the small things (your corner) and the car (the carport). */
  homes: HomePlace[];
  /** Things it needs owned first: the decoder needs the TV. */
  needs: Id<"thing">[];
  /** Things of one group do not add up: only the dearest owned of the group counts (the light, the cool air). */
  group: string | null;
  /** Once, when it lands: a standing lift. */
  bought: ThingAdd[];
  /** Each month it is lived with, at the close: the evening, the cooler nights, the light when NEPA takes it. */
  monthly: ThingAdd[];
  acts: ThingMod[];
  /** Another thing whose running cost it cuts, in basis points of that cost: the phone that makes the data go further. */
  eases?: { thing: Id<"thing">; bp: number };
  /** The car: a way of its own on the map (world:ride-sheet-shows-fares). */
  drive?: true;
}

export interface Content {
  version: string;
  /** The version of the overlay applied at load, if any (engine:numbers-read-from-content). Set by `applyOverlay` alone. */
  overlay?: string;
  /** Ids this version renamed, old to new, for `upgradeState` (server:upgrade-state-is-pure). */
  renames?: Record<string, string>;
  quality: Record<Id<"quality">, QualityEntry>;
  activity: Record<Id<"activity">, ActivityEntry>;
  document: Record<Id<"document">, DocumentEntry>;
  school: Record<Id<"school">, SchoolEntry>;
  route: Record<Id<"route">, RouteEntry>;
  setpiece: Record<Id<"setpiece">, SetpieceEntry>;
  obligation: Record<Id<"obligation">, ObligationEntry>;
  offer: Record<Id<"offer">, OfferEntry>;
  chapter: Record<Id<"chapter">, ChapterEntry>;
  var: Record<Id<"var">, VarEntry>;
  news: Record<Id<"news">, NewsEntry>;
  scenario: Record<Id<"scenario">, ScenarioEntry>;
  country: Record<Id<"country">, CountryEntry>;
  status: Record<Id<"status">, StatusEntry>;
  goal: Record<Id<"goal">, GoalEntry>;
  era: Record<Id<"era">, EraEntry>;
  /** The places of the city (docs/rules/city.md). The simulation never reads them; the city and the content check do. */
  place: Record<Id<"place">, PlaceEntry>;
  person: Record<Id<"person">, PersonEntry>;
  phrase: Record<Id<"phrase">, PhraseEntry>;
  interview: Record<Id<"interview">, InterviewEntry>;
  /** The market's things for the home: price, resale, running cost, where each may stand and what it does in life. */
  thing: Record<Id<"thing">, ThingEntry>;
  /** The spots people meet at, named by key (person:time-together-is-an-act). */
  people: { spots: string[] };
  /** The advert slots, the guides and the counters (advert.md, guide.md, analytics.md). The simulation never reads them; the content checks and the client and server do. */
  advert: Record<Id<"advert">, AdvertSlotEntry>;
  guide: Record<Id<"guide">, GuideEntry>;
  analytics: { counters: CounterDef[] };
  points: Record<Id<"points">, PointsEntry>;
  /** The prologue's steps by id. Empty in content with no prologue. */
  prologue: Record<string, PrologueStep>;
  tuning: Tuning;
}

// ---------------------------------------------------------------------------
// The world: the same for everyone at one tick. Passed in, never stored.
// ---------------------------------------------------------------------------

export interface WorldNews {
  id: Id<"news">;
  stage: NewsStage;
  /** The tick it reached this stage. */
  since: number;
}

export interface World {
  tick: number;
  rates: Record<ForeignCurrency, { official: number; street: number }>;
  vars: Record<Id<"var">, number>;
  /** Every story that has reached any stage by this tick. */
  news: WorldNews[];
  /** The era running. Null until the director runs (docs/rules/director.md). */
  era: { id: Id<"era">; since: number; until: number } | null;
  /**
   * The Friday draw the server runs (docs/rules/lottery.md). Null offline: the stand-in world sets it to null.
   * `onSale` is false between a draw's close and the next draw's opening (lottery:draw-sells-between-ticks).
   */
  lottery: { draw: number; closesTick: number; onSale: boolean; fingerprint: string; beaconRound: number; salesSoFar: number; jackpot: number; rolledOver: boolean; odds: LotteryOdds; last: LotteryResult | null } | null;
  /** advert:real-name-only-by-agreement: the server's overlay of real names on sponsored places. Empty offline; the simulation never reads it. */
  placeNames: Record<string, { name: string; sign: string }>;
}

/**
 * A draw's odds and amounts (lottery:ticket-result-is-public-function, lottery:fixed-prizes-shared-jackpot, lottery:jackpot-rolls-over, lottery:odds-fixed-at-draw-open):
 * chances in draws per million, amounts in kobo, growth in basis points of a
 * week's sales. Fixed for a draw when it opens.
 */
export interface LotteryOdds {
  smallPerMillion: number;
  small: number;
  midPerMillion: number;
  mid: number;
  jackpotPerMillion: number;
  jackpotStart: number;
  jackpotGrowthBp: number;
  jackpotCap: number;
  forcedWinWeeks: number | null;
}

/** One draw's published result (lottery:ticket-result-is-public-function, lottery:fixed-prizes-shared-jackpot, lottery:jackpot-rolls-over, lottery:winners-paid-by-authority, lottery:money-report-checks-draws and lottery:result-published-in-tick-row). */
export interface LotteryResult {
  draw: number;
  /** The server's secret for the draw, published after it (lottery:result-published-in-tick-row); named so the view's hidden-key check stays a net. */
  revealed: string;
  beaconRound: number;
  beaconRandomness: string;
  listHash: string;
  count: number;
  /** The odds and the jackpot the draw ran under (lottery:odds-fixed-at-draw-open, lottery:jackpot-rolls-over). */
  odds: LotteryOdds;
  jackpot: number;
  /** Each tier's winning tickets and what one of them is paid: the jackpot's amount is its share (lottery:fixed-prizes-shared-jackpot). */
  winners: { tier: "jackpot" | "mid" | "small"; tickets: number[]; amount: number }[];
  /** lottery:jackpot-rolls-over: the jackpot the next draw opens with under these odds. */
  nextJackpot: number;
}

// ---------------------------------------------------------------------------
// State: one slice per kind
// ---------------------------------------------------------------------------

export interface SlotPick {
  activity: Id<"activity">;
  param: string | null;
}

/** Money in a line, formatted on screen in its own currency: docs/rules/text.md "Money on screen". */
export interface MoneyParam {
  currency: Currency;
  amount: number;
}

/** A line's param: an id or word, a plain count, or money. Never a bare number that is money. */
export type ReportParam = string | number | MoneyParam;

export interface ReportLine {
  /** A text key. Content holds the words. */
  key: string;
  params: Record<string, ReportParam>;
  tone: "good" | "bad" | "plain";
  /** A staged moment, not a line in a list (docs/rules/text.md, luck:big-wins-are-staged). */
  big?: boolean;
  /** True when the player should stop and look: an answer arrived, an offer opened, a chapter closed. */
  attention: boolean;
  /** Routes this line's gain counts toward. */
  counts: Id<"route">[];
}

export interface TurnReport {
  month: number;
  lines: ReportLine[];
  japacityBefore: number | null;
  japacityAfter: number | null;
  /** True when something now needs the player: a set piece, a new offer, a decision. */
  attention: boolean;
}

/** A lock on free slots (turn:slots-can-be-locked). */
export interface SlotLock {
  slots: number;
  /** The last month the lock holds. */
  untilMonth: number;
  why: string;
}

export interface TurnSlice {
  month: number;
  banked: number;
  /** The month's free time spent by now-acts so far, in half-days (turn:month-lived-in-half-days, decision 0011). */
  spent: number;
  /** True once the life is over (`turn/finish`, turn:finish-ends-the-life; only the road's `lost` applies it). Only `turns/grant` is accepted after that. */
  ended: boolean;
  report: TurnReport | null;
  locks: SlotLock[];
}

export type QualitySlice = Record<Id<"quality">, number>;

export interface ActivitySlice {
  job: Id<"activity"> | null;
  /** The side job held (activity:side-job-holds-a-slot). */
  side: Id<"activity"> | null;
  tenure: Record<Id<"activity">, number>;
  /** What filled the free slots last month, for "same again". */
  lastSlots: SlotPick[];
  /** Months each activity filled a slot, main or free, over the whole life (activity:months-played-counted); the send-off card reads it. */
  played: Record<Id<"activity">, number>;
  /** The jobs whose pay has risen once by `tuning.activity.raiseBp` (activity:waiting-months-build-profile). Missing: none yet. */
  raised?: Id<"activity">[];
  /** The month each raise landed, for the Jobs app (activity:waiting-months-build-profile). Missing until a raise lands, so no state hash moves before one. */
  raisedIn?: Record<Id<"activity">, number>;
  /** The now-acts sent in the month in hand, in order, cleared as the month closes (activity:now-acts-and-month-acts). Missing: none. */
  now?: SlotPick[];
  /** The held job's pay a month as the yearly review left it, the entry's figure at the start (activity:naira-pay-reviewed-yearly). Missing: no reviewed job held. */
  pay?: number;
  /** The official dollar rate, kobo for one dollar, on the day the held job started and at each review since (activity:naira-pay-reviewed-yearly). Missing with `pay`. */
  reviewRate?: number;
  /** Months in a row the free path was played (activity:free-path-keeps-a-streak). Missing: none yet. */
  streak?: number;
  /** What the bootcamp leaves owed until a developer job opens its loan (activity:bootcamp-paid-after-a-job). Missing: nothing owed. */
  bootcampOwed?: number;
  /** The month the bootcamp finished, from which its hire help runs (activity:paid-tech-courses). Missing: never finished. */
  bootcampDone?: number;
  /** The tech study path held and the months it has counted (activity:paid-tech-courses). Missing: none held. */
  study?: { activity: Id<"activity">; months: number };
  /** The sittings passed of each exam sat more than once (document:trade-papers). Missing: none passed. */
  sittings?: Record<Id<"activity">, number>;
}

export interface PocketBalance {
  bank: number;
  cash: number;
  /** In the bank, counted as shown funds, not spendable. */
  locked: number;
}

export interface QueuedConversion {
  id: string;
  from: Currency;
  to: Currency;
  /** Already taken from the `from` pocket. */
  paid: number;
  readyMonth: number;
}

/** A recent deposit into the bank from a source a visa officer would question. */
export interface Lot {
  currency: Currency;
  amount: number;
  month: number;
  reason: Reason;
}

export interface WalletSlice {
  pockets: Record<Currency, PocketBalance>;
  queued: QueuedConversion[];
  lots: Lot[];
  totals: {
    in: Partial<Record<Reason, Partial<Record<Currency, number>>>>;
    out: Partial<Record<Reason, Partial<Record<Currency, number>>>>;
  };
  /** Foreign currency bought at the bank in the given month, valued in US cents. */
  bought: { month: number; cents: number };
  /** Cash moved into the bank in the given month, in kobo at the official rate, for wallet:large-deposits-record-lots's monthly threshold. */
  cashIn: { month: number; kobo: number };
  /**
   * The month in hand's money in less out, by currency, as the results sheet counts it (decision 0024, world:month-end-results-sheet):
   * a change's two sides, a move between pockets and held funds locked and given back count nothing (a change's bank
   * charge and a short count are money out); nothing before the prologue closed counts. Missing until money moves in the month, and cleared as it closes.
   */
  monthNet?: Partial<Record<Currency, number>>;
  /** Months ended whose net in the money of the place was above zero (decision 0024). Missing until the first, so no state hash moves before one. */
  keptMonths?: number;
  /** True once the cash warning was told (wallet:cash-pile-warning). Missing until then, so no state hash moves before it. */
  cashWarned?: true;
  /**
   * wallet:top-ups-are-marked: naira topped up with real money and not yet spent, in kobo. Earned naira is spent first, so it falls only
   * when a debit outruns the earned share; never above the naira bank and cash, never negative, missing while zero so no state hash moves.
   */
  marked?: number;
  /**
   * The passbook's pace: the month in hand's money in less out, by currency, as the month's net counts it, less the road's
   * own fees and the flight, which the target counts already. Missing until money moves in the month, cleared as it closes.
   */
  paceNet?: Partial<Record<Currency, number>>;
  /** The passbook's pace: the last three closed months' kept for the road, in kobo at the official rate, oldest first. Missing until the first. */
  nets?: number[];
  /** The passbook's stamps reached, each once, with the month it was reached; `target` marks the road's own figure reached. Missing until the first. */
  stamps?: { at: number; month: number; target?: true }[];
}

export interface DocumentState {
  state: "pending" | "held" | "expired";
  /** False once the paper came from a scammer and was used (advice:agent-loss-is-the-fee); absent means genuine. */
  genuine?: boolean;
  readyMonth: number | null;
  expiresMonth: number | null;
  value: number | null;
}

export type DocumentSlice = Record<Id<"document">, DocumentState>;

export interface SchoolApplication {
  state: "pending" | "offer" | "rejected";
  readyMonth: number;
  /** Pence off the tuition. Set when the offer arrives. */
  discount: number;
}

export interface VisaApplication {
  submittedMonth: number;
  decisionMonth: number;
  /** The rule numbers on the day of submission. The decision uses these: route:application-fixes-figures. */
  rules: { livingLine: number; livingMonths: number; strictness: number };
  unexplainedBp: number;
  /** Null until the interview is finished. */
  interviewScore: number | null;
  /** Pence of surcharge paid with the application, refunded on a refusal (route:refusal-refunds-and-resets). */
  surchargePaid: number;
  /** Made from inside the route's country (status:grace-allows-in-country-applications, person:partner-route-in-country): no flight on a grant (route-gates:in-country-grant-switches-status). */
  inCountry?: true;
}

export interface RouteState {
  state: RouteStateName;
  heardMonth: number | null;
  knownMonth: number | null;
  schools: Record<Id<"school">, SchoolApplication>;
  /** The school whose deposit is paid. */
  school: Id<"school"> | null;
  depositPaid: number;
  /** Money in a parent's account that counts by consent. It never leaves that account. */
  support: { currency: Currency; amount: number } | null;
  /** route:education-loan-pays-the-school: what an education loan paid the school, in pence. Missing: none. */
  loanPaid?: number;
  /** The family's gift for this route, in naira, and whether its deed is held so it counts (route-gates:family-gift-counts-with-deed). Missing: none given. */
  gift?: { amount: number; deeded: boolean };
  /** The last month-end funds check. */
  funds: { heldMonths: number; covered: boolean; shown: number; required: number };
  visa: VisaApplication | null;
  refusals: number;
  lastRefusal: { month: number; reasons: string[] } | null;
  depositRefund: { amount: number; readyMonth: number } | null;
  /** The gate's own state (route-gates.md). A route the route kind makes always has one. */
  gate: RouteGateState | null;
  /** Never in the view. */
  secret: { sponsorFraud: boolean | null };
  /** Months the route stays `refused` from a ban. Null: no ban. */
  bannedUntil: number | null;
  /** The month the authorisation to return into Canada was paid on this route (route-gates:canada-return-asks-authorisation). Missing: never. */
  authorisedMonth?: number;
  /** The month the route was last granted (chapter.md, `chapter.secure`). Missing: a grant before the month was kept, read as after any return. */
  grantedMonth?: number;
  /**
   * status:course-passed-or-withdrawn: the course a withdrawn student flew for, set aside while the route is known again in the cut months, so paying
   * everything owed puts the route back as it was. `open` turns false once a new school is applied to or paid on the route, which shuts reinstatement.
   * Missing: nothing set aside.
   */
  withdrawn?: SetAside;
}

/** A withdrawn student's course as the route held it at the flight (status:course-passed-or-withdrawn). */
export interface SetAside {
  open: boolean;
  knownMonth: number | null;
  schools: Record<Id<"school">, SchoolApplication>;
  school: Id<"school"> | null;
  depositPaid: number;
  funds: RouteState["funds"];
  visa: VisaApplication | null;
}

/** State the gates keep beyond the study fields: docs/rules/route-gates.md. */
export type RouteGateState =
  | { gate: "study" }
  | { gate: "sponsor"; sponsor: { employer: string; salary: number } | null }
  | { gate: "points"; poolMonth: number | null; invitedMonth: number | null }
  | { gate: "endorsement"; endorsementRefusedMonth: number | null }
  | { gate: "contract"; agent: { employer: string; salary: number; role: string } | null }
  | { gate: "road"; step: string | null; monthsHere: number; debt: number }
  | { gate: "partner"; bond: string | null }
  | { gate: "dependant"; bond: string | null };

export type RouteSlice = Record<Id<"route">, RouteState>;

export interface SetpieceSlice {
  /** How many times each set piece has closed (route:answers-carry-effects). */
  answered: Partial<Record<Id<"setpiece">, number>>;
  /** The last answer given to each question of each set piece (route:last-answers-remembered). */
  given: Partial<Record<Id<"setpiece">, Record<string, string>>>;
  open: {
    entry: Id<"setpiece">;
    route: Id<"route"> | null;
    questions: string[];
    answers: Record<string, string>;
    /** The sum of the answers so far, each scored when it was given (route:answers-score-and-close). */
    score: number;
  } | null;
}

/** The fixed figures of one car from its entry (docs/rules/car.md). */
export interface CarTerms {
  price: number;
  final: number;
  third: number;
  half: number;
  resale: number;
  courtMonths: number;
}

/** car:view-shows-car-terms: what a screen shows of one car beyond the obligation's own fields. */
export interface CarView extends CarTerms {
  paid: number;
  /** The monthly interest fixed at opening by the credit ladder. */
  interest: number;
  /** That interest as basis points of the opening principal. */
  rateBp: number;
  /** Two misses in a row: the lender's notice stands (car:missed-payments-take-the-car). */
  notice: boolean;
  /** The month the car is taken while the lender waits on the court, or null. */
  courtMonth: number | null;
}

export interface ObligationState {
  id: string;
  entry: Id<"obligation">;
  state: "active" | "grace" | "defaulted";
  openedMonth: number;
  /** The fixed monthly charge. */
  amount: number;
  /** The opening principal. */
  principal: number;
  /** Principal still owed or still held. */
  outstanding: number;
  monthsLeft: number | null;
  missed: number;
  /** The bond an undertaking is for, else null (docs/rules/undertaking.md). */
  bond: string | null;
  /** Months of assistance already charged on an undertaking. */
  charged: number;
  /** Shares off the next charge, each from the activity that earned it, spent by that charge (obligation:cooking-and-fetching-water). Absent when there are none. */
  relief?: Relief[];
  /**
   * abroad-money:missed-tuition-runs-in-stages: the payment plan agreed after course month `month`: `total`, what was owed then, spread evenly over `months`,
   * the last rounded so the whole is paid. Absent with no plan.
   */
  plan?: { month: number; total: number; months: number };
  /** route:education-loan-pays-the-school: charges wait on `deferWhile`; `seen` once that status has been held. Absent once charges have started, or for an entry that never waits. */
  deferred?: { seen: boolean };
}

/** One share off an obligation's next charge, in basis points of it, and the activity that earned it (obligation:cooking-and-fetching-water). */
export interface Relief {
  source: string;
  bp: number;
}

export interface ObligationSlice {
  /** Open obligations only. A closed one is removed. */
  items: Record<string, ObligationState>;
}

export interface OfferState {
  id: string;
  entry: Id<"offer">;
  openedMonth: number;
  expiresMonth: number;
  terms: Terms;
  /** The signs this one happens to show. */
  signs: string[];
  /** Never in the view. */
  secret: { fraud: boolean };
}

export interface OfferSlice {
  /** Open offers only. A taken, declined or lapsed one is removed. */
  items: Record<string, OfferState>;
  lastOpened: Record<Id<"offer">, number>;
  timesOpened: Record<Id<"offer">, number>;
  /** The offers opened by roll in `rolledMonth`, at the day's arrivals and the close together, for the month's cap (offer:come-up-rolls-in-order, offer:day-arrivals-roll-offers). */
  rolled: number;
  rolledMonth: number;
}

export interface ChapterSlice {
  current: Id<"chapter"> | null;
  done: Id<"chapter">[];
  /** The way out the player made the plan (chapter:chapters-follow-lean-route), read before the order looked into; absent until one is chosen. */
  chosen?: Id<"route">;
  /**
   * The done chapters a grant closed and no flight has made final, each with the route it rested on, in the order they
   * closed (chapter:done-chapter-stays-done): a withdrawal of that grant before the flight reopens them. Absent while none.
   */
  byGrant?: { chapter: Id<"chapter">; route: Id<"route"> }[];
}

export interface NewsSlice {
  /** The latest pass of each story this character has been shown: its stage and the tick that stage began. */
  delivered: Record<Id<"news">, { stage: NewsStage; since: number }>;
}

export interface PlaceSlice {
  where: Where;
  country: Id<"country"> | null;
  movedMonth: number;
  /** The record of returns. `country` is null for a return from the road (road:exit-is-assisted-return). */
  returns: { month: number; shape: ReturnShape; country: Id<"country"> | null }[];
  /** A status kept after a return with papers (return:papers-return-keeps-status), from the month of the return. */
  heldAbroad: ({ status: Id<"status">; sinceMonth: number } & KeptStatusMonths) | null;
  /** The month the December visit opened, null before (place:view-shows-place-and-returns). */
  decemberMonth: number | null;
  /**
   * Each return home from an overstay past the grace, or with a ban (place:leaving-an-overstay-bans, status:overstay-counts-as-refusal):
   * the country, the month, the ban in months and whether the grace had passed. Missing: none yet.
   */
  overstays?: { country: Id<"country">; month: number; banMonths: number; pastGrace: boolean }[];
}

/** Months at home while a status was kept, from the return's month to the flight back's (status:absence-breaks-settlement). */
export interface MonthsAway {
  from: number;
  to: number;
}

/**
 * What a status kept from a return with papers carries back (return:papers-return-keeps-status, status:granting-a-status): its months held and lawful
 * months, its end month where it has one, the settlement months it carries in place of the entry's, and the months spent at home while it was kept
 * that still fall inside the rule's window (status:absence-breaks-settlement). A missing field: none.
 */
export interface KeptStatusMonths {
  monthsHeld: number;
  lawfulMonths: number;
  expiresMonth?: number;
  settleMonths?: number;
  away?: MonthsAway[];
}

export interface StatusState {
  entry: Id<"status">;
  grantedMonth: number;
  expiresMonth: number | null;
  /** Months left on the clock when the job went. Null: not running. */
  clock: number | null;
  lawfulMonths: number;
  monthsHeld: number;
  /** The job a one-employer status is tied to. */
  job: Id<"activity"> | null;
  /** An overstayer status's stages (status:overstayer-risks-detection): missing on any other status. */
  overstay?: OverstayState;
  /** Settlement months that replace the entry's, for a partner status granted in country past the grace (person:partner-route-in-country). */
  settleMonths?: number;
  /** Months at home while this status was kept, still inside the window status:absence-breaks-settlement reads. Missing: none. */
  away?: MonthsAway[];
  /** status:course-passed-or-withdrawn: a withdrawn student's permission, cut to end `tuning.status.curtailMonths` on; `expiresMonth` is the status's own end, restored on reinstatement. Missing: not withdrawn. */
  withdrawn?: { expiresMonth: number | null };
  /** status:graduate-visa-applied-for: on an overstayer status, the status that lapsed into it, whose grace this is. Missing: none did (the road's arrival). */
  lapsedFrom?: Id<"status">;
}

/**
 * An overstay (status:grace-before-overstaying, status:detection-gives-notice, status:uae-fine-accrues): the month it began, the last
 * month of the grace (held on by an application made in country), the month a notice ends (null with none) and the
 * fine owed in the country's smallest unit.
 */
export interface OverstayState {
  since: number;
  graceUntil: number;
  noticeUntil: number | null;
  fine: number;
}

export interface StatusSlice {
  current: StatusState | null;
  /** Removals, by country and month. */
  removals: { country: Id<"country">; month: number }[];
  /**
   * status:course-passed-or-withdrawn: the course of the last status with a course: the months counted, the months under a cut of access waiting to
   * count once its arrears are paid or moved into a plan, and whether it is passed, kept after the status ends. Missing: no course begun.
   */
  course?: { counted: number; waiting: number; passed: boolean };
}

export interface CreditFile {
  mark: number;
  onTime: number;
  missed: number;
  lastMissMonth: number | null;
  judgmentUntil: number | null;
}

export interface CreditSlice {
  byCountry: Record<Id<"country">, CreditFile>;
}

export interface GoalSlice {
  open: Record<Id<"goal">, { openedMonth: number }>;
  done: Record<Id<"goal">, { month: number }>;
}

export interface PrologueSlice {
  open: boolean;
  step: string | null;
  draw: { familyMeans: number; town: "city" | "town"; siblings: number; parentsEducated: boolean } | null;
  choices: Record<string, string>;
  /** The last draw's outcome, shown on the next card. */
  lastOutcome: string | null;
  flags: string[];
  gradeBase: number;
}

export interface State {
  /**
   * The shape of the save. Raised when the shape changes. 2 adds the whole-life slices; 3 the people and interview slices;
   * 4 the month's spent half-days (`turn.spent`), the offers rolled this month (`offer.rolled`, `offer.rolledMonth`), the
   * body's qualities (decision 0011) and the things slice.
   */
  schema: 1 | 2 | 3 | 4;
  content: string;
  /** The state version: one more for each accepted command. */
  v: number;
  /** Hidden. */
  seed: string;
  scenario: Id<"scenario">;
  /** The world tick of the last accepted command. */
  tick: number;
  /** The next number used to name an offer, obligation or queued conversion. */
  nextInstance: number;
  /** Hidden. How many draws each stream has made. */
  draws: Partial<Record<Stream, number>>;
  turn: TurnSlice;
  quality: QualitySlice;
  activity: ActivitySlice;
  wallet: WalletSlice;
  document: DocumentSlice;
  route: RouteSlice;
  setpiece: SetpieceSlice;
  obligation: ObligationSlice;
  offer: OfferSlice;
  chapter: ChapterSlice;
  news: NewsSlice;
  place: PlaceSlice;
  status: StatusSlice;
  credit: CreditSlice;
  goal: GoalSlice;
  prologue: PrologueSlice;
  lottery: LotterySlice;
  people: PeopleSlice;
  interview: InterviewSlice;
  home: HomeSlice;
  things: ThingsSlice;
}

/** What the life owns at home: each thing once, with the month it came and what was paid. */
export interface ThingsSlice {
  owned: { thing: Id<"thing">; month: number; paid: number }[];
}

/** Where the character lives at home (home:home-slice-fields, home:move-home-once-a-month, home:makoko-eviction-draw, home:hosting-costs-the-host). */
export interface HomeSlice {
  /** Null after an eviction and while a guest. */
  place: HomePlace | null;
  /** The month the character came to live where they live. */
  since: number;
  /** While taken in: the kind of host, who it is (a bond or a person entry) and the month the stay ends. */
  guest: { host: HomeHost | null; by: string | null; until: number } | null;
  /** The month of the last move, for once a month (home:move-home-once-a-month). Null before any. */
  moved: number | null;
  /** The month of the last eviction (home:makoko-eviction-draw). Null before any. */
  evicted: number | null;
  /** A real player's character staying with this one, as the authority sent it, and the last month of the stay (home:hosting-costs-the-host). */
  hosting: { pair: string; until: number } | null;
}

/** This character's tickets in the draw that is open (docs/rules/lottery.md). */
export interface LotterySlice {
  /** The draw the tickets are for, or null with none bought. */
  draw: number | null;
  tickets: number;
  /** The last draw paid out to this character, or null. */
  paid: number | null;
  /** The last draw whose result the character has been shown, or null. */
  seen: number | null;
}

// ---------------------------------------------------------------------------
// Commands and results
// ---------------------------------------------------------------------------

export type Command = { basedOn: number } & (
  | { type: "turn/end"; slots: SlotPick[] }
  | { type: "activity/quit"; side?: boolean }
  /** A now-act at once, where it is staged (activity:now-acts-and-month-acts). */
  | { type: "activity/now"; activity: Id<"activity">; param: string | null }
  | { type: "offer/choose"; offer: string; choice: string; amount?: number }
  | { type: "wallet/convert"; from: Currency; to: Currency; amount: number; via: "bank" | "aboki" }
  | { type: "wallet/move"; currency: Currency; amount: number; to: Pocket }
  | { type: "obligation/pay"; obligation: string; amount: number }
  | { type: "route/pay-deposit"; route: Id<"route">; school: Id<"school"> }
  | { type: "route/depart"; route: Id<"route"> }
  | { type: "setpiece/answer"; question: string; answer: string }
  | { type: "turns/grant"; count: number }
  // whole life
  | { type: "wallet/remit"; currency: ForeignCurrency; amount: number; channel: "app" | "bank" | "informal" }
  | { type: "prologue/choose"; step: string; answer: string }
  | { type: "status/renew" }
  /** `scheme`: ask the returns service (place:returns-service-takes-you-home, decision 0028). Missing or false: home at the character's own fare, or the assisted return when no status is held and nothing covers the fare (place:return-home-paid-or-assisted). */
  | { type: "return/home"; scheme?: boolean }
  /** A ride between two places of the city (place:rides-between-city-places, world:ride-sheet-shows-fares, decision 0017). */
  | { type: "place/ride"; from: Id<"place">; to: Id<"place">; way: RideWay }
  // online (docs/rules/lottery.md)
  | { type: "lottery/buy"; tickets: number }
  /** Sent by the authority alone, after the draw. */
  | { type: "lottery/pay"; draw: number; prizes: { tier: "jackpot" | "mid" | "small"; amount: number }[] }
  /** Sent by the authority alone (wallet:top-ups-are-marked, server:apologies-never-currency): naira bought with real money, marked. No server route sends it. */
  | { type: "wallet/top-up"; amount: number }
  // people (person:nobody-real-is-needed, person:courting-opens-a-bond, person:time-together-is-an-act, person:talking-adds-moments, person:proposing-a-step, person:agreed-partner-and-marriage, person:one-partner-at-a-time, person:routes-name-dependant-routes, person:statuses-name-dependants, person:family-requests-shared, person:either-side-ends-a-bond, person:joint-collapses-with-bond, person:ender-pays-in-standing, person:one-left-keeps-own-gains, person:ended-bond-record-kept and person:leaving-player-ends-bonds)
  | { type: "people/invite"; slot: string; looking?: string; fill?: string }
  /** `with` names a computer character (`person.*`) or a slot holding an invited player (person:time-together-is-an-act). */
  | { type: "people/court"; with: string }
  | { type: "people/propose"; bond: string; step: Proposal["step"]; route?: Id<"route">; lead?: "me" | "them" }
  | { type: "people/answer"; bond: string; step: Proposal["step"]; yes: boolean }
  | { type: "people/withdraw"; bond: string }
  | { type: "people/consent"; bond: string; countFunds?: boolean; standInMay?: boolean }
  | { type: "people/end"; bond: string }
  // people, from the authority alone (person:money-counted-never-moved): another life's actions, recorded in the save
  | { type: "people/link"; slot: string; pair: string; facts: PersonFacts }
  | { type: "people/facts"; pair: string; facts: PersonFacts }
  | { type: "people/moments"; pair: string; moments: Moment[] }
  | { type: "people/proposal"; pair: string; proposal: Proposal }
  | { type: "people/agreed"; pair: string; step: Proposal["step"]; route?: Id<"route">; lead?: "me" | "them" }
  /** `restart`: the other player ended their life to start another (account:start-a-new-life, decision 0020): no cost, the moments kept. */
  | { type: "people/ended"; pair: string; why: "them" | "absence" | "block" | "restart" }
  /** Decision 0020: the other life's answer to a proposal, carried across lives by the server. */
  | { type: "people/declined"; pair: string; step: Proposal["step"] }
  | { type: "people/withdrawn"; pair: string; step: Proposal["step"] }
  | { type: "people/gossip"; pair: string }
  | { type: "people/stand-in"; pair: string; stage: "warned" | "on" | null }
  /** `handled` says another copy of the request was handled (person:family-requests-shared). */
  | { type: "people/family-request"; offer: Id<"offer">; terms: Terms; handled?: true }
  // the interview (docs/rules/interview.md)
  | { type: "interview/answer"; question: string; option: string }
  /** `thin`: the applicant's measure of the record (interview:draws-made-in-one-life). Missing: measured in this life. */
  | { type: "interview/open"; pair: string; route: Id<"route">; questions: { id: string; options: string[] }[]; thin?: boolean }
  | { type: "interview/scored"; pair: string; theirs: string[] }
  // home (docs/rules/home.md)
  | { type: "home/move"; to: HomePlace }
  /** From the authority alone: a joined player's character stays with this one until `until`, or no longer with null (home:hosting-costs-the-host). */
  | { type: "home/host"; pair: string; until: number | null }
  // things
  /** Buy a thing from the market: at home in Lagos, the price held, delivered at once. */
  | { type: "thing/buy"; thing: Id<"thing"> }
  /** Sell a thing owned back at its resale figure. */
  | { type: "thing/sell"; thing: Id<"thing"> }
  // chapter (chapter:chapters-follow-lean-route)
  /** Make a way out heard of or looked into the plan the chapters follow. */
  | { type: "chapter/lean"; route: Id<"route"> }
);

export type CommandType = Command["type"];

export type RejectionCode =
  | "stale"
  | "clock-went-back"
  | "setpiece-open"
  | "not-legal"
  | "cannot-afford"
  | "unknown-id"
  | "bad-amount"
  | "not-yours"
  | "ended"
  /** The prologue is open: only prologue/choose and turns/grant are accepted (prologue:prologue-life-starts-empty). */
  | "prologue-open";

export interface Rejection {
  ok: false;
  code: RejectionCode;
  detail: string;
  /** Why a granted way cannot be flown yet, where a rule names it (route-gates:canada-funds-checked-at-departure, decision 0033). Missing: no reason beyond the code. */
  reason?: "funds";
}

/**
 * Every event has a type of the form kind/what-happened. Each kind defines its
 * own in <kind>.events.ts. The engine has one of its own, `engine/stepped`,
 * which carries the four counters it keeps: v, tick, draws and nextInstance.
 */
export interface BaseEvent {
  type: `${KindName | "engine"}/${string}`;
}

export interface Accepted<E extends BaseEvent = BaseEvent> {
  ok: true;
  state: State;
  events: E[];
  lines: ReportLine[];
}

export type StepResult<E extends BaseEvent = BaseEvent> = Accepted<E> | Rejection;

/** Who sent a command: the player, the authority, or the stand-in that plays for an absent partner (person:stand-in-acts-narrowly). A player may not send `turns/grant`. */
export type Sender = "player" | "authority" | "stand-in";

// ---------------------------------------------------------------------------
// What a kind is given, and what a kind is
// ---------------------------------------------------------------------------

export interface Random {
  /** A whole number from 0 up to, not including, n. */
  int(stream: Stream, n: number): number;
  /** A whole number between the two, both included. */
  between(stream: Stream, min: number, max: number): number;
  /** True with the given chance in basis points. */
  chance(stream: Stream, bp: number): boolean;
}

export interface Ctx {
  /** The state as it stands now, after every event already produced in this step. */
  state: State;
  world: World;
  content: Content;
  /** Who sent the command being stepped (decision 0005: a stand-in's command is judged as a player's, but a kind may mark it). */
  sender: Sender;
  random: Random;
  /** A fresh instance id. */
  nextId(prefix: string): string;
  /** Turn an amount into a number, reading the world and the terms in hand. */
  amount(amount: Amount, terms?: Terms): number;
  /** Evaluate a requirement against the state and world. */
  check(requirement: Requirement, terms?: Terms): RequirementResult;
  /** Carry out effects through the kinds that own them, and get back the events. */
  apply(effects: Effect[], cause: Cause): BaseEvent[];
}

/** What reading needs: no random numbers, no ids, no effects. */
export interface ReadCtx {
  state: State;
  world: World;
  content: Content;
}

export interface KindModule<Slice, E extends BaseEvent> {
  kind: KindName;
  initial(scenario: ScenarioEntry, content: Content): Slice;
  commands?: Partial<Record<CommandType, (ctx: Ctx, command: Command) => BaseEvent[] | Rejection>>;
  effects?: Partial<Record<EffectType, (ctx: Ctx, effect: Effect, cause: Cause) => BaseEvent[]>>;
  phases?: Partial<Record<Phase, (ctx: Ctx) => BaseEvent[]>>;
  evolve(slice: Slice, event: E, state: State, content: Content): Slice;
  /** Sentences describing what is broken. Empty when all is well. */
  invariants?(state: State, content: Content): string[];
  lines?(event: E, state: State, content: Content): ReportLine[];
  /** The requirement types this kind knows how to judge. */
  requirements?: Partial<Record<Requirement["type"], (read: ReadCtx, requirement: Requirement, terms: Terms) => RequirementResult>>;
  /** This kind's part of the view. The engine joins the parts and checks nothing is missing. */
  view?(read: ReadCtx): Partial<PlayerView>;
}

// ---------------------------------------------------------------------------
// Saves and the authority
// ---------------------------------------------------------------------------

/** One accepted command as a save records it: the command, the tick it was stepped at and who sent it. */
export interface SavedCommand {
  command: Command;
  tick: number;
  sender: Sender;
}

/** Where a segment begins: a new life from its scenario and seeds, or a state carried over (server:save-is-list-of-segments). */
export type SegmentStart = { scenario: Id<"scenario">; seed: string; worldSeed: string } | { base: State };

/** The commands accepted under one content version and one overlay (decision 0004). */
export interface SaveSegment {
  content: string;
  /** The overlay's version, when the content was loaded with one (engine:state-is-plain-data). */
  overlay?: string;
  start: SegmentStart;
  commands: SavedCommand[];
}

/** Everything needed to rebuild a state: engine:state-is-plain-data and server:save-is-list-of-segments. Schema 3 is the save in segments. */
export interface Save {
  schema: 3;
  segments: SaveSegment[];
  /** Decision 0020: a sibling made from an invite takes the inviter's family draw (person:real-sibling-shares-family-draw). */
  family?: { from: string; draw: NonNullable<PrologueSlice["draw"]> };
}

/** A save of schema 1 or 2: one segment, flat, where schema 3 is the save in segments (decision 0004). `loadSave` reads it; nothing writes it as a save. */
export interface FlatSave {
  schema: 1 | 2;
  content: string;
  overlay?: string;
  scenario: Id<"scenario">;
  seed: string;
  worldSeed: string;
  commands: SavedCommand[];
}

export type Reply = { ok: true; view: PlayerView; lines: ReportLine[] } | Rejection;

/**
 * Whoever holds the full state: the tab when played offline, the server
 * online, which is why every method is a promise.
 */
export interface Authority {
  view(): Promise<PlayerView>;
  send(command: Command): Promise<Reply>;
}

// ---------------------------------------------------------------------------
// The view: all the interface ever sees
// ---------------------------------------------------------------------------

export interface ChecklistItemView {
  id: string;
  weight: number;
  met: boolean;
  /** Present on slow items: how far along. */
  have: number | null;
  need: number | null;
  earned: number;
}

export interface RouteView {
  id: Id<"route">;
  state: RouteStateName;
  /** Null while only heard of. */
  percent: number | null;
  window: "open" | "narrowing" | "closed";
  checklist: ChecklistItemView[];
  schools: { id: Id<"school">; state: SchoolApplication["state"]; readyMonth: number; discount: number }[];
  school: Id<"school"> | null;
  depositPaid: number;
  /** route:education-loan-pays-the-school: what an education loan paid the school, in pence; 0 with none. */
  loanPaid: number;
  support: { currency: Currency; amount: number } | null;
  funds: RouteState["funds"];
  unexplainedBp: number;
  visa: { submittedMonth: number; decisionMonth: number } | null;
  refusals: number;
  lastRefusal: RouteState["lastRefusal"];
  depositRefund: RouteState["depositRefund"];
  /** What the gate shows: docs/rules/route-gates.md. Null for the study gate. */
  gate: RouteGateView | null;
  /** The authorisation to return and the removal costs a Canadian route's first application still owes (route-gates:canada-return-asks-authorisation). Missing: nothing owed. */
  authorisation?: { arc: MoneyParam; removal: MoneyParam };
}

/** The gate's own part of a route's view. Nothing hidden: no fraud, no draw. */
export type RouteGateView =
  | { gate: "sponsor"; employer: string | null; salary: number | null; underBar: boolean }
  /** `invites` (route-gates:points-view-carries-invites): the score is at a cut-off the clocks would invite at now, the care cut-off for a carer among them. */
  | { gate: "points"; points: number; cutoff: number; careCutoff: number | null; educationCutoff: number | null; fundsShort: number; invites: boolean; poolMonth: number | null; profileEndsMonth: number | null; invitedMonth: number | null }
  | { gate: "endorsement"; refusedMonth: number | null; cooledFromMonth: number | null }
  | { gate: "partner"; bond: string | null; lead: RouteStateName | null }
  | { gate: "dependant"; bond: string | null; lead: RouteStateName | null }
  | { gate: "contract"; employer: string | null; salary: number | null; role: string | null }
  | { gate: "road"; step: string | null; monthsHere: number };

export interface ActivityOption {
  id: Id<"activity">;
  allowed: boolean;
  /** The requirements not yet met, for "why not". */
  missing: Requirement[];
  /** The params that may be picked now. Null when the activity takes none. */
  params: string[] | null;
  cost: { currency: Currency; amount: number }[];
  affordable: boolean;
  /** `now` is sent as `activity/now`; `month` fills a slot (activity:now-acts-and-month-acts). */
  when: "now" | "month";
  /** A now-act that is not a purchase, already done this month: not `allowed` again until the next (activity:now-acts-and-month-acts). */
  done: boolean;
  /** activity:spent-body-refuses-acts: the act takes effort and the body is spent, so it waits for sleep. Missing otherwise. */
  spent?: true;
  /** The act's time in half-days when a thing owned changes it (the gas cooker's pot). Missing otherwise: the entry's own. */
  halfDays?: number;
  /** activity:study-days-capped: the day's class has run its days this month. Missing otherwise. */
  capped?: true;
  /** activity:paid-tech-courses: another tech study path is held, so this one waits ("You are on a course"). Missing otherwise. */
  onCourse?: true;
}

export interface OfferView {
  id: string;
  entry: Id<"offer">;
  openedMonth: number;
  expiresMonth: number;
  terms: Terms;
  signs: string[];
  choices: { id: string; allowed: boolean; pick: { min: number; max: number } | null }[];
  /** On an offer whose terms name a job: what it would pay a month as the wallet will book it (wallet:view-carries-month-pay). */
  pay?: MoneyParam;
}

export interface PlayerView {
  v: number;
  scenario: Id<"scenario">;
  month: number;
  ended: boolean;
  turns: { banked: number; cap: number };
  /** The month's free time in half-days: spent so far and the month's total (turn:month-lived-in-half-days). */
  halfDays: { spent: number; free: number };
  /** Locks on free slots now, with their reasons (turn:slots-can-be-locked). */
  locks: SlotLock[];
  japacity: { percent: number | null; route: Id<"route"> | null };
  qualities: { id: Id<"quality">; value: number }[];
  /** The run-down warning stands: two months under the wellbeing line (health:low-wellbeing-warns-first, health:view-shows-health-warning). */
  runDown: boolean;
  /**
   * The job, its tenure, and the side job held if any (activity:side-job-holds-a-slot).
   * `raise` (activity:waiting-months-build-profile): the held job's pay a month with the raise from being noticed, and the month the raise
   * landed (null for a raise the state holds without its month). Absent while the job held has no raise.
   * `pay` and `sidePay` (wallet:view-carries-month-pay): each job's month as the wallet will book it, net of tax; null with no job or no pay it can read.
   * `review` (activity:naira-pay-reviewed-yearly): the months to the held job's next pay review. Absent while the job held is not reviewed.
   */
  job: {
    id: Id<"activity"> | null;
    months: number;
    side: Id<"activity"> | null;
    pay: MoneyParam | null;
    sidePay: MoneyParam | null;
    raise?: { pay: MoneyParam; month: number | null };
    review?: number;
  };
  freeSlots: number;
  activities: ActivityOption[];
  lastSlots: SlotPick[];
  pockets: Record<Currency, PocketBalance>;
  queued: QueuedConversion[];
  rates: World["rates"];
  /** What may still be bought at the bank this month, in US cents. Null abroad, where the Lagos allowance does not bind (wallet:monthly-fx-allowance, wallet:bank-queue-delays-purchases). */
  bankAllowanceLeft: number | null;
  /** Months ended in which the character kept more than they spent (decision 0024). A count the japa type reads; never shown as a figure. */
  keptMonths: number;
  /**
   * wallet:top-ups-are-marked: `marked` is the topped-up naira not yet spent, 0 while there is none. The kiosk's sheet and slip read it
   * (a ticket is bought only with the naira held less it); the Bank shows one balance.
   */
  wallet: { marked: number };
  /** `onItsWay` (document:paper-on-its-way): the month the copy being made is due, pending or held with a new copy requested; null when none is. */
  documents: { id: Id<"document">; state: DocumentState["state"]; readyMonth: number | null; expiresMonth: number | null; value: number | null; onItsWay: number | null }[];
  routes: RouteView[];
  setpiece: {
    entry: Id<"setpiece">;
    asked: number;
    total: number;
    /** `answers` is every answer; `allowed` those whose requirements hold now (route:set-piece-answers-in-order); `weak` those that would score below zero, shown only with enough prep (route:view-shows-progress-not-score); `followUp` true when it is asked after the answer before it (route:answer-may-ask-follow-up). */
    question: { id: string; answers: string[]; allowed: string[]; weak: string[]; followUp: boolean } | null;
  } | null;
  /** Every open obligation with its next charge; `car` carries car:view-shows-car-terms's figures for a car and is null for anything else. */
  obligations: (ObligationState & { due: number; car: CarView | null })[];
  offers: OfferView[];
  /**
   * chapter:view-says-closes-and-next: `closes` is true when the current chapter closes at this month's end as things stand (every item
   * met, or the one its `closesOn` names); `next` is the chapter that follows it, with the lean as it stands now.
   */
  chapter: { current: Id<"chapter"> | null; items: { id: string; met: boolean }[]; done: Id<"chapter">[]; closes: boolean; next: Id<"chapter"> | null };
  /** The chapter kind's plan (chapter:chapters-follow-lean-route), beside its chapter part so that part keeps its shape. */
  plan: {
    /** The way out the chapters follow, or null while no own-effort way is heard of. */
    route: Id<"route"> | null;
    /** Each own-effort way heard of or further on, with the figure its checklist earns now (japacity:figure-sums-checklist-items), for the switch. */
    ways: { route: Id<"route">; percent: number }[];
  };
  news: { id: Id<"news">; stage: NewsStage; since: number; forYou: boolean }[];
  /**
   * `fareHome` is the fare from the country the character is in, December factor applied, or null at home (place:fare-home-in-local-currency).
   * `wayHome` (place:view-carries-way-home): the way home from where the character is today, as `return/home` would take it; null when not abroad.
   * `ways` (place:rides-between-city-places): the ways a ride may take where the character is, with their figures; empty on the road and in a country with none. Always set by the simulation; optional only so a view a test writes by hand without it stays whole.
   * `shuttles` (place:employer-shuttle-rides-free, decision 0017): the stops of the character's country the employer's shuttle serves, so a bus to or from one asks no fare; empty at home, on the road and in a country with none. Always set by the simulation; optional for the same reason as `ways`.
   */
  place: { where: Where; country: Id<"country"> | null; monthsHere: number; returns: PlaceSlice["returns"]; heldAbroad: Id<"status"> | null; kept?: KeptView; fareHome: MoneyParam | null; fareBp: number; wayHome: WayHome | null; ways?: RideWayView[]; shuttles?: Id<"place">[] };
  status: {
    entry: Id<"status">;
    monthsLeft: number | null;
    clock: number | null;
    lawfulMonths: number;
    settleMonths: number | null;
    work: WorkRule;
    nextStep: string | null;
    /** What `status/renew` would cost today from the world's variables, or null when the status cannot be renewed by asking (status:view-shows-status). */
    renew: { months: number; currency: ForeignCurrency; fee: number; surcharge: number } | null;
    /** On an overstayer status (status:view-shows-status): the grace left, the notice left, the UAE's fine owed and whether an application made in country holds them; null on any other. */
    overstay: { graceLeft: number; noticeLeft: number | null; fine: MoneyParam | null; pending: boolean } | null;
    /** status:graduate-visa-applied-for: what the Graduate application costs today, from course month 9 on a status with a course, so the months to save show; null otherwise. */
    graduate: { currency: ForeignCurrency; fee: number; surcharge: number } | null;
  } | null;
  credit: { mark: number; onTime: number; missed: number; judgmentUntil: number | null; needs: { id: Id<"obligation">; creditMin: number }[] } | null;
  goals: { open: { id: Id<"goal">; items: { id: string; met: boolean }[] }[]; done: { id: Id<"goal">; month: number }[] };
  prologue: {
    step: string;
    answers: { id: string; allowed: boolean }[];
    lastOutcome: string | null;
    draw: PrologueSlice["draw"];
  } | null;
  /**
   * Where the life is from (prologue:family-draw-on-first-answer): `hometown.<slug>`, with
   * words in content, read from the family drawn or the fixed life's own, kept after the prologue closes. Null until
   * the family is drawn.
   */
  hometown: string | null;
  /** The era running, with its start and end as this player's months (the tick difference from now). Null until the director runs. */
  era: { id: Id<"era">; since: number; until: number; sinceMonth: number; untilMonth: number } | null;
  /** The send-off card or the real-story card, when one is due (chapter:send-off-card-on-close, road:real-story-card-after-chain). */
  card: {
    kind: "chapter" | "granted" | "send-off" | "first-pay-abroad" | "secured" | "december" | "draw-win" | "real-story" | "lost";
    chapter: Id<"chapter"> | null;
    route: Id<"route"> | null;
    percent: number | null;
    months: number;
    standing: number;
    topActivities: Id<"activity">[];
    /** The name the player chose, never the account's (share:card-art-shows-no-face). */
    name: string | null;
  } | null;
  /** The people around the character (person:view-shows-people). */
  people: {
    slots: Record<string, { state: PeopleSlice["slots"][string]["state"]; label: PersonLabel | null; bond: string | null; invite: { looking: string; fill: string | null } | null }>;
    bonds: { id: string; role: "partner" | "sibling"; stage: BondStage; label: PersonLabel; person: Id<"person"> | null; pair: string | null; lastMomentMonth: number | null; cooldownUntil: number | null; partnerMonth: number | null; consent: { countFunds: boolean; standInMay: boolean } | null; moments: Moment[] | null; pending: { mine: Proposal | null; theirs: Proposal | null }; standIn: "warned" | "on" | null; facts: PersonFacts | null }[];
    candidates: { person: Id<"person">; role: "partner" | "sibling" }[];
    joint: { bond: string; route: Id<"route">; lead: "me" | "them"; myScore: number | null; theirScore: number | null } | null;
    sponsoring: { bond: string; route: Id<"route">; month: number } | null;
    barUntilMonth: number | null;
  };
  /** The genuineness interview as it stands (docs/rules/interview.md), or null. */
  interview: { route: Id<"route">; question: { id: string; options: string[] } | null; asked: number; total: number; waiting: boolean; standIn: boolean; result: InterviewResult | null; matched: number | null } | null;
  /** The Friday draw as this character sees it, or null offline (lottery:result-published-in-tick-row). */
  lottery: { ticket: number; maxTickets: number; draw: number; closesTick: number; onSale: boolean; tickets: number; numbers: number[] | null; jackpot: number; rolledOver: boolean; odds: LotteryOdds; fingerprint: string; last: LotteryResult | null } | null;
  /** advert:no-adverts-on-protected-screens: whether an advert may show now (never on the road, in a set piece, or in a chapter with `noAdverts`). */
  adverts: boolean;
  /**
   * Where the character lives at home (home:view-carries-home): the monthly charge there, the eviction chance a month in Makoko now, and the month
   * of the last move, so the card shuts the move made this month. `rent` is the month's charge where the character lives as the
   * bill takes it (home:moves-carry-cost-and-reason); `moves` the moves the card offers at home, each with what it charges a month, what it takes at once, and why it is shut (empty abroad).
   */
  home: {
    place: HomePlace | null;
    since: number;
    guest: HomeSlice["guest"];
    rent: MoneyParam | null;
    evictionBp: number;
    moved: number | null;
    moves: { to: HomePlace; monthly: MoneyParam; now: number; shut: HomeMoveShut | null }[];
    /**
     * home:compound-room-is-a-home: the room's yearly rent while it is open, in naira: `year` the rent the
     * landlord asks each year, `fees` the agent's and the agreement's fees paid on it at the move, and `dueIn` the
     * months until the next year's rent is taken, 0 at this month's end (or while a missed one is asked for again).
     * Null where no yearly rent is open.
     */
    roomRent: { year: number; fees: number; dueIn: number } | null;
  };
  report: TurnReport | null;
  /** The passbook (the Bank's first page): the money held for the road against the plan's target, the stamps, the pace and the roads. Null away from home or once the life has ended. */
  passbook: PassbookView | null;
  /** The things owned and the market. */
  things: ThingsView;
}

/** Why the market would refuse a thing now: owned already, not a thing for this home, its need not owned, the price not held, or not at home in Lagos. */
export type ThingShut = "owned" | "home" | "needs" | "short" | "away";

export interface ThingsView {
  /** Each thing owned: `stored` while the home lived in is not one it may stand in (a TV at the family house), so it does nothing until a home of your own. */
  owned: { thing: Id<"thing">; month: number; stored: boolean; resale: number }[];
  /** Every thing of the market with its price now, its resale, its running cost a month as it would be taken, and why buying it is shut, null when it may be bought. */
  market: { thing: Id<"thing">; price: number; resale: number; running: number; shut: ThingShut | null }[];
  /** The car stands at home: the ride sheet offers Drive. */
  drive: boolean;
  /** What running what is owned takes a month, as the close will take it. */
  running: number;
}

/** A road to the target (the passbook): a job a rung up, a side job, the street's circle, a family loan, a scholarship. */
export type PassbookRoadKind = "ladder" | "side" | "ajo" | "family" | "scholarship";

export interface PassbookRoad {
  road: PassbookRoadKind;
  /** The thing the road is: the job or side job to hunt, the act to ask with, or the offer that opens it. */
  via: Id<"activity"> | Id<"offer">;
  /** `taken`: held now; `open`: it can be taken now; `shut`: it waits on what `needs` lists, or on the street to ask. */
  state: "taken" | "open" | "shut";
  /** The requirements not yet met. */
  needs: Requirement[];
  /** The offer's instance while it stands open, to answer it by. Null otherwise. */
  offer: string | null;
  /** What it adds to the pace a month, and brings at once, in kobo at the official rate. */
  monthly: number;
  lump: number;
  /** Whole months to the target with it taken, 0 when it would reach it at once; null with no target or no pace. */
  months: number | null;
}

export interface PassbookView {
  /** The money held for the road: the bank and the cash in every money, in kobo at the official rate. Locked money is not counted. */
  held: number;
  /** The plan's whole cost in kobo once its way is looked into: the funds still to show, the fees ahead in every money, the flight. Null with no plan to count. */
  target: { route: Id<"route">; total: number; funds: number; fees: number; flight: number } | null;
  /** The stamps in the order of their figures: each fixed one under the target or reached, and the target's own last; `month` when it was reached. */
  stamps: { at: number; month: number | null; target: boolean }[];
  /** What the last three closed months kept for the road, a month, in kobo, rounded down; null before a month has closed. */
  pace: number | null;
  /** Whole months to the target at this pace: 0 when it is held already; null with no target or no pace above nothing. */
  months: number | null;
  roads: PassbookRoad[];
  /** The road not taken that reaches the target soonest, sooner than the pace alone; null when none does. */
  best: PassbookRoadKind | null;
}
