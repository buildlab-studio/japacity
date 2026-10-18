// The keepsake's place (docs/rules/share.md R-SHARE-015): the send-off card is no screen of its own. It is kept with
// the seat the counter gave once the first ride says it is saved (at once when no scene shows, a life reopened after
// the plane), and until its time ends it is reached from the tile on the phone's home, with Open the card, the share
// unchanged and the stub carrying the seat in words.
import { text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { stubFace, stubSteps } from "../../shared/share/stub";
import { recordedGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { sendOff } from "../../shared/world/sendOff";
import { say } from "../../shared/words/text";
import { gallery } from "./gallery";
import { CardView, Keepsake } from "./ShareCard";

function adaFlown(): PlayerView {
  const view = recordedGame("ada-careful").view();
  if (view.card?.kind !== "send-off") throw new Error("Ada's recorded life does not end at the send-off.");
  return view;
}

beforeEach(() => {
  gallery.getState().clear();
  act(() => sendOff.getState().choose("window"));
});

afterEach(() => {
  act(() => sendOff.getState().close());
  localStorage.clear();
});

describe("the keepsake's place", () => {
  test("[R-SHARE-015] given Ada just flown with no scene showing, then the card opens on no screen of its own and is kept at once with the seat the counter gave", async () => {
    act(() => sendOff.getState().choose("aisle"));
    const view = adaFlown();
    await renderWithView(<CardView />, view);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(gallery.getState().kept.map((entry) => [entry.card.kind, entry.seat])).toEqual([["send-off", "aisle"]]);
  });

  test("[R-SHARE-015] given the scene still showing before the first ride, then the card is neither kept nor offered; once the ride says it is saved, it is kept", async () => {
    const view = adaFlown();
    act(() => sendOff.getState().open({ route: view.card!.route!, country: "country.uk" }));
    await renderWithView(
      <>
        <CardView />
        <Keepsake />
      </>,
      view,
    );
    expect(gallery.getState().kept).toEqual([]);
    expect(document.querySelector("[data-keepsake]")).toBeNull();
    act(() => sendOff.getState().save());
    expect(gallery.getState().kept.map((entry) => entry.card.kind)).toEqual(["send-off"]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("[R-SHARE-015] given the card's time, then the phone's tile opens it with the share unchanged and the stub carrying the seat in words; after the first month abroad, no tile", async () => {
    act(() => sendOff.getState().choose("aisle"));
    const view = adaFlown();
    const { store } = await renderWithView(<Keepsake />, view);
    const tile = document.querySelector("[data-keepsake]") as HTMLElement;
    expect(tile.textContent).toContain(say("share.send-off.ready"));
    fireEvent.click(within(tile).getByRole("button", { name: say("ui.card.open") }));
    const sheet = await screen.findByRole("dialog");
    expect(sheet.querySelector("[data-share-card='send-off']")).not.toBeNull();
    expect(within(sheet).getByRole("button", { name: say("share.button.save") })).toBeDefined();
    fireEvent.click(within(sheet).getByRole("button", { name: say("share.stub.pick.stub") }));
    expect(sheet.querySelector("[data-stub-seat]")?.textContent).toBe(text["share.stub.seat.aisle"]);
    act(() => store.setState({ view: { ...view, v: view.v + 1, month: view.month + 1, card: null } }));
    expect(document.querySelector("[data-keepsake]")).toBeNull();
  });

  test("[R-SHARE-015] [R-SHARE-006] given a seat, then the drawn stub keeps its landscape shape and carries the seat in words under the place, never a number, and no word of a ticket's machinery", () => {
    const card = adaFlown().card!;
    const measure = (words: string, size: number) => Math.round(words.length * size * 0.55);
    const ticket = /airline|airways|barcode|boarding|\bseat\b|\bgate\b|flight|booking|\d/i;
    for (const seat of ["window", "aisle"] as const) {
      const face = stubFace(card, "scenario.ada", null, seat)!;
      expect(face.seat).toBe(text[`share.stub.seat.${seat}`]);
      const seatSteps = stubSteps(face, { width: 1920, height: 1080 }, measure).flatMap((step) => (step.op === "text" && step.role === "stub-seat" ? [step] : []));
      expect(seatSteps.map((step) => step.text).join(" ")).toBe(text[`share.stub.seat.${seat}`]);
      for (const step of seatSteps) expect(step.text).not.toMatch(ticket);
      const place = stubSteps(face, { width: 1920, height: 1080 }, measure).find((step) => step.op === "text" && step.role === "stub-value" && step.text === face.fields.to);
      expect(place !== undefined && place.op === "text" && seatSteps[0]!.y > place.y).toBe(true);
    }
    expect(stubFace(card, "scenario.ada", null)?.seat).toBeNull();
  });
});
