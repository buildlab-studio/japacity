import { shareKinds, text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import pageFile from "../../../public/official/index.html?raw";
import { fakeCanvas } from "../../shared/card/fakeCanvas";
import { recordedGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { gallery } from "./gallery";
import { listedAccounts, officialPage } from "./official";
import { CardView } from "./ShareCard";

type Shared = NonNullable<PlayerView["card"]>;

/** Ada just flown, with her card swapped for the kind under test. */
function adaWith(kind: Shared["kind"]): PlayerView {
  const view = recordedGame("ada-careful").view();
  if (view.card === null) throw new Error("Ada's recorded life has no card.");
  return { ...view, card: { ...view.card, kind, ...(kind === "chapter" ? { chapter: "chapter.landing" as const } : {}) } };
}

/** A phone's share sheet that takes files, watched. */
function phoneShare() {
  const share = vi.fn<(data: ShareData) => Promise<void>>(() => Promise.resolve());
  Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
  Object.defineProperty(navigator, "share", { configurable: true, value: share });
  return share;
}

beforeEach(() => {
  gallery.getState().clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "canShare");
  Reflect.deleteProperty(navigator, "share");
});

describe("a card for every moment", () => {
  test("[R-SHARE-001] [R-SHARE-015] given each kind of card the view carries, when it is due, then it opens with the kind's title and a tile names it, the send-off from its tile", async () => {
    for (const kind of shareKinds) {
      const { store } = await renderWithView(<CardView />, adaWith(kind));
      // R-SHARE-015: the send-off opens from its tile (that it never opens on its own is SendOffKeepsake.test.tsx's).
      if (kind === "send-off") fireEvent.click(screen.getByRole("button", { name: say("ui.card.open") }));
      const sheet = await screen.findByRole("dialog");
      const face = sheet.querySelector(`[data-share-card='${kind}']`) as HTMLElement;
      expect(face).not.toBeNull();
      expect(face.textContent).toContain(text[`share.${kind}.title`]);
      expect(face.textContent).toContain("Japacity is a game.");
      act(() => store.getState().closeCard(`${kind}-${String(store.getState().view!.card!.months)}`));
      expect(screen.getByText(say(`share.${kind}.ready`))).toBeDefined();
      cleanup();
    }
  });

  test("[R-SHARE-002] given the ending card, when it shows, then it has no share button and says it is for the player alone", async () => {
    await renderWithView(<CardView />, adaWith("lost"));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).queryByRole("button", { name: say("share.button.share") })).toBeNull();
    expect(within(sheet).queryByRole("button", { name: say("share.button.save") })).toBeNull();
    expect(within(sheet).getByText(say("share.not-shareable"))).toBeDefined();
  });

  test("[R-SHARE-003] given a card due on a phone, when it opens, then nothing is shared until the player taps, and one tap shares it once", async () => {
    const share = phoneShare();
    fakeCanvas(() => 1000);
    await renderWithView(<CardView />, adaWith("granted"));
    const sheet = await screen.findByRole("dialog");
    expect(share).not.toHaveBeenCalled();
    fireEvent.click(within(sheet).getByRole("button", { name: say("share.button.share") }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const data = share.mock.calls[0]![0];
    expect(data.files?.[0]?.type).toBe("image/jpeg");
    expect(data.url).toBe("https://japacity.app/?card=granted");
    expect(await within(sheet).findByText(say("share.done.shared"))).toBeDefined();
  });

  test("[R-SHARE-009] given a browser with no share sheet, when the player taps, then the card is saved as a file", async () => {
    fakeCanvas(() => 1000);
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: () => "blob:card" });
    await renderWithView(<CardView />, adaWith("december"));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: say("share.button.save") }));
    expect(await within(sheet).findByText(say("share.done.saved"))).toBeDefined();
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  test("[R-SHARE-009] given a card the renderer refuses, when the player taps, then the card is not sent and a screenshot is suggested", async () => {
    const share = phoneShare();
    fakeCanvas(() => Number.MAX_SAFE_INTEGER);
    await renderWithView(<CardView />, adaWith("secured"));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: say("share.button.share") }));
    expect(await within(sheet).findByText(say("share.failed"))).toBeDefined();
    expect(share).not.toHaveBeenCalled();
  });

  test("[R-SHARE-011] given a card closed, when its month has passed, then it is kept on this device in the gallery, nothing is fetched, and it opens again from there", async () => {
    const fetched = vi.spyOn(globalThis, "fetch");
    const view = adaWith("first-pay-abroad");
    const { store } = await renderWithView(<CardView />, view);
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: say("ui.report.close") }));
    act(() => store.setState({ view: { ...view, v: view.v + 1, month: view.month + 1, card: null } }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: say("share.gallery.open") }));
    const list = await screen.findByRole("dialog");
    fireEvent.click(within(list).getByRole("button", { name: new RegExp(say("share.first-pay-abroad.title")) }));
    expect(list.querySelector("[data-share-card='first-pay-abroad']")).not.toBeNull();
    expect(JSON.parse(localStorage.getItem("japacity.cards") ?? "[]")).toHaveLength(1);
    expect(fetched).not.toHaveBeenCalled();
  });

  test("[R-SHARE-011] given the same card closed twice, then the gallery keeps it once", async () => {
    const view = adaWith("send-off");
    await renderWithView(<CardView />, view);
    // R-SHARE-015: the send-off is no screen of its own; it opens from the tile where the phone keeps it.
    fireEvent.click(await screen.findByRole("button", { name: say("ui.card.open") }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: say("ui.report.close") }));
    gallery.getState().keep(view.scenario, view.card!);
    expect(gallery.getState().kept).toHaveLength(1);
  });

  test("[R-SHARE-014] given any card on screen, then it points to the official accounts page", async () => {
    await renderWithView(<CardView />, adaWith("draw-win"));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("Official accounts: japacity.app/official")).toBeDefined();
  });
});

describe("the official accounts page", () => {
  test("[R-SHARE-012] given the page at /official, then it is the page built from content's words, listing every claimed account and nothing else", () => {
    expect(pageFile).toBe(officialPage());
    const page = new DOMParser().parseFromString(pageFile, "text/html");
    const listed = [...page.querySelectorAll("[data-accounts] a")].map((link) => link.textContent);
    expect(listed).toEqual(listedAccounts().map((account) => account.address));
    const hrefs = new Set([...page.querySelectorAll("a")].map((link) => link.getAttribute("href")));
    expect([...hrefs].sort()).toEqual(["https://japacity.app", "https://github.com/buildlab-studio/japacity", "mailto:social@japacity.app"].sort());
    expect(page.querySelectorAll("script, img, iframe, form")).toHaveLength(0);
  });

  test("[R-SHARE-013] given the page, then it says what the game never does and where to report an account pretending to be it", () => {
    const page = new DOMParser().parseFromString(pageFile, "text/html");
    const never = [...page.querySelectorAll("[data-never] li")].map((item) => item.textContent);
    expect(never).toEqual(["money", "turns", "prize", "advert", "agents"].map((item) => text[`share.official.never.${item}`]));
    expect(page.querySelector("[data-report]")?.textContent).toBe(say("share.official.report", { email: "social@japacity.app" }));
  });
});
