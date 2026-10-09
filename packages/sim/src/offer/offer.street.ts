// The price of sleeping under the bridge: docs/rules/streets.md R-STREET-004.
// Three bad offers of the life group, each opening only in a month the
// character slept rough. Their chance reads the month's played activities and
// never money (luck.md R-LUCK-001); the content check below holds them to it.
import type { Content, Ctx, Id, OfferEntry, Requirement, Terms } from "../engine/types";

export const SLEEP_ROUGH: Id<"activity"> = "activity.sleep-rough";
export const BRIDGE_THEFT: Id<"offer"> = "offer.bridge-theft";
export const BRIDGE_MOSQUITOES: Id<"offer"> = "offer.bridge-mosquitoes";
export const BRIDGE_NIGHT: Id<"offer"> = "offer.bridge-night";
/** The bridge's price, each entry drawn on its own (R-STREET-004). */
export const BRIDGE_OFFERS: readonly Id<"offer">[] = [BRIDGE_THEFT, BRIDGE_MOSQUITOES, BRIDGE_NIGHT];

/** The requirement types that read money held or money moved. */
const MONEY: readonly Requirement["type"][] = ["money/min", "money/can-pay", "wallet/total"];

function flatten(requirements: readonly Requirement[]): Requirement[] {
  return requirements.flatMap((requirement): Requirement[] => {
    if (requirement.type === "not") return [requirement, ...flatten([requirement.of])];
    if (requirement.type === "any") return [requirement, ...flatten(requirement.of)];
    return [requirement];
  });
}

/** The words key the night is told by: R-STREET-009 reads the scenario's sex, and a life that does not say takes the neutral line. */
export function nightLine(content: Content, scenario: Id<"scenario">): string {
  const sex = content.scenario[scenario]?.sex;
  if (sex === "f") return `${BRIDGE_NIGHT}.woman`;
  if (sex === "m") return `${BRIDGE_NIGHT}.man`;
  return `${BRIDGE_NIGHT}.anyone`;
}

/**
 * What the bridge's offers carry when they open. The theft happens in the
 * night it is drawn for: the cash goes as the offer opens, all or nothing
 * (R-WALLET-001), so it cannot be dodged by moving the cash to the bank before
 * answering; its term says which line tells it. The night's term names the
 * line for the character's sex. The words resolve a term that names a key
 * through that key's `.name`, so the interface needs no knowledge of either.
 */
export function bridgeTerms(ctx: Ctx, entry: OfferEntry): Terms {
  if (entry.id === BRIDGE_NIGHT) return { night: nightLine(ctx.content, ctx.state.scenario) };
  if (entry.id !== BRIDGE_THEFT) return {};
  const amount = ctx.content.tuning.street.theftNaira;
  const taken = ctx.state.wallet.pockets.NGN.cash >= amount;
  if (taken) ctx.apply([{ type: "money/take", currency: "NGN", pocket: "cash", amount, reason: "mishap" }], { source: entry.id, param: null, terms: {} });
  return { lost: taken ? `${BRIDGE_THEFT}.taken` : `${BRIDGE_THEFT}.nothing` };
}

/**
 * R-STREET-004 for `checkContent`: each of the bridge's offers in content is a
 * bad offer of the life group, opens only in a month the character slept rough,
 * and never reads money, directly or inside `not` or `any`.
 */
export function bridgeProblems(content: Content): string[] {
  const problems: string[] = [];
  for (const id of BRIDGE_OFFERS) {
    const entry = content.offer[id];
    if (entry === undefined) continue;
    const when = flatten(entry.when);
    if (when.some((requirement) => MONEY.includes(requirement.type))) problems.push(`${id}: the bridge's price reads money (R-STREET-004, R-LUCK-001).`);
    if (!entry.when.some((requirement) => requirement.type === "activity/played" && requirement.activity === SLEEP_ROUGH)) {
      problems.push(`${id}: opens in a month the character did not sleep rough (R-STREET-004).`);
    }
    if (entry.group !== "life" || entry.bad !== true) problems.push(`${id}: is not a bad offer of the life group (R-STREET-004).`);
  }
  return problems;
}
