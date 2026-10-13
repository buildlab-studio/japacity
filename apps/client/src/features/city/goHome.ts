// The bag's Go home in the room abroad (docs/rules/return.md; place.md R-PLACE-011): the world's one way home by choice.
// The card says the shape the return would take today in one line, what ends and what waits as chips (R-RETURN-006: the
// status ends and the family house takes you back; R-RETURN-002: standing moves by the shape), and the fare stands on the
// one yellow button. The engine's forecast is the only source: the client never works out a shape or a fare.
import type { PlayerView } from "@japacity/sim";

import { say } from "../../shared/words/text";
import type { Ask } from "../../shared/world/contract";

export const GO_HOME = "return/home";

/** True while the bag offers Go home: abroad with a way home forecast, in a life still running. */
export function goHomeOffered(view: Pick<PlayerView, "place" | "ended">): boolean {
  return !view.ended && view.place.where === "abroad" && view.place.wayHome !== null;
}

/** The standing chip by the move the shape brings on the day (R-RETURN-002), in words, never the figure (R-TEXT-005). */
function standingWords(standing: number): string {
  return say(standing > 0 ? "ui.world.go-home.standing.up" : standing < 0 ? "ui.world.go-home.standing.down" : "ui.world.go-home.standing.same");
}

/** The card, or null when there is no way home to forecast (not abroad). */
export function goHomeAsk(view: Pick<PlayerView, "place" | "ended">, hands: { who: string; go: () => void; dismiss: () => void }): Ask | null {
  const home = view.place.wayHome;
  if (home === null || view.place.where !== "abroad") return null;
  const { fare, offPeak, paidFrom, naira, shape, standing } = home;
  const assisted = shape === "assisted";
  const december = fare.amount > offPeak.amount;
  // The assisted ticket is the agency's; any other return pays the fare here, or buys it from naira (R-PLACE-011).
  const cost = assisted || shape === null ? null : paidFrom === "naira" ? { amount: naira, currency: "NGN" } : { amount: fare.amount, currency: fare.currency };
  const blocked = shape === null ? say("ui.world.go-home.none") : !assisted && paidFrom === null ? say("ui.world.go-home.short") : undefined;
  const facts = shape === null ? [] : [say("ui.world.go-home.status"), say("ui.world.go-home.family"), standingWords(standing), ...(december && !assisted ? [say("ui.world.go-home.december")] : [])];
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
    button: say(assisted ? "ui.world.go-home.button.assisted" : "ui.world.go-home"),
    act: hands.go,
    dismiss: hands.dismiss,
  };
}
