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
  | "scenario";

/** An entry id: the kind, a dot, then a lower-case slug with hyphens. */
export type Id<K extends KindName> = `${K}.${string}`;

export type Currency = "NGN" | "GBP" | "USD";
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
  // transfers: always in matched pairs
  | "convert"
  | "move";

export type Stream = "job" | "gig" | "test" | "school" | "document" | "visa" | "offer" | "fraud" | "street";

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
  // obligation
  | { type: "obligation/open"; obligation: Id<"obligation">; principal?: Amount; amount?: Amount }
  // offer: opens nothing when the offer's own `when` does not hold
  | { type: "offer/open"; offer: Id<"offer"> }
  // turn
  | { type: "turn/refill" }
  /** The life at home is over: the character has left. */
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
  slot: "main" | "free";
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
  hearIf: Requirement[];
  /** A character who meets `hearIf` has heard by this month at the latest. */
  hearBy: number;
  window: Id<"var">;
  checklist: ChecklistItem[];
  schools: Id<"school">[];
  interview: Id<"setpiece">;
}

export interface SetpieceAnswer {
  id: string;
  score: number;
  /** When these hold, `thenScore` is used instead of `score`. */
  when: Requirement[];
  thenScore: number | null;
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

export interface ObligationEntry {
  id: Id<"obligation">;
  type: "upkeep" | "support" | "loan" | "held-funds";
  currency: Currency;
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
  group: "family" | "job" | "money" | "life";
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

export interface ScenarioEntry {
  id: Id<"scenario">;
  qualities: Record<Id<"quality">, number>;
  job: Id<"activity"> | null;
  tenure: Record<Id<"activity">, number>;
  pockets: Partial<Record<Currency, { bank: number; cash: number }>>;
  documents: { document: Id<"document">; monthsLeft: number | null; value: number | null }[];
  obligations: { obligation: Id<"obligation">; amount: number }[];
}

/** Numbers that are rules more than entries. Each is named in a rule page. */
export interface Tuning {
  turn: { cap: number; start: number; freeSlots: number; freeSlotsNoJob: number };
  quality: {
    wellbeingRest: number;
    wellbeingDriftTo: number;
    wellbeingDrift: number;
    burnoutBelow: number;
    networkHireBp: number;
    hireMaxBp: number;
    /** A gain to a skill is halved, rounding up, once the skill is at or above this. */
    skillSoftAt: number;
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
  english: { base: number; perHundred: number; noiseSteps: number; min: number; max: number };
  route: {
    refusalBaseBp: number;
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
}

export interface Content {
  version: string;
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
}

// ---------------------------------------------------------------------------
// State: one slice per kind
// ---------------------------------------------------------------------------

export interface SlotPick {
  activity: Id<"activity">;
  param: string | null;
}

export interface ReportLine {
  /** A text key. Content holds the words. */
  key: string;
  params: Record<string, string | number>;
  tone: "good" | "bad" | "plain";
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

export interface TurnSlice {
  month: number;
  banked: number;
  /** True once the character has left. Only `turns/grant` is accepted after that. */
  ended: boolean;
  report: TurnReport | null;
}

export type QualitySlice = Record<Id<"quality">, number>;

export interface ActivitySlice {
  job: Id<"activity"> | null;
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
}

export type RouteSlice = Record<Id<"route">, RouteState>;

export interface SetpieceSlice {
  open: {
    entry: Id<"setpiece">;
    route: Id<"route">;
    questions: string[];
    answers: Record<string, string>;
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

export interface State {
  /** The shape of the save. Raised when the shape changes. */
  schema: 1;
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
}

// ---------------------------------------------------------------------------
// Commands and results
// ---------------------------------------------------------------------------

export type Command = { basedOn: number } & (
  | { type: "turn/end"; slots: SlotPick[] }
  | { type: "activity/quit" }
  | { type: "offer/choose"; offer: string; choice: string; amount?: number }
  | { type: "wallet/convert"; from: Currency; to: Currency; amount: number; via: "bank" | "aboki" }
  | { type: "wallet/move"; currency: Currency; amount: number; to: Pocket }
  | { type: "obligation/pay"; obligation: string; amount: number }
  | { type: "route/pay-deposit"; route: Id<"route">; school: Id<"school"> }
  | { type: "route/depart"; route: Id<"route"> }
  | { type: "setpiece/answer"; question: string; answer: string }
  | { type: "turns/grant"; count: number }
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
  | "ended";

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
  schema: 1;
  content: string;
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
  report: TurnReport | null;
}
