// A bounded sample of legal commands, read from the view alone. One small
// function per kind; a kind agent extends its own. Random play draws from
// this list, so everything here must be accepted by step when the view says so.
import { handles } from "../engine/step";
import type { PlayerView, SlotPick } from "../engine/types";
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

function fromWallet(view: PlayerView): Loose[] {
  const commands: Loose[] = [];
  const naira = view.pockets.NGN;
  if (naira.cash >= 100) commands.push({ type: "wallet/move", currency: "NGN", amount: 100, to: "bank" });
  if (naira.bank >= 100) commands.push({ type: "wallet/move", currency: "NGN", amount: 100, to: "cash" });
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
