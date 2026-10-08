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
  // Added for the whole-life milestone: docs/decisions/0003-whole-life-contract.md.
  | "place"
  | "status"
  | "credit"
  | "goal"
  | "prologue"
  // Added for the online milestone: docs/rules/lottery.md.
  | "lottery"
  // Added for the people milestone: docs/rules/people.md, pair.md, interview.md.
  | "people"
  | "person"
  | "interview"
  | "phrase"
  | "era"
  | "country"
  | "points";

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
  | "ransom"
  | "fare"
  | "build"
  /** A lottery, bet or draw win (docs/rules/luck.md). Never flagged: a letter explains it. */
  | "win"
  /** Retired by decision 0010: credited by nothing, its ceiling in the money report zero. Kept so old ledger rows and saves still read. */
  | "pot-top-up"
  /** A lottery ticket bought (docs/rules/lottery.md), a sink. */
  | "ticket"
  /** A wedding's share paid (docs/rules/people.md), a sink. */
  | "wedding"
  /** An undertaking charge paid by a sponsor (docs/rules/undertaking.md), a sink. */
  | "undertaking"
  /** Social assistance received abroad (docs/rules/undertaking.md), a source. */
  | "assistance"
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
  /** The people kind's draws: courting, a computer's answers, gossip (docs/rules/people.md). */
  | "people";

/** Where a character is. `road` is the chain in docs/rules/road.md. */
export type Where = "home" | "abroad" | "road";
/** Where an entry applies. */
export type WhereEntry = "home" | "abroad" | "any";
/** The shapes of a return home: docs/rules/place.md R-PLACE-005. */
export type ReturnShape = "removed" | "assisted" | "broke" | "by-choice" | "with-papers";
/** What a status lets you do for work: docs/rules/status.md R-STATUS-002. */
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
  /** The document is held and did not come from a scammer (advice.md R-ADVICE-008). */
  | { type: "document/genuine"; document: Id<"document"> }
  | { type: "route/state"; route: Id<"route">; in: RouteStateName[] }
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
  /** The amount could be paid now: naira from cash and bank, a foreign fee by R-WALLET-009. */
  | { type: "money/can-pay"; currency: Currency; amount: Amount }
  | { type: "var/min"; var: Id<"var">; value: number }
  | { type: "var/max"; var: Id<"var">; value: number }
  | { type: "month/min"; value: number }
  | { type: "chapter/done"; chapter: Id<"chapter"> }
  // whole life
  | { type: "place/is"; where: Where; country?: Id<"country"> }
  | { type: "status/is"; statuses: Id<"status">[] }
  /** A status is held whose clock is running and under this many months. */
  | { type: "status/clock-under"; months: number }
  /** The credit mark in the current country. */
  | { type: "credit/min"; value: number }
  | { type: "goal/done"; goal: Id<"goal"> }
  | { type: "era/is"; eras: Id<"era">[] }
  /** An open obligation of this type exists. The car is `obligation/has` with type `car`. */
  /** `obligation` narrows the check to one entry (goal.own-door, the repeatable flat). */
  | { type: "obligation/has"; obligationType: ObligationType; obligation?: Id<"obligation"> }
  /** A route's gate has reached the named step: docs/rules/route-gates.md. */
  | { type: "route/gate-step"; route: Id<"route">; step: string }
  /** Months in any job in the current country. */
  | { type: "activity/local-tenure"; months: number }
  /** The set piece has closed at least `times` times (default 1): docs/rules/route.md R-SETPIECE-006. */
  | { type: "setpiece/answered"; setpiece: Id<"setpiece">; times?: number }
  /** The last answer given to this question of this set piece was this one (R-SETPIECE-007). */
  | { type: "setpiece/answered-with"; setpiece: Id<"setpiece">; question: string; answer: string }
  /** The world runs the Friday draw (`online` true) or not (docs/rules/lottery.md). */
  | { type: "world/lottery"; online: boolean }
  /** A bond of this role at one of these stages, and where the other is (docs/rules/people.md R-PEOPLE-046). */
  | { type: "people/bond"; role: "partner" | "sibling"; stages: BondStage[]; where?: Where; country?: Id<"country">; statuses?: Id<"status">[] }
  /** A sibling in this country with one of these statuses, old enough (R-PEOPLE-031). */
  | { type: "people/sibling-abroad"; country: Id<"country">; statuses: Id<"status">[]; minAgeMonths: number }
  /** A joint application on this route with the character as lead or dependant (R-PEOPLE-029). */
  | { type: "people/joint"; route: Id<"route">; as: "lead" | "dependant" }
  /** The ledger's total under a reason, in or out, in one currency, is at least this: docs/rules/wallet.md R-WALLET-014. */
  | { type: "wallet/total"; flow: "in" | "out"; reason: Reason; currency: Currency; amount: Amount }
  /** A return of one of these shapes is on record: docs/rules/place.md. */
  | { type: "place/returned"; shapes: ReturnShape[] }
  /** The character has been where they are, in `where`, for at least this many months. */
  | { type: "place/months-here"; where: Where; months: number }
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
  | { type: "money/take"; currency: Currency; pocket: Pocket | "any" | "locked"; amount: Amount; reason: Reason }
  /** Pay a foreign-currency fee from whatever the character holds: see R-WALLET-009. */
  | { type: "money/pay-fee"; currency: ForeignCurrency; amount: Amount; reason: Reason }
  // quality
  | { type: "quality/add"; quality: Id<"quality">; amount: number }
  // activity
  | { type: "activity/hunt" } // the slot's param names the job
  | { type: "activity/start-job"; job: Id<"activity"> | { term: string } }
  /** `side` names the side slot (the home side job ends at the flight, R-ACTIVITY-010). */
  | { type: "activity/end-job"; why: string; side?: true }
  | { type: "activity/gig"; min: number; max: number; perTech: number }
  // document
  | { type: "document/request"; document: Id<"document"> }
  | { type: "document/grant"; document: Id<"document"> }
  | { type: "document/void"; document: Id<"document"> }
  // route
  | { type: "route/hear"; route: Id<"route">; chanceBp?: number; via: string }
  | { type: "route/look-into" } // the slot's param names the route
  | { type: "route/apply-school" } // the slot's param names the school
  | { type: "route/apply"; route: Id<"route"> }
  | { type: "route/support"; route: Id<"route">; currency: Currency; amount: Amount }
  /** The set piece finished: its score goes on the route's open visa application (R-SETPIECE-004). */
  | { type: "route/interview-scored"; route: Id<"route">; score: number }
  /** A sponsor, agent or connection is recorded on a gate route. `fraud` is hidden on the route. */
  | { type: "route/record-sponsor"; route: Id<"route">; employer: string; salary: number; fraud: boolean }
  /** The road chain moves to a step or ends: docs/rules/road.md. */
  | { type: "route/road-step"; step: string }
  /** The pool entered on the points route, from `activity.enter-pool` (R-POINTS-002). */
  | { type: "route/enter-pool"; route: Id<"route"> }
  // setpiece
  /** Opens a set piece for a route (R-SETPIECE-001). */
  /** Open a set piece. With a route, the score goes to its visa application; with none, nothing is scored (R-SETPIECE-006). */
  | { type: "setpiece/open"; setpiece: Id<"setpiece">; route: Id<"route"> | null }
  /** closes the open scene unscored (a flight during a road scene, R-ROAD-004 as rewritten). */
  | { type: "setpiece/close"; setpiece: Id<"setpiece"> }
  /** A moment with the bond the slot's param names (docs/rules/people.md R-PEOPLE-015). */
  | { type: "people/moment"; kind: Moment["kind"] }
  /** Withdraws an application in progress (R-PEOPLE-038). */
  | { type: "route/withdraw"; route: Id<"route"> }
  /** The application just sent on this route, resting on this bond, opens the genuineness interview (R-INTERVIEW-001, 002). */
  | { type: "interview/open"; route: Id<"route">; bond: string }
  /** The interview open for this route closes unscored (R-PEOPLE-036, R-INTERVIEW-011). */
  | { type: "interview/close"; route: Id<"route"> }
  /** The character arrived on this route, as the people slice records it (R-PEOPLE-027). */
  | { type: "people/arrived"; route: Id<"route"> }
  /** One month of social assistance taken, counted while `arrived` names this route (R-UNDERTAKING-010). */
  | { type: "people/assistance-taken"; route: Id<"route"> }
  // obligation
  /** `bond`: the bond an undertaking is for (R-UNDERTAKING-006). */
  | { type: "obligation/open"; obligation: Id<"obligation">; principal?: Amount; amount?: Amount; bond?: string }
  // offer: opens nothing when the offer's own `when` does not hold
  | { type: "offer/open"; offer: Id<"offer"> }
  /** closes an open offer unanswered, as a family request handled in another life (R-PEOPLE-034). */
  | { type: "offer/close"; offer: Id<"offer"> }
  // obligation, whole life
  | { type: "obligation/close"; obligationType: ObligationType }
  // place (docs/rules/place.md)
  | { type: "place/move"; to: Where; country: Id<"country"> | null }
  /** The authority sends the character home with this shape, as `return/home` would (R-PLACE-004, R-ROAD-007, R-STATUS-008). */
  | { type: "place/return"; shape: ReturnShape }
  // status (docs/rules/status.md)
  | { type: "status/grant"; status: Id<"status">; job?: Id<"activity"> }
  | { type: "status/lose" }
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
  /** Locks free slots for some months (R-TURN-009). */
  | { type: "turn/lock"; slots: number; months: number; why: string }
  /** The one final ending: the road's `lost` (R-ROAD-008). Departure no longer ends the life. */
  | { type: "turn/finish" };

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
}

export interface ActivityEntry {
  id: Id<"activity">;
  /** `side` holds one free slot while kept: docs/rules/activity.md R-ACTIVITY-010. */
  slot: "main" | "free" | "side";
  /** A job that keeps paying through a sick month (docs/rules/health.md R-HEALTH-004). Missing means no. */
  sickLeave?: boolean;
  /** Where it applies. Missing means `home`. docs/rules/ladders.md R-LADDER-001. */
  where?: WhereEntry;
  /** Abroad: the country it belongs to. Null or missing: every country. */
  country?: Id<"country"> | null;
  /** A job within the student cap (R-LADDER-006). */
  part?: boolean;
  /** Cash work: paid to cash, untaxed, pay may be withheld (R-LADDER-003). */
  cash?: boolean;
  withheldBp?: number;
  /** A job that carries its own sponsorship certificate (R-LADDER-005). */
  sponsor?: boolean;
  /** Needs the car (R-CAR-002). */
  needsCar?: boolean;
  /** Yearly bonus paid while the character has the car, in the pay's currency. */
  carBonus?: number;
  requires: Requirement[];
  /** What the player picks along with a free-slot activity. */
  /** `route` lists routes heard of; `known-route` lists routes known (the sponsor's find). */
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
  /** The English band times ten: 65 is band 6.5. */
  minBand: number;
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
  /** Which steps the route runs through: docs/rules/route-gates.md R-GATE-001. */
  gate: RouteGate;
  country: Id<"country"> | null;
  /** The status held abroad after departure. Null for the road. */
  status: Id<"status"> | null;
  /** The route's own refusal base, in place of the tuning base (R-GATE-002). */
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
  sponsor?: { salaryVar: Id<"var">; maintenanceVar: Id<"var"> | null; findBp: number; bandMin: number; documents: Id<"document">[]; strictnessVar: Id<"var">; surchargeYears: number; job: Id<"activity"> };
  /** Points gate. */
  /** `spouseTable`: the lead's columns with a spouse and the spouse's factors (R-PEOPLE-030). Null: no spouse counts. */
  points?: { table: Id<"points">; spouseTable: Id<"points"> | null; fundsVar: Id<"var">; cutoffVar: Id<"var">; careCutoffVar: Id<"var"> | null; feeVar: Id<"var">; decisionVar: Id<"var">; profileMonths: number };
  /** Endorsement gate. */
  endorsement?: { document: Id<"document">; baseBp: number; perPortfolioBp: number; perNetworkBp: number; capBp: number; cooldown: number; feeVar: Id<"var">; surchargeYears: number };
  /** Contract gate. */
  contract?: { medical: Id<"document">; maxAgeMonths: number };
  /** The route a partner may follow as a dependant, or null when this route brings none (docs/rules/people.md R-PEOPLE-024). */
  dependants: Id<"route"> | null;
  /** The partner gate (R-PEOPLE-026 to 028). */
  partner?: { sponsorStatuses: Id<"status">[]; bandMin: number | null; feeVar: Id<"var">; surchargeYears: number; decisionMonths: number; livingTogetherMonths: number | null; floorVar: Id<"var"> | null };
  /** The dependant gate (R-PEOPLE-022 to 025). */
  dependant?: { maintenanceVar: Id<"var"> | null; leadMonthsExempt: number | null; feeVar: Id<"var"> | null; feeFromLead: boolean; decisionMonths: number };
  /** Road gate: the outcome tables by step, in basis points. */
  road?: { steps: { id: string; months: [min: number, max: number]; on: number; held: number; turned: number; lost: number }[] };
}

/** One row of a points table: docs/rules/route-gates.md. */
export interface PointsEntry {
  id: Id<"points">;
  /** Age in whole years to points. The last row's age is a floor. */
  age: { years: number; points: number }[];
  /** `quality.edu-level` to points. */
  education: { level: number; points: number }[];
  /** English band (times ten) to points per ability; the last row's band is a floor. */
  language: { band: number; points: number }[];
  transfer: { educationLowBand: number; educationHighBand: number; workLowBand: number; workHighBand: number; workLongLowBand: number; workLongHighBand: number; highBand: number; workMonths: number; longMonths: number; cap: number };
  /** Points for a sibling in the country (R-PEOPLE-031). */
  siblingBonus: number;
  /** The spouse's factors when applying with a partner (R-PEOPLE-030). */
  spouse?: { education: { level: number; points: number }[]; language: { band: number; points: number }[]; canadianWork: { years: number; points: number }[]; cap: number };
  /** `quality.care` at or above this reads the care cut-off (R-POINTS-003). */
  careMin: number;
}

export interface SetpieceAnswer {
  id: string;
  score: number;
  /** When these hold, `thenScore` is used instead of `score`. */
  when: Requirement[];
  thenScore: number | null;
  /** Applied the moment the answer is given (R-SETPIECE-006). */
  effects: Effect[];
  /** Judged when the answer is given; an answer whose requirements fail is rejected `not-legal` (R-SETPIECE-003). Missing: always allowed. */
  requires?: Requirement[];
  /** True: giving this answer closes the set piece with the questions after it unasked (R-SETPIECE-004). */
  closes?: true;
  /** The id of a question in the entry's `followUps`, asked next when this answer is given (R-SETPIECE-008). */
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
  /** `fixed`: the first `ask` questions whose conditions hold, in the order written. Missing: drawn on `visa` (R-SETPIECE-001). */
  order?: "fixed";
  questions: SetpieceQuestion[];
  /** Questions asked only after an answer that names one, never drawn (R-SETPIECE-008). Missing: none. */
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
  /** Abroad: the credit mark needed to open it (R-CREDIT-004). */
  creditMin?: number;
  /** Paid and missed months move the credit file (R-CREDIT-002). */
  reportsToCredit?: boolean;
  /** The monthly rate by credit mark, first rung whose `min` the mark reaches (R-CREDIT-005). */
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
    /** The loan opened for what is still owed after the car goes (R-CAR-003, R-CAR-005). */
    shortfall: Id<"obligation">;
  };
  /** The group loan's named asset, taken on default (R-OBLIGATION-011). */
  seize?: Effect[];
  /** A fixed charge each month. A scenario or an effect may override it. */
  amount: number;
  /** Monthly interest on the opening principal. */
  rateBp: number;
  /** Months over which the principal is repaid in equal parts. Null: no schedule. */
  term: number | null;
  /** True: the principal sits locked in the bank and is returned, never spent. */
  locksPrincipal: boolean;
  sink: Reason;
  interestSink: Reason;
  /** Months a charge may be missed before `onDefault`. */
  grace: number;
  onMiss: Effect[];
  onDefault: Effect[];
}

export type TermSpec =
  | number
  | { from: "quality"; quality: Id<"quality">; times: number }
  | { from: "pay"; times: number; cap: number }
  | { from: "range"; min: number; max: number; step: number };

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
  /** The road: how the chance moves with the character's situation (R-ROAD-002). */
  pressure?: { refusalBp: number; defaultBp: number; lowStandingBp: number; perYearOver30Bp: number; strongRouteBp: number };
  /** The road pitch: what the offer really is, in basis points (R-ROAD-003). */
  kinds?: { fraud: number; realish: number; road: number };
  /** A win from the world or the profile; its `when` may never read money (docs/rules/luck.md R-LUCK-001). */
  luck?: boolean;
  /** A blow; rolls at half chance while the character is down (R-LUCK-003). */
  bad?: boolean;
  /** What the choice that takes the slot will lock, said a month ahead; the choice's own `turn/lock` effect does the locking (docs/rules/health.md R-HEALTH-006). */
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
  /** An item that closes the chapter alone when it is met, whatever the others say (R-CHAPTER-002). */
  closesOn?: string;
  /** R-ADVERT-003: no advert shows while this chapter is open. */
  noAdverts?: boolean;
}

/** docs/rules/adverts.md: a slot an advert may fill. The simulation never reads it. */
export interface AdvertSlotEntry {
  id: Id<"advert">;
  surface: "billboard" | "poster" | "phone-tile" | "shopfront";
  place: string;
  width: number;
  height: number;
  maxBytes: number;
}

/** docs/rules/guides.md: a guide, with its sources and sections as text keys. The simulation never reads it. */
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

/** docs/rules/city.md R-CITY-031: the fixed emote set. */
export type Emote = "wave" | "clap" | "sit" | "dance";

export interface VarEntry {
  id: Id<"var">;
  start: number;
}

export interface NewsEntry {
  id: Id<"news">;
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
  /** The fare home, one way, in the currency's smallest unit (R-PLACE-006). */
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
  /** Months after arriving through a partner before sponsoring a new one (R-UNDERTAKING-004). */
  partnerBarMonths: number;
}

export interface StatusEntry {
  id: Id<"status">;
  country: Id<"country">;
  /** Months it lasts. Null: it does not expire. A var id reads the length from the world; `lead`: as long as the lead's status (R-PEOPLE-024). */
  months: number | Id<"var"> | "lead" | null;
  work: WorkRule;
  /** Who may come as a dependant: none, anyone, or holders of these jobs (R-PEOPLE-024). */
  dependants: "none" | "any" | Id<"activity">[];
  /** A status that ends when the partnership ends, with the clock (R-PEOPLE-037). */
  tiedTo: "partner" | null;
  /** Months on the clock when the job goes. Null: no clock; `lapsesAtOnce` says the status lapses instead. */
  clockMonths: number | null;
  lapsesAtOnce: boolean;
  renewMonths: number;
  /** the employer's renewal chance on the status stream in the contract's last month (status.md, the Gulf renewal). */
  renewBp?: number;
  renewFeeVar: Id<"var"> | null;
  surchargeYearVar: Id<"var"> | null;
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
  overstayBanMonths: number;
  detectBp: number;
  holdsPassport: boolean;
}

export interface GoalEntry {
  id: Id<"goal">;
  where: WhereEntry;
  openIf: Requirement[];
  doneIf: Requirement[];
  reward: Effect[];
}

/** One place of the city: docs/rules/city.md R-CITY-002 to 024. Read by the city and the content check, never by a kind. */
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
  /** The real name of a public place, else null (R-CITY-005). */
  realName: string | null;
  /** Thousandths of a degree, or null. */
  position: { latE3: number; lonE3: number } | null;
  data: { source: "osm" | "overture" | "own"; licence: "ODbL-1.0" | "CDLA-Permissive-2.0" | null; checked: string } | null;
  sponsor: { key: string } | null;
  scope: "exterior" | "interior";
  hub: boolean;
  occasion: boolean;
  /** What is staged here, by id (R-CITY-010). */
  stages: (Id<"activity"> | Id<"offer"> | Id<"setpiece"> | Id<"chapter">)[];
  crowd: { low: number; high: number; target: number };
  traditionalBp: number;
  /** The folder under `public/assets/places/`. */
  assets: string;
}

// ---------------------------------------------------------------------------
// People, pairs and the interview: docs/rules/people.md, pair.md, interview.md
// ---------------------------------------------------------------------------

export type BondStage = "connected" | "courting" | "partner" | "married" | "ended";
export type PersonLabel = "player" | "computer" | "stand-in";

/** A computer character who can fill a slot: docs/rules/people.md "Entries". */
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

/** What one life knows of another person (R-PEOPLE-003): facts, never state. */
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
  ended: { month: number; by: "me" | "them" | "absence" | "block" | "drift" } | null;
  cooldownUntil: number | null;
  /** This life's own consents for a joint on the bond, agreed or pending (R-PEOPLE-004, 044). Null before any was given. */
  consent: { countFunds: boolean; standInMay: boolean } | null;
}

export interface PeopleSlice {
  slots: Record<string, { state: "empty" | "computer" | "invited" | "player" | "stand-in"; bond: string | null; person: Id<"person"> | null; invite: { looking: string; fill: string | null } | null }>;
  bonds: Record<string, Bond>;
  /** The view reads the two scores of R-PEOPLE-030 fresh from the state (8 Oct 2026: the slice holds none). */
  joint: { bond: string; route: Id<"route">; lead: "me" | "them"; countFunds: boolean; standInMay: boolean } | null;
  sponsoring: { bond: string; route: Id<"route">; month: number } | null;
  arrived: { route: Id<"route">; month: number } | null;
  assistanceTaken: number;
  /** Hidden. A computer partner's interview answers (R-INTERVIEW-006). */
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
  /** `thin`: the record measured once, in the applicant's life at opening, and carried to the other life (R-INTERVIEW-012). */
  open: { pair: string; route: Id<"route">; questions: { id: string; options: string[] }[]; answers: string[]; standIn: boolean; thin: boolean } | null;
  /** `standIn` marks whose answers were a stand-in's, so the result view can say so (R-INTERVIEW-008). */
  last: { route: Id<"route">; result: InterviewResult; matched: number; asked: number; month: number; standIn: { a: boolean; b: boolean } } | null;
  /** Hidden. The true answers for the questions asked (R-INTERVIEW-004). */
  secret: { truths: (string | null)[] | null };
}

/** The interview as the pair record holds it (R-INTERVIEW-007). */
export interface PairInterview {
  route: Id<"route">;
  questions: { id: string; options: string[] }[];
  answers: { a: string[] | null; b: string[] | null };
  standIn: { a: boolean; b: boolean };
  result: InterviewResult | null;
}

/** A preset phrase (docs/rules/pair.md R-PAIR-011 to 014). */
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

/** The one row per pair the server keeps (docs/rules/pair.md R-PAIR-001 to 006). Pure data; the simulation's pair module reads and writes it. */
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

/** A stored phrase between two players (R-PAIR-012). Times are the server's and never enter a state. */
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
  /** True for `scenario.prologue`: the life is built by the prologue's choices (R-PROLOGUE-001). */
  prologue?: boolean;
  qualities: Record<Id<"quality">, number>;
  job: Id<"activity"> | null;
  tenure: Record<Id<"activity">, number>;
  /** Siblings the life starts with (R-PEOPLE-010). */
  siblings: number;
  pockets: Partial<Record<Currency, { bank: number; cash: number }>>;
  documents: { document: Id<"document">; monthsLeft: number | null; value: number | null }[];
  obligations: { obligation: Id<"obligation">; amount: number }[];
}

/** Numbers that are rules more than entries. Each is named in a rule page. */
export interface Tuning {
  turn: { cap: number; start: number; freeSlots: number; freeSlotsNoJob: number; maxLocked: number };
  quality: {
    wellbeingRest: number;
    wellbeingDriftTo: number;
    wellbeingDrift: number;
    burnoutBelow: number;
    networkHireBp: number;
    hireMaxBp: number;
    /** A gain to a skill is halved, rounding up, once the skill is at or above this. */
    skillSoftAt: number;
    /** The share of a skill gain kept at or above the soft cap, rounding up (R-QUALITY-005). */
    skillSoftBp: number;
    /** The share of a skill gain kept while a side job is held, rounding up (R-ACTIVITY-010). */
    sideJobSkillBp: number;
  };
  wallet: {
    bankChargeBp: number;
    /** The aboki buys foreign currency this far under the street rate. */
    streetSpreadBp: number;
    streetShortBp: number;
    streetShortLossBp: [min: number, max: number];
    lotMonths: number;
    flagDepositAbove: number;
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
  /** `bandStep`: bands move in steps of this, a band times ten (R-DOCUMENT-005). */
  english: { base: number; perHundred: number; noiseSteps: number; min: number; max: number; bandStep: number };
  route: {
    /** R-ROUTE-007: an offer's chance rises this much for each grade above the school's minimum, up to `offerMaxBp`. */
    offerPerGradeBp: number;
    offerMaxBp: number;
    /** R-ROUTE-016: the grade from which the good-grade figure comes off the chance of refusal. */
    goodGrade: number;
    /** R-ROUTE-019: an unexplained share at or above this makes `funds` a refusal reason. */
    fundsReasonBp: number;
    /** R-ROUTE-006: months after a school's refusal before it takes a new application. */
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
  };
  offer: { maxNewPerMonth: number; maxOpen: number };
  place: { brokeLine: number; fareFromNaira: boolean };
  status: { courseMonths: number };
  /** `judgmentCap`: while a judgment stands, `credit/min` above it is never met (R-CREDIT-006). */
  /** `cleanMonths`: months without a miss before the file drifts up (R-CREDIT-003). */
  credit: { onTime: number; onMiss: number; onDefault: number; drift: number; driftTo: number; judgmentMonths: number; judgmentCap: number; returnPenalty: number; cleanMonths: number };
  car: { lessons: number; testFee: number; passBp: number; passPerAttemptBp: number; passCapBp: number };
  remit: { appFeeBp: number; appMarginBp: number; bankFeeBp: number; informalLossBp: number; abroadBp: number };
  return: { standing: Record<ReturnShape, number>; capitalPer: number; capitalCap: number; offerMonths: number; residentLapseMonths: number };
  director: { surgePerTick: number; closedTicks: number; maxNewPerTick: number; shockGapTicks: number; onlineTickScale: number };
  /**
   * `meansStep`: family means fall one point for each this much the family pays (R-ROAD-005). The pressure
   * lines (R-ROAD-002): standing under `pressureStandingUnder`, each year of age over `pressureAgeOver`, and a
   * formal route at a japacity figure of `pressureStrongRoute` or more.
   */
  road: { enabled: boolean; meansStep: number; pressureStandingUnder: number; pressureAgeOver: number; pressureStrongRoute: number };
  /** `robberyWellbeing`: wellbeing lost to the one chance (R-ACTIVITY-011). */
  ladder: { cashDetectBp: number; accountRent: number; overtimeBp: number; oneChanceBp: number; phone: number; robberyWellbeing: number };
  prologue: {
    startAgeMonths: number;
    siblings: [min: number, max: number];
    familyMeans: [min: number, max: number];
    cityBp: number;
    /** The parents' chance of schooling: this plus `parentsEducatedPerPoint` for each point of family means (R-PROLOGUE-002). */
    parentsEducatedBp: number;
    parentsEducatedPerPoint: number;
    /** Starting network by town, plus the educated parents' share; starting standing. */
    network: { city: number; town: number; educated: number };
    standing: number;
    /** The school certificate fee strains a family under `under`: standing changes by `standing` (R-PROLOGUE-003). */
    waecStrain: { under: number; standing: number };
    /** The degree's grade: base plus the grade base, up one at `upBp`, down one at `downBp`, kept between min and max. */
    grade: { base: number; upBp: number; downBp: number; min: number; max: number };
    /** A private university's session, passed through the account by the family (R-PROLOGUE-003). */
    privateSession: number;
  };
  /** `downUnder`: wellbeing or standing under this is "down" (R-LUCK-003); `rescueAfterMonths`: months played before the whip-round (R-LUCK-002). */
  /** advice.md: the four ways to look into a route, and the agents. */
  advice: { networkToAsk: number; adviserFee: number; agentKindsBp: { fixer: number; overpromiser: number; scammer: number }; fees: { fixer: [number, number]; overpromiser: [number, number]; scammer: [number, number] }; fixerMonths: number; fakePapersFee: number; scamTells: number; overpromiseTells: number; floorNaira: number; warnMonths: number };
  luck: {
    downUnder: number;
    rescueAfterMonths: number;
    rescue: number;
    rescueUnder: number;
    rescueRatio: number;
    drySpellMonths: number;
    drySpellBp: number;
    drySpellCapBp: number;
    /** Wellbeing gained on a won bet slip and lost on a lost one (R-LUCK-006). */
    betWellbeing: number;
    ticket: number;
    maxTickets: number;
    prizeSmall: number;
    prizeSmallBp: number;
    prizeMid: number;
    prizeMidBp: number;
    prizeJackpot: number;
    /** the jackpot's chance, in draws per million (it was named as basis points). */
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
  /** `cardLines`: the lines the send-off card names (R-CHAPTER-006). */
  chapter: { cardLines: number };
  /** `visit`: the second miss in a row, the officer and the group at the house (R-OBLIGATION-011). */
  groupLoan: { feeBp: number; savingsBp: number; vanishBp: number; visit: { standing: number; wellbeing: number } };
  /** The Friday draw (docs/rules/lottery.md): the ticket price, the cap per player, and the odds a draw takes when it opens (R-LOTTERY-021). */
  lottery: { ticket: number; maxTickets: number; odds: LotteryOdds };
  /** docs/rules/adverts.md Numbers. */
  advert: { maxSlotsPerPlace: number; maxPhoneTiles: number; impressionMs: number };
  /** docs/rules/share.md Numbers. */
  share: { width: number; height: number; maxBytes: number; previewWidth: number; previewHeight: number; previewMaxBytes: number };
  /** docs/rules/guides.md Numbers. */
  guide: { staleMonths: number };
  /** docs/rules/analytics.md Numbers. */
  analytics: { batchSeconds: number; maxBatchBytes: number; maxCount: number; batchesPerHour: number; minShown: number; refD1Bp: number; refD7Bp: number };
  /** The city's crowd bands, the graphics modes' switches and the screen split (docs/rules/city.md). The simulation never reads it. */
  city: { crowdLow: number; crowdHigh: number; playersMax: number; fridayBp: number; saturdayBp: number; raiseAfterMs: number; raiseFrameMs: number; dropAfterMs: number; dropFrameMs: number; maxPixelRatio: number; desktopMinWidth: number; idleAfterMs: number; idleFps: number; walkMmPerS: number; stopShortMm: number; tagNearMm: number; residentFloor: number; roam: boolean; flyover: boolean; indoorLow: number; indoorHigh: number; outdoorLow: number; outdoorHigh: number; motionSheets: number; ride: { fareKobo: { danfo: number; keke: number; okada: number }; metresPerMinute: { danfo: number; keke: number; okada: number }; waitMinutes: number } };
  /** The people around the character (docs/rules/people.md Numbers). */
  people: { matchmaker: boolean; maxCourting: number; partnerMoments: number; marryAfterMonths: number; weddingShare: number; proposeCooldown: number; recourtMonths: number; gossipBp: number; weddingStanding: number; gossipStanding: number; endStanding: { courting: number; partner: number; married: number; applying: number }; endWellbeing: number; leftWellbeing: number; couchMonths: number; warnDays: number; standInDays: number; computerAfterMonths: number };
  /** Invites and phrases (docs/rules/pair.md Numbers). */
  pair: { inviteDays: number; maxOpenInvites: number; rewardFriends: number; phrasesPerHour: number; placePhrasesPerMinute: number };
  /** The genuineness interview (docs/rules/interview.md Numbers). */
  interview: { ask: number; decoys: number; passBp: number; failBp: number; caughtBelowBp: number; thinMoments: number; thinMonths: number; doubtBp: number; standInRecallBp: number; caughtStanding: number };
  /** The sponsor's undertaking (docs/rules/undertaking.md Numbers). */
  undertaking: { months: number; assistanceUnder: number };
}

export interface Content {
  version: string;
  /** The version of the overlay applied at load, if any (R-ENGINE-017). Set by `applyOverlay` alone. */
  overlay?: string;
  /** Ids this version renamed, old to new, for `upgradeState` (docs/rules/server.md R-SERVER-017). */
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
  /** The spots people meet at, named by key (docs/rules/people.md R-PEOPLE-014). */
  people: { spots: string[] };
  /** The advert slots, the guides and the counters (the pages). The simulation never reads them; the content checks and the client and server do. */
  advert: Record<Id<"advert">, AdvertSlotEntry>;
  guide: Record<Id<"guide">, GuideEntry>;
  analytics: { counters: CounterDef[] };
  points: Record<Id<"points">, PointsEntry>;
  /** The prologue's steps by id. Empty until the prologue is built. */
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
  /** The Friday draw the server runs (docs/rules/lottery.md). Null offline: the stand-in world sets it to null. */
  /** `onSale` is false between a draw's close and the next draw's opening (R-LOTTERY-002 as amended). */
  lottery: { draw: number; closesTick: number; onSale: boolean; fingerprint: string; beaconRound: number; salesSoFar: number; jackpot: number; rolledOver: boolean; odds: LotteryOdds; last: LotteryResult | null } | null;
  /** R-ADVERT-017: the server's overlay of real names on sponsored places. Empty offline; the simulation never reads it. */
  placeNames: Record<string, { name: string; sign: string }>;
}

/**
 * A draw's odds and amounts (docs/rules/lottery.md R-LOTTERY-010 to 012, 021):
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

/** One draw's published result (docs/rules/lottery.md R-LOTTERY-010 to 015). */
export interface LotteryResult {
  draw: number;
  /** The server's secret for the draw, published after it (R-LOTTERY-015); named so the view's hidden-key check stays a net. */
  revealed: string;
  beaconRound: number;
  beaconRandomness: string;
  listHash: string;
  count: number;
  /** The odds and the jackpot the draw ran under (R-LOTTERY-021, R-LOTTERY-012). */
  odds: LotteryOdds;
  jackpot: number;
  /** Each tier's winning tickets and what one of them is paid: the jackpot's amount is its share (R-LOTTERY-011). */
  winners: { tier: "jackpot" | "mid" | "small"; tickets: number[]; amount: number }[];
  /** R-LOTTERY-012: the jackpot the next draw opens with under these odds. */
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
  /** A staged moment, not a line in a list (docs/rules/text.md, R-LUCK-008). */
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

/** A lock on free slots (R-TURN-009). */
export interface SlotLock {
  slots: number;
  /** The last month the lock holds. */
  untilMonth: number;
  why: string;
}

export interface TurnSlice {
  month: number;
  banked: number;
  /** True once the character has left. Only `turns/grant` is accepted after that. */
  ended: boolean;
  report: TurnReport | null;
  locks: SlotLock[];
}

export type QualitySlice = Record<Id<"quality">, number>;

export interface ActivitySlice {
  job: Id<"activity"> | null;
  /** The side job held (R-ACTIVITY-010). */
  side: Id<"activity"> | null;
  tenure: Record<Id<"activity">, number>;
  /** What filled the free slots last month, for "same again". */
  lastSlots: SlotPick[];
  /** Months each activity filled a slot, main or free, over the whole life (R-ACTIVITY-012); the send-off card reads it. */
  played: Record<Id<"activity">, number>;
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
  /** Cash moved into the bank in the given month, in kobo at the official rate, for R-WALLET-011's monthly threshold. */
  cashIn: { month: number; kobo: number };
}

export interface DocumentState {
  state: "pending" | "held" | "expired";
  /** False once the paper came from a scammer and was used (advice.md R-ADVICE-008); absent means genuine. */
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
  /** The rule numbers on the day of submission. The decision uses these: R-ROUTE-014. */
  rules: { livingLine: number; livingMonths: number; strictness: number };
  unexplainedBp: number;
  /** Null until the interview is finished. */
  interviewScore: number | null;
  /** Pence of surcharge paid with the application, refunded on a refusal (R-ROUTE-018). */
  surchargePaid: number;
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
  /** The last month-end funds check. */
  funds: { heldMonths: number; covered: boolean; shown: number; required: number };
  visa: VisaApplication | null;
  refusals: number;
  lastRefusal: { month: number; reasons: string[] } | null;
  depositRefund: { amount: number; readyMonth: number } | null;
  /** The gate's own state. Null before the whole-life kinds land. */
  gate: RouteGateState | null;
  /** Never in the view. */
  secret: { sponsorFraud: boolean | null };
  /** Months the route stays `refused` from a ban. Null: no ban. */
  bannedUntil: number | null;
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
  /** How many times each set piece has closed (R-SETPIECE-006). */
  answered: Partial<Record<Id<"setpiece">, number>>;
  /** The last answer given to each question of each set piece (R-SETPIECE-007). */
  given: Partial<Record<Id<"setpiece">, Record<string, string>>>;
  open: {
    entry: Id<"setpiece">;
    route: Id<"route"> | null;
    questions: string[];
    answers: Record<string, string>;
    /** The sum of the answers so far, each scored when it was given (R-SETPIECE-004). */
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

/** R-CAR-007: what a screen shows of one car beyond the obligation's own fields. */
export interface CarView extends CarTerms {
  paid: number;
  /** The monthly interest fixed at opening by the credit ladder. */
  interest: number;
  /** That interest as basis points of the opening principal. */
  rateBp: number;
  /** Two misses in a row: the lender's notice stands (R-CAR-003). */
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
}

export interface ChapterSlice {
  current: Id<"chapter"> | null;
  done: Id<"chapter">[];
}

export interface NewsSlice {
  /** The latest pass of each story this character has been shown: its stage and the tick that stage began. */
  delivered: Record<Id<"news">, { stage: NewsStage; since: number }>;
}

export interface PlaceSlice {
  where: Where;
  country: Id<"country"> | null;
  movedMonth: number;
  /** The record of returns. `country` is null for a return from the road (R-ROAD-007). */
  returns: { month: number; shape: ReturnShape; country: Id<"country"> | null }[];
  /** A settled or citizen status kept after a return with papers (R-RETURN-004). */
  heldAbroad: { status: Id<"status">; sinceMonth: number } | null;
  /** the month the December visit opened, null before (R-PLACE-009). */
  decemberMonth: number | null;
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
}

export interface StatusSlice {
  current: StatusState | null;
  /** Removals, by country and month. */
  removals: { country: Id<"country">; month: number }[];
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
  /** The shape of the save. Raised when the shape changes. 2 adds the whole-life slices; 3 the people and interview slices. */
  schema: 1 | 2 | 3;
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
  | { type: "return/home" }
  // online (docs/rules/lottery.md)
  | { type: "lottery/buy"; tickets: number }
  /** Sent by the authority alone, after the draw. */
  | { type: "lottery/pay"; draw: number; prizes: { tier: "jackpot" | "mid" | "small"; amount: number }[] }
  // people (docs/rules/people.md R-PEOPLE-012 to 020, 034 to 040)
  | { type: "people/invite"; slot: string; looking?: string; fill?: string }
  /** `with` names a computer character (`person.*`) or a slot holding an invited player (R-PEOPLE-014). */
  | { type: "people/court"; with: string }
  | { type: "people/propose"; bond: string; step: Proposal["step"]; route?: Id<"route">; lead?: "me" | "them" }
  | { type: "people/answer"; bond: string; step: Proposal["step"]; yes: boolean }
  | { type: "people/withdraw"; bond: string }
  | { type: "people/consent"; bond: string; countFunds?: boolean; standInMay?: boolean }
  | { type: "people/end"; bond: string }
  // people, from the authority alone (R-PEOPLE-004): another life's actions, recorded in the save
  | { type: "people/link"; slot: string; pair: string; facts: PersonFacts }
  | { type: "people/facts"; pair: string; facts: PersonFacts }
  | { type: "people/moments"; pair: string; moments: Moment[] }
  | { type: "people/proposal"; pair: string; proposal: Proposal }
  | { type: "people/agreed"; pair: string; step: Proposal["step"]; route?: Id<"route">; lead?: "me" | "them" }
  | { type: "people/ended"; pair: string; why: "them" | "absence" | "block" }
  /** the other life's answer to a proposal, carried across lives by the server. */
  | { type: "people/declined"; pair: string; step: Proposal["step"] }
  | { type: "people/withdrawn"; pair: string; step: Proposal["step"] }
  | { type: "people/gossip"; pair: string }
  | { type: "people/stand-in"; pair: string; stage: "warned" | "on" | null }
  /** `handled` says another copy of the request was handled (R-PEOPLE-034). */
  | { type: "people/family-request"; offer: Id<"offer">; terms: Terms; handled?: true }
  // the interview (docs/rules/interview.md)
  | { type: "interview/answer"; question: string; option: string }
  /** `thin`: the applicant's measure of the record (R-INTERVIEW-012). Missing: measured in this life. */
  | { type: "interview/open"; pair: string; route: Id<"route">; questions: { id: string; options: string[] }[]; thin?: boolean }
  | { type: "interview/scored"; pair: string; theirs: string[] }
);

export type CommandType = Command["type"];

export type RejectionCode =
  | "stale"
  | "clock-went-back"
  | "no-turns"
  | "setpiece-open"
  | "not-legal"
  | "cannot-afford"
  | "unknown-id"
  | "bad-amount"
  | "not-yours"
  | "ended"
  /** The prologue is open: only prologue/choose and turns/grant are accepted (R-PROLOGUE-001). */
  | "prologue-open";

export interface Rejection {
  ok: false;
  code: RejectionCode;
  detail: string;
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

/** Who sent a command. A player may not send `turns/grant`. */
/** Who sent a command: the player, the authority, or the stand-in that plays for an absent partner (R-PEOPLE-041). */
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
  /** Who sent the command being stepped (decision 0007 point 3: a stand-in's command is judged as a player's, but a kind may mark it). */
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

/** Where a segment begins: a new life from its scenario and seeds, or a state carried over (R-SERVER-020). */
export type SegmentStart = { scenario: Id<"scenario">; seed: string; worldSeed: string } | { base: State };

/** The commands accepted under one content version and one overlay (decision 0006). */
export interface SaveSegment {
  content: string;
  /** The overlay's version, when the content was loaded with one (R-ENGINE-010). */
  overlay?: string;
  start: SegmentStart;
  commands: SavedCommand[];
}

/** Everything needed to rebuild a state: R-ENGINE-010 and R-SERVER-020. Schema 3 is the save in segments. */
export interface Save {
  schema: 3;
  segments: SaveSegment[];
  /** a sibling made from an invite takes the inviter's family draw (R-PEOPLE-011). */
  family?: { from: string; draw: NonNullable<PrologueSlice["draw"]> };
}

/** A save of schema 1 or 2, before decision 0006: one segment, flat. `loadSave` reads it; nothing writes it as a save. */
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
 * Whoever holds the full state. In the first milestone it runs in the tab.
 * Online it is the server, which is why every method is a promise.
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
  support: { currency: Currency; amount: number } | null;
  funds: RouteState["funds"];
  unexplainedBp: number;
  visa: { submittedMonth: number; decisionMonth: number } | null;
  refusals: number;
  lastRefusal: RouteState["lastRefusal"];
  depositRefund: RouteState["depositRefund"];
  /** What the gate shows: docs/rules/route-gates.md. Null for the study gate. */
  gate: RouteGateView | null;
}

/** The gate's own part of a route's view. Nothing hidden: no fraud, no draw. */
export type RouteGateView =
  | { gate: "sponsor"; employer: string | null; salary: number | null; underBar: boolean }
  | { gate: "points"; points: number; cutoff: number; careCutoff: number | null; poolMonth: number | null; profileEndsMonth: number | null; invitedMonth: number | null }
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
}

export interface OfferView {
  id: string;
  entry: Id<"offer">;
  openedMonth: number;
  expiresMonth: number;
  terms: Terms;
  signs: string[];
  choices: { id: string; allowed: boolean; pick: { min: number; max: number } | null }[];
}

export interface PlayerView {
  v: number;
  scenario: Id<"scenario">;
  month: number;
  ended: boolean;
  turns: { banked: number; cap: number };
  /** Locks on free slots now, with their reasons (R-TURN-009). */
  locks: SlotLock[];
  japacity: { percent: number | null; route: Id<"route"> | null };
  qualities: { id: Id<"quality">; value: number }[];
  /** The run-down warning stands: two months under the wellbeing line (R-HEALTH-001, R-HEALTH-007). */
  runDown: boolean;
  /** The job, its tenure, and the side job held if any (R-ACTIVITY-010). */
  job: { id: Id<"activity"> | null; months: number; side: Id<"activity"> | null };
  freeSlots: number;
  activities: ActivityOption[];
  lastSlots: SlotPick[];
  pockets: Record<Currency, PocketBalance>;
  queued: QueuedConversion[];
  rates: World["rates"];
  /** What may still be bought at the bank this month, in US cents. */
  /** null abroad, where the Lagos allowance does not bind (R-WALLET-005, 006). */
  bankAllowanceLeft: number | null;
  documents: { id: Id<"document">; state: DocumentState["state"]; readyMonth: number | null; expiresMonth: number | null; value: number | null }[];
  routes: RouteView[];
  setpiece: {
    entry: Id<"setpiece">;
    asked: number;
    total: number;
    /** `answers` is every answer; `allowed` those whose requirements hold now (R-SETPIECE-003); `weak` those that would score below zero, shown only with enough prep (R-SETPIECE-005); `followUp` true when it is asked after the answer before it (R-SETPIECE-008). */
    question: { id: string; answers: string[]; allowed: string[]; weak: string[]; followUp: boolean } | null;
  } | null;
  /** Every open obligation with its next charge; `car` carries R-CAR-007's figures for a car and is null for anything else. */
  obligations: (ObligationState & { due: number; car: CarView | null })[];
  offers: OfferView[];
  chapter: { current: Id<"chapter"> | null; items: { id: string; met: boolean }[]; done: Id<"chapter">[] };
  news: { id: Id<"news">; stage: NewsStage; since: number; forYou: boolean }[];
  /** `fareHome` is the fare from the country the character is in, December factor applied, or null at home (R-PLACE-006). */
  place: { where: Where; country: Id<"country"> | null; monthsHere: number; returns: PlaceSlice["returns"]; heldAbroad: Id<"status"> | null; fareHome: MoneyParam | null };
  status: {
    entry: Id<"status">;
    monthsLeft: number | null;
    clock: number | null;
    lawfulMonths: number;
    settleMonths: number | null;
    work: WorkRule;
    nextStep: string | null;
    /** What `status/renew` would cost today from the world's variables, or null when the status cannot be renewed by asking (R-STATUS-010). */
    renew: { months: number; currency: ForeignCurrency; fee: number; surcharge: number } | null;
  } | null;
  credit: { mark: number; onTime: number; missed: number; judgmentUntil: number | null; needs: { id: Id<"obligation">; creditMin: number }[] } | null;
  goals: { open: { id: Id<"goal">; items: { id: string; met: boolean }[] }[]; done: { id: Id<"goal">; month: number }[] };
  prologue: {
    step: string;
    answers: { id: string; allowed: boolean }[];
    lastOutcome: string | null;
    draw: PrologueSlice["draw"];
  } | null;
  /** The era running, with its start and end as this player's months (the tick difference from now). Null until the director runs. */
  era: { id: Id<"era">; since: number; until: number; sinceMonth: number; untilMonth: number } | null;
  /** The send-off card or the real-story card, when one is due (R-CHAPTER-006, R-ROAD-011). */
  card: {
    kind: "chapter" | "granted" | "send-off" | "first-pay-abroad" | "secured" | "december" | "draw-win" | "real-story" | "lost";
    chapter: Id<"chapter"> | null;
    route: Id<"route"> | null;
    percent: number | null;
    months: number;
    standing: number;
    topActivities: Id<"activity">[];
    /** The name the player chose, never the account's (R-SHARE-007). */
    name: string | null;
  } | null;
  /** The people around the character (docs/rules/people.md R-PEOPLE-051). */
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
  /** The Friday draw as this character sees it, or null offline (docs/rules/lottery.md R-LOTTERY-015). */
  lottery: { ticket: number; maxTickets: number; draw: number; closesTick: number; onSale: boolean; tickets: number; numbers: number[] | null; jackpot: number; rolledOver: boolean; odds: LotteryOdds; fingerprint: string; last: LotteryResult | null } | null;
  /** R-ADVERT-003: whether an advert may show now (never on the road, in a set piece, or in a chapter with `noAdverts`). */
  adverts: boolean;
  report: TurnReport | null;
}
