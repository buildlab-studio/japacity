// A thing's fan with its act carrying on in the plan (docs/rules/world.md R-WORLD-005, R-WORLD-007, R-WORLD-034): a
// month-act started at a thing carries on each month until it is stopped, so its fan button
// says Ongoing, shut, with a stop beside it that takes it out of the plan. Time with Mama is an
// act done at once (decision 0012, R-ACTIVITY-019), on one sheet with her shop, so the fan is read on a month-act that
// carries on: the apprenticeship at the accessories stall in Computer Village. Every thing has a fan.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import villageRaw from "../../../../public/assets/places/computer-village/place.json";
import { engineView } from "../../../shared/testing/fixtures";
import { say } from "../../../shared/words/text";
import { withPlanned } from "../acts";
import { type PlaceFile, stageOf } from "../../../shared/scene/placeFile";
import { anchorFan } from "./anchor";
import { Fan } from "./Fan";
import { type FanEntry, fanEntriesOf, fanModel } from "./fanActs";

const village = villageRaw as unknown as PlaceFile;
const LEARN = "activity.apprentice-repair";

afterEach(() => cleanup());

function thingOf(id: string) {
  const thing = (stageOf(village).things ?? []).find((candidate) => candidate.id === id);
  if (thing === undefined) throw new Error(`No ${id}`);
  return thing;
}

/** The stall's fan drawn with the plan as it stands, beside the thing's spot on the left of a phone. */
function fanned(plan: Parameters<typeof withPlanned>[1], id: string) {
  const view = engineView("scenario.ada");
  const entries = fanModel(fanEntriesOf(withPlanned(thingOf("accessories"), plan, view)), view, []);
  const onAct = vi.fn<(entry: FanEntry) => void>();
  render(<Fan thing={id} title="Accessories" entries={entries} onAct={onAct} onFallback={vi.fn()} />);
  act(() => anchorFan(id, { x: 90, y: 420 }));
  return { entries, onAct };
}

describe("an ongoing act's fan", () => {
  test("[R-WORLD-007] [R-WORLD-005] [R-WORLD-034] given the apprenticeship started, when the stall's fan is built, then its button says Ongoing and is shut, and its stop takes it out; with nothing started it is open", () => {
    const open = fanned([null, null, null], "accessories-open");
    const openButton = document.querySelector<HTMLElement>(`[data-fan-act="${LEARN}"] button`);
    expect(openButton?.getAttribute("aria-disabled")).toBeNull();
    expect(open.entries.some((entry) => entry.kind === "stop")).toBe(false);
    expect(document.querySelector("[data-fan-kind='stop']")).toBeNull();
    cleanup();

    const ongoing = fanned([{ activity: LEARN, param: null }, null, null], "accessories-ongoing");
    const shut = document.querySelector<HTMLElement>(`[data-fan-act="${LEARN}"]`);
    expect(shut?.dataset.fanRefused).toBe("planned");
    expect(shut?.querySelector("[data-fan-refusal='planned']")?.textContent).toBe(say("ui.world.thing.planned"));
    expect(shut?.querySelector("[data-fan-refusal='planned']")?.textContent).toBe("Ongoing");
    expect(shut?.querySelector("button")?.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(shut!.querySelector("button")!);
    expect(ongoing.onAct).not.toHaveBeenCalled();
    const stop = screen.getByRole("button", { name: say("ui.world.stop-act", { what: "Learn repairs" }) });
    expect(stop.closest("[data-fan-act]")?.textContent).toContain("Stop");
    fireEvent.click(stop);
    expect(ongoing.onAct.mock.calls.map(([entry]) => [entry.kind, entry.act.stages])).toEqual([["stop", LEARN]]);
  });

  test("[R-WORLD-007] [R-WORLD-034] given only the apprenticeship started, when the stall's fan is built, then its other act is still open", () => {
    const { entries } = fanned([{ activity: LEARN, param: null }, null, null], "accessories-other");
    const other = entries.filter((entry) => entry.kind === "act" && entry.id !== LEARN);
    expect(other.map((entry) => entry.id)).toEqual(["activity.job-phone-sales"]);
    for (const entry of other) expect(entry.refusal).toBeNull();
    for (const entry of other) expect(document.querySelector(`[data-fan-act="${entry.id}"] button`)?.getAttribute("aria-disabled")).toBeNull();
  });
});
