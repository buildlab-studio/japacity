// The hub in Yaba (place.yaba, the room Ojuelegba's hub door cuts to): what its things open. The interview's
// practice is staged at the long desk, so a player can prepare before the visa centre (docs/rules/world.md R-WORLD-005).
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import placeFile from "../../../../public/assets/places/yaba-hub/place.json";
import { sceneWords } from "../scene.words";
import { stagedNow, thingsNow } from "../things";
import { actEntries } from "./frontage.testing";
import { staged } from "./place.testing";

const PREP = "activity.interview-prep";
const { stage, entry } = staged(placeFile, "place.yaba");
const desk = stage.things?.find((thing) => thing.id === "desk");
if (desk === undefined) throw new Error("The hub has no desk");

describe("the hub's desk", () => {
  test("[R-WORLD-005] given the hub in content, when what it stages is read, then the interview's practice is staged there, and every entry it stages opens from an act of a thing in the room", () => {
    expect(entry.stages).toContain(PREP);
    const opened = new Set(actEntries(placeFile, "place.yaba"));
    expect(entry.stages.filter((entryId) => !opened.has(entryId))).toEqual([]);
  });

  test("[R-WORLD-005] given the desk, when its acts are read, then one of its two acts lists the interview's practice, and the practice has a name and a line in content", () => {
    expect(desk.acts.length).toBeLessThanOrEqual(2);
    const lists = desk.acts.filter((act) => act.stages === PREP || (act.more ?? []).includes(PREP));
    expect(lists).toHaveLength(1);
    expect(sceneWords(lists[0]?.label ?? "")).not.toBe(lists[0]?.label);
    expect(content.activity[PREP]).toBeDefined();
    expect(sceneWords(`${PREP}.name`)).not.toBe(`${PREP}.name`);
    expect(sceneWords(`${PREP}.blurb`)).not.toBe(`${PREP}.blurb`);
  });

  test("[R-WORLD-005] given the practice offered and nothing else the desk lists, when the desk's acts are read for now, then the act stays and opens the practice; with the practice not offered it goes", () => {
    const stagedHere = new Set(entry.stages);
    const offered = thingsNow([desk], stagedNow(new Set([PREP]), stagedHere, new Set(), null));
    expect(offered[0]?.acts.map((act) => act.stages)).toEqual([PREP]);
    const none = thingsNow([desk], stagedNow(new Set(), stagedHere, new Set(), null));
    expect(none[0]?.acts ?? []).toEqual([]);
  });
});

describe("the hub's jobs board", () => {
  const board = stage.things?.find((thing) => thing.id === "jobs");
  if (board === undefined) throw new Error("The hub has no jobs board");
  const HUNT = "activity.job-hunt";
  const jobs = ["activity.job-junior-dev", "activity.job-bank-officer"];

  test("[R-WORLD-005] given the hunt open and jobs the board lists offered, when the board's act is read for now, then it opens the hunt's sheet, where the job is chosen from the list, not the first job's card", () => {
    const now = thingsNow([board], stagedNow(new Set([HUNT, ...jobs]), new Set(entry.stages), new Set(), null));
    expect(now[0]?.acts).toHaveLength(1);
    expect(now[0]?.acts[0]?.stages).toBe(HUNT);
  });

  test("[R-WORLD-005] given the board, when what it lists is read, then every job the hub stages is on it, so each still opens from a thing there", () => {
    const listed = new Set(board.acts.flatMap((act) => [act.stages, ...(act.more ?? [])]));
    const staffed = entry.stages.filter((id) => content.activity[id as keyof typeof content.activity]?.slot === "main");
    expect(staffed.length).toBeGreaterThan(0);
    expect(staffed.filter((id) => !listed.has(id))).toEqual([]);
  });
});
