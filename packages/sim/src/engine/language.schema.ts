// Schemas for the small languages content is written in: amounts, money,
// requirements, effects and terms, plus the tuning numbers and the id template.
// Every object is strict, so a misspelt or extra key fails the content check.
import { z } from "zod";

import type {
  Amount,
  Cost,
  Currency,
  Effect,
  ForeignCurrency,
  KindName,
  Money,
  NewsStage,
  Pocket,
  Reason,
  Requirement,
  RouteStateName,
  TermSpec,
  Tuning,
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

export const CurrencySchema = z.enum(["NGN", "GBP", "USD"]);
export const ForeignCurrencySchema = z.enum(["GBP", "USD"]);
export const PocketSchema = z.enum(["bank", "cash"]);
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
  "convert",
  "move",
]);
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
    pocket: z.enum(["bank", "cash", "any", "locked"]),
    amount: AmountSchema,
    reason: ReasonSchema,
  }),
  z.strictObject({
    type: z.literal("money/pay-fee"),
    currency: ForeignCurrencySchema,
    amount: AmountSchema,
    reason: ReasonSchema,
  }),
  z.strictObject({ type: z.literal("quality/add"), quality: idOf("quality"), amount: IntSchema }),
  z.strictObject({ type: z.literal("activity/hunt") }),
  z.strictObject({
    type: z.literal("activity/start-job"),
    job: z.union([idOf("activity"), z.strictObject({ term: z.string().min(1) })]),
  }),
  z.strictObject({ type: z.literal("activity/end-job"), why: z.string().min(1) }),
  z.strictObject({ type: z.literal("activity/gig"), min: CountSchema, max: CountSchema, perTech: CountSchema }),
  z.strictObject({ type: z.literal("document/request"), document: idOf("document") }),
  z.strictObject({ type: z.literal("document/grant"), document: idOf("document") }),
  z.strictObject({ type: z.literal("document/void"), document: idOf("document") }),
  z.strictObject({
    type: z.literal("route/hear"),
    route: idOf("route"),
    chanceBp: BpSchema.exactOptional(),
    via: z.string().min(1),
  }),
  z.strictObject({ type: z.literal("route/look-into") }),
  z.strictObject({ type: z.literal("route/apply-school") }),
  z.strictObject({ type: z.literal("route/apply"), route: idOf("route") }),
  z.strictObject({
    type: z.literal("route/support"),
    route: idOf("route"),
    currency: CurrencySchema,
    amount: AmountSchema,
  }),
  z.strictObject({
    type: z.literal("obligation/open"),
    obligation: idOf("obligation"),
    principal: AmountSchema.exactOptional(),
    amount: AmountSchema.exactOptional(),
  }),
  z.strictObject({ type: z.literal("offer/open"), offer: idOf("offer") }),
  z.strictObject({ type: z.literal("turn/refill") }),
  z.strictObject({ type: z.literal("turn/finish") }),
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
  turn: z.strictObject({ cap: CountSchema, start: CountSchema, freeSlots: CountSchema, freeSlotsNoJob: CountSchema }),
  quality: z.strictObject({
    wellbeingRest: CountSchema,
    wellbeingDriftTo: CountSchema,
    wellbeingDrift: CountSchema,
    burnoutBelow: CountSchema,
    networkHireBp: BpSchema,
    hireMaxBp: BpSchema,
    skillSoftAt: CountSchema,
  }),
  wallet: z.strictObject({
    bankChargeBp: BpSchema,
    streetSpreadBp: BpSchema,
    streetShortBp: BpSchema,
    streetShortLossBp: RangeSchema,
    lotMonths: CountSchema,
    flagDepositAbove: CountSchema,
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
  }),
  route: z.strictObject({
    refusalBaseBp: BpSchema,
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
});

export type TuningMatches = Proof<Same<z.infer<typeof TuningSchema>, Tuning>>;
