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
  | "health";

/** Where a character is. `road` is the chain in docs/rules/road.md. */
export type Where = "home" | "abroad" | "road";
/** Where an entry applies. */
export type WhereEntry = "home" | "abroad" | "any";
/** The shapes of a return home: docs/rules/place.md R-PLACE-005. */
export type ReturnShape = "removed" | "assisted" | "broke" | "by-choice" | "with-papers";
/** What a status lets you do for work: docs/rules/status.md R-STATUS-002. */
export type WorkRule = "any" | "part" | "one-employer" | "cash" | "none";
/** A route's gate: docs/rules/route-gates.md. */
export type RouteGate = "study" | "sponsor" | "points" | "endorsement" | "contract" | "road";

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
  | { type: "obligation/has"; obligationType: ObligationType }
  /** A route's gate has reached the named step: docs/rules/route-gates.md. */
  | { type: "route/gate-step"; route: Id<"route">; step: string }
  /** Months in any job in the current country. */
  | { type: "activity/local-tenure"; months: number }
  /** The set piece has closed at least `times` times (default 1): docs/rules/route.md R-SETPIECE-006. */
  | { type: "setpiece/answered"; setpiece: Id<"setpiece">; times?: number }
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
  | { type: "activity/end-job"; why: string }
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
  // setpiece
  /** Opens a set piece for a route (R-SETPIECE-001). */
  /** Open a set piece. With a route, the score goes to its visa application; with none, nothing is scored (R-SETPIECE-006). */
  | { type: "setpiece/open"; setpiece: Id<"setpiece">; route: Id<"route"> | null }
  // obligation
  | { type: "obligation/open"; obligation: Id<"obligation">; principal?: Amount; amount?: Amount }
  // offer: opens nothing when the offer's own `when` does not hold
  | { type: "offer/open"; offer: Id<"offer"> }
  // obligation, whole life
  | { type: "obligation/close"; obligationType: ObligationType }
  // place (docs/rules/place.md)
  | { type: "place/move"; to: Where; country: Id<"country"> | null }
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
  param: "job" | "route" | "school" | null;
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
  sponsor?: { salaryVar: Id<"var">; maintenanceVar: Id<"var"> | null; findBp: number; bandMin: number; documents: Id<"document">[] };
  /** Points gate. */
  points?: { table: Id<"points">; fundsVar: Id<"var">; cutoffVar: Id<"var">; careCutoffVar: Id<"var"> | null; feeVar: Id<"var">; decisionVar: Id<"var">; profileMonths: number };
  /** Endorsement gate. */
  endorsement?: { document: Id<"document">; baseBp: number; perPortfolioBp: number; perNetworkBp: number; capBp: number; cooldown: number; feeVar: Id<"var"> };
  /** Contract gate. */
  contract?: { medical: Id<"document">; maxAgeMonths: number };
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
  transfer: { educationLowBand: number; educationHighBand: number; workLowBand: number; workHighBand: number; workLongLowBand: number; workLongHighBand: number; highBand: number; longMonths: number; cap: number };
}

export interface SetpieceAnswer {
  id: string;
  score: number;
  /** When these hold, `thenScore` is used instead of `score`. */
  when: Requirement[];
  thenScore: number | null;
  /** Applied the moment the answer is given (R-SETPIECE-006). */
  effects: Effect[];
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
  questions: SetpieceQuestion[];
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
  car?: { price: number; depositBp: number; finalBp: number; resaleBp: number; courtThirdBp: number; handBackBp: number; courtMonths: number };
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
  /** Taking any choice locks slots from next month (docs/rules/health.md R-HEALTH-006). */
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
}

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
}

export interface StatusEntry {
  id: Id<"status">;
  country: Id<"country">;
  /** Months it lasts. Null: it does not expire. A var id reads the length from the world. */
  months: number | Id<"var"> | null;
  work: WorkRule;
  /** Months on the clock when the job goes. Null: no clock; `lapsesAtOnce` says the status lapses instead. */
  clockMonths: number | null;
  lapsesAtOnce: boolean;
  renewMonths: number;
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
  credit: { onTime: number; onMiss: number; onDefault: number; drift: number; driftTo: number; judgmentMonths: number; returnPenalty: number };
  car: { lessons: number; testFee: number; passBp: number; passPerAttemptBp: number; passCapBp: number };
  remit: { appFeeBp: number; appMarginBp: number; bankFeeBp: number; informalLossBp: number; abroadBp: number };
  return: { standing: Record<ReturnShape, number>; capitalPer: number; capitalCap: number; offerMonths: number; residentLapseMonths: number };
  director: { surgePerTick: number; closedTicks: number; maxNewPerTick: number; shockGapTicks: number; onlineTickScale: number };
  road: { enabled: boolean };
  ladder: { cashDetectBp: number; accountRent: number; overtimeBp: number; oneChanceBp: number; phone: number };
  prologue: { startAgeMonths: number; siblings: [min: number, max: number]; familyMeans: [min: number, max: number]; cityBp: number };
  luck: {
    rescue: number;
    rescueUnder: number;
    rescueRatio: number;
    drySpellMonths: number;
    drySpellBp: number;
    drySpellCapBp: number;
    ticket: number;
    maxTickets: number;
    prizeSmall: number;
    prizeSmallBp: number;
    prizeMid: number;
    prizeMidBp: number;
    prizeJackpot: number;
    prizeJackpotBp: number;
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
  groupLoan: { feeBp: number; savingsBp: number; vanishBp: number };
}

export interface Content {
  version: string;
  /** The version of the overlay applied at load, if any (R-ENGINE-017). Set by `applyOverlay` alone. */
  overlay?: string;
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
}

export interface DocumentState {
  state: "pending" | "held" | "expired";
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
  | { gate: "road"; step: string | null; monthsHere: number; debt: number };

export type RouteSlice = Record<Id<"route">, RouteState>;

export interface SetpieceSlice {
  /** How many times each set piece has closed (R-SETPIECE-006). */
  answered: Partial<Record<Id<"setpiece">, number>>;
  open: {
    entry: Id<"setpiece">;
    route: Id<"route"> | null;
    questions: string[];
    answers: Record<string, string>;
    /** The sum of the answers so far, each scored when it was given (R-SETPIECE-004). */
    score: number;
  } | null;
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
  /** The latest stage of each story this character has been shown. */
  delivered: Record<Id<"news">, NewsStage>;
}

export interface PlaceSlice {
  where: Where;
  country: Id<"country"> | null;
  movedMonth: number;
  returns: { month: number; shape: ReturnShape; country: Id<"country"> }[];
  /** A settled or citizen status kept after a return with papers (R-RETURN-004). */
  heldAbroad: { status: Id<"status">; sinceMonth: number } | null;
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
  /** The shape of the save. Raised when the shape changes. 2 adds the whole-life slices. */
  schema: 1 | 2;
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
export type Sender = "player" | "authority";

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

/** Everything needed to rebuild a state: R-ENGINE-010. */
export interface Save {
  schema: 1 | 2;
  content: string;
  /** The overlay's version, when the content was loaded with one (R-ENGINE-010). */
  overlay?: string;
  scenario: Id<"scenario">;
  seed: string;
  worldSeed: string;
  commands: { command: Command; tick: number; sender: Sender }[];
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
}

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
  job: { id: Id<"activity"> | null; months: number };
  freeSlots: number;
  activities: ActivityOption[];
  lastSlots: SlotPick[];
  pockets: Record<Currency, PocketBalance>;
  queued: QueuedConversion[];
  rates: World["rates"];
  /** What may still be bought at the bank this month, in US cents. */
  bankAllowanceLeft: number;
  documents: { id: Id<"document">; state: DocumentState["state"]; readyMonth: number | null; expiresMonth: number | null; value: number | null }[];
  routes: RouteView[];
  setpiece: {
    entry: Id<"setpiece">;
    asked: number;
    total: number;
    question: { id: string; answers: string[]; weak: string[] } | null;
  } | null;
  obligations: (ObligationState & { due: number })[];
  offers: OfferView[];
  chapter: { current: Id<"chapter"> | null; items: { id: string; met: boolean }[]; done: Id<"chapter">[] };
  news: { id: Id<"news">; stage: NewsStage; since: number; forYou: boolean }[];
  place: { where: Where; country: Id<"country"> | null; monthsHere: number; returns: PlaceSlice["returns"]; heldAbroad: Id<"status"> | null };
  status: {
    entry: Id<"status">;
    monthsLeft: number | null;
    clock: number | null;
    lawfulMonths: number;
    settleMonths: number | null;
    work: WorkRule;
    nextStep: string | null;
  } | null;
  credit: { mark: number; onTime: number; missed: number; judgmentUntil: number | null; needs: { id: Id<"obligation">; creditMin: number }[] } | null;
  goals: { open: { id: Id<"goal">; items: { id: string; met: boolean }[] }[]; done: { id: Id<"goal">; month: number }[] };
  prologue: {
    step: string;
    answers: { id: string; allowed: boolean }[];
    lastOutcome: string | null;
    draw: PrologueSlice["draw"];
  } | null;
  era: World["era"];
  /** The send-off card or the real-story card, when one is due (R-CHAPTER-006, R-ROAD-011). */
  card: { kind: "send-off" | "real-story" | "lost"; route: Id<"route"> | null; percent: number | null; months: number; standing: number; topActivities: Id<"activity">[] } | null;
  report: TurnReport | null;
}
