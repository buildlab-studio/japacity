// Home's send-off answered with the party (docs/rules/chapter.md R-CHAPTER-008): the sheet
// closes, the scene cuts to the yard dressed for the party, and the party's own line
// stands over it for a beat. The scene itself needs WebGL and is not drawn here; its dressing is.
import { text } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import familyFile from "../../../public/assets/places/home-family-house/place.json";
import { richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { City, dressedBy, partyThrown } from "./City";
import { dressPlace, type PlaceFile, stageOf } from "../../shared/scene/placeFile";

const SEND_OFF = "offer.family-send-off";
const taken = (choice: string): ReportLine => ({ key: "line.offer.taken", params: { offer: SEND_OFF, choice }, tone: "plain", attention: false, counts: [] });
const PARTY = text[`${SEND_OFF}.said.party`];

describe("the party at home", () => {
  test("[R-CHAPTER-008] [R-WORLD-008] given the send-off answered this month, when the yard is dressed, then the party keeps its set and its guests and the dinner leaves the yard plain", () => {
    expect(partyThrown([taken("party")])).toBe(true);
    expect(partyThrown([taken("dinner")])).toBe(false);
    const file = familyFile as unknown as PlaceFile;
    const plain = stageOf(file);
    const party = dressPlace(file, dressedBy([], [taken("party")]));
    expect(party.crowd).not.toBeNull();
    expect(stageOf(party.file).models.length).toBeGreaterThan(plain.models.length);
    expect(stageOf(party.file).dancers?.length ?? 0).toBeGreaterThan(plain.dancers?.length ?? 0);
    expect(dressPlace(file, dressedBy([], [taken("dinner")])).crowd).toBeNull();
    // The month over, its answers are gone, and so is the party.
    expect(dressPlace(file, dressedBy([], [])).crowd).toBeNull();
  });

  test("[R-CHAPTER-008] [R-WORLD-008] given the asks open over the world, when the party is the answer, then the sheet closes and the party's line stands over the yard, once, until tapped", async () => {
    const { store } = await renderWithView(<City world results={() => <p />} asks={[<p key="other">another ask</p>]} />, richView());
    // The set piece is staged elsewhere, so the nudge says it waits there (R-CITY-011); its tap opens the sheet all the same.
    fireEvent.click(document.querySelector<HTMLElement>("[data-nudge-open]") as HTMLElement);
    expect(screen.getByText("another ask")).toBeDefined();
    act(() => store.setState({ monthLines: [taken("party")], moments: [{ key: `${SEND_OFF}.said.party`, params: {}, tone: "plain", attention: false, counts: [] }] }));
    const beat = await waitFor(() => {
      const found = document.querySelector<HTMLElement>("[data-party-beat]");
      if (found === null) throw new Error("No beat yet");
      return found;
    });
    expect(beat.textContent).toBe(PARTY);
    expect(screen.queryByText("another ask")).toBeNull();
    // Told once: not again in the corner beside it.
    expect(document.querySelector("[data-corner]")?.textContent ?? "").not.toContain(PARTY);
    fireEvent.click(beat);
    expect(document.querySelector("[data-party-beat]")).toBeNull();
    act(() => store.setState({ monthLines: [taken("party"), taken("party")] }));
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(document.querySelector("[data-party-beat]")).toBeNull();
  });
});
