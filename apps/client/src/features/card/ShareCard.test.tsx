import { text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { playedWords, standingWords } from "../../shared/card/face";
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
  chapter: null,
  name: null,
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
    expect(within(card).getByText(playedWords(35))).toBeDefined();
    expect(within(card).getByText(standingWords(61))).toBeDefined();
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
    // R-SHARE-015: the send-off does not open on its own (SendOffKeepsake.test.tsx); a granted card still does.
    await renderWithView(<CardView />, withCard({ ...SEND_OFF, kind: "granted" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText(say("ui.card.how"))).toBeDefined();
    fireEvent.click(within(sheet).getByRole("button", { name: say("ui.report.close") }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("ui.card.open") }));
    expect(await screen.findByRole("dialog")).toBeDefined();
  });

  test("[R-SHARE-004] [R-SHARE-003] given a card opened over the world, then it names the character as the band does, and its share, the screenshot's hint and Close stand together on a ground of their own at the foot of a sheet that scrolls within the screen", async () => {
    // The catalog's pictures 141, 168 and 169 (1b952f4b): the card said "Ada" under a band that said "Adaeze"; the picker
    // stood above the screen's top and the hint and Close were printed over the phone's icons with nothing behind them.
    const view = withCard({ ...SEND_OFF, kind: "granted" });
    await renderWithView(<CardView />, view);
    const sheet = await screen.findByRole("dialog");
    const band = (text[`${view.scenario}.name`] ?? "").split(/\s+/)[0]!;
    expect(band).not.toBe("");
    expect(within(sheet).getByText(band, { selector: "[data-card-name]" })).toBeDefined();
    const foot = sheet.querySelector<HTMLElement>("[data-card-foot]")!;
    expect(foot.className).toContain("bg-sheet");
    expect(foot.className).toContain("sticky");
    expect(within(foot).getByText(say("ui.card.how"))).toBeDefined();
    expect(within(foot).getByRole("button", { name: say("ui.report.close") })).toBeDefined();
    expect(foot.querySelector("[data-share-button]")).not.toBeNull();
    const scroller = sheet.querySelector<HTMLElement>("[data-card-screen]")!;
    expect(scroller.className).toContain("max-h-full");
    expect(scroller.className).toContain("overflow-y-auto");
  });

  test("given a life lost on the road, then the ending card and the real-story card are all there is", async () => {
    await renderWithView(<EndingView />, withCard({ ...SEND_OFF, kind: "lost", route: "route.road", percent: null }, true));
    expect(document.querySelector("[data-share-card='lost']")).not.toBeNull();
    expect(document.querySelector("[data-share-card='real-story']")).not.toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("the seal on a card", () => {
  test("[R-SHARE-006] given any card on screen, then the seal stands in its footer before the game's name as a picture behind an empty box, with no image element", () => {
    for (const kind of ["send-off", "real-story", "lost"] as const) {
      const { container, unmount } = render(<ShareCardFace card={{ ...SEND_OFF, kind }} />);
      const seal = container.querySelector("[data-seal]") as HTMLElement;
      expect(seal.style.backgroundImage).toMatch(/brand\/japacity-mark-small-light\.svg/);
      expect(seal.getAttribute("aria-hidden")).toBe("true");
      const name = container.querySelector("[data-word-mark]") as HTMLElement;
      expect(seal.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(container.querySelector("img")).toBeNull();
      unmount();
    }
  });
});
