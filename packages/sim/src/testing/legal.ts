// A bounded sample of legal commands, read from the view alone. One small
// function per kind; a kind agent extends its own. Random play draws from
// this list, so everything here must be accepted by step when the view says so.
import { handles } from "../engine/step";
import { mulDiv } from "../engine/int";
import type { Currency, ForeignCurrency, PlayerView, SlotPick } from "../engine/types";
import type { Loose } from "./play";

function fromTurn(view: PlayerView): Loose[] {
  if (view.turns.banked < 1 || view.setpiece !== null) return [];
  const playable = view.activities.filter((option) => option.allowed && option.affordable && option.params === null);
  const commands: Loose[] = [{ type: "turn/end", slots: [] }];
  for (const option of playable) {
    const slots: SlotPick[] = [];
    for (let i = 0; i < view.freeSlots; i += 1) slots.push({ activity: option.id, param: null });
    if (slots.length > 0) commands.push({ type: "turn/end", slots });
  }
  if (playable.length >= 2 && view.freeSlots >= 2) {
    const [a, b] = playable as [(typeof playable)[number], (typeof playable)[number]];
    commands.push({ type: "turn/end", slots: [{ activity: a.id, param: null }, { activity: b.id, param: null }] });
  }
  return commands;
}

function fromOffers(view: PlayerView): Loose[] {
  const commands: Loose[] = [];
  for (const offer of view.offers) {
    for (const choice of offer.choices) {
      if (!choice.allowed) continue;
      if (choice.pick === null) commands.push({ type: "offer/choose", offer: offer.id, choice: choice.id });
      else {
        commands.push({ type: "offer/choose", offer: offer.id, choice: choice.id, amount: choice.pick.min });
        commands.push({ type: "offer/choose", offer: offer.id, choice: choice.id, amount: choice.pick.max });
      }
    }
  }
  return commands;
}

function fromSetpiece(view: PlayerView): Loose[] {
  const question = view.setpiece?.question;
  if (question === undefined || question === null) return [];
  return question.answers.map((answer) => ({ type: "setpiece/answer", question: question.id, answer }));
}

/** Small amounts, so random play can make many and never runs a pocket dry in one go. */
const SMALL_MOVE = 100;
const SMALL_FOREIGN = 1000;
const SMALL_NAIRA = 1000000;

function fromWallet(view: PlayerView): Loose[] {
  const commands: Loose[] = [];
  const currencies: Currency[] = ["NGN", "GBP", "USD"];
  const foreign: ForeignCurrency[] = ["GBP", "USD"];
  for (const currency of currencies) {
    const pocket = view.pockets[currency];
    if (pocket.cash >= SMALL_MOVE) commands.push({ type: "wallet/move", currency, amount: SMALL_MOVE, to: "bank" });
    if (pocket.bank >= SMALL_MOVE) commands.push({ type: "wallet/move", currency, amount: SMALL_MOVE, to: "cash" });
  }
  const naira = view.pockets.NGN;
  // The most US cents a naira purchase could use: the charge only makes it less.
  const nairaCents = mulDiv(SMALL_NAIRA, 100, view.rates.USD.official);
  for (const currency of foreign) {
    const pocket = view.pockets[currency];
    if (naira.bank >= SMALL_NAIRA && view.bankAllowanceLeft >= nairaCents) {
      commands.push({ type: "wallet/convert", from: "NGN", to: currency, amount: SMALL_NAIRA, via: "bank" });
    }
    if (naira.cash >= SMALL_NAIRA) commands.push({ type: "wallet/convert", from: "NGN", to: currency, amount: SMALL_NAIRA, via: "aboki" });
    if (pocket.bank >= SMALL_FOREIGN) commands.push({ type: "wallet/convert", from: currency, to: "NGN", amount: SMALL_FOREIGN, via: "bank" });
    if (pocket.cash >= SMALL_FOREIGN) commands.push({ type: "wallet/convert", from: currency, to: "NGN", amount: SMALL_FOREIGN, via: "aboki" });
  }
  const pounds = view.pockets.GBP;
  const poundCents = mulDiv(SMALL_FOREIGN, view.rates.GBP.official, view.rates.USD.official);
  if (pounds.bank >= SMALL_FOREIGN && view.bankAllowanceLeft >= poundCents) {
    commands.push({ type: "wallet/convert", from: "GBP", to: "USD", amount: SMALL_FOREIGN, via: "bank" });
  }
  return commands;
}

function fromActivity(view: PlayerView): Loose[] {
  return view.job.id === null ? [] : [{ type: "activity/quit" }];
}

/**
 * Every legal command the sample knows how to build from this view. Commands
 * whose kind has no handler yet are left out, so the list grows as kinds land.
 */
export function legalCommands(view: PlayerView): Loose[] {
  if (view.ended) return [];
  return [...fromTurn(view), ...fromOffers(view), ...fromSetpiece(view), ...fromWallet(view), ...fromActivity(view)].filter((command) =>
    handles(command.type),
  );
}
