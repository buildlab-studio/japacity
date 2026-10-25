// An offer's terms as words need: each term that is money becomes typed money
// in the currency content pays or takes it in, so `{cost}`, `{rescue}` or
// `{hospital}` read as money and a sponsor's `{salary}` reads in pounds. The
// currency comes from the entry's own effects, never from the term's name.
import { content } from "@japacity/content";
import type { Amount, Currency, Effect, Id, OfferEntry, OfferView, ReportParam } from "@japacity/sim";

function termOf(amount: Amount | undefined): string | null {
  return amount !== undefined && typeof amount === "object" && "term" in amount ? amount.term : null;
}

/** The term an effect moves money by, with the currency it moves, or null. */
function moneyTerm(effect: Effect): [string, Currency] | null {
  if (effect.type === "money/add" || effect.type === "money/take" || effect.type === "money/pay-fee" || effect.type === "route/support") {
    const term = termOf(effect.amount);
    return term === null ? null : [term, effect.currency];
  }
  if (effect.type === "obligation/open") {
    const term = termOf(effect.principal) ?? termOf(effect.amount);
    const currency = content.obligation[effect.obligation]?.currency;
    return term === null || currency === undefined ? null : [term, currency];
  }
  return null;
}

/** The currency of the country a route flies to, for a salary a sponsor records on that route. */
function sponsorCurrency(entry: OfferEntry): Currency | null {
  for (const choice of entry.choices) {
    for (const effect of choice.effects) {
      if (effect.type !== "route/record-sponsor") continue;
      const country = content.route[effect.route]?.country;
      const currency = country === null || country === undefined ? undefined : content.country[country]?.currency;
      if (currency !== undefined) return currency;
    }
  }
  return null;
}

/** The currency a choice's money moves in: its first money effect's, or its obligation's. Null when it moves none. */
export function choiceCurrency(effects: readonly Effect[]): Currency | null {
  for (const effect of effects) {
    if (effect.type === "money/add" || effect.type === "money/take" || effect.type === "money/pay-fee") return effect.currency;
    if (effect.type === "obligation/open") return content.obligation[effect.obligation]?.currency ?? null;
  }
  return null;
}

const currencies = new Map<Id<"offer">, Map<string, Currency>>();

/** Which of an entry's terms are money, and in what currency. */
export function moneyTerms(id: Id<"offer">): Map<string, Currency> {
  const known = currencies.get(id);
  if (known !== undefined) return known;
  const found = new Map<string, Currency>();
  const entry = content.offer[id];
  if (entry !== undefined) {
    for (const choice of entry.choices) {
      for (const effect of [...choice.effects, ...(choice.fraudEffects ?? [])]) {
        const money = moneyTerm(effect);
        if (money !== null && !found.has(money[0])) found.set(money[0], money[1]);
      }
    }
    // An amount picked between two terms is money in the currency its choice pays or owes in (the study lender's pounds).
    for (const choice of entry.choices) {
      const currency = choiceCurrency(choice.effects);
      if (choice.pick === null || currency === null) continue;
      for (const term of [choice.pick.minTerm, choice.pick.maxTerm]) if (!found.has(term)) found.set(term, currency);
    }
    // abroad-money:missed-tuition-runs-in-stages: the payment plan's offer names the instalment it spreads the tuition into.
    for (const choice of entry.choices) {
      for (const effect of choice.effects) {
        const currency = effect.type === "obligation/plan" ? content.obligation[effect.obligation]?.currency : undefined;
        if (currency !== undefined && "instalment" in entry.terms && !found.has("instalment")) found.set("instalment", currency);
      }
    }
    const salary = sponsorCurrency(entry);
    if (salary !== null && "salary" in entry.terms && !found.has("salary")) found.set("salary", salary);
  }
  currencies.set(id, found);
  return found;
}

/** The terms of an open offer as params for its words: money typed, everything else as it came. */
export function offerParams(offer: Pick<OfferView, "entry" | "terms">): Record<string, ReportParam> {
  const money = moneyTerms(offer.entry);
  const params: Record<string, ReportParam> = {};
  for (const [name, value] of Object.entries(offer.terms)) {
    const currency = money.get(name);
    params[name] = typeof value === "number" && currency !== undefined ? { currency, amount: value } : value;
  }
  return params;
}
