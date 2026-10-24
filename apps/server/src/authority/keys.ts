// server:commands-only-through-route: the keys each command type has, beside `type` and `basedOn`. A key a
// command's type does not have is never read by the simulation, and an accepted command is logged as it came, so
// the route keeps only these: nothing else reaches the log. The types check the table both ways: a key the type
// lacks does not compile, and neither does a type with a key left out.
import type { Command, CommandType } from "@japacity/sim";

type OwnKey<T extends CommandType> = Exclude<keyof Extract<Command, { type: T }>, "type" | "basedOn">;

type KeyTable = { readonly [T in CommandType]: readonly OwnKey<T>[] };

const KEYS = {
  "turn/end": ["slots"],
  "activity/quit": ["side"],
  "activity/now": ["activity", "param"],
  "offer/choose": ["offer", "choice", "amount"],
  "wallet/convert": ["from", "to", "amount", "via"],
  "wallet/move": ["currency", "amount", "to"],
  "obligation/pay": ["obligation", "amount"],
  "route/pay-deposit": ["route", "school"],
  "route/depart": ["route"],
  "setpiece/answer": ["question", "answer"],
  "turns/grant": ["count"],
  "wallet/remit": ["currency", "amount", "channel"],
  "prologue/choose": ["step", "answer"],
  "status/renew": [],
  "return/home": ["scheme"],
  "place/ride": ["from", "to", "way"],
  "lottery/buy": ["tickets"],
  "lottery/pay": ["draw", "prizes"],
  "wallet/top-up": ["amount"],
  "people/invite": ["slot", "looking", "fill"],
  "people/court": ["with"],
  "people/propose": ["bond", "step", "route", "lead"],
  "people/answer": ["bond", "step", "yes"],
  "people/withdraw": ["bond"],
  "people/consent": ["bond", "countFunds", "standInMay"],
  "people/end": ["bond"],
  "people/link": ["slot", "pair", "facts"],
  "people/facts": ["pair", "facts"],
  "people/moments": ["pair", "moments"],
  "people/proposal": ["pair", "proposal"],
  "people/agreed": ["pair", "step", "route", "lead"],
  "people/ended": ["pair", "why"],
  "people/declined": ["pair", "step"],
  "people/withdrawn": ["pair", "step"],
  "people/gossip": ["pair"],
  "people/stand-in": ["pair", "stage"],
  "people/family-request": ["offer", "terms", "handled"],
  "interview/answer": ["question", "option"],
  "interview/open": ["pair", "route", "questions", "thin"],
  "interview/scored": ["pair", "theirs"],
  "home/move": ["to"],
  "home/host": ["pair", "until"],
  "thing/buy": ["thing"],
  "thing/sell": ["thing"],
  "chapter/lean": ["route"],
} as const satisfies KeyTable;

type Missing = { [T in CommandType]: Exclude<OwnKey<T>, (typeof KEYS)[T][number]> }[CommandType];

/** Compiles only while no command type has a key the table leaves out. */
const EVERY_KEY_LISTED: [Missing] extends [never] ? true : Missing = true;
void EVERY_KEY_LISTED;

/**
 * server:commands-only-through-route: the command with only its type's own keys, `type` and `basedOn`. A type no
 * command has keeps only those two; the simulation refuses it.
 */
export function ownKeys(command: Record<string, unknown>): Record<string, unknown> {
  const type = command.type;
  const keys: readonly string[] = typeof type === "string" && Object.hasOwn(KEYS, type) ? KEYS[type as CommandType] : [];
  const kept: Record<string, unknown> = {};
  for (const key of ["type", "basedOn", ...keys]) if (Object.hasOwn(command, key)) kept[key] = command[key];
  return kept;
}
