import type { PlayerView } from "@japacity/sim";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { nameOf, say, words } from "../../shared/words/text";
import { EndingView } from "./EndingView";
import { CardView, ShareCardFace } from "./ShareCard";

type Shared = NonNullable<PlayerView["card"]>;

const SEND_OFF: Shared = {
  kind: "send-off",
  route: "route.uk-masters",
  percent: 82,
  months: 35,
  standing: 61,
  topActivities: ["activity.learn-tech", "activity.build-portfolio", "activity.study-english"],
};

function withCard(card: Shared, ended = false): PlayerView {
  return { ...abroadView(), card, ended };
}

// The send-off and real-story rules are still pending in the rule list until the chapter and road kinds make the card.
describe("the share cards", () => {
  test("given the send-off card, then the route, the japacity figure, the months, the standing and the three things done most show, with the game named as the sender", () => {
    render(<ShareCardFace card={SEND_OFF} />);
    const card = document.querySelector("[data-share-card='send-off']") as HTMLElement;
    expect(within(card).getByText(words("chapter.send-off.title"))).toBeDefined();
    expect(within(card).getByText(nameOf("route.uk-masters"))).toBeDefined();
    expect(card.textContent).toContain("82%");
    expect(within(card).getByText("35")).toBeDefined();
    expect(within(card).getByText("61")).toBeDefined();
    for (const id of SEND_OFF.topActivities) expect(within(card).getByText(nameOf(id))).toBeDefined();
    expect(within(card).getByText(say("ui.card.is-a-game"))).toBeDefined();
    expect(within(card).getByText(say("ui.game"))).toBeDefined();
  });

  test("given any card, then it is drawn in type alone, with no picture, and says Japacity is a game", () => {
    for (const kind of ["send-off", "real-story", "lost"] as const) {
      const { container, unmount } = render(<ShareCardFace card={{ ...SEND_OFF, kind }} />);
      expect(container.querySelector("img, picture, canvas, video")).toBeNull();
      expect(container.textContent).toContain(say("ui.card.is-a-game"));
      expect(container.querySelector("article")?.className).toContain("aspect-[9/16]");
      unmount();
    }
  });

  test("given a card due, then it opens full screen on its own, and once closed the tile opens it again", async () => {
    await renderWithView(<CardView />, withCard(SEND_OFF));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText(say("ui.card.how"))).toBeDefined();
    fireEvent.click(within(sheet).getByRole("button", { name: say("ui.report.close") }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("ui.card.open") }));
    expect(await screen.findByRole("dialog")).toBeDefined();
  });

  test("given a life lost on the road, then the ending card and the real-story card are all there is", async () => {
    await renderWithView(<EndingView />, withCard({ ...SEND_OFF, kind: "lost", route: "route.road", percent: null }, true));
    expect(document.querySelector("[data-share-card='lost']")).not.toBeNull();
    expect(document.querySelector("[data-share-card='real-story']")).not.toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
