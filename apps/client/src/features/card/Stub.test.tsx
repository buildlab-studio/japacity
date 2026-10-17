// The ticket stub beside the send-off card (docs/rules/share.md R-SHARE-001, R-SHARE-003, R-SHARE-004,
// R-SHARE-009, R-SHARE-011; decision 0024): the player picks which of the two to share, one tap shares
// the one picked, and the type read at the send-off is kept with the card for the gallery and the data page.
import { content, text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { playedWords } from "../../shared/card/face";
import { fakeCanvas } from "../../shared/card/fakeCanvas";
import { recordedGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { japaTypeOf, typeWords } from "../../shared/words/japaType";
import { say } from "../../shared/words/text";
import { keptTypeOf } from "../../shared/card/kept";
import { gallery } from "./gallery";
import { CardView } from "./ShareCard";

const tuning = content.tuning.share;

function adaSendOff(): PlayerView {
  const view = recordedGame("ada-careful").view();
  if (view.card?.kind !== "send-off") throw new Error("Ada's recorded life does not end at the send-off.");
  return view;
}

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

describe("the ticket stub beside the send-off card", () => {
  test("[R-SHARE-001] [R-SHARE-004] [R-SHARE-015] given Ada just flown, when her send-off opens from its tile, then the card shows first, and the stub beside it carries FROM Lagos, TO the country, the months, the figure, her type and her name as the band says it", async () => {
    const view = adaSendOff();
    await renderWithView(<CardView />, view);
    // R-SHARE-015: the send-off is no screen of its own; it opens from the tile where the phone keeps it.
    fireEvent.click(await screen.findByRole("button", { name: say("ui.card.open") }));
    const sheet = await screen.findByRole("dialog");
    expect(sheet.querySelector("[data-share-card='send-off']")).not.toBeNull();
    const pickStub = within(sheet).getByRole("button", { name: say("share.stub.pick.stub") });
    expect(pickStub.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(pickStub);
    expect(pickStub.getAttribute("aria-pressed")).toBe("true");
    const stub = sheet.querySelector("[data-share-card='stub']") as HTMLElement;
    expect(sheet.querySelector("[data-share-card='send-off']")).toBeNull();
    // Her name as the band says it, the first word of the life's own name (R-SHARE-004).
    const band = (text["scenario.ada.name"] ?? "").split(/\s+/)[0]!;
    for (const words of ["Lagos", text["country.uk.name"]!, playedWords(view.card!.months), `${String(view.card!.percent)}%`, typeWords(japaTypeOf(view)!).name, typeWords(japaTypeOf(view)!).line, band, "Japacity is a game.", "japacity.app"]) {
      expect(within(stub).getByText(words)).toBeDefined();
    }
    fireEvent.click(within(sheet).getByRole("button", { name: say("share.stub.pick.card") }));
    expect(sheet.querySelector("[data-share-card='send-off']")).not.toBeNull();
  });

  test("[R-SHARE-001] given any card but the send-off, when it opens, then no stub is offered", async () => {
    const view = adaSendOff();
    await renderWithView(<CardView />, { ...view, card: { ...view.card!, kind: "granted" } });
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).queryByRole("button", { name: say("share.stub.pick.stub") })).toBeNull();
    expect(sheet.querySelector("[data-card-pick]")).toBeNull();
  });

  test("[R-SHARE-003] [R-SHARE-009] given the stub picked on a phone, when the player taps share once, then one landscape picture goes to the share sheet; given the card picked, then the portrait one", async () => {
    const share = phoneShare();
    const drawn = fakeCanvas(() => 1000);
    await renderWithView(<CardView />, adaSendOff());
    // R-SHARE-015: the send-off is no screen of its own; it opens from the tile where the phone keeps it.
    fireEvent.click(await screen.findByRole("button", { name: say("ui.card.open") }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: say("share.stub.pick.stub") }));
    expect(share).not.toHaveBeenCalled();
    fireEvent.click(within(sheet).getByRole("button", { name: say("share.button.share") }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share.mock.calls[0]![0].files?.[0]?.type).toBe("image/jpeg");
    expect(drawn.sizes.at(-1)).toEqual({ width: tuning.height, height: tuning.width });
    fireEvent.click(within(sheet).getByRole("button", { name: say("share.stub.pick.card") }));
    fireEvent.click(within(sheet).getByRole("button", { name: say("share.button.share") }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    expect(drawn.sizes.at(-1)).toEqual({ width: tuning.width, height: tuning.height });
  });

  test("[R-SHARE-011] given the send-off closed, then its type is kept with it on this device, the data page can read it, and the gallery offers the stub again with the type", async () => {
    const view = adaSendOff();
    const { store } = await renderWithView(<CardView />, view);
    // R-SHARE-015: the send-off is no screen of its own; it opens from the tile where the phone keeps it.
    fireEvent.click(await screen.findByRole("button", { name: say("ui.card.open") }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: say("ui.report.close") }));
    expect(keptTypeOf(view.scenario)).toBe(japaTypeOf(view));
    const stored = JSON.parse(localStorage.getItem("japacity.cards") ?? "[]") as { type?: string }[];
    expect(stored[0]?.type).toBe(japaTypeOf(view));
    act(() => store.setState({ view: { ...view, v: view.v + 1, month: view.month + 1, card: null } }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: say("share.gallery.open") }));
    const list = await screen.findByRole("dialog");
    fireEvent.click(within(list).getByRole("button", { name: new RegExp(say("share.send-off.title")) }));
    fireEvent.click(within(list).getByRole("button", { name: say("share.stub.pick.stub") }));
    expect(within(list.querySelector("[data-share-card='stub']") as HTMLElement).getByText(typeWords(japaTypeOf(view)!).name)).toBeDefined();
  });

  test("[R-SHARE-011] given no send-off closed yet, or only other cards kept, then the data page reads no type", () => {
    const view = adaSendOff();
    expect(keptTypeOf(view.scenario)).toBeNull();
    gallery.getState().keep(view.scenario, { ...view.card!, kind: "granted" });
    expect(keptTypeOf(view.scenario)).toBeNull();
  });
});
