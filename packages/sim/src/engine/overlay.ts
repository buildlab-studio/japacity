// Content is one plain object and every number the game runs on is read from
// it (R-ENGINE-017). An overlay replaces any part of it, applied once at load,
// and the result is checked before anything plays on it (R-ENGINE-014).
import { ContentSchema } from "../schemas";
import { standInWorld } from "../world/standIn";
import { allMet } from "./check";
import { checkContent } from "./content";
import { newState } from "./state";
import type { Amount, Content, Id, ReadCtx, Requirement, WhereEntry } from "./types";

/** Any part of a plain object, to any depth. Arrays are replaced whole. */
export type Part<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: Part<T[K]> }
    : T;

/**
 * An overlay: the version that names it, which the save records (R-ENGINE-010),
 * and any part of the content to replace. The content's own version is never
 * replaced, so a save still names the content it was made with.
 */
export type Overlay = { version: string } & Part<Omit<Content, "version" | "overlay">>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function merge(base: unknown, over: unknown): unknown {
  if (over === undefined) return base;
  if (isPlainObject(base) && isPlainObject(over)) {
    const out: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(over)) out[key] = merge(base[key], value);
    return out;
  }
  return over;
}

/**
 * A copy of the content with the overlay's values in place of the defaults,
 * and the overlay's version recorded on it. Neither input is changed. Throws
 * when the result does not fit the schemas or fails `checkContent`, so content
 * that would break a rule is refused at load.
 */
export function applyOverlay(content: Content, overlay: Overlay): Content {
  const { version, ...changes } = overlay;
  const merged = { ...(merge(content, changes) as Content), overlay: version };
  const parsed = ContentSchema.safeParse(merged);
  if (!parsed.success) {
    const where = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`The overlay ${version} does not fit the content schemas: ${where}`);
  }
  const problems = checkContent(merged);
  if (problems.length > 0) throw new Error(`The overlay ${version} fails the content check: ${problems.join(" ")}`);
  return merged;
}

/** Top-level fields no overlay may touch: the rename table belongs to a content version (R-SERVER-022). */
const FIXED_FIELDS: readonly string[] = ["renames"];

/** Fields that name a ledger reason (R-WALLET-013). */
const REASON_FIELDS: readonly string[] = ["reason", "sink", "interestSink"];

/** The world seed the overlay check builds new characters' worlds with. Any fixed string does. */
const CHECK_SEED = "overlay-check";

function shownPath(path: string): string {
  return path.replace(/^content\.?/, "") || "the content";
}

/**
 * R-SERVER-018: an overlay changes the live numbers and never a rule. Every
 * field it names must be in the content; every value it changes must be a
 * number that replaces a number. A list is replaced whole, so inside one the
 * overlay must keep every field and every length the content has.
 */
function shapeProblems(base: unknown, over: unknown, path: string, whole: boolean, problems: string[]): void {
  const where = shownPath(path);
  if (isPlainObject(over)) {
    if (!isPlainObject(base)) {
      problems.push(`${where} is not a table in the content; an overlay changes numbers, never a rule (R-SERVER-018).`);
      return;
    }
    for (const [key, value] of Object.entries(over)) {
      const inner = path === "" ? key : `${path}.${key}`;
      if (path === "" && FIXED_FIELDS.includes(key)) {
        problems.push(`${key} is fixed by the content version; no overlay touches it (R-SERVER-022).`);
        continue;
      }
      if (!(key in base)) {
        problems.push(`${shownPath(inner)} is not in the content; an overlay names each value it changes and has no field of its own, such as a factor (R-SERVER-014).`);
        continue;
      }
      shapeProblems(base[key], value, inner, whole, problems);
    }
    if (whole) {
      for (const key of Object.keys(base)) {
        if (!(key in over)) problems.push(`${shownPath(`${path}.${key}`)} is dropped from a list the overlay replaces; an overlay changes numbers, never a rule (R-SERVER-018).`);
      }
    }
    return;
  }
  if (Array.isArray(over)) {
    if (!Array.isArray(base) || base.length !== over.length) {
      problems.push(`${where} changes the shape of a list; an overlay changes numbers, never a rule (R-SERVER-018).`);
      return;
    }
    over.forEach((item, index) => shapeProblems(base[index], item, `${path}[${String(index)}]`, true, problems));
    return;
  }
  if (typeof over === "number") {
    if (typeof base !== "number") problems.push(`${where} puts a number where the content has none; an overlay changes numbers, never a rule (R-SERVER-018).`);
    return;
  }
  if (over === base) return;
  const field = path.slice(path.lastIndexOf(".") + 1);
  if (REASON_FIELDS.includes(field)) problems.push(`${where} changes a ledger reason; no overlay does (R-SERVER-014).`);
  else problems.push(`${where} changes something that is not a number; an overlay changes numbers, never a rule (R-SERVER-018).`);
}

/** A money effect or cost found at the same place in the content and the overlaid content. */
interface MoneyAt {
  path: string;
  type: "take" | "add";
  before: Amount;
  after: Amount;
}

/** What a part of the content charges or gives, and the obligations it opens, read side by side in both contents. */
interface Reading {
  money: MoneyAt[];
  opens: Id<"obligation">[];
}

function readMoney(base: unknown, merged: unknown, path: string, reading: Reading): void {
  if (Array.isArray(base)) {
    base.forEach((item, index) => readMoney(item, (merged as unknown[])[index], `${path}[${String(index)}]`, reading));
    return;
  }
  if (!isPlainObject(base) || !isPlainObject(merged)) return;
  const type = base.type;
  if (type === "money/take" || type === "money/pay-fee" || type === "money/add") {
    reading.money.push({ path: `${path}.amount`, type: type === "money/add" ? "add" : "take", before: base.amount as Amount, after: merged.amount as Amount });
  } else if (type === "obligation/open") {
    reading.opens.push(base.obligation as Id<"obligation">);
  } else if (typeof base.reason === "string" && "amount" in base && "currency" in base) {
    // A cost: a price with its ledger reason.
    reading.money.push({ path: `${path}.amount`, type: "take", before: base.amount as Amount, after: merged.amount as Amount });
  }
  for (const [key, value] of Object.entries(base)) readMoney(value, merged[key], `${path}.${key}`, reading);
}

function raised(before: number, after: number, path: string, what: string): string[] {
  return after > before ? [`${shownPath(path)} rises from ${String(before)} to ${String(after)}: ${what} (R-SERVER-014).`] : [];
}

/** The readers of each scenario's first state, under the content and the overlaid content. */
function newCharacters(contents: readonly Content[]): ReadCtx[] {
  return contents.flatMap((content) => {
    const world = standInWorld(CHECK_SEED, 0, content);
    return (Object.keys(content.scenario) as Id<"scenario">[]).map((scenario) => ({ state: newState(scenario, CHECK_SEED, content), world, content }));
  });
}

/** Whether some new character meets the requirements. One that cannot be judged at the start counts as met. */
function someoneMeets(readers: readonly ReadCtx[], requirements: readonly Requirement[]): boolean {
  return readers.some((read) => {
    try {
      return allMet(read, requirements);
    } catch {
      return true;
    }
  });
}

/** Where an entry applies. A new character is at home. */
function atHome(where: WhereEntry | undefined): boolean {
  return where === undefined || where === "home" || where === "any";
}

/**
 * R-SERVER-014: the money a new character meets. No overlay adds money to a
 * scenario's pockets or to the prologue, the opening of a life, and none
 * raises a cost or fee a new character can meet: the costs and money taken by
 * the activities and offer choices whose requirements hold for some
 * scenario's first state, judged with `check` on it, every school's fees, the
 * obligations those open or a scenario starts with, and the world variables
 * their amounts read.
 */
function moneyProblems(base: Content, merged: Content): string[] {
  const problems: string[] = [];
  const readers = newCharacters([base, merged]);
  const met: Reading = { money: [], opens: [] };
  const opening: Reading = { money: [], opens: [] };

  for (const id of Object.keys(base.scenario) as Id<"scenario">[]) {
    const before = base.scenario[id]!;
    const after = merged.scenario[id]!;
    for (const [currency, pocket] of Object.entries(before.pockets)) {
      const now = after.pockets[currency as keyof typeof after.pockets];
      if (pocket === undefined || now === undefined) continue;
      const path = `scenario.${id}.pockets.${currency}`;
      problems.push(...raised(pocket.bank, now.bank, `${path}.bank`, "an overlay adds no money to a scenario"));
      problems.push(...raised(pocket.cash, now.cash, `${path}.cash`, "an overlay adds no money to a scenario"));
    }
    before.obligations.forEach((owed, index) => {
      met.opens.push(owed.obligation);
      problems.push(...raised(owed.amount, after.obligations[index]!.amount, `scenario.${id}.obligations[${String(index)}].amount`, "a new character pays it"));
    });
  }
  readMoney(base.prologue, merged.prologue, "prologue", opening);
  for (const money of opening.money) {
    if (typeof money.before !== "number" || typeof money.after !== "number") continue;
    problems.push(...raised(money.before, money.after, money.path, money.type === "add" ? "an overlay adds no money to the opening of a life" : "a new character pays it"));
  }
  met.opens.push(...opening.opens);

  for (const id of Object.keys(base.activity) as Id<"activity">[]) {
    const entry = base.activity[id]!;
    if (atHome(entry.where) && someoneMeets(readers, entry.requires)) readMoney(entry, merged.activity[id], `activity.${id}`, met);
  }
  for (const id of Object.keys(base.offer) as Id<"offer">[]) {
    const entry = base.offer[id]!;
    if (!atHome(entry.where) || !someoneMeets(readers, entry.when)) continue;
    entry.choices.forEach((choice, index) => {
      if (someoneMeets(readers, choice.requires)) readMoney(choice, merged.offer[id]!.choices[index], `offer.${id}.choices[${String(index)}]`, met);
    });
  }
  for (const money of met.money) {
    if (money.type !== "take") continue;
    if (typeof money.before === "number" && typeof money.after === "number") problems.push(...raised(money.before, money.after, money.path, "a new character can pay it"));
    if (typeof money.before === "object" && "var" in money.before) {
      const id = money.before.var;
      problems.push(...raised(base.var[id]?.start ?? 0, merged.var[id]?.start ?? 0, `var.${id}.start`, "a new character can pay the amount it sets"));
    }
  }
  for (const id of Object.keys(base.school) as Id<"school">[]) {
    const before = base.school[id]!;
    const after = merged.school[id]!;
    problems.push(...raised(before.tuition, after.tuition, `school.${id}.tuition`, "a new character can apply"));
    problems.push(...raised(before.deposit, after.deposit, `school.${id}.deposit`, "a new character can apply"));
  }
  for (const id of new Set(met.opens)) {
    const before = base.obligation[id];
    const after = merged.obligation[id];
    if (before === undefined || after === undefined) continue;
    problems.push(...raised(before.amount, after.amount, `obligation.${id}.amount`, "a new character can owe it"));
    problems.push(...raised(before.rateBp, after.rateBp, `obligation.${id}.rateBp`, "a new character can owe it"));
    if (before.car !== undefined && after.car !== undefined) problems.push(...raised(before.car.price, after.car.price, `obligation.${id}.car.price`, "a new character can owe it"));
  }
  return [...new Set(problems)];
}

/**
 * Why an overlay may not be applied to the content, or nothing when it may
 * (R-SERVER-014, R-SERVER-018). It refuses an overlay that names a field the
 * content lacks (a factor has nowhere to go), changes anything but a number,
 * touches the rename table or a ledger reason, adds money to a scenario or the
 * opening of a life, or raises a cost or fee a new character can meet; and one
 * that `applyOverlay` itself refuses.
 */
export function checkOverlay(base: Content, overlay: Overlay): string[] {
  const { version, ...changes } = overlay;
  const problems: string[] = [];
  if (typeof version !== "string" || version === "") problems.push("An overlay names its version (R-ENGINE-017).");
  shapeProblems(base, changes, "", false, problems);
  if (problems.length > 0) return problems;
  let merged: Content;
  try {
    merged = applyOverlay(base, overlay);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  return moneyProblems(base, merged);
}
