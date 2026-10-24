// The bag's Go home in the room abroad (docs/rules/return.md; place:view-carries-way-home): the world's one way home by choice.
// The card says the shape the return would take today in one line, what ends and what waits as chips (return:return-reopens-home-charges: the
// status ends and the family house takes you back; return:standing-by-return-shape: standing moves by the shape), and the fare stands on the
// one yellow button. On an overstay the card says the ban the way would bring in words (place:leaving-an-overstay-bans) and the UAE's fine
// as money, and where the status has the returns service it is a second, quiet way with its own line, asked once more before
// it goes (place:returns-service-takes-you-home, world:costly-acts-confirmed). The engine's forecast is the only source: the client never
// works out a shape, a fare or a ban.
import type { PlayerView } from "@japacity/sim";

import { formatMoney } from "../../../shared/words/format";
import { keptOnGoingHome } from "../../../shared/words/kept";
import { say } from "../../../shared/words/text";
import type { Ask } from "../../../shared/world/contract";

export const GO_HOME = "return/home";

/** True while the bag offers Go home: abroad with a way home forecast, in a life still running. */
export function goHomeOffered(view: Pick<PlayerView, "place" | "ended">): boolean {
  return !view.ended && view.place.where === "abroad" && view.place.wayHome !== null;
}

/** The standing chip by the move the shape brings on the day (return:standing-by-return-shape), in words, never the figure (text:bands-not-figures). */
function standingWords(standing: number): string {
  return say(standing > 0 ? "ui.world.go-home.standing.up" : standing < 0 ? "ui.world.go-home.standing.down" : "ui.world.go-home.standing.same");
}

/** The ban a way home would bring, in words: none, or when the life may come back (place:leaving-an-overstay-bans). */
function banWords(months: number): string {
  return months === 0 ? say("ui.world.go-home.ban.none") : say("ui.world.go-home.ban", { months });
}

/** What an overstay adds to the card's chips: the ban the way would bring, and the UAE's fine within the fare or carried home. */
function overstayFacts(view: Pick<PlayerView, "status">, home: NonNullable<PlayerView["place"]["wayHome"]>): string[] {
  const overstay = view.status?.overstay ?? null;
  if (overstay === null || home.shape === null) return [];
  const fine =
    home.fine !== null && home.fine.amount > 0
      ? [say("ui.world.go-home.fine", { fine: formatMoney(home.fine.amount, home.fine.currency) })]
      : home.shape === "assisted" && overstay.fine !== null && overstay.fine.amount > 0
        ? [say("ui.world.go-home.fine-home", { fine: formatMoney(overstay.fine.amount, overstay.fine.currency) })]
        : [];
  return [banWords(home.banMonths), ...fine];
}

/** The returns service as the card's second way, where the status has one and the main way is not already it (place:returns-service-takes-you-home). */
function schemeWay(home: NonNullable<PlayerView["place"]["wayHome"]>, act: () => void): Ask["other"] {
  const scheme = home.scheme;
  if (scheme === null || home.shape === "assisted") return undefined;
  const grant = formatMoney(scheme.grant.amount, scheme.grant.currency);
  return {
    button: say("ui.world.go-home.scheme"),
    line: say("ui.world.go-home.scheme.line", { grant, months: scheme.banMonths }),
    sure: { line: say("ui.world.go-home.scheme.sure", { months: scheme.banMonths }), keep: say("ui.world.go-home.scheme.keep"), go: say("ui.world.go-home.scheme.go") },
    act,
  };
}

/**
 * The card, or null when there is no way home to forecast (not abroad). `scheme` sends the return by the returns service; `beganAt`, when the life
 * began, names the month a kept status runs to, read from the clock when it is not given.
 */
export function goHomeAsk(
  view: Pick<PlayerView, "place" | "ended" | "status" | "month">,
  hands: { who: string; go: () => void; scheme?: () => void; dismiss: () => void; beganAt?: number },
): Ask | null {
  const home = view.place.wayHome;
  if (home === null || view.place.where !== "abroad") return null;
  const { fare, offPeak, paidFrom, naira, shape, standing } = home;
  const assisted = shape === "assisted";
  const december = fare.amount > offPeak.amount;
  // The assisted ticket is the agency's; any other return pays the fare here, or buys it from naira (place:view-carries-way-home).
  const cost = assisted || shape === null ? null : paidFrom === "naira" ? { amount: naira, currency: "NGN" } : { amount: fare.amount, currency: fare.currency };
  const blocked = shape === null ? say("ui.world.go-home.none") : !assisted && paidFrom === null ? say("ui.world.go-home.short") : undefined;
  // return:papers-return-keeps-status: a return with papers keeps the status, so the card says what it keeps in place of the status ending.
  const status = shape === "with-papers" ? keptOnGoingHome(view, hands.beganAt ?? Date.now()) : [say("ui.world.go-home.status")];
  const facts = shape === null ? [] : [...status, say("ui.world.go-home.family"), standingWords(standing), ...overstayFacts(view, home), ...(december && !assisted ? [say("ui.world.go-home.december")] : [])];
  const other = hands.scheme === undefined ? undefined : schemeWay(home, hands.scheme);
  return {
    form: "card",
    icon: "plane",
    who: hands.who,
    title: say(assisted ? "ui.world.go-home.title.assisted" : "ui.world.go-home"),
    line: say(`ui.world.go-home.line.${shape ?? "none"}`),
    cost,
    when: "now",
    ...(cost === null ? {} : { priced: true as const }),
    ...(blocked === undefined ? {} : { blocked }),
    ...(facts.length === 0 ? {} : { facts }),
    // return:return-reopens-home-charges: the bills abroad close on the way home, so the month's dues there are no warning on the button.
    dues: false,
    button: say(assisted ? "ui.world.go-home.button.assisted" : "ui.world.go-home"),
    act: hands.go,
    dismiss: hands.dismiss,
    ...(other === undefined ? {} : { other }),
  };
}
