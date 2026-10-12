// Schemas for the small languages content is written in: amounts, money,
// requirements, effects and terms, plus the tuning numbers and the id template.
// Every object is strict, so a misspelt or extra key fails the content check.
import { z } from "zod";

import { HomeHostSchema, HomePlaceSchema, HomeTuningSchema } from "../home/home.schema";

import type {
  Amount,
  Cost,
  Currency,
  Effect,
  ForeignCurrency,
  KindName,
  Money,
  NewsStage,
  ObligationType,
  Pocket,
  Reason,
  Requirement,
  ReturnShape,
  RouteGate,
  RouteStateName,
  TermSpec,
  Tuning,
  Where,
  WhereEntry,
  WorkRule,
} from "./types";

// ---------------------------------------------------------------------------
// Proving a schema and a contract type are the same
// ---------------------------------------------------------------------------

/**
 * True only when A and B are the same type. A field missing on either side, an
 * extra field on either side (optional ones included) or a field of another
 * type makes it false.
 */
export type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compiles only when given `true`. Used as `Proof<Same<z.infer<typeof X>, Y>>` beside each schema. */
export type Proof<T extends true> = T;

// ---------------------------------------------------------------------------
// Ids and small enums
// ---------------------------------------------------------------------------

const SLUG = "[a-z0-9]+(?:-[a-z0-9]+)*";

/** The id template for one kind: the kind, a dot, then lower-case letters, digits and single hyphens. */
export function idOf<K extends KindName>(kind: K) {
  return z
    .templateLiteral([z.literal(kind), ".", z.string()])
    .check(z.regex(new RegExp(`^${kind}\\.${SLUG}$`), { error: `Expected an id of the form ${kind}.slug` }));
}

export const CurrencySchema = z.enum(["NGN", "GBP", "USD", "CAD", "AED", "EUR"]);
export const ForeignCurrencySchema = z.enum(["GBP", "USD", "CAD", "AED", "EUR"]);
export const PocketSchema = z.enum(["bank", "cash"]);
/** A hometown (R-PROLOGUE-002): `hometown.<slug>`, its words in content. Not a kind: a town the family is from, never a place the game shows. */
export const HometownSchema = z.string().regex(new RegExp(`^hometown\\.${SLUG}$`), { error: "Expected a hometown of the form hometown.slug" });
export const ReasonSchema = z.enum([
  "opening",
  "salary",
  "gig",
  "gift",
  "sale",
  "loan",
  "held-funds",
  "refund",
  "upkeep",
  "family",
  "fee-document",
  "fee-test",
  "fee-school",
  "fee-visa",
  "fee-surcharge",
  "fee-agent",
  "fee-advice",
  "food",
  "enjoyment",
  "bank-charge",
  "loan-repay",
  "loan-interest",
  "held-funds-return",
  "held-funds-interest",
  "study",
  "social",
  "mishap",
  "flight",
  "short-count",
  "rent",
  "deposit-return",
  "phone",
  "car-payment",
  "car-deposit",
  "remit",
  "remit-fee",
  "cash-work",
  "tax",
  "agent-debt",
  "ransom",
  "fare",
  "build",
  "win",
  "pot-top-up",
  "ticket",
  "wedding",
  "undertaking",
  "assistance",
  "top-up",
  "convert",
  "move",
]);
export const WhereSchema = z.enum(["home", "abroad", "road"]);
export const BondStageSchema = z.enum(["connected", "courting", "partner", "married", "ended"]);
export const WhereEntrySchema = z.enum(["home", "abroad", "any"]);
export const ReturnShapeSchema = z.enum(["removed", "assisted", "broke", "by-choice", "with-papers"]);
export const WorkRuleSchema = z.enum(["any", "part", "one-employer", "cash", "none"]);
export const RouteGateSchema = z.enum(["study", "sponsor", "points", "endorsement", "contract", "road", "partner", "dependant"]);
export const ObligationTypeSchema = z.enum([
  "upkeep",
  "support",
  "loan",
  "held-funds",
  "rent",
  "phone",
  "car",
  "surcharge",
  "tuition",
  "agent-debt",
  "undertaking",
  "group-loan",
  "ajo",
]);

export type WhereMatches = Proof<Same<z.infer<typeof WhereSchema>, Where>>;
export type WhereEntryMatches = Proof<Same<z.infer<typeof WhereEntrySchema>, WhereEntry>>;
export type ReturnShapeMatches = Proof<Same<z.infer<typeof ReturnShapeSchema>, ReturnShape>>;
export type WorkRuleMatches = Proof<Same<z.infer<typeof WorkRuleSchema>, WorkRule>>;
export type RouteGateMatches = Proof<Same<z.infer<typeof RouteGateSchema>, RouteGate>>;
export type ObligationTypeMatches = Proof<Same<z.infer<typeof ObligationTypeSchema>, ObligationType>>;
export const RouteStateNameSchema = z.enum(["unknown", "heard", "known", "applying", "granted", "refused", "departed"]);
export const NewsStageSchema = z.enum(["rumour", "announced", "in-force", "ended"]);

export type CurrencyMatches = Proof<Same<z.infer<typeof CurrencySchema>, Currency>>;
export type ForeignCurrencyMatches = Proof<Same<z.infer<typeof ForeignCurrencySchema>, ForeignCurrency>>;
export type PocketMatches = Proof<Same<z.infer<typeof PocketSchema>, Pocket>>;
export type ReasonMatches = Proof<Same<z.infer<typeof ReasonSchema>, Reason>>;
export type RouteStateNameMatches = Proof<Same<z.infer<typeof RouteStateNameSchema>, RouteStateName>>;
export type NewsStageMatches = Proof<Same<z.infer<typeof NewsStageSchema>, NewsStage>>;

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/** A whole number. Money, chances and counts are never fractions. */
export const IntSchema = z.int();
/** A whole number, zero or more. */
export const CountSchema = z.int().nonnegative();
/** A chance or share in basis points: 0 to 10000. */
export const BpSchema = z.int().min(0).max(10000);
/** A pair of whole numbers, the first no greater than the second. */
export const RangeSchema = z
  .tuple([CountSchema, CountSchema])
  .check(z.refine(([min, max]) => min <= max, { error: "The first figure must not be above the second" }));

// ---------------------------------------------------------------------------
// Amounts, money, costs
// ---------------------------------------------------------------------------

export const AmountSchema = z.union([
  CountSchema,
  z.strictObject({ var: idOf("var") }),
  z.strictObject({ term: z.string().min(1), bp: CountSchema.exactOptional() }),
]);

export const MoneySchema = z.strictObject({
  currency: CurrencySchema,
  amount: AmountSchema,
});

export const CostSchema = z.strictObject({
  currency: CurrencySchema,
  amount: AmountSchema,
  reason: ReasonSchema,
});

export type AmountMatches = Proof<Same<z.infer<typeof AmountSchema>, Amount>>;
export type MoneyMatches = Proof<Same<z.infer<typeof MoneySchema>, Money>>;
export type CostMatches = Proof<Same<z.infer<typeof CostSchema>, Cost>>;

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

export const RequirementSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("quality/min"), quality: idOf("quality"), value: IntSchema }),
  z.strictObject({ type: z.literal("quality/max"), quality: idOf("quality"), value: IntSchema }),
  z.strictObject({ type: z.literal("job/any") }),
  z.strictObject({ type: z.literal("job/none") }),
  z.strictObject({ type: z.literal("job/is"), activities: z.array(idOf("activity")) }),
  z.strictObject({ type: z.literal("activity/tenure"), activities: z.array(idOf("activity")), months: CountSchema }),
  z.strictObject({ type: z.literal("document/held"), document: idOf("document"), min: IntSchema.exactOptional() }),
  z.strictObject({ type: z.literal("document/absent"), document: idOf("document") }),
  z.strictObject({ type: z.literal("document/pending"), document: idOf("document") }),
  z.strictObject({ type: z.literal("document/genuine"), document: idOf("document") }),
  z.strictObject({ type: z.literal("route/state"), route: idOf("route"), in: z.array(RouteStateNameSchema).min(1) }),
  z.strictObject({ type: z.literal("route/offer"), route: idOf("route") }),
  z.strictObject({ type: z.literal("route/deposit"), route: idOf("route") }),
  z.strictObject({ type: z.literal("route/funds"), route: idOf("route"), heldMonths: CountSchema }),
  z.strictObject({ type: z.literal("route/unexplained-max"), route: idOf("route"), bp: BpSchema }),
  z.strictObject({
    type: z.literal("money/min"),
    currency: CurrencySchema,
    amount: AmountSchema,
    pocket: PocketSchema.exactOptional(),
  }),
  z.strictObject({ type: z.literal("money/can-pay"), currency: CurrencySchema, amount: AmountSchema }),
  z.strictObject({ type: z.literal("var/min"), var: idOf("var"), value: IntSchema }),
  z.strictObject({ type: z.literal("var/max"), var: idOf("var"), value: IntSchema }),
  z.strictObject({ type: z.literal("month/min"), value: CountSchema }),
  z.strictObject({ type: z.literal("chapter/done"), chapter: idOf("chapter") }),
  z.strictObject({ type: z.literal("place/is"), where: WhereSchema, country: idOf("country").exactOptional() }),
  z.strictObject({ type: z.literal("status/is"), statuses: z.array(idOf("status")) }),
  z.strictObject({ type: z.literal("status/clock-under"), months: CountSchema }),
  z.strictObject({ type: z.literal("credit/min"), value: IntSchema }),
  z.strictObject({ type: z.literal("goal/done"), goal: idOf("goal") }),
  z.strictObject({ type: z.literal("era/is"), eras: z.array(idOf("era")) }),
  z.strictObject({ type: z.literal("obligation/has"), obligationType: ObligationTypeSchema, obligation: idOf("obligation").exactOptional() }),
  z.strictObject({ type: z.literal("route/gate-step"), route: idOf("route"), step: z.string().min(1) }),
  z.strictObject({ type: z.literal("activity/local-tenure"), months: CountSchema }),
  z.strictObject({ type: z.literal("activity/played"), activity: idOf("activity") }),
  z.strictObject({ type: z.literal("setpiece/answered"), setpiece: idOf("setpiece"), times: CountSchema.exactOptional() }),
  z.strictObject({ type: z.literal("setpiece/answered-with"), setpiece: idOf("setpiece"), question: z.string().min(1), answer: z.string().min(1) }),
  z.strictObject({ type: z.literal("world/lottery"), online: z.boolean() }),
  z.strictObject({
    type: z.literal("people/bond"),
    role: z.enum(["partner", "sibling"]),
    stages: z.array(BondStageSchema).min(1),
    where: WhereSchema.exactOptional(),
    country: idOf("country").exactOptional(),
    statuses: z.array(idOf("status")).exactOptional(),
  }),
  z.strictObject({ type: z.literal("people/sibling-abroad"), country: idOf("country"), statuses: z.array(idOf("status")).min(1), minAgeMonths: CountSchema }),
  z.strictObject({ type: z.literal("people/joint"), route: idOf("route"), as: z.enum(["lead", "dependant"]) }),
  z.strictObject({ type: z.literal("wallet/total"), flow: z.enum(["in", "out"]), reason: ReasonSchema, currency: CurrencySchema, amount: AmountSchema }),
  z.strictObject({ type: z.literal("place/returned"), shapes: z.array(ReturnShapeSchema).min(1) }),
  z.strictObject({ type: z.literal("place/months-here"), where: WhereSchema, months: CountSchema }),
  z.strictObject({ type: z.literal("home/host"), host: HomeHostSchema }),
  z.strictObject({
    type: z.literal("not"),
    get of(): z.ZodType<Requirement> {
      return RequirementSchema;
    },
  }),
  z.strictObject({
    type: z.literal("any"),
    get of(): z.ZodArray<z.ZodType<Requirement>> {
      return z.array(RequirementSchema);
    },
  }),
]);

export type RequirementMatches = Proof<Same<z.infer<typeof RequirementSchema>, Requirement>>;

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

export const EffectSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("money/add"),
    currency: CurrencySchema,
    pocket: PocketSchema,
    amount: AmountSchema,
    reason: ReasonSchema,
    flagged: z.boolean().exactOptional(),
    locked: z.boolean().exactOptional(),
  }),
  z.strictObject({
    type: z.literal("money/take"),
    currency: CurrencySchema,
    pocket: z.enum(["bank", "cash", "any", "transfer", "locked"]),
    amount: AmountSchema,
    reason: ReasonSchema,
  }),
  z.strictObject({
    type: z.literal("money/pay-fee"),
    currency: ForeignCurrencySchema,
    amount: AmountSchema,
    reason: ReasonSchema,
  }),
  // R-WALLET-020: the authority's top-up alone applies it; a test proves no content entry carries it.
  z.strictObject({ type: z.literal("wallet/top-up"), amount: z.int().positive() }),
  z.strictObject({ type: z.literal("quality/add"), quality: idOf("quality"), amount: IntSchema }),
  z.strictObject({ type: z.literal("activity/hunt") }),
  z.strictObject({
    type: z.literal("activity/start-job"),
    job: z.union([idOf("activity"), z.strictObject({ term: z.string().min(1) })]),
  }),
  z.strictObject({ type: z.literal("activity/end-job"), why: z.string().min(1), side: z.literal(true).exactOptional() }),
  z.strictObject({ type: z.literal("activity/gig"), min: CountSchema, max: CountSchema, perTech: CountSchema }),
  z.strictObject({ type: z.literal("activity/exam"), activity: idOf("activity") }),
  z.strictObject({ type: z.literal("document/request"), document: idOf("document") }),
  z.strictObject({ type: z.literal("document/grant"), document: idOf("document") }),
  z.strictObject({ type: z.literal("document/void"), document: idOf("document") }),
  z.strictObject({
    type: z.literal("route/hear"),
    route: idOf("route"),
    chanceBp: BpSchema.exactOptional(),
    via: z.string().min(1),
  }),
  // Decision 0025: an effect may name the route it looks into.
  z.strictObject({ type: z.literal("route/look-into"), route: idOf("route").exactOptional() }),
  z.strictObject({ type: z.literal("route/apply-school") }),
  z.strictObject({ type: z.literal("route/apply"), route: idOf("route") }),
  z.strictObject({
    type: z.literal("route/support"),
    route: idOf("route"),
    currency: CurrencySchema,
    amount: AmountSchema,
  }),
  z.strictObject({ type: z.literal("route/interview-scored"), route: idOf("route"), score: IntSchema }),
  z.strictObject({ type: z.literal("people/moment"), kind: z.enum(["met", "call", "said", "wedding"]) }),
  z.strictObject({ type: z.literal("route/withdraw"), route: idOf("route") }),
  z.strictObject({ type: z.literal("interview/open"), route: idOf("route"), bond: z.string().min(1) }),
  z.strictObject({ type: z.literal("interview/close"), route: idOf("route") }),
  z.strictObject({ type: z.literal("people/arrived"), route: idOf("route") }),
  z.strictObject({ type: z.literal("people/assistance-taken"), route: idOf("route") }),
  z.strictObject({
    type: z.literal("route/record-sponsor"),
    route: idOf("route"),
    employer: z.string().min(1),
    salary: CountSchema,
    fraud: z.boolean(),
  }),
  z.strictObject({ type: z.literal("route/road-step"), step: z.string().min(1) }),
  z.strictObject({ type: z.literal("route/enter-pool"), route: idOf("route") }),
  z.strictObject({ type: z.literal("setpiece/open"), setpiece: idOf("setpiece"), route: idOf("route").nullable() }),
  z.strictObject({ type: z.literal("setpiece/close"), setpiece: idOf("setpiece") }),
  z.strictObject({
    type: z.literal("obligation/open"),
    obligation: idOf("obligation"),
    principal: AmountSchema.exactOptional(),
    amount: AmountSchema.exactOptional(),
    bond: z.string().min(1).exactOptional(),
  }),
  z.strictObject({ type: z.literal("offer/open"), offer: idOf("offer") }),
  z.strictObject({ type: z.literal("offer/close"), offer: idOf("offer") }),
  z.strictObject({ type: z.literal("offer/come-up"), max: CountSchema }),
  z.strictObject({ type: z.literal("obligation/close"), obligationType: ObligationTypeSchema }),
  z.strictObject({ type: z.literal("obligation/relief"), obligationType: ObligationTypeSchema, bp: BpSchema }),
  z.strictObject({ type: z.literal("place/move"), to: WhereSchema, country: idOf("country").nullable() }),
  z.strictObject({ type: z.literal("place/return"), shape: ReturnShapeSchema }),
  z.strictObject({ type: z.literal("status/grant"), status: idOf("status"), job: idOf("activity").exactOptional() }),
  z.strictObject({ type: z.literal("status/lose") }),
  z.strictObject({ type: z.literal("status/remove") }),
  z.strictObject({ type: z.literal("status/clock-start") }),
  z.strictObject({ type: z.literal("credit/mark"), amount: IntSchema }),
  z.strictObject({ type: z.literal("credit/judgment") }),
  z.strictObject({ type: z.literal("goal/open"), goal: idOf("goal") }),
  z.strictObject({ type: z.literal("goal/done"), goal: idOf("goal") }),
  z.strictObject({ type: z.literal("turn/refill") }),
  z.strictObject({ type: z.literal("turn/spend-days"), halfDays: CountSchema }),
  z.strictObject({ type: z.literal("turn/lock"), slots: CountSchema, months: z.int().positive(), why: z.string().min(1) }),
  z.strictObject({ type: z.literal("turn/finish") }),
  z.strictObject({ type: z.literal("home/move"), place: HomePlaceSchema }),
  z.strictObject({ type: z.literal("home/guest"), host: HomeHostSchema }),
]);

export type EffectMatches = Proof<Same<z.infer<typeof EffectSchema>, Effect>>;

// ---------------------------------------------------------------------------
// Offer terms
// ---------------------------------------------------------------------------

export const TermSpecSchema = z.union([
  CountSchema,
  z.discriminatedUnion("from", [
    z.strictObject({ from: z.literal("quality"), quality: idOf("quality"), times: CountSchema }),
    z.strictObject({ from: z.literal("pay"), times: CountSchema, cap: CountSchema }),
    z
      .strictObject({ from: z.literal("range"), min: CountSchema, max: CountSchema, step: z.int().positive() })
      .check(z.refine((range) => range.min <= range.max, { error: "A range's min must not be above its max" })),
  ]),
]);

export type TermSpecMatches = Proof<Same<z.infer<typeof TermSpecSchema>, TermSpec>>;

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------

export const TuningSchema = z.strictObject({
  turn: z.strictObject({
    cap: CountSchema,
    start: CountSchema,
    freeSlots: CountSchema,
    freeSlotsNoJob: CountSchema,
    maxLocked: CountSchema,
    quietAskCap: CountSchema,
    halfDays: z.strictObject({ noJob: CountSchema, withJob: CountSchema }),
    repeatPerSlot: z.int().positive(),
    arrivalsBp: z.array(CountSchema),
    body: z.strictObject({ bellyPerHalfDay: CountSchema, energyPerHalfDay: CountSchema, restTo: CountSchema, restBy: CountSchema, lowBelow: CountSchema, hungryWellbeing: CountSchema, spentWellbeing: CountSchema, spentBelow: CountSchema }),
  }),
  quality: z.strictObject({
    wellbeingRest: CountSchema,
    wellbeingDriftTo: CountSchema,
    wellbeingDrift: CountSchema,
    burnoutBelow: CountSchema,
    networkHireBp: BpSchema,
    hireMaxBp: BpSchema,
    skillSoftAt: CountSchema,
    skillSoftBp: BpSchema,
    sideJobSkillBp: BpSchema,
  }),
  wallet: z.strictObject({
    bankChargeBp: BpSchema,
    streetSpreadBp: BpSchema,
    streetShortBp: BpSchema,
    streetShortLossBp: RangeSchema,
    lotMonths: CountSchema,
    flagDepositAbove: CountSchema,
    cashUpTo: CountSchema,
    cashWarnAt: CountSchema,
  }),
  rate: z.strictObject({
    start: z.record(ForeignCurrencySchema, z.int().positive()),
    driftBp: BpSchema,
    noiseBp: BpSchema,
    premiumFloorBp: BpSchema,
    premiumPerSupplyBp: BpSchema,
    premiumNoiseBp: BpSchema,
    floatPremiumBp: BpSchema,
  }),
  english: z.strictObject({
    base: CountSchema,
    perHundred: CountSchema,
    noiseSteps: CountSchema,
    min: CountSchema,
    max: CountSchema,
    bandStep: z.int().positive(),
  }),
  route: z.strictObject({
    offerPerGradeBp: BpSchema,
    offerMaxBp: BpSchema,
    goodGrade: CountSchema,
    fundsReasonBp: BpSchema,
    reapplyMonths: CountSchema,
    refusalPerStrictnessBp: BpSchema,
    refusalPerUnexplainedBp: BpSchema,
    refusalPerRefusalBp: BpSchema,
    refusalPerInterviewPointBp: BpSchema,
    refusalGoodGradeBp: BpSchema,
    refusalMinBp: BpSchema,
    refusalMaxBp: BpSchema,
    depositAdminFee: CountSchema,
    depositRefundMonths: CountSchema,
    decisionMonths: CountSchema,
    flight: MoneySchema,
    hintPrep: CountSchema,
  }),
  offer: z.strictObject({ maxNewPerMonth: CountSchema, maxOpen: CountSchema }),
  place: z.strictObject({ brokeLine: CountSchema, fareFromNaira: z.boolean() }),
  street: z.strictObject({ phonePrice: CountSchema, phoneMood: CountSchema, phoneNetwork: CountSchema, salesPay: CountSchema, salesHireBp: BpSchema, apprenticeTech: CountSchema, apprenticeUntil: CountSchema, theftBp: BpSchema, theftNaira: CountSchema, mosquitoBp: BpSchema, harassBp: BpSchema, harassMood: CountSchema, shoppingGbp: CountSchema, shoppingAed: CountSchema, shoppingMood: CountSchema, findBp: BpSchema, findMood: CountSchema, runMood: CountSchema }),
  parcel: z.strictObject({ handling: CountSchema, laptopMood: CountSchema, clothesPrep: CountSchema }),
  status: z.strictObject({ courseMonths: CountSchema }),
  credit: z.strictObject({
    onTime: CountSchema,
    onMiss: CountSchema,
    onDefault: CountSchema,
    drift: CountSchema,
    driftTo: CountSchema,
    judgmentMonths: CountSchema,
    judgmentCap: CountSchema,
    returnPenalty: CountSchema,
    cleanMonths: CountSchema,
  }),
  car: z.strictObject({ lessons: CountSchema, testFee: CountSchema, passBp: BpSchema, passPerAttemptBp: BpSchema, passCapBp: BpSchema }),
  remit: z.strictObject({ appFeeBp: BpSchema, appMarginBp: BpSchema, bankFeeBp: BpSchema, informalLossBp: BpSchema, abroadBp: CountSchema }),
  return: z.strictObject({
    standing: z.record(ReturnShapeSchema, IntSchema),
    capitalPer: z.int().positive(),
    capitalCap: CountSchema,
    offerMonths: CountSchema,
    residentLapseMonths: CountSchema,
  }),
  director: z.strictObject({
    surgePerTick: CountSchema,
    closedTicks: CountSchema,
    maxNewPerTick: CountSchema,
    shockGapTicks: CountSchema,
    onlineTickScale: z.int().positive(),
  }),
  road: z.strictObject({
    enabled: z.boolean(),
    meansStep: CountSchema,
    pressureStandingUnder: CountSchema,
    pressureAgeOver: CountSchema,
    pressureStrongRoute: CountSchema,
  }),
  ladder: z.strictObject({ cashDetectBp: BpSchema, accountRent: CountSchema, overtimeBp: BpSchema, oneChanceBp: BpSchema, phone: CountSchema, robberyWellbeing: IntSchema }),
  prologue: z.strictObject({
    startAgeMonths: CountSchema,
    siblings: z.tuple([CountSchema.max(6), CountSchema.max(6)]),
    familyMeans: z.tuple([CountSchema, CountSchema]),
    cityBp: BpSchema,
    parentsEducatedBp: BpSchema,
    parentsEducatedPerPoint: CountSchema,
    network: z.strictObject({ city: CountSchema, town: CountSchema, educated: CountSchema }),
    standing: CountSchema,
    waecStrain: z.strictObject({ under: CountSchema, standing: IntSchema }),
    grade: z.strictObject({ base: CountSchema, upBp: BpSchema, downBp: BpSchema, min: CountSchema, max: CountSchema }),
    privateSession: CountSchema,
    homeSupport: CountSchema,
    hometowns: z.strictObject({ city: z.array(HometownSchema).min(1), town: z.array(HometownSchema).min(1), byHome: z.record(z.string().min(1), HometownSchema) }),
  }),
  advice: z.strictObject({ warnings: z.boolean(), networkToAsk: CountSchema, adviserFee: CountSchema, agentKindsBp: z.strictObject({ fixer: BpSchema, chaser: BpSchema, overpromiser: BpSchema, scammer: BpSchema }), fees: z.strictObject({ fixer: z.tuple([CountSchema, CountSchema]), overpromiser: z.tuple([CountSchema, CountSchema]), scammer: z.tuple([CountSchema, CountSchema]) }), chaserFee: z.tuple([CountSchema, CountSchema]), fixerMonths: CountSchema, chaserMonths: CountSchema, fakePapersFee: CountSchema, scamTells: CountSchema, overpromiseTells: CountSchema, floorNaira: CountSchema, warnMonths: CountSchema }),
  luck: z.strictObject({
    downUnder: CountSchema,
    rescueAfterMonths: CountSchema,
    rescue: CountSchema,
    rescueUnder: CountSchema,
    rescueRatio: CountSchema,
    drySpellMonths: CountSchema,
    drySpellBp: BpSchema,
    drySpellCapBp: BpSchema,
    ticket: CountSchema,
    maxTickets: z.int().positive(),
    prizeSmall: CountSchema,
    prizeSmallBp: BpSchema,
    prizeMid: CountSchema,
    prizeMidBp: BpSchema,
    betWellbeing: CountSchema,
    prizeJackpot: CountSchema,
    jackpotPerMillion: CountSchema,
    stake: CountSchema,
    betOddsBp: CountSchema,
    betWinBp: BpSchema,
    promo: CountSchema,
  }),
  health: z.strictObject({
    runDownBelow: CountSchema,
    illnessBp: BpSchema,
    hospital: CountSchema,
    chemist: CountSchema,
    hospitalWorse: CountSchema,
    relapseChemistBp: BpSchema,
    relapseIgnoreBp: BpSchema,
    sickPayBp: BpSchema,
    gapMonths: CountSchema,
  }),
  chapter: z.strictObject({ cardLines: z.int().positive(), sendOffNaira: CountSchema }),
  groupLoan: z.strictObject({ feeBp: BpSchema, savingsBp: BpSchema, vanishBp: BpSchema, visit: z.strictObject({ standing: IntSchema, wellbeing: IntSchema }) }),
  activity: z.strictObject({ raiseBp: BpSchema, raiseChanceBp: BpSchema }),
  room: z.strictObject({ cookedBp: BpSchema, waterBp: BpSchema, cookWellbeing: CountSchema }),
  lottery: z.strictObject({
    ticket: CountSchema,
    maxTickets: CountSchema,
    odds: z.strictObject({
      smallPerMillion: CountSchema,
      small: CountSchema,
      midPerMillion: CountSchema,
      mid: CountSchema,
      jackpotPerMillion: CountSchema,
      jackpotStart: CountSchema,
      jackpotGrowthBp: BpSchema,
      jackpotCap: CountSchema,
      forcedWinWeeks: z.int().positive().nullable(),
    }),
  }),
  advert: z.strictObject({ maxSlotsPerPlace: CountSchema, maxPhoneTiles: CountSchema, impressionMs: CountSchema }),
  share: z.strictObject({ width: CountSchema, height: CountSchema, maxBytes: CountSchema, previewWidth: CountSchema, previewHeight: CountSchema, previewMaxBytes: CountSchema }),
  guide: z.strictObject({ staleMonths: CountSchema }),
  analytics: z.strictObject({ batchSeconds: CountSchema, maxBatchBytes: CountSchema, maxCount: CountSchema, batchesPerHour: CountSchema, minShown: CountSchema, refD1Bp: BpSchema, refD7Bp: BpSchema }),
  city: z.strictObject({ crowdLow: CountSchema, crowdHigh: CountSchema, playersMax: CountSchema, fridayBp: BpSchema, saturdayBp: BpSchema, raiseAfterMs: CountSchema, raiseFrameMs: CountSchema, dropAfterMs: CountSchema, dropFrameMs: CountSchema, maxPixelRatio: CountSchema, desktopMinWidth: CountSchema, idleAfterMs: CountSchema, idleFps: CountSchema, walkMmPerS: CountSchema, stopShortMm: CountSchema, tagNearMm: CountSchema, residentFloor: CountSchema, roam: z.boolean(), flyover: z.boolean(), indoorLow: CountSchema, indoorHigh: CountSchema, outdoorLow: CountSchema, outdoorHigh: CountSchema, motionSheets: CountSchema, ride: z.strictObject({ fareKobo: z.strictObject({ danfo: CountSchema, keke: CountSchema, okada: CountSchema, walk: CountSchema }), metresPerMinute: z.strictObject({ danfo: CountSchema, keke: CountSchema, okada: CountSchema, walk: CountSchema }), waitMinutes: CountSchema, scarcityBp: CountSchema, walkMetres: CountSchema }) }),
  people: z.strictObject({
    matchmaker: z.boolean(),
    maxCourting: CountSchema,
    partnerMoments: CountSchema,
    marryAfterMonths: CountSchema,
    weddingShare: CountSchema,
    proposeCooldown: CountSchema,
    recourtMonths: CountSchema,
    gossipBp: BpSchema,
    weddingStanding: IntSchema,
    gossipStanding: IntSchema,
    endStanding: z.strictObject({ courting: IntSchema, partner: IntSchema, married: IntSchema, applying: IntSchema }),
    endWellbeing: IntSchema,
    leftWellbeing: IntSchema,
    couchMonths: CountSchema,
    warnDays: CountSchema,
    standInDays: CountSchema, computerAfterMonths: CountSchema,
  }),
  pair: z.strictObject({ inviteDays: CountSchema, maxOpenInvites: CountSchema, rewardFriends: CountSchema, phrasesPerHour: CountSchema, placePhrasesPerMinute: CountSchema }),
  interview: z.strictObject({ ask: CountSchema, decoys: CountSchema, passBp: BpSchema, failBp: BpSchema, caughtBelowBp: BpSchema, thinMoments: CountSchema, thinMonths: CountSchema, doubtBp: BpSchema, standInRecallBp: BpSchema, caughtStanding: IntSchema }),
  undertaking: z.strictObject({ months: CountSchema, assistanceUnder: CountSchema }),
  home: HomeTuningSchema,
});

export type TuningMatches = Proof<Same<z.infer<typeof TuningSchema>, Tuning>>;
