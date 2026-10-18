import type { OfferView as Offer, PlayerView, ReportLine } from "@japacity/sim";
import { fireEvent, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say, words } from "../../shared/words/text";
import { ASK, EXIT_OFFER, RoadView } from "./RoadView";

function line(key: string, params: ReportLine["params"] = {}): ReportLine {
  return { key, params, tone: "plain", attention: false, counts: [] };
}

function offer(id: string, entry: Offer["entry"], choices: string[]): Offer {
  return { id, entry, openedMonth: 30, expiresMonth: 31, terms: {}, signs: [], choices: choices.map((choice) => ({ id: choice, allowed: true, pick: null })) };
}

const RANSOM = offer("offer-7", "offer.road-ransom-call", ["pay", "cannot"]);
const FAMILY = offer("offer-8", "offer.mum-shop", ["give", "half"]);

/** A hand-built month on the road: until the simulation opens the exit offer, these views are made here. */
function onTheRoad(offers: Offer[]): PlayerView {
  const base = engineView("scenario.tunde");
  return {
    ...base,
    month: 30,
    place: { ...base.place, where: "road" },
    offers,
    report: {
      month: 30,
      lines: [
        line("line.route.road-held"),
        line("line.news.delivered", { story: "news.era-calm", stage: "announced", forYou: 1 }),
        line("line.offer.opened", { offer: "offer.mum-shop" }),
        line("line.offer.opened", { offer: "offer.road-ransom-call" }),
        line("line.route.heard", { route: "route.canada-points" }),
      ],
      japacityBefore: null,
      japacityAfter: null,
      attention: false,
    },
  };
}

/** The shell hands in the offer screen; here a plain list of the titles it is given stands in for it. */
function road(view: PlayerView, city: ReactNode = null) {
  const offers = (only: (offer: Offer) => boolean) => (
    <ul>
      {view.offers.filter(only).map((open) => (
        <li key={open.id}>
          <h3>{words(`${open.entry}.title`)}</h3>
        </li>
      ))}
    </ul>
  );
  return renderWithView(<RoadView offers={offers} city={city} />, view);
}

describe("the road's one panel", () => {
  test("[world:top-band-is-lively-pill] given the month's report on the road, when the screen is read, then its heading names the month on the road and no running month number shows", async () => {
    await road(onTheRoad([offer("offer-9", EXIT_OFFER, [ASK])]));
    expect(screen.getByRole("heading", { name: say("ui.road.month-done") })).toBeDefined();
    expect(document.body.textContent).not.toMatch(/Month \d+/);
  });

  test("[road:exit-is-assisted-return] given the exit offer open, when the player asks to be let go, then offer/choose is sent with ask, beside waiting a month", async () => {
    const { authority } = await road(onTheRoad([offer("offer-9", EXIT_OFFER, [ASK])]));
    const exit = document.querySelector<HTMLElement>("[data-road-exit]");
    if (exit === null) throw new Error("No exit panel.");
    const ask = within(exit).getByRole("button", { name: say("ui.road.ask") });
    expect(within(exit).getByRole("button", { name: say("ui.road.wait") })).toBeDefined();
    fireEvent.click(ask);
    expect(authority.sent.at(-1)).toMatchObject({ type: "offer/choose", offer: "offer-9", choice: ASK });
  });

  test("[road:exit-is-assisted-return] given no exit offer yet, when a road offer that can be answered by asking is open, then that offer is the exit", async () => {
    const { authority } = await road(onTheRoad([offer("offer-10", "offer.road-ransom-call", ["pay", "cannot", ASK])]));
    fireEvent.click(screen.getByRole("button", { name: say("ui.road.ask") }));
    expect(authority.sent.at(-1)).toMatchObject({ type: "offer/choose", offer: "offer-10", choice: ASK });
  });

  test("[road:exit-is-assisted-return] given nothing on the road to ask, then the exit is told in words and only waiting is offered", async () => {
    await road(onTheRoad([RANSOM]));
    expect(screen.queryByRole("button", { name: say("ui.road.ask") })).toBeNull();
    expect(screen.getByRole("button", { name: say("ui.road.wait") })).toBeDefined();
    expect(screen.getByText(say("ui.road.exit-help"))).toBeDefined();
  });

  test("[road:road-earns-nothing] given a family request, Lagos news and talk of routes in the month, then on the road only the chain's own lines and offers show", async () => {
    await road(onTheRoad([RANSOM, FAMILY]));
    expect(screen.getByRole("heading", { name: words("offer.road-ransom-call.title") })).toBeDefined();
    expect(screen.queryByRole("heading", { name: words("offer.mum-shop.title") })).toBeNull();
    expect(screen.getByText(words("line.route.road-held"))).toBeDefined();
    expect(screen.getByText(words("line.offer.opened", { offer: "offer.road-ransom-call" }))).toBeDefined();
    expect(screen.queryByText(words("line.offer.opened", { offer: "offer.mum-shop" }))).toBeNull();
    expect(screen.queryByText(words("line.news.delivered", { story: "news.era-calm", stage: "announced", forYou: 1 }))).toBeNull();
    expect(screen.queryByText(words("line.route.heard", { route: "route.canada-points" }))).toBeNull();
  });
});

describe("the city behind the road", () => {
  test("[city:enterable-places-follow-view] given the character on the road, when the road screen shows, then the city the shell hands in stands behind its panel", async () => {
    await road(onTheRoad([RANSOM]), <div data-city="place.motor-park" />);
    expect(document.querySelector("[data-road] [data-city]")).not.toBeNull();
  });
});
