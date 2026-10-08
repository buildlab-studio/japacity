// A bounded sample of legal commands, read from the view alone. One small
// function per kind; a kind agent extends its own. Random play draws from
// this list, so everything here must be accepted by step when the view says so.
import { handles } from "../engine/step";
import { mulDiv } from "../engine/int";
import type { Currency, ForeignCurrency, PlayerView, SlotPick } from "../engine/types";
import type { Loose } from "./play";

function fromTurn(view: PlayerView): Loose[] {
  if (view.turns.banked < 1 || view.setpiece !== null) return [];
  // Each playable activity with its first param, then every other param on its own.
  const playable = view.activities.filter((option) => option.allowed && option.affordable);
  const first: SlotPick[] = [];
  const commands: Loose[] = [{ type: "turn/end", slots: [] }];
  for (const option of playable) {
    if (option.params === null) first.push({ activity: option.id, param: null });
    else if (option.params.length > 0) first.push({ activity: option.id, param: option.params[0] ?? null });
  }
  for (const slot of first) {
    const slots: SlotPick[] = [];
    for (let i = 0; i < view.freeSlots; i += 1) slots.push(slot);
    if (slots.length > 0) commands.push({ type: "turn/end", slots });
  }
  if (view.freeSlots >= 1) {
    for (const option of playable) {
      for (const param of option.params?.slice(1) ?? []) commands.push({ type: "turn/end", slots: [{ activity: option.id, param }] });
    }
  }
  if (first.length >= 2 && view.freeSlots >= 2) {
    const [a, b] = first as [SlotPick, SlotPick];
    commands.push({ type: "turn/end", slots: [a, b] });
  }
  return commands;
}

function fromOffers(view: PlayerView): Loose[] {
  const commands: Loose[] = [];
  for (const offer of view.offers) {
    for (const choice of offer.choices) {
      if (!choice.allowed) continue;
      // `allowed` is judged at the smallest amount: a larger one can cost more than is held.
      if (choice.pick === null) commands.push({ type: "offer/choose", offer: offer.id, choice: choice.id });
      else commands.push({ type: "offer/choose", offer: offer.id, choice: choice.id, amount: choice.pick.min });
    }
  }
  return commands;
}

function fromSetpiece(view: PlayerView): Loose[] {
  const question = view.setpiece?.question;
  if (question === undefined || question === null) return [];
  // Only an allowed answer is accepted (R-SETPIECE-003).
  return question.allowed.map((answer) => ({ type: "setpiece/answer", question: question.id, answer }));
}

/** R-INTERVIEW-004: every option of the question this life must answer now. */
function fromInterview(view: PlayerView): Loose[] {
  const question = view.interview?.question;
  if (question === undefined || question === null) return [];
  return question.options.map((option) => ({ type: "interview/answer", question: question.id, option }));
}

/** R-PEOPLE-016: the moments partners needs in the shipped content and the mini content alike. */
const PARTNER_MOMENTS = 6;
const TOGETHER: readonly string[] = ["partner", "married"];

/**
 * R-PEOPLE-016: partners asked of a courting bond with the moments for it,
 * while nothing else is waiting on it, no other bond is together and the
 * cooldown after a no has passed. marriage is not sampled, because
 * the view carries no `partnerMonth` to tell the months as partners.
 */
function proposals(view: PlayerView): Loose[] {
  const { bonds } = view.people;
  if (bonds.some((bond) => TOGETHER.includes(bond.stage))) return [];
  return bonds
    .filter((bond) => bond.role === "partner" && bond.stage === "courting" && bond.pending.mine === null)
    .filter((bond) => bond.moments !== null && bond.moments.length >= PARTNER_MOMENTS)
    .filter((bond) => bond.cooldownUntil === null || view.month >= bond.cooldownUntil)
    .map((bond) => ({ type: "people/propose", bond: bond.id, step: "partner" }));
}

/**
 * docs/rules/people.md: courting a candidate while nothing else is courting,
 * a card out on an open slot or taken back, partners asked for, a proposal
 * taken back, an answer of no, consent on a joint agreed or asked for, and an
 * end to any bond still open.
 */
function fromPeople(view: PlayerView): Loose[] {
  const commands: Loose[] = [];
  const { slots, bonds, candidates, joint } = view.people;
  // R-PEOPLE-013: any courting limit allows one bond.
  if (!bonds.some((bond) => bond.stage === "courting")) {
    for (const candidate of candidates) if (candidate.role === "partner") commands.push({ type: "people/court", with: candidate.person });
  }
  // R-PEOPLE-010: a card on the empty partner slot or a computer sibling's, and taking one back.
  for (const [slot, held] of Object.entries(slots)) {
    if (held.state === "invited") commands.push({ type: "people/invite", slot });
    else if (slot === "partner" && held.state === "empty") commands.push({ type: "people/invite", slot, looking: "partner" });
    else if (slot.startsWith("sibling-") && held.state === "computer") commands.push({ type: "people/invite", slot, looking: "sibling" });
  }
  commands.push(...proposals(view));
  for (const bond of bonds) {
    if (bond.stage === "ended") continue;
    if (bond.pending.mine !== null) commands.push({ type: "people/withdraw", bond: bond.id });
    if (bond.pending.theirs !== null) commands.push({ type: "people/answer", bond: bond.id, step: bond.pending.theirs.step, yes: false });
    // R-PEOPLE-044: consent may be given while a joint is asked for, before it is agreed.
    if (joint?.bond !== bond.id && (bond.pending.mine?.step === "joint" || bond.pending.theirs?.step === "joint")) commands.push({ type: "people/consent", bond: bond.id, standInMay: true });
    // R-PEOPLE-035: an end is never refused for a bond still open.
    commands.push({ type: "people/end", bond: bond.id });
  }
  if (joint !== null) commands.push({ type: "people/consent", bond: joint.bond, countFunds: true });
  return commands;
}

/** Small amounts, so random play can make many and never runs a pocket dry in one go. */
const SMALL_MOVE = 100;
const SMALL_FOREIGN = 1000;
const SMALL_NAIRA = 1000000;

function fromWallet(view: PlayerView): Loose[] {
  const commands: Loose[] = [];
  const foreign: ForeignCurrency[] = ["GBP", "USD", "CAD", "AED", "EUR"];
  const currencies: Currency[] = ["NGN", ...foreign];
  for (const currency of currencies) {
    const pocket = view.pockets[currency];
    if (pocket.cash >= SMALL_MOVE) commands.push({ type: "wallet/move", currency, amount: SMALL_MOVE, to: "bank" });
    if (pocket.bank >= SMALL_MOVE) commands.push({ type: "wallet/move", currency, amount: SMALL_MOVE, to: "cash" });
  }
  const naira = view.pockets.NGN;
  // The most US cents a naira purchase could use: the charge only makes it less.
  const nairaCents = mulDiv(SMALL_NAIRA, 100, view.rates.USD.official);
  const allowance = view.bankAllowanceLeft ?? 0;
  for (const currency of foreign) {
    const pocket = view.pockets[currency];
    if (naira.bank >= SMALL_NAIRA && allowance >= nairaCents) {
      commands.push({ type: "wallet/convert", from: "NGN", to: currency, amount: SMALL_NAIRA, via: "bank" });
    }
    if (naira.cash >= SMALL_NAIRA) commands.push({ type: "wallet/convert", from: "NGN", to: currency, amount: SMALL_NAIRA, via: "aboki" });
    if (pocket.bank >= SMALL_FOREIGN) commands.push({ type: "wallet/convert", from: currency, to: "NGN", amount: SMALL_FOREIGN, via: "bank" });
    if (pocket.cash >= SMALL_FOREIGN) commands.push({ type: "wallet/convert", from: currency, to: "NGN", amount: SMALL_FOREIGN, via: "aboki" });
  }
  const pounds = view.pockets.GBP;
  const poundCents = mulDiv(SMALL_FOREIGN, view.rates.GBP.official, view.rates.USD.official);
  if (pounds.bank >= SMALL_FOREIGN && allowance >= poundCents) {
    commands.push({ type: "wallet/convert", from: "GBP", to: "USD", amount: SMALL_FOREIGN, via: "bank" });
  }
  // R-ABROAD-006: from abroad, a small sum home by each channel.
  if (view.place.where === "abroad") {
    for (const currency of foreign) {
      if (view.pockets[currency].bank < SMALL_FOREIGN) continue;
      for (const channel of ["app", "bank", "informal"] as const) commands.push({ type: "wallet/remit", currency, amount: SMALL_FOREIGN, channel });
    }
  }
  return commands;
}

/** A part payment small enough to leave most of a loan owed, so random play pays both ways. */
const SMALL_REPAY = 100000;

/**
 * The loans in the shipped content and their currencies. The view carries
 * neither an entry's type nor its currency. the sampler names them;
 * a loan it does not know is merely not sampled.
 */
const LOANS: Record<string, Currency> = {
  "obligation.salary-loan": "NGN",
  "obligation.quick-loan": "NGN",
  "obligation.group-loan": "NGN",
  "obligation.car-shortfall": "GBP",
};
const CAR = "obligation.car";

/**
 * Paying ahead (R-OBLIGATION-008), and a car's arrears (R-CAR-003): the view's
 * `due` on a car behind on its payments is what clears them. Held funds still
 * hold their principal. Everything else is paid month by month and is never
 * offered. The car's hand-back (R-CAR-004) needs its price, which the view does
 * not carry, so it is not sampled.
 */
function fromObligations(view: PlayerView): Loose[] {
  const commands: Loose[] = [];
  for (const owed of view.obligations) {
    if (owed.outstanding <= 0) continue;
    const loan = LOANS[owed.entry];
    if (loan !== undefined) {
      const pocket = view.pockets[loan];
      const spendable = pocket.bank + pocket.cash;
      const part = Math.min(SMALL_REPAY, owed.outstanding);
      if (spendable >= part) commands.push({ type: "obligation/pay", obligation: owed.id, amount: part });
      if (owed.outstanding > part && spendable >= owed.outstanding) commands.push({ type: "obligation/pay", obligation: owed.id, amount: owed.outstanding });
    } else if (owed.entry === CAR) {
      const pocket = view.pockets.GBP;
      if (owed.missed > 0 && owed.due > 0 && pocket.bank + pocket.cash >= owed.due) commands.push({ type: "obligation/pay", obligation: owed.id, amount: owed.due });
    } else if (owed.entry.includes("held-funds") && owed.principal === owed.outstanding && view.pockets.NGN.locked >= owed.outstanding) {
      commands.push({ type: "obligation/pay", obligation: owed.id, amount: owed.outstanding });
    }
  }
  return commands;
}

/**
 * The view carries neither a school's deposit nor the flight's price, nor
 * which obligations hold funds. the sampler offers the deposit only
 * when the pound pockets alone hold the dearest deposit in the shipped
 * content, the flight only when naira cash and bank hold the shipped flight,
 * and never while an obligation whose entry names held funds is open. A
 * command these bounds let through is always accepted; one they hold back is
 * merely not sampled.
 */
const DEPOSIT_BOUND = 750000;
const FLIGHT_BOUND = 160000000;

function fromRoute(view: PlayerView): Loose[] {
  const commands: Loose[] = [];
  const pounds = view.pockets.GBP.bank + view.pockets.GBP.cash;
  const naira = view.pockets.NGN.bank + view.pockets.NGN.cash;
  const holding = view.obligations.some((obligation) => obligation.entry.includes("held-funds"));
  for (const route of view.routes) {
    if (route.school === null && pounds >= DEPOSIT_BOUND) {
      for (const school of route.schools) {
        if (school.state === "offer") commands.push({ type: "route/pay-deposit", route: route.id, school: school.id });
      }
    }
    if (route.state === "granted" && !holding && naira >= FLIGHT_BOUND && view.place.where !== "road") commands.push({ type: "route/depart", route: route.id });
  }
  return commands;
}

/**
 * Coming home (R-PLACE-004). The view carries no fare. the sampler
 * offers the return when the character holds no lawful status (none, or a
 * cash-only one, which in content is always the overstayer's), since that is
 * accepted whether or not the fare can be paid; otherwise only when the
 * country's own pockets hold the shipped December fare, the dearest it can be.
 */
const FARE_BOUND: Record<string, { currency: Currency; amount: number }> = {
  "country.uk": { currency: "GBP", amount: 155000 },
  "country.canada": { currency: "CAD", amount: 297000 },
  "country.uae": { currency: "AED", amount: 342000 },
  "country.italy": { currency: "EUR", amount: 96000 },
};

function fromPlace(view: PlayerView): Loose[] {
  const { where, country } = view.place;
  if (where !== "abroad" || country === null) return [];
  if (view.status === null || view.status.work === "cash") return [{ type: "return/home" }];
  const bound = FARE_BOUND[country];
  if (bound === undefined) return [];
  const pocket = view.pockets[bound.currency];
  return pocket.bank + pocket.cash >= bound.amount ? [{ type: "return/home" }] : [];
}

/** R-PROLOGUE-003: every answer of the current card that is allowed now. */
function fromPrologue(view: PlayerView): Loose[] {
  const card = view.prologue;
  if (card === null) return [];
  return card.answers.filter((answer) => answer.allowed).map((answer) => ({ type: "prologue/choose", step: card.step, answer: answer.id }));
}

function fromActivity(view: PlayerView): Loose[] {
  return view.job.id === null ? [] : [{ type: "activity/quit" }];
}

/**
 * R-LOTTERY-003: one ticket while the cap and the naira bank allow it. The
 * world's draw is always the one on sale at its own tick (R-LOTTERY-002), so
 * the close has not passed for a view built from it.
 */
function fromLottery(view: PlayerView): Loose[] {
  const draw = view.lottery;
  if (draw === null || draw.tickets >= draw.maxTickets || view.pockets.NGN.bank < draw.ticket) return [];
  return [{ type: "lottery/buy", tickets: 1 }];
}

/**
 * Every legal command the sample knows how to build from this view. Commands
 * whose kind has no handler yet are left out, so the list grows as kinds are built.
 */
export function legalCommands(view: PlayerView): Loose[] {
  if (view.ended) return [];
  // R-PROLOGUE-001: while the prologue is open, its answers are all a player may send.
  if (view.prologue !== null) return fromPrologue(view).filter((command) => handles(command.type));
  return [
    ...fromTurn(view),
    ...fromOffers(view),
    ...fromSetpiece(view),
    ...fromRoute(view),
    ...fromWallet(view),
    ...fromObligations(view),
    ...fromActivity(view),
    ...fromPlace(view),
    ...fromLottery(view),
    ...fromInterview(view),
    ...fromPeople(view),
  ].filter(
    // R-INTERVIEW-004: a question waiting holds the turn as a set piece does.
    (command) => handles(command.type) && !(command.type === "turn/end" && (view.interview?.question ?? null) !== null),
  );
}
