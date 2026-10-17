// The people around the character: docs/rules/people.md. Slots for a partner,
// siblings and parents; bonds with computer characters and with players, known
// only through facts; courting, proposals, the joint, letting people down and
// the stand-in. Another life reaches this one only by authority commands
// (decision 0007), so each life replays alone.
import { check, worldVar } from "../engine/check";
import type { RegisteredKind } from "../engine/kind";
import { emit, ownOf } from "../engine/kind";
import { reject } from "../engine/reject";
import type {
  BaseEvent,
  Bond,
  BondStage,
  Cause,
  Command,
  Content,
  Ctx,
  Effect,
  Id,
  Moment,
  PeopleSlice,
  PersonEntry,
  PersonFacts,
  PlayerView,
  Proposal,
  ReadCtx,
  Rejection,
  ReportLine,
  Requirement,
  RequirementResult,
  ScenarioEntry,
  State,
  StatusEntry,
} from "../engine/types";
import { undertakingOpening } from "../obligation/undertaking";
import { pointsScoreAlone, pointsScoreWith } from "../route/gates/points";
import { sponsorBarUntil, sponsorCheck } from "./sponsor-checks";
import { AGE, computerFacts, jointRouteOf } from "./people.facts";
import type { PeopleEvent } from "./people.events";

export { factsOf } from "./people.facts";

const STANDING: Id<"quality"> = "quality.standing";
const WELLBEING: Id<"quality"> = "quality.wellbeing";
const RECOVERY: Id<"offer"> = "offer.people-recovery";
const PAPERS_OFFER: Id<"offer"> = "offer.papers-marriage";
const DECEMBER: Id<"var"> = "var.season-december";
/** R-PEOPLE-017: where a wedding is held, drawn on `people`. */
export const WEDDING_SPOTS: readonly string[] = ["family-compound", "church", "mosque", "registry", "event-hall"];
/** R-PAIR-007: what an invite card may say it is looking for. */
const FILLS: Record<"partner" | "sibling", readonly string[]> = {
  partner: ["already-in-uk", "already-in-canada", "abroad-anywhere", "who-is-a-nurse", "who-codes", "to-start-out-with-me"],
  sibling: ["to-start-out-with-me", "to-go-first", "to-follow-me"],
};
const PARTNER_SLOT = "partner";
const SIBLING_PREFIX = "sibling-";
const TOGETHER: readonly BondStage[] = ["partner", "married"];
const COURTED: readonly BondStage[] = ["courting", "partner", "married"];
const KNOWN_OR_LATER: readonly string[] = ["known", "applying", "granted", "departed"];
const WEDDING_WHAT = "wedding";
/** R-PEOPLE-034: what a sibling earns when another sibling paid the shared request. */
const HANDLED_STANDING = 1;

type Slot = PeopleSlice["slots"][string];
type Ender = "me" | "left" | "none";

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function record(ctx: Ctx, events: PeopleEvent[]): BaseEvent[] {
  return emit(ctx, "people", events);
}

/** R-PEOPLE-044: a stand-in only answers the interview and says yes to a joint step the absent side allowed; it never does this. */
function byStandIn(ctx: Ctx, what: string): Rejection | null {
  return ctx.sender === "stand-in" ? reject("not-legal", `A stand-in never ${what}.`) : null;
}

function live(bond: Bond): boolean {
  return bond.stage !== "ended";
}

function computerOf(content: Content, bond: Bond): PersonEntry | null {
  return bond.with.kind === "computer" ? (content.person[bond.with.entry] ?? null) : null;
}

/** The bond at `partner` or `married`, if any (R-PEOPLE-018). */
function partnerBond(slice: PeopleSlice): [string, Bond] | null {
  return Object.entries(slice.bonds).find(([, bond]) => TOGETHER.includes(bond.stage)) ?? null;
}

/** The latest bond with a pair: a live one first, else the last ended. */
/** The slice's own bond named `id`. A name a player sent may be a built-in object key, which is no bond. */
function ownBond(slice: PeopleSlice, id: string): Bond | undefined {
  return Object.hasOwn(slice.bonds, id) ? slice.bonds[id] : undefined;
}

/** The slice's own slot named `id`, on the same terms as `ownBond`. */
function ownSlot(slice: PeopleSlice, id: string): Slot | undefined {
  return Object.hasOwn(slice.slots, id) ? slice.slots[id] : undefined;
}

function bondByPair(slice: PeopleSlice, pair: string): string | null {
  const ids = Object.entries(slice.bonds).filter(([, bond]) => bond.with.kind === "player" && bond.with.pair === pair);
  const open = ids.find(([, bond]) => live(bond));
  return (open ?? ids[ids.length - 1])?.[0] ?? null;
}

function courtingCount(slice: PeopleSlice): number {
  return Object.values(slice.bonds).filter((bond) => bond.stage === "courting").length;
}

/** The role a slot is for, or null for the parents. */
function slotRole(slot: string): "partner" | "sibling" | null {
  if (slot === PARTNER_SLOT) return "partner";
  return slot.startsWith(SIBLING_PREFIX) ? "sibling" : null;
}

/** R-PEOPLE-039: an ended bond with this person or pair still cooling, or null. */
function coolingUntil(slice: PeopleSlice, matches: (bond: Bond) => boolean, month: number): number | null {
  const until = Object.values(slice.bonds)
    .filter((bond) => matches(bond) && bond.cooldownUntil !== null && bond.cooldownUntil > month && !live(bond))
    .map((bond) => bond.cooldownUntil ?? 0);
  return until.length === 0 ? null : Math.max(...until);
}

function withPerson(person: Id<"person">): (bond: Bond) => boolean {
  return (bond) => bond.with.kind === "computer" && bond.with.entry === person;
}

/**
 * R-PEOPLE-009: every computer partner whose `when` holds, with whom the
 * character has no bond and no ended one still cooling. A papers partner is
 * never a candidate (R-PEOPLE-050).
 */
function candidatesOf(read: ReadCtx): PersonEntry[] {
  const { bonds } = read.state.people;
  const month = read.state.turn.month;
  return Object.values(read.content.person)
    .filter((entry) => entry.role === "partner" && !entry.behaviour.papers)
    .filter((entry) => entry.when.every((requirement) => check(read, requirement).met))
    .filter((entry) => !Object.values(bonds).some((bond) => live(bond) && withPerson(entry.id)(bond)))
    .filter((entry) => coolingUntil(read.state.people, withPerson(entry.id), month) === null)
    .sort((left, right) => left.id.localeCompare(right.id));
}

/** True when the other side is where the character is: home, or the same country abroad (R-PEOPLE-014). */
function samePlace(state: State, facts: PersonFacts): boolean {
  if (facts.where !== state.place.where) return false;
  return facts.where !== "abroad" || facts.country === state.place.country;
}

/** R-PEOPLE-021, R-PEOPLE-020: a status that lets a partner come as a dependant of this job. */
function statusAllows(content: Content, status: Id<"status"> | null, job: Id<"activity"> | null): boolean {
  const entry: StatusEntry | undefined = status === null ? undefined : content.status[status];
  if (entry === undefined) return false;
  if (entry.dependants === "any") return true;
  if (entry.dependants === "none") return false;
  return job !== null && entry.dependants.includes(job);
}

/** The lists a bond's moments are drawn from: a computer's own, or the ones every computer partner shares (R-PEOPLE-014). */
function listsOf(content: Content, bond: Bond): { spots: readonly string[]; whats: readonly string[]; calls: readonly string[] } {
  const own = computerOf(content, bond);
  if (own !== null) return { spots: own.spots, whats: own.whats, calls: own.calls };
  const partners = Object.values(content.person).filter((entry) => entry.role === "partner" && !entry.behaviour.papers);
  const shared = (pick: (entry: PersonEntry) => readonly string[]): string[] => {
    const lists = partners.map(pick).filter((list) => list.length > 0);
    const [first, ...rest] = lists;
    return first === undefined ? [] : first.filter((item) => rest.every((list) => list.includes(item)));
  };
  // a real pair draws from the spots in content and the whats and calls every computer partner shares.
  return { spots: content.people.spots, whats: shared((entry) => entry.whats), calls: shared((entry) => entry.calls) };
}

function drawFrom(ctx: Ctx, list: readonly string[]): string | null {
  if (list.length === 0) return null;
  return list[ctx.random.int("people", list.length)] ?? null;
}

/** R-PEOPLE-016: the naira wedding share could be paid now. */
function canPayShare(read: Pick<Ctx, "check" | "content">): boolean {
  return read.check({ type: "money/can-pay", currency: "NGN", amount: read.content.tuning.people.weddingShare }).met;
}

// ---------------------------------------------------------------------------
// The slots: R-PEOPLE-007, R-PEOPLE-047
// ---------------------------------------------------------------------------

function emptySlot(state: Slot["state"]): Slot {
  return { state, bond: null, person: null, invite: null };
}

/** R-PEOPLE-007: the partner slot, the parents, and a fixed life's siblings, whose lives are drawn in the first turn. */
function initial(scenario: ScenarioEntry): PeopleSlice {
  const slots: PeopleSlice["slots"] = { [PARTNER_SLOT]: emptySlot("empty"), mother: emptySlot("computer"), father: emptySlot("computer") };
  // A prologue life learns its count from the family draw (R-PROLOGUE-002).
  const count = scenario.prologue === true ? 0 : scenario.siblings;
  for (let index = 1; index <= count; index += 1) slots[`${SIBLING_PREFIX}${String(index)}`] = emptySlot("computer");
  return { slots, bonds: {}, joint: null, sponsoring: null, arrived: null, assistanceTaken: 0, secret: { computerAnswers: null } };
}

function siblingCount(read: ReadCtx): number {
  const scenario = read.content.scenario[read.state.scenario];
  if (scenario === undefined) return 0;
  if (scenario.prologue === true) return read.state.prologue.open ? 0 : (read.state.prologue.draw?.siblings ?? 0);
  return scenario.siblings;
}

/** One entry of a role by weight, on `people`. */
function drawByWeight(ctx: Ctx, entries: readonly PersonEntry[]): PersonEntry | null {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return null;
  let roll = ctx.random.int("people", total);
  for (const entry of entries) {
    if (roll < entry.weight) return entry;
    roll -= entry.weight;
  }
  return null;
}

/** An age for a computer character: the character's own plus a gap drawn from its entry. */
function drawAge(ctx: Ctx, entry: PersonEntry): number {
  const [low, high] = entry.profile.ageGapMonths;
  return Math.max(0, (ctx.state.quality[AGE] ?? 0) + ctx.random.between("people", low, high));
}

/**
 * R-PEOPLE-047: each sibling slot not yet drawn gets a computer life by
 * weight on `people`. `initial` has no seed, so the draw is made at
 * the first turn, as the prologue makes its own draw on its first answer.
 */
function drawSiblings(ctx: Ctx): BaseEvent[] {
  const read: ReadCtx = { state: ctx.state, world: ctx.world, content: ctx.content };
  const { slots } = ctx.state.people;
  const entries = Object.values(ctx.content.person)
    .filter((entry) => entry.role === "sibling" && entry.when.every((requirement) => ctx.check(requirement).met))
    .sort((left, right) => left.id.localeCompare(right.id));
  const drawn: Extract<PeopleEvent, { type: "people/siblings-drawn" }>["siblings"] = [];
  for (let index = 1; index <= siblingCount(read); index += 1) {
    const slot = `${SIBLING_PREFIX}${String(index)}`;
    const held = slots[slot];
    if (held !== undefined && (held.state !== "computer" || held.person !== null)) continue;
    const entry = drawByWeight(ctx, entries);
    if (entry === null) continue;
    const facts = computerFacts(read, entry, drawAge(ctx, entry), ctx.state.turn.month);
    drawn.push({ slot, bond: slot, person: entry.id, facts });
  }
  return drawn.length === 0 ? [] : record(ctx, [{ type: "people/siblings-drawn", siblings: drawn }]);
}

// ---------------------------------------------------------------------------
// Commands: invites and links, R-PEOPLE-008, R-PEOPLE-010
// ---------------------------------------------------------------------------

function invite(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "people/invite") throw new Error(`people/invite cannot handle ${command.type}.`);
  const standIn = byStandIn(ctx, "sends a card");
  if (standIn !== null) return standIn;
  const slot = ownSlot(ctx.state.people, command.slot);
  if (slot === undefined) return reject("unknown-id", `There is no slot ${command.slot}.`);
  if (command.looking === undefined) {
    if (slot.state !== "invited") return reject("not-legal", `No card is out for ${command.slot}.`);
    return record(ctx, [{ type: "people/invite-withdrawn", slot: command.slot }]);
  }
  const role = slotRole(command.slot);
  // R-PEOPLE-007: the parents stay computer-run.
  if (role === null) return reject("not-legal", `${command.slot} is not a slot a card can fill.`);
  if (command.looking !== role) return reject("not-legal", `A card for ${command.slot} looks for a ${role}.`);
  const open = role === "partner" ? "empty" : "computer";
  if (slot.state !== open) return reject("not-legal", `${command.slot} is ${slot.state}; a card needs it ${open}.`);
  const fill = command.fill ?? null;
  if (fill !== null && !FILLS[role].includes(fill)) return reject("not-legal", `${fill} is not on the card's list.`);
  return record(ctx, [{ type: "people/invited", slot: command.slot, looking: role, fill }]);
}

function link(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "people/link") throw new Error(`people/link cannot handle ${command.type}.`);
  const slot = ownSlot(ctx.state.people, command.slot);
  if (slot === undefined) return reject("unknown-id", `There is no slot ${command.slot}.`);
  if (slot.state !== "invited") return reject("not-legal", `${command.slot} has no card out.`);
  const bond = ctx.nextId("bond");
  return record(ctx, [{ type: "people/linked", slot: command.slot, bond, pair: command.pair, facts: command.facts }]);
}

// ---------------------------------------------------------------------------
// Commands: courting, R-PEOPLE-013, R-PEOPLE-039
// ---------------------------------------------------------------------------

function courtComputer(ctx: Ctx, person: Id<"person">): BaseEvent[] | Rejection {
  const entry = ctx.content.person[person];
  if (entry === undefined) return reject("unknown-id", `There is no person ${person}.`);
  const read: ReadCtx = { state: ctx.state, world: ctx.world, content: ctx.content };
  if (!candidatesOf(read).some((candidate) => candidate.id === person)) return reject("not-legal", `${person} is not someone the character can court now.`);
  const bond = ctx.nextId("bond");
  const facts = computerFacts(read, entry, drawAge(ctx, entry), ctx.state.turn.month);
  return record(ctx, [
    { type: "people/courted", bond, with: person, role: "partner" },
    { type: "people/facts-updated", bond, facts },
  ]);
}

function courtPlayer(ctx: Ctx, withWhom: string): BaseEvent[] | Rejection {
  const slice = ctx.state.people;
  // A name the player sent may be a built-in object key; only the slice's own bonds are bonds.
  const id = Object.hasOwn(slice.bonds, withWhom) ? withWhom : bondByPair(slice, withWhom);
  const bond = id === null ? undefined : slice.bonds[id];
  if (id === null || bond === undefined || bond.with.kind !== "player") return reject("unknown-id", `There is no pair ${withWhom}.`);
  if (bond.role !== "partner") return reject("not-legal", "Only a partner bond is courted.");
  if (bond.stage === "connected") return record(ctx, [{ type: "people/courted", bond: id, with: bond.with.pair, role: "partner" }]);
  if (live(bond)) return reject("not-legal", `The bond is already ${bond.stage}.`);
  const month = ctx.state.turn.month;
  if (bond.cooldownUntil !== null && month < bond.cooldownUntil) return reject("not-legal", `The two may court again from month ${String(bond.cooldownUntil)}.`);
  const fresh = ctx.nextId("bond");
  const events: PeopleEvent[] = [{ type: "people/courted", bond: fresh, with: bond.with.pair, role: "partner" }];
  if (bond.facts !== null) events.push({ type: "people/facts-updated", bond: fresh, facts: bond.facts });
  return record(ctx, events);
}

function court(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "people/court") throw new Error(`people/court cannot handle ${command.type}.`);
  const standIn = byStandIn(ctx, "courts");
  if (standIn !== null) return standIn;
  const { maxCourting } = ctx.content.tuning.people;
  if (courtingCount(ctx.state.people) >= maxCourting) return reject("not-legal", `${String(maxCourting)} bonds are courting already.`);
  // The command came as JSON from the player, so its name may not be a string at all.
  const withWhom: unknown = command.with;
  if (typeof withWhom !== "string") return reject("unknown-id", `There is no person or pair ${String(withWhom)}.`);
  if (withWhom.startsWith("person.")) return courtComputer(ctx, withWhom as Id<"person">);
  return courtPlayer(ctx, withWhom);
}

// ---------------------------------------------------------------------------
// Commands: proposals, R-PEOPLE-016, R-PEOPLE-017, R-PEOPLE-021, R-PEOPLE-049
// ---------------------------------------------------------------------------

/** Why a joint cannot be asked for, or null when it can (R-PEOPLE-021). */
function jointProblem(ctx: Ctx, bond: Bond, route: Id<"route"> | undefined, lead: "me" | "them" | undefined): string | null {
  if (!TOGETHER.includes(bond.stage)) return "A joint needs the bond at partner or married.";
  if (ctx.state.people.joint !== null) return "A joint is already agreed.";
  if (route === undefined || lead === undefined) return "A joint names a route and a lead.";
  const entry = ctx.content.route[route];
  if (entry === undefined) return `There is no route ${route}.`;
  const partnerGate = entry.gate === "partner";
  if (!partnerGate && entry.dependants === null) return `${route} brings no partner.`;
  if (lead === "me") {
    if (partnerGate) {
      // R-PEOPLE-026, R-UNDERTAKING-001: the sponsor leads a partner route, and agreeing runs the sponsor's checks in this life.
      const failed = sponsorCheck(ctx, route);
      return failed === null ? null : `The sponsor's check failed: ${failed}.`;
    }
    const held = ctx.state.route[route]?.state ?? "unknown";
    const allows = statusAllows(ctx.content, ctx.state.status.current?.entry ?? null, ctx.state.activity.job);
    return KNOWN_OR_LATER.includes(held) || allows ? null : `Leading needs ${route} known or a status that brings a partner.`;
  }
  const facts = bond.facts;
  if (facts === null) return "Nothing is known of the other side yet.";
  if (partnerGate) return facts.country === entry.country && facts.status !== null && (entry.partner?.sponsorStatuses ?? []).includes(facts.status) ? null : "The other side is not a sponsor for this route.";
  // R-PEOPLE-021: a computer leads only on a status it holds; a player's own life judges the route it holds.
  if (bond.with.kind === "player") return null;
  return facts.country === entry.country && statusAllows(ctx.content, facts.status, facts.job) ? null : "A computer leads only on a status it holds already.";
}

/** Why this step cannot be proposed now, or null when it can. */
function proposeProblem(ctx: Ctx, id: string, bond: Bond, command: Extract<Command, { type: "people/propose" }>): string | null {
  const month = ctx.state.turn.month;
  const numbers = ctx.content.tuning.people;
  if (bond.pending.mine !== null) return "A proposal is already waiting.";
  if (bond.cooldownUntil !== null && month < bond.cooldownUntil) return `Not before month ${String(bond.cooldownUntil)}.`;
  switch (command.step) {
    case "partner": {
      if (bond.role !== "partner" || bond.stage !== "courting") return "Becoming partners needs the bond courting.";
      if (bond.moments.length < numbers.partnerMoments) return `Becoming partners needs ${String(numbers.partnerMoments)} moments.`;
      const together = partnerBond(ctx.state.people);
      return together !== null && together[0] !== id ? "There is a partner already." : null;
    }
    case "marry":
      if (bond.stage !== "partner" || bond.partnerMonth === null) return "Marrying needs the bond at partner.";
      if (month - bond.partnerMonth < numbers.marryAfterMonths) return `Marrying needs ${String(numbers.marryAfterMonths)} months as partners.`;
      return canPayShare(ctx) ? null : "The wedding share cannot be paid.";
    case "joint":
      return jointProblem(ctx, bond, command.route, command.lead);
    case "landed":
      return "Landing is said by the authority alone.";
    default: {
      const never: never = command.step;
      throw new Error(`Unknown step ${String(never)}.`);
    }
  }
}

/** R-PEOPLE-049: the computer's own conditions for this step. */
function computerWilling(ctx: Ctx, bond: Bond, entry: PersonEntry, step: Proposal["step"]): boolean {
  const month = ctx.state.turn.month;
  switch (step) {
    case "partner":
      return bond.firstMonth !== null && month - bond.firstMonth >= entry.behaviour.courtMonths;
    case "marry":
      return bond.partnerMonth !== null && month - bond.partnerMonth >= entry.behaviour.marryAfterMonths;
    case "joint":
    case "landed":
      return true;
    default: {
      const never: never = step;
      throw new Error(`Unknown step ${String(never)}.`);
    }
  }
}

/** A computer's wedding waits for December when its entry says so (R-PEOPLE-049). */
function waitsForDecember(ctx: Ctx, entry: PersonEntry, step: Proposal["step"]): boolean {
  return step === "marry" && entry.behaviour.marryInDecember && worldVar(ctx, DECEMBER) !== 1;
}

/**
 * What an agreement does in this life (R-PEOPLE-017, R-PEOPLE-021): the stage,
 * the wedding's share, standing and moment, the joint, and the route a
 * dependant follows on.
 */
function agree(ctx: Ctx, id: string, proposal: Proposal): BaseEvent[] | Rejection {
  const bond = ctx.state.people.bonds[id];
  if (bond === undefined || !live(bond)) return reject("not-legal", "The bond is not open.");
  const month = ctx.state.turn.month;
  const agreed: PeopleEvent = { type: "people/agreed", bond: id, step: proposal.step, route: proposal.route, lead: proposal.lead, month };
  const cause: Cause = { source: id, param: id, terms: {} };
  switch (proposal.step) {
    case "partner": {
      const together = partnerBond(ctx.state.people);
      if (together !== null && together[0] !== id) return reject("not-legal", "There is a partner already.");
      return record(ctx, [agreed]);
    }
    case "marry": {
      if (bond.stage !== "partner") return reject("not-legal", "Marrying needs the bond at partner.");
      if (!canPayShare(ctx)) return reject("cannot-afford", "The wedding share cannot be paid.");
      const events = record(ctx, [agreed]);
      const share = ctx.content.tuning.people.weddingShare;
      events.push(...ctx.apply([{ type: "money/take", currency: "NGN", pocket: "transfer", amount: share, reason: "wedding" }, { type: "quality/add", quality: STANDING, amount: ctx.content.tuning.people.weddingStanding }], cause));
      const moment: Moment = { n: bond.moments.length + 1, by: "me", kind: "wedding", spot: drawFrom(ctx, WEDDING_SPOTS), what: WEDDING_WHAT, tick: ctx.world.tick };
      events.push(...record(ctx, [{ type: "people/moment-added", bond: id, moment }]));
      return events;
    }
    case "joint": {
      if (proposal.route === null || proposal.lead === null) return reject("not-legal", "A joint names a route and a lead.");
      const route = ctx.content.route[proposal.route];
      if (route === undefined) return reject("unknown-id", `There is no route ${proposal.route}.`);
      const events = record(ctx, [agreed]);
      // no effect moves a route straight to known (R-PEOPLE-021), so the dependant route is heard of and the gate reads the joint.
      if (proposal.lead === "them" && route.dependants !== null) events.push(...ctx.apply([{ type: "route/hear", route: route.dependants, via: "partner" }], cause));
      return events;
    }
    case "landed": {
      const events = record(ctx, [agreed]);
      // R-UNDERTAKING-006: the undertaking names the bond.
      const undertaking = Object.values(ctx.content.obligation).find((entry) => entry.type === "undertaking");
      if (undertaking !== undefined) events.push(...ctx.apply([undertakingOpening(undertaking.id, id)], cause));
      return events;
    }
    default: {
      const never: never = proposal.step;
      throw new Error(`Unknown step ${String(never)}.`);
    }
  }
}

function propose(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "people/propose") throw new Error(`people/propose cannot handle ${command.type}.`);
  const standIn = byStandIn(ctx, "proposes");
  if (standIn !== null) return standIn;
  const bond = ownBond(ctx.state.people, command.bond);
  if (bond === undefined) return reject("unknown-id", `There is no bond ${command.bond}.`);
  if (!live(bond)) return reject("not-legal", "The bond has ended.");
  const problem = proposeProblem(ctx, command.bond, bond, command);
  if (problem !== null) return reject("not-legal", problem);
  const proposal: Proposal = { step: command.step, route: command.step === "joint" ? (command.route ?? null) : null, lead: command.step === "joint" ? (command.lead ?? null) : null };
  const events = record(ctx, [{ type: "people/proposed", bond: command.bond, proposal }]);
  const entry = computerOf(ctx.content, bond);
  if (entry === null) return events;
  // R-PEOPLE-016: a computer answers at once, on `people`.
  const yes = computerWilling(ctx, bond, entry, command.step) && ctx.random.chance("people", entry.behaviour.agreeBp);
  if (!yes) return [...events, ...record(ctx, [{ type: "people/declined", bond: command.bond, step: command.step }])];
  if (waitsForDecember(ctx, entry, command.step)) return [...events, ...record(ctx, [{ type: "people/wedding-waits", bond: command.bond }])];
  const agreed = agree(ctx, command.bond, proposal);
  if (!Array.isArray(agreed)) return agreed;
  return [...events, ...agreed];
}

function answer(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "people/answer") throw new Error(`people/answer cannot handle ${command.type}.`);
  const bond = ownBond(ctx.state.people, command.bond);
  if (bond === undefined) return reject("unknown-id", `There is no bond ${command.bond}.`);
  const theirs = bond.pending.theirs;
  if (!live(bond) || theirs === null || theirs.step !== command.step) return reject("not-legal", `No ${command.step} proposal is waiting on this bond.`);
  if (ctx.sender === "stand-in" && !standInMayAgree(ctx, command.bond, theirs, command.yes)) return reject("not-legal", "A stand-in says only yes, only to a joint the absent side allowed it to, and never to sponsoring.");
  if (command.yes && command.step === "marry" && !canPayShare(ctx)) return reject("cannot-afford", "The wedding share cannot be paid.");
  // R-UNDERTAKING-001: a yes that makes this life the sponsor runs the sponsor's checks; the proposal comes in this life's terms.
  if (command.yes && theirs.step === "joint" && theirs.lead === "me" && theirs.route !== null && ctx.content.route[theirs.route]?.gate === "partner") {
    const failed = sponsorCheck(ctx, theirs.route);
    if (failed !== null) return reject("not-legal", `The sponsor's check failed: ${failed}.`);
  }
  return record(ctx, [{ type: "people/answered", bond: command.bond, step: command.step, yes: command.yes }]);
}

function withdraw(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "people/withdraw") throw new Error(`people/withdraw cannot handle ${command.type}.`);
  const standIn = byStandIn(ctx, "takes back a proposal");
  if (standIn !== null) return standIn;
  const bond = ownBond(ctx.state.people, command.bond);
  if (bond === undefined) return reject("unknown-id", `There is no bond ${command.bond}.`);
  if (bond.pending.mine === null) return reject("not-legal", "No proposal of yours is waiting.");
  return record(ctx, [{ type: "people/withdrawn", bond: command.bond }]);
}

/**
 * R-PEOPLE-044, R-UNDERTAKING-001: a stand-in says yes to a pending joint step
 * only where the absent side set `standInMay` on that bond, and never to a
 * joint that makes this life the sponsor.
 */
function standInMayAgree(ctx: Ctx, id: string, proposal: Proposal, yes: boolean): boolean {
  if (!yes || proposal.step !== "joint") return false;
  if (ctx.state.people.bonds[id]?.consent?.standInMay !== true) return false;
  // The authority sends a proposal in this life's terms, as it sends `people/agreed`.
  const sponsors = proposal.lead === "me" && proposal.route !== null && ctx.content.route[proposal.route]?.gate === "partner";
  return !sponsors;
}

/** A joint step waiting on the bond, either way: consent may be given before it is agreed (R-PEOPLE-044). */
function jointPending(bond: Bond): boolean {
  return bond.pending.mine?.step === "joint" || bond.pending.theirs?.step === "joint";
}

/** R-PEOPLE-004, R-PEOPLE-044: what the joint may use of this life, on an agreed joint or one still pending. */
function consent(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "people/consent") throw new Error(`people/consent cannot handle ${command.type}.`);
  const standIn = byStandIn(ctx, "consents");
  if (standIn !== null) return standIn;
  const bond = ownBond(ctx.state.people, command.bond);
  if (bond === undefined) return reject("unknown-id", `There is no bond ${command.bond}.`);
  const onJoint = ctx.state.people.joint?.bond === command.bond;
  if (!live(bond) || (!onJoint && !jointPending(bond))) return reject("not-legal", "Consent is given for a joint, agreed or asked for.");
  const countFunds = command.countFunds ?? bond.consent?.countFunds ?? false;
  const standInMay = command.standInMay ?? bond.consent?.standInMay ?? false;
  return record(ctx, [{ type: "people/consented", bond: command.bond, countFunds, standInMay }]);
}

// ---------------------------------------------------------------------------
// Letting people down: R-PEOPLE-029, R-PEOPLE-035 to 039, R-PEOPLE-041, R-PEOPLE-042
// ---------------------------------------------------------------------------

/** R-PEOPLE-036: the applications in this life resting on the bond, not yet used. */
function restingOn(state: State, content: Content, id: string): Id<"route">[] {
  const onJoint = state.people.joint?.bond === id;
  const routes: Id<"route">[] = [];
  for (const entry of Object.values(content.route)) {
    if (entry.gate !== "partner" && entry.gate !== "dependant") continue;
    const held = state.route[entry.id];
    if (held === undefined || (held.state !== "applying" && held.state !== "granted")) continue;
    const gate = held.gate;
    const bond = gate !== null && (gate.gate === "partner" || gate.gate === "dependant") ? gate.bond : null;
    if (bond === id || (bond === null && onJoint)) routes.push(entry.id);
  }
  return routes;
}

/** R-PEOPLE-037: a joint application on the bond is `applying` in this life. */
function applyingOn(state: State, content: Content, id: string): boolean {
  if (state.people.joint?.bond !== id) return false;
  const route = jointRouteOf(state.people, content);
  return route !== null && state.route[route]?.state === "applying";
}

/** R-PEOPLE-037: what the one who ends it pays in standing. */
function endStanding(state: State, content: Content, id: string, stage: BondStage): number {
  const numbers = content.tuning.people.endStanding;
  const byStage = stage === "courting" ? numbers.courting : stage === "partner" ? numbers.partner : stage === "married" ? numbers.married : 0;
  return byStage + (applyingOn(state, content, id) ? numbers.applying : 0);
}

/**
 * Ends a bond in this life: the joint's applications withdrawn, the tied
 * status's clock, then what each side pays. `payer` says who pays: the one
 * who ended it, the one left, or nobody (absence and block).
 */
function endBond(ctx: Ctx, id: string, by: NonNullable<Bond["ended"]>["by"], payer: Ender): BaseEvent[] {
  const bond = ctx.state.people.bonds[id];
  if (bond === undefined) return [];
  const cause: Cause = { source: id, param: id, terms: {} };
  const standing = endStanding(ctx.state, ctx.content, id, bond.stage);
  const wasTogether = TOGETHER.includes(bond.stage);
  const events: BaseEvent[] = [];
  for (const route of restingOn(ctx.state, ctx.content, id)) events.push(...ctx.apply([{ type: "route/withdraw", route }], cause));
  events.push(...record(ctx, [{ type: "people/ended", bond: id, by, month: ctx.state.turn.month }]));
  const status = ctx.state.status.current;
  if (wasTogether && status !== null && ctx.content.status[status.entry]?.tiedTo === "partner") events.push(...ctx.apply([{ type: "status/clock-start" }], cause));
  const numbers = ctx.content.tuning.people;
  const effects: Effect[] = [];
  if (payer === "me") {
    if (standing !== 0) effects.push({ type: "quality/add", quality: STANDING, amount: standing });
    effects.push({ type: "quality/add", quality: WELLBEING, amount: numbers.endWellbeing });
  }
  if (payer === "left") effects.push({ type: "quality/add", quality: WELLBEING, amount: numbers.leftWellbeing }, { type: "offer/open", offer: RECOVERY });
  events.push(...ctx.apply(effects, cause));
  return events;
}

function end(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "people/end") throw new Error(`people/end cannot handle ${command.type}.`);
  const standIn = byStandIn(ctx, "ends a bond");
  if (standIn !== null) return standIn;
  const bond = ownBond(ctx.state.people, command.bond);
  if (bond === undefined) return reject("unknown-id", `There is no bond ${command.bond}.`);
  if (!live(bond)) return reject("not-legal", "The bond has ended already.");
  // R-PEOPLE-044: with the stand-in on, the waiting side may end it as an absence end, costing nobody.
  if (bond.standIn === "on") return endBond(ctx, command.bond, "absence", "none");
  return endBond(ctx, command.bond, "me", "me");
}

// ---------------------------------------------------------------------------
// Authority commands: R-PEOPLE-002
// ---------------------------------------------------------------------------

function pairBond(ctx: Ctx, pair: string, open: boolean): [string, Bond] | Rejection {
  const id = bondByPair(ctx.state.people, pair);
  const bond = id === null ? undefined : ctx.state.people.bonds[id];
  if (id === null || bond === undefined) return reject("unknown-id", `No bond is with the pair ${pair}.`);
  if (open && !live(bond)) return reject("not-legal", `The bond with ${pair} has ended.`);
  return [id, bond];
}

type FromAuthority = Extract<
  Command,
  { type: "people/facts" | "people/moments" | "people/proposal" | "people/agreed" | "people/ended" | "people/declined" | "people/withdrawn" | "people/gossip" | "people/stand-in" | "people/family-request" }
>;

const FROM_AUTHORITY: readonly string[] = [
  "people/facts",
  "people/moments",
  "people/proposal",
  "people/agreed",
  "people/ended",
  "people/declined",
  "people/withdrawn",
  "people/gossip",
  "people/stand-in",
  "people/family-request",
] satisfies FromAuthority["type"][];

type FamilyRequest = Extract<Command, { type: "people/family-request" }>;

/**
 * R-PEOPLE-034: a copy whose request a sibling paid elsewhere. This life gets
 * standing +1 and the line instead of the lapse choice, and the copy closes
 * unanswered through `offer/close`: nothing of it is paid or lapsed.
 */
function familyHandled(ctx: Ctx, command: FamilyRequest): BaseEvent[] | Rejection {
  const open = Object.values(ctx.state.offer.items).some((item) => item.entry === command.offer);
  if (!open) return reject("not-legal", `No copy of ${command.offer} is open here.`);
  const events = record(ctx, [{ type: "people/request-handled", offer: command.offer }]);
  return [...events, ...ctx.apply([{ type: "offer/close", offer: command.offer }, { type: "quality/add", quality: STANDING, amount: HANDLED_STANDING }], { source: command.offer, param: null, terms: command.terms })];
}

function isFromAuthority(command: Command): command is FromAuthority {
  return FROM_AUTHORITY.includes(command.type);
}

function authority(ctx: Ctx, sent: Command): BaseEvent[] | Rejection {
  if (!isFromAuthority(sent)) throw new Error(`The people kind's authority handler cannot handle ${sent.type}.`);
  const command = sent;
  switch (command.type) {
    case "people/facts": {
      const found = pairBond(ctx, command.pair, false);
      return Array.isArray(found) ? record(ctx, [{ type: "people/facts-updated", bond: found[0], facts: command.facts }]) : found;
    }
    case "people/moments": {
      const found = pairBond(ctx, command.pair, true);
      return Array.isArray(found) ? record(ctx, [{ type: "people/moments-synced", bond: found[0], moments: command.moments }]) : found;
    }
    case "people/proposal": {
      const found = pairBond(ctx, command.pair, true);
      return Array.isArray(found) ? record(ctx, [{ type: "people/proposal-received", bond: found[0], proposal: command.proposal }]) : found;
    }
    case "people/agreed": {
      const found = pairBond(ctx, command.pair, true);
      if (!Array.isArray(found)) return found;
      return agree(ctx, found[0], { step: command.step, route: command.route ?? null, lead: command.lead ?? null });
    }
    case "people/ended": {
      const found = pairBond(ctx, command.pair, true);
      if (!Array.isArray(found)) return found;
      return endBond(ctx, found[0], command.why, command.why === "them" ? "left" : "none");
    }
    case "people/declined": {
      // R-PEOPLE-016: the other life said no; the proposer's own proposal clears and the same step waits out the cooldown.
      const found = pairBond(ctx, command.pair, true);
      if (!Array.isArray(found)) return found;
      if (found[1].pending.mine?.step !== command.step) return reject("not-legal", `No ${command.step} proposal of this life is waiting.`);
      return record(ctx, [{ type: "people/declined", bond: found[0], step: command.step }]);
    }
    case "people/withdrawn": {
      const found = pairBond(ctx, command.pair, true);
      if (!Array.isArray(found)) return found;
      if (found[1].pending.theirs?.step !== command.step) return reject("not-legal", `No ${command.step} proposal of theirs is waiting.`);
      return record(ctx, [{ type: "people/proposal-withdrawn", bond: found[0], step: command.step }]);
    }
    case "people/gossip": {
      const found = pairBond(ctx, command.pair, true);
      return Array.isArray(found) ? record(ctx, [{ type: "people/gossip-heard", bond: found[0] }]) : found;
    }
    case "people/stand-in": {
      const found = pairBond(ctx, command.pair, true);
      return Array.isArray(found) ? record(ctx, [{ type: "people/stand-in-changed", bond: found[0], stage: command.stage }]) : found;
    }
    case "people/family-request": {
      const entry = ownOf(ctx.content.offer, command.offer);
      if (entry === undefined) return reject("unknown-id", `There is no offer ${command.offer}.`);
      if (entry.group !== "family") return reject("not-legal", `${command.offer} is not a family request.`);
      if (command.handled === true) return familyHandled(ctx, command);
      const events = record(ctx, [{ type: "people/request-shared", offer: command.offer }]);
      return [...events, ...ctx.apply([{ type: "offer/open", offer: command.offer }], { source: command.offer, param: null, terms: command.terms })];
    }
    default: {
      const never: never = command;
      throw new Error(`Unknown authority command ${JSON.stringify(never)}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// The effect: R-PEOPLE-014, R-PEOPLE-050
// ---------------------------------------------------------------------------

/**
 * R-PEOPLE-050: taking the papers offer opens a bond at `married` with no
 * moments and a joint on the partner route into the person's country, with
 * the person as sponsor. the offer's `take` choice carries this as a
 * `people/moment` of kind `wedding`, since no effect opens a bond.
 */
function papersMarriage(ctx: Ctx): BaseEvent[] {
  const entry = Object.values(ctx.content.person)
    .filter((person) => person.behaviour.papers)
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  if (entry === undefined || partnerBond(ctx.state.people) !== null) return [];
  const read: ReadCtx = { state: ctx.state, world: ctx.world, content: ctx.content };
  const id = ctx.nextId("bond");
  const month = ctx.state.turn.month;
  const route = Object.values(ctx.content.route).find((candidate) => candidate.gate === "partner" && candidate.country === entry.profile.country);
  const events: PeopleEvent[] = [
    { type: "people/courted", bond: id, with: entry.id, role: "partner" },
    { type: "people/facts-updated", bond: id, facts: computerFacts(read, entry, drawAge(ctx, entry), month) },
    { type: "people/agreed", bond: id, step: "partner", route: null, lead: null, month },
    { type: "people/agreed", bond: id, step: "marry", route: null, lead: null, month },
  ];
  if (route !== undefined) events.push({ type: "people/agreed", bond: id, step: "joint", route: route.id, lead: "them", month });
  return record(ctx, events);
}

/**
 * The bond a slot's time goes to (R-PEOPLE-014): the one the param names, or
 * else the bond at courting or later that has waited longest for a moment.
 * an activity's `param` has no `bond` kind, so a slot cannot name one.
 */
function bondFor(ctx: Ctx, kind: Moment["kind"], param: string | null): string | null {
  const together = kind === "met";
  const eligible = Object.entries(ctx.state.people.bonds)
    .filter(([, bond]) => COURTED.includes(bond.stage) && bond.facts !== null && samePlace(ctx.state, bond.facts) === together)
    .sort(([leftId, left], [rightId, right]) => (left.lastMomentMonth ?? -1) - (right.lastMomentMonth ?? -1) || leftId.localeCompare(rightId));
  if (param !== null && eligible.some(([id]) => id === param)) return param;
  return eligible[0]?.[0] ?? null;
}

function momentEffect(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "people/moment") throw new Error(`people/moment cannot carry out ${effect.type}.`);
  if (effect.kind === "wedding" && cause.source.startsWith(`${PAPERS_OFFER}.`)) return papersMarriage(ctx);
  if (effect.kind !== "met" && effect.kind !== "call") return [];
  const id = bondFor(ctx, effect.kind, cause.param);
  const bond = id === null ? undefined : ctx.state.people.bonds[id];
  if (id === null || bond === undefined) return [];
  const lists = listsOf(ctx.content, bond);
  const spot = effect.kind === "met" ? drawFrom(ctx, lists.spots) : null;
  const what = drawFrom(ctx, effect.kind === "call" && lists.calls.length > 0 ? lists.calls : lists.whats) ?? effect.kind;
  const moment: Moment = { n: bond.moments.length + 1, by: "me", kind: effect.kind, spot, what, tick: ctx.world.tick };
  return record(ctx, [{ type: "people/moment-added", bond: id, moment }]);
}

/** R-PEOPLE-027: the departure on a partner route records the arrival, for the bar (R-UNDERTAKING-004) and the assistance count. */
function arrivedEffect(ctx: Ctx, effect: Effect): BaseEvent[] {
  if (effect.type !== "people/arrived") throw new Error(`people/arrived cannot carry out ${effect.type}.`);
  return record(ctx, [{ type: "people/arrived", route: effect.route, month: ctx.state.turn.month }]);
}

/**
 * R-UNDERTAKING-010: a month of assistance counts while `arrived` names the
 * effect's route and fewer than `tuning.undertaking.months` of this life's
 * months have passed since. The sponsor reads the count in the facts.
 */
function assistanceEffect(ctx: Ctx, effect: Effect): BaseEvent[] {
  if (effect.type !== "people/assistance-taken") throw new Error(`people/assistance-taken cannot carry out ${effect.type}.`);
  const { arrived } = ctx.state.people;
  if (arrived === null || arrived.route !== effect.route) return [];
  if (ctx.state.turn.month - arrived.month >= ctx.content.tuning.undertaking.months) return [];
  return record(ctx, [{ type: "people/assistance-counted", route: effect.route }]);
}

// ---------------------------------------------------------------------------
// The month: R-PEOPLE-041, R-PEOPLE-042, R-PEOPLE-048, R-PEOPLE-049
// ---------------------------------------------------------------------------

/** R-PEOPLE-048: each computer's facts rebuilt, a month older. */
function refreshFacts(ctx: Ctx): BaseEvent[] {
  const read: ReadCtx = { state: ctx.state, world: ctx.world, content: ctx.content };
  const events: PeopleEvent[] = [];
  for (const [id, bond] of Object.entries(ctx.state.people.bonds)) {
    const entry = computerOf(ctx.content, bond);
    if (entry === null || !live(bond) || bond.facts === null) continue;
    events.push({ type: "people/facts-updated", bond: id, facts: computerFacts(read, entry, bond.facts.ageMonths + 1, ctx.state.turn.month) });
  }
  return events.length === 0 ? [] : record(ctx, events);
}

/** R-PEOPLE-049: a December wedding a computer agreed to is held once December comes. */
function decemberWeddings(ctx: Ctx): BaseEvent[] {
  const waiting = Object.entries(ctx.state.people.bonds).filter(([, bond]) => live(bond) && bond.pending.mine?.step === "marry" && computerOf(ctx.content, bond) !== null);
  if (waiting.length === 0 || worldVar(ctx, DECEMBER) !== 1) return [];
  const events: BaseEvent[] = [];
  for (const [id, bond] of waiting) {
    if (bond.pending.mine === null || !canPayShare(ctx)) continue;
    const agreed = agree(ctx, id, bond.pending.mine);
    if (Array.isArray(agreed)) events.push(...agreed);
  }
  return events;
}

/**
 * R-PEOPLE-041: for each bond courting beside a partner, one draw at
 * `gossipBp`. A real partner hears through the authority; a computer partner
 * may end it, and the courter pays as if they had.
 */
function gossip(ctx: Ctx): BaseEvent[] {
  const events: BaseEvent[] = [];
  const courting = Object.entries(ctx.state.people.bonds).filter(([, bond]) => bond.stage === "courting").map(([id]) => id);
  for (const about of courting) {
    const together = partnerBond(ctx.state.people);
    if (together === null) break;
    if (!ctx.random.chance("people", ctx.content.tuning.people.gossipBp)) continue;
    const [partnerId, partner] = together;
    events.push(...ctx.apply([{ type: "quality/add", quality: STANDING, amount: ctx.content.tuning.people.gossipStanding }], { source: about, param: about, terms: {} }));
    const entry = computerOf(ctx.content, partner);
    if (entry === null) {
      events.push(...record(ctx, [{ type: "people/gossip-spread", bond: partnerId, about }]));
      continue;
    }
    if (ctx.random.chance("people", entry.behaviour.jealousBp)) events.push(...endBond(ctx, partnerId, "them", "me"));
  }
  return events;
}

/** R-PEOPLE-042: a computer partner with no moment for its patience ends the bond, and the character is the one left. */
function drift(ctx: Ctx): BaseEvent[] {
  const events: BaseEvent[] = [];
  const month = ctx.state.turn.month;
  for (const [id, bond] of Object.entries(ctx.state.people.bonds)) {
    const entry = computerOf(ctx.content, bond);
    const patience = entry?.behaviour.patienceMonths ?? null;
    if (entry === null || bond.role !== "partner" || !COURTED.includes(bond.stage) || patience === null || bond.lastMomentMonth === null) continue;
    if (month - bond.lastMomentMonth >= patience) events.push(...endBond(ctx, id, "drift", "left"));
  }
  return events;
}

function monthPhase(ctx: Ctx): BaseEvent[] {
  return [...refreshFacts(ctx), ...decemberWeddings(ctx), ...gossip(ctx), ...drift(ctx)];
}

// ---------------------------------------------------------------------------
// Evolve
// ---------------------------------------------------------------------------

function newBond(withWhom: Bond["with"], role: Bond["role"], stage: BondStage, month: number | null, facts: PersonFacts | null): Bond {
  return {
    with: withWhom,
    role,
    stage,
    firstMonth: null,
    partnerMonth: null,
    marriedMonth: null,
    // courting starts the patience clock (R-PEOPLE-042), so a bond with no moment yet can drift too.
    lastMomentMonth: month,
    moments: [],
    facts,
    pending: { mine: null, theirs: null },
    standIn: null,
    ended: null,
    cooldownUntil: null,
    consent: null,
  };
}

function withBond(slice: PeopleSlice, id: string, change: (bond: Bond) => Bond): PeopleSlice {
  const bond = slice.bonds[id];
  if (bond === undefined) throw new Error(`The people slice has no bond ${id}.`);
  return { ...slice, bonds: { ...slice.bonds, [id]: change(bond) } };
}

function withSlot(slice: PeopleSlice, key: string, slot: Slot): PeopleSlice {
  return { ...slice, slots: { ...slice.slots, [key]: slot } };
}

/** The slot holding a bond, if any. */
function slotOf(slice: PeopleSlice, id: string): string | null {
  return Object.entries(slice.slots).find(([, slot]) => slot.bond === id)?.[0] ?? null;
}

function mergeMoments(held: readonly Moment[], arriving: readonly Moment[]): Moment[] {
  const byN = new Map<number, Moment>();
  for (const moment of [...held, ...arriving]) byN.set(moment.n, moment);
  return [...byN.values()].sort((left, right) => left.n - right.n);
}

function evolveAgreed(slice: PeopleSlice, event: Extract<PeopleEvent, { type: "people/agreed" }>, content: Content): PeopleSlice {
  const cleared = withBond(slice, event.bond, (bond) => ({ ...bond, pending: { mine: null, theirs: null } }));
  const bond = cleared.bonds[event.bond]!;
  switch (event.step) {
    case "partner": {
      const next = withBond(cleared, event.bond, (held) => ({ ...held, stage: "partner", partnerMonth: event.month }));
      const person = bond.with.kind === "computer" ? bond.with.entry : null;
      const state = person !== null ? "computer" : bond.standIn === "on" ? "stand-in" : "player";
      return withSlot(next, PARTNER_SLOT, { state, bond: event.bond, person, invite: null });
    }
    case "marry":
      return withBond(cleared, event.bond, (held) => ({ ...held, stage: "married", marriedMonth: event.month }));
    case "joint": {
      if (event.route === null || event.lead === null) return cleared;
      // Consent given while the joint was asked for carries into it (R-PEOPLE-044).
      const given = bond.consent ?? { countFunds: false, standInMay: false };
      const joint = { bond: event.bond, route: event.route, lead: event.lead, ...given };
      const sponsors = event.lead === "me" && content.route[event.route]?.gate === "partner";
      return { ...cleared, joint, sponsoring: sponsors ? { bond: event.bond, route: event.route, month: event.month } : cleared.sponsoring };
    }
    case "landed":
      return cleared;
    default: {
      const never: never = event.step;
      throw new Error(`Unknown step ${String(never)}.`);
    }
  }
}

function evolveEnded(slice: PeopleSlice, event: Extract<PeopleEvent, { type: "people/ended" }>, content: Content): PeopleSlice {
  const cooldownUntil = event.month + content.tuning.people.recourtMonths;
  let next = withBond(slice, event.bond, (bond) => ({ ...bond, stage: "ended", ended: { month: event.month, by: event.by }, cooldownUntil, pending: { mine: null, theirs: null }, standIn: null }));
  if (next.joint?.bond === event.bond) next = { ...next, joint: null };
  if (next.sponsoring?.bond === event.bond) next = { ...next, sponsoring: null };
  if (next.slots[PARTNER_SLOT]?.bond === event.bond) next = withSlot(next, PARTNER_SLOT, emptySlot("empty"));
  // R-PEOPLE-040 (decision 0027): a sibling slot whose player started a new life goes back to a computer sibling, drawn
  // again at the next month's start as an undrawn slot is (R-PEOPLE-047).
  if (event.by === "restart") {
    for (const [slot, held] of Object.entries(next.slots)) {
      if (slot.startsWith(SIBLING_PREFIX) && held.bond === event.bond) next = withSlot(next, slot, emptySlot("computer"));
    }
  }
  return next;
}

function evolve(slice: PeopleSlice, event: PeopleEvent, state: State, content: Content): PeopleSlice {
  const month = state.turn.month;
  switch (event.type) {
    case "people/siblings-drawn": {
      let next = slice;
      for (const drawn of event.siblings) {
        next = withSlot(next, drawn.slot, { state: "computer", bond: drawn.bond, person: drawn.person, invite: null });
        next = { ...next, bonds: { ...next.bonds, [drawn.bond]: newBond({ kind: "computer", entry: drawn.person }, "sibling", "connected", null, drawn.facts) } };
      }
      return next;
    }
    case "people/invited": {
      const slot = slice.slots[event.slot] ?? emptySlot("empty");
      return withSlot(slice, event.slot, { ...slot, state: "invited", invite: { looking: event.looking, fill: event.fill } });
    }
    case "people/invite-withdrawn": {
      const slot = slice.slots[event.slot] ?? emptySlot("empty");
      return withSlot(slice, event.slot, { ...slot, state: event.slot === PARTNER_SLOT ? "empty" : "computer", invite: null });
    }
    case "people/linked": {
      const role = slotRole(event.slot) ?? "partner";
      const bonds = { ...slice.bonds, [event.bond]: newBond({ kind: "player", pair: event.pair }, role, "connected", null, event.facts) };
      const replaced = slice.slots[event.slot]?.bond;
      // A computer sibling keeps its life only until the slot is linked (R-PEOPLE-010).
      if (role === "sibling" && replaced !== undefined && replaced !== null) delete bonds[replaced];
      const slot: Slot = role === "sibling" ? { state: "player", bond: event.bond, person: null, invite: null } : emptySlot("empty");
      return withSlot({ ...slice, bonds }, event.slot, slot);
    }
    case "people/courted": {
      if (slice.bonds[event.bond] !== undefined) return withBond(slice, event.bond, (bond) => ({ ...bond, stage: "courting", lastMomentMonth: bond.lastMomentMonth ?? month }));
      const withWhom: Bond["with"] = event.with.startsWith("person.") ? { kind: "computer", entry: event.with as Id<"person"> } : { kind: "player", pair: event.with };
      return { ...slice, bonds: { ...slice.bonds, [event.bond]: newBond(withWhom, event.role, "courting", month, null) } };
    }
    case "people/moment-added":
      return withBond(slice, event.bond, (bond) => ({ ...bond, moments: [...bond.moments, event.moment], lastMomentMonth: month, firstMonth: bond.firstMonth ?? month }));
    case "people/moments-synced":
      return withBond(slice, event.bond, (bond) => ({ ...bond, moments: mergeMoments(bond.moments, event.moments), lastMomentMonth: month, firstMonth: bond.firstMonth ?? month }));
    case "people/proposed":
      return withBond(slice, event.bond, (bond) => ({ ...bond, pending: { ...bond.pending, mine: event.proposal } }));
    case "people/proposal-received":
      return withBond(slice, event.bond, (bond) => ({ ...bond, pending: { ...bond.pending, theirs: event.proposal } }));
    case "people/answered":
      return withBond(slice, event.bond, (bond) => ({ ...bond, pending: { ...bond.pending, theirs: null } }));
    case "people/agreed":
      return evolveAgreed(slice, event, content);
    case "people/declined":
      return withBond(slice, event.bond, (bond) => ({ ...bond, pending: { ...bond.pending, mine: null }, cooldownUntil: month + content.tuning.people.proposeCooldown }));
    case "people/withdrawn":
      return withBond(slice, event.bond, (bond) => ({ ...bond, pending: { ...bond.pending, mine: null } }));
    case "people/proposal-withdrawn":
      return withBond(slice, event.bond, (bond) => ({ ...bond, pending: { ...bond.pending, theirs: null } }));
    case "people/consented": {
      const consent = { countFunds: event.countFunds, standInMay: event.standInMay };
      const next = withBond(slice, event.bond, (bond) => ({ ...bond, consent }));
      return next.joint?.bond === event.bond ? { ...next, joint: { ...next.joint, ...consent } } : next;
    }
    case "people/ended":
      return evolveEnded(slice, event, content);
    case "people/facts-updated":
      return withBond(slice, event.bond, (bond) => ({ ...bond, facts: event.facts }));
    case "people/stand-in-changed": {
      const next = withBond(slice, event.bond, (bond) => ({ ...bond, standIn: event.stage }));
      const key = slotOf(next, event.bond);
      const slot = key === null ? undefined : next.slots[key];
      if (key === null || slot === undefined || (slot.state !== "player" && slot.state !== "stand-in")) return next;
      return withSlot(next, key, { ...slot, state: event.stage === "on" ? "stand-in" : "player" });
    }
    case "people/arrived":
      return { ...slice, arrived: { route: event.route, month: event.month } };
    case "people/assistance-counted":
      return { ...slice, assistanceTaken: slice.assistanceTaken + 1 };
    case "people/gossip-heard":
    case "people/gossip-spread":
    case "people/request-shared":
    case "people/request-handled":
    case "people/wedding-waits":
      return slice;
    default: {
      const never: never = event;
      throw new Error(`Unknown people event ${JSON.stringify(never)}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Lines
// ---------------------------------------------------------------------------

function line(key: string, params: ReportLine["params"], tone: ReportLine["tone"], attention = false): ReportLine {
  return { key, params, tone, attention, counts: [] };
}

/** Who a bond is with, for a line: a computer's entry id, or `player`. */
function whoOf(state: State, id: string): string {
  const bond = state.people.bonds[id];
  return bond?.with.kind === "computer" ? bond.with.entry : "player";
}

function agreedLines(event: Extract<PeopleEvent, { type: "people/agreed" }>, state: State): ReportLine[] {
  const who = whoOf(state, event.bond);
  switch (event.step) {
    case "partner":
      return [line("line.people.partners", { who }, "good", true)];
    case "marry":
      return [line("line.people.married", { who }, "good", true)];
    case "joint":
      return [line("line.people.joint", { who, route: event.route ?? "", lead: event.lead ?? "" }, "good", true)];
    case "landed":
      return [line("line.people.landed", { who }, "good", true)];
    default: {
      const never: never = event.step;
      throw new Error(`Unknown step ${String(never)}.`);
    }
  }
}

function endedLines(event: Extract<PeopleEvent, { type: "people/ended" }>, state: State): ReportLine[] {
  const who = whoOf(state, event.bond);
  switch (event.by) {
    case "me":
      return [line("line.people.ended", { who }, "bad")];
    case "them":
      return [line("line.people.left", { who }, "bad", true)];
    case "drift":
      return [line("line.people.drifted", { who }, "bad", true)];
    case "absence":
      return [line("line.people.ended-absence", { who }, "plain", true)];
    case "restart":
      return [line("line.people.ended-restart", { who }, "plain", true)];
    case "block":
      return [line("line.people.ended-block", { who }, "plain", true)];
    default: {
      const never: never = event.by;
      throw new Error(`Unknown end ${String(never)}.`);
    }
  }
}

function momentLines(event: Extract<PeopleEvent, { type: "people/moment-added" }>, state: State): ReportLine[] {
  const who = whoOf(state, event.bond);
  const { moment } = event;
  switch (moment.kind) {
    case "met":
      return [line("line.people.met", { who, spot: moment.spot ?? "", what: moment.what }, "good")];
    case "call":
      return [line("line.people.called", { who, what: moment.what }, "good")];
    case "wedding":
      return [{ ...line("line.people.wedding", { who, spot: moment.spot ?? "" }, "good", true), big: true }];
    case "said":
      return [];
    default: {
      const never: never = moment.kind;
      throw new Error(`Unknown moment ${String(never)}.`);
    }
  }
}

function lines(event: PeopleEvent, state: State): ReportLine[] {
  switch (event.type) {
    case "people/invited":
      return [line("line.people.invited", { slot: event.slot }, "plain")];
    case "people/invite-withdrawn":
      return [line("line.people.invite-withdrawn", { slot: event.slot }, "plain")];
    case "people/linked":
      return [line("line.people.linked", { slot: event.slot }, "good", true)];
    case "people/courted":
      return [line("line.people.courted", { who: whoOf(state, event.bond) }, "plain")];
    case "people/moment-added":
      return momentLines(event, state);
    case "people/proposed":
      return [line("line.people.proposed", { who: whoOf(state, event.bond), step: event.proposal.step }, "plain")];
    case "people/wedding-waits":
      return [line("line.people.wedding-december", { who: whoOf(state, event.bond) }, "good", true)];
    case "people/proposal-received":
      return [line("line.people.proposal-received", { step: event.proposal.step }, "plain", true)];
    case "people/answered":
      return [line(event.yes ? "line.people.answered-yes" : "line.people.answered-no", { step: event.step }, "plain")];
    case "people/agreed":
      return agreedLines(event, state);
    case "people/declined":
      return [line("line.people.declined", { who: whoOf(state, event.bond), step: event.step }, "bad", true)];
    case "people/withdrawn":
      return [line("line.people.withdrawn", { who: whoOf(state, event.bond) }, "plain")];
    case "people/proposal-withdrawn":
      return [line("line.people.proposal-withdrawn", { who: whoOf(state, event.bond), step: event.step }, "plain", true)];
    case "people/consented":
      return [line("line.people.consented", {}, "plain")];
    case "people/ended":
      return endedLines(event, state);
    case "people/gossip-heard":
      return [line("line.people.gossip", {}, "bad", true)];
    case "people/gossip-spread":
      return [line("line.people.gossip-spread", {}, "bad", true)];
    case "people/stand-in-changed":
      return [line(event.stage === null ? "line.people.stand-in-off" : event.stage === "on" ? "line.people.stand-in-on" : "line.people.stand-in-warned", {}, "plain", event.stage !== null)];
    case "people/request-shared":
      return [line("line.people.request-shared", { offer: event.offer }, "plain", true)];
    case "people/request-handled":
      return [line("line.people.handled", { offer: event.offer }, "good", true)];
    case "people/siblings-drawn":
    case "people/moments-synced":
    case "people/facts-updated":
    case "people/arrived":
    case "people/assistance-counted":
      return [];
    default: {
      const never: never = event;
      throw new Error(`Unknown people event ${JSON.stringify(never)}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Requirements: R-PEOPLE-031, R-PEOPLE-046 and the joint
// ---------------------------------------------------------------------------

function bondMeets(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "people/bond") throw new Error(`people/bond cannot judge ${requirement.type}.`);
  const met = Object.values(read.state.people.bonds).some((bond) => {
    if (bond.role !== requirement.role || !requirement.stages.includes(bond.stage)) return false;
    const facts = bond.facts;
    if (requirement.where !== undefined && facts?.where !== requirement.where) return false;
    if (requirement.country !== undefined && facts?.country !== requirement.country) return false;
    return requirement.statuses === undefined || (facts?.status !== null && facts?.status !== undefined && requirement.statuses.includes(facts.status));
  });
  return { met };
}

function siblingAbroad(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "people/sibling-abroad") throw new Error(`people/sibling-abroad cannot judge ${requirement.type}.`);
  const met = Object.values(read.state.people.bonds).some((bond) => {
    const facts = bond.facts;
    if (bond.role !== "sibling" || !live(bond) || facts === null) return false;
    return facts.where === "abroad" && facts.country === requirement.country && facts.status !== null && requirement.statuses.includes(facts.status) && facts.ageMonths >= requirement.minAgeMonths;
  });
  return { met };
}

function jointMeets(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "people/joint") throw new Error(`people/joint cannot judge ${requirement.type}.`);
  const { joint } = read.state.people;
  if (joint === null) return { met: false };
  const onRoute = joint.route === requirement.route || read.content.route[joint.route]?.dependants === requirement.route;
  return { met: onRoute && (joint.lead === "me") === (requirement.as === "lead") };
}

// ---------------------------------------------------------------------------
// The view: R-PEOPLE-051
// ---------------------------------------------------------------------------

function labelOf(bond: Bond): PlayerView["people"]["bonds"][number]["label"] {
  if (bond.with.kind === "computer") return "computer";
  return bond.standIn === "on" ? "stand-in" : "player";
}

function slotLabel(slice: PeopleSlice, slot: Slot): PlayerView["people"]["slots"][string]["label"] {
  switch (slot.state) {
    case "computer":
      return "computer";
    case "stand-in":
      return "stand-in";
    case "player": {
      const bond = slot.bond === null ? undefined : slice.bonds[slot.bond];
      return bond === undefined ? "player" : labelOf(bond);
    }
    case "empty":
    case "invited":
      return null;
    default: {
      const never: never = slot.state;
      throw new Error(`Unknown slot state ${String(never)}.`);
    }
  }
}

/**
 * R-PEOPLE-030: on a points route, the score alone (`mine`) and the score
 * leading with this partner from their facts (`theirs`), read fresh from the
 * state as the points gate reads its own. Null on any other route.
 */
function jointScores(read: ReadCtx, joint: NonNullable<PeopleSlice["joint"]>): { myScore: number | null; theirScore: number | null } {
  const entry = read.content.route[joint.route];
  if (entry?.gate !== "points") return { myScore: null, theirScore: null };
  const facts = read.state.people.bonds[joint.bond]?.facts ?? null;
  const withSpouse = facts !== null && entry.points?.spouseTable !== null && entry.points?.spouseTable !== undefined;
  return { myScore: pointsScoreAlone(read, joint.route), theirScore: withSpouse ? pointsScoreWith(read, joint.route, facts) : null };
}

function view(read: ReadCtx): Pick<PlayerView, "people"> {
  const slice = read.state.people;
  // R-INTERVIEW-005: while an interview is open each side answers from memory.
  const interviewOpen = read.state.interview.open !== null;
  return {
    people: {
      slots: Object.fromEntries(Object.entries(slice.slots).map(([key, slot]) => [key, { state: slot.state, label: slotLabel(slice, slot), bond: slot.bond, invite: slot.invite }])),
      bonds: Object.entries(slice.bonds).map(([id, bond]) => ({
        id,
        role: bond.role,
        stage: bond.stage,
        label: labelOf(bond),
        moments: interviewOpen ? null : bond.moments,
        pending: bond.pending,
        standIn: bond.standIn,
        // Decision 0009: the screens need who the bond is with and its timing.
        person: bond.with.kind === "computer" ? bond.with.entry : null,
        pair: bond.with.kind === "player" ? bond.with.pair : null,
        lastMomentMonth: bond.lastMomentMonth,
        cooldownUntil: bond.cooldownUntil,
        partnerMonth: bond.partnerMonth,
        consent: bond.consent,
        // R-PEOPLE-051: funds only on the joint's bond, where consent put them in the facts.
        facts: bond.facts === null ? null : { ...bond.facts, funds: slice.joint?.bond === id ? bond.facts.funds : null },
      })),
      candidates: candidatesOf(read).map((entry) => ({ person: entry.id, role: entry.role })),
      joint: slice.joint === null ? null : { bond: slice.joint.bond, route: slice.joint.route, lead: slice.joint.lead, ...jointScores(read, slice.joint) },
      sponsoring: slice.sponsoring,
      barUntilMonth: sponsorBarUntil(read),
    },
  };
}

// ---------------------------------------------------------------------------
// Invariants and the kind
// ---------------------------------------------------------------------------

/** R-PEOPLE-044: a stand-in never ends a turn. */
function turnEnd(ctx: Ctx): BaseEvent[] | Rejection {
  return byStandIn(ctx, "ends a turn") ?? [];
}

function invariants(state: State, content: Content): string[] {
  const problems: string[] = [];
  const slice = state.people;
  if (!Number.isSafeInteger(slice.assistanceTaken) || slice.assistanceTaken < 0) problems.push("The people slice counts negative assistance.");
  const together = Object.values(slice.bonds).filter((bond) => TOGETHER.includes(bond.stage)).length;
  if (together > 1) problems.push(`R-PEOPLE-018: ${String(together)} bonds are at partner or married.`);
  if (courtingCount(slice) > content.tuning.people.maxCourting) problems.push("R-PEOPLE-013: more bonds are courting than the tuning allows.");
  for (const [key, slot] of Object.entries(slice.slots)) {
    if (slot.bond !== null && slice.bonds[slot.bond] === undefined) problems.push(`The slot ${key} names the missing bond ${slot.bond}.`);
  }
  if (slice.joint !== null && slice.bonds[slice.joint.bond]?.stage === "ended") problems.push("R-PEOPLE-036: a joint rests on an ended bond.");
  return problems;
}

export const peopleKind: RegisteredKind<PeopleSlice, PeopleEvent> = {
  kind: "people",
  initial,
  commands: {
    "people/invite": invite,
    "people/court": court,
    "people/propose": propose,
    "people/answer": answer,
    "people/withdraw": withdraw,
    "people/consent": consent,
    "people/end": end,
    "people/link": link,
    "people/facts": authority,
    "people/moments": authority,
    "people/proposal": authority,
    "people/agreed": authority,
    "people/ended": authority,
    "people/declined": authority,
    "people/withdrawn": authority,
    "people/gossip": authority,
    "people/stand-in": authority,
    "people/family-request": authority,
    "turn/end": turnEnd,
  },
  effects: { "people/moment": momentEffect, "people/arrived": arrivedEffect, "people/assistance-taken": assistanceEffect },
  phases: { spend: drawSiblings, month: monthPhase },
  evolve,
  lines,
  requirements: { "people/bond": bondMeets, "people/sibling-abroad": siblingAbroad, "people/joint": jointMeets },
  invariants,
  view,
};
