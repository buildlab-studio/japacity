// The ticket stub beside the send-off card (share:cards-due-at-set-moments, share:card-offered-never-sent, share:card-contents,
// share:card-drawn-on-device, share:card-never-stored; decision 0024): the player picks which of the two to share, one tap shares
// the one picked, and the type read at the send-off is kept with the card for the gallery and the data page.
import { content, text } from "@japacity/content";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { playedWords } from "../../shared/share/face";
import { fakeCanvas } from "../../shared/share/canvas.testing";
import { renderWithView } from "../../shared/testing/render";
import { japaTypeOf, typeWords } from "../../shared/words/japaType";
import { say } from "../../shared/words/text";
import { keptTypeOf } from "../../shared/share/kept";
import { keepPerson } from "../../shared/frontdoor/person";
import { graduateSendOff } from "../../shared/share/share.testing";
import { gallery } from "./gallery";
import { CardView } from "./ShareCard";

const tuning = content.tuning.share;

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
  localStorage.clear();
  Reflect.deleteProperty(navigator, "canShare");
  Reflect.deleteProperty(navigator, "share");
});

describe("the ticket stub beside the send-off card", () => {
  test("[share:cards-due-at-set-moments] [share:card-contents] [share:send-off-card-kept] given Ada just flown, when her send-off opens from its tile, then the card shows first, and the stub beside it carries FROM Lagos, TO the country, the months, the figure, her type and her name as the band says it", async () => {
    keepPerson({ look: "person_ada", name: "Adaeze", archetype: null });
    const view = graduateSendOff();
    await renderWithView(<CardView />, view);
    // share:send-off-card-kept: the send-off is no screen of its own; it opens from the tile where the phone keeps it.
    fireEvent.click(await screen.findByRole("button", { name: say("ui.card.open") }));
    const sheet = await screen.findByRole("dialog");
    expect(sheet.querySelector("[data-share-card='send-off']")).not.toBeNull();
    const pickStub = within(sheet).getByRole("button", { name: say("share.stub.pick.stub") });
    expect(pickStub.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(pickStub);
    expect(pickStub.getAttribute("aria-pressed")).toBe("true");
    const stub = sheet.querySelector("[data-share-card='stub']") as HTMLElement;
    expect(sheet.querySelector("[data-share-card='send-off']")).toBeNull();
    // The name as the band says it, the one given at the door (share:card-contents).
    const band = "Adaeze";
    for (const words of ["Lagos", text["country.uk.name"]!, playedWords(view.card!.months), `${String(view.card!.percent)}%`, typeWords(japaTypeOf(view)!).name, typeWords(japaTypeOf(view)!).line, band, "Japacity is a game.", "japacity.app"]) {
      expect(within(stub).getByText(words)).toBeDefined();
    }
    fireEvent.click(within(sheet).getByRole("button", { name: say("share.stub.pick.card") }));
    expect(sheet.querySelector("[data-share-card='send-off']")).not.toBeNull();
  });

  test("[share:cards-due-at-set-moments] given any card but the send-off, when it opens, then no stub is offered", async () => {
    const view = graduateSendOff();
    await renderWithView(<CardView />, { ...view, card: { ...view.card!, kind: "granted" } });
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).queryByRole("button", { name: say("share.stub.pick.stub") })).toBeNull();
    expect(sheet.querySelector("[data-card-pick]")).toBeNull();
  });

  test("[share:card-offered-never-sent] [share:card-drawn-on-device] given the stub picked on a phone, when the player taps share once, then one landscape picture goes to the share sheet; given the card picked, then the portrait one", async () => {
    const share = phoneShare();
    const drawn = fakeCanvas(() => 1000);
    await renderWithView(<CardView />, graduateSendOff());
    // share:send-off-card-kept: the send-off is no screen of its own; it opens from the tile where the phone keeps it.
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

  test("[share:card-never-stored] given the send-off closed, then its type is kept with it on this device, the data page can read it, and the gallery offers the stub again with the type", async () => {
    const view = graduateSendOff();
    const { store } = await renderWithView(<CardView />, view);
    // share:send-off-card-kept: the send-off is no screen of its own; it opens from the tile where the phone keeps it.
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

  test("[share:card-never-stored] given no send-off closed yet, or only other cards kept, then the data page reads no type", () => {
    const view = graduateSendOff();
    expect(keptTypeOf(view.scenario)).toBeNull();
    gallery.getState().keep(view.scenario, { ...view.card!, kind: "granted" });
    expect(keptTypeOf(view.scenario)).toBeNull();
  });
});
