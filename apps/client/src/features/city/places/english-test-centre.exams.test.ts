// The chartered exams are sat at the test centre's desks (document:trade-papers), as the nurse's quiz is sat at the clinic: the centre
// stages the sitting, and a desk there opens it.
import { describe, expect, test } from "vitest";

import placeFile from "../../../../public/assets/places/english-test-centre/place.json";
import { actEntries } from "./frontage.testing";
import { staged } from "./place.testing";

const SITTING = "setpiece.ican-exam";
const { stage, entry } = staged(placeFile, "place.english-test-centre");

describe("the chartered exams at the test centre", () => {
  test("[document:trade-papers] [city:set-piece-shown-where-staged] given the test centre, when what it stages and its desks' acts are read, then it stages the chartered sitting and a desk opens it, and every entry it stages opens from a thing", () => {
    expect(entry.stages).toContain(SITTING);
    const desk = stage.things?.find((thing) => thing.acts.some((act) => act.stages === SITTING));
    expect(desk?.file).toBe("places/english-test-centre/prop_test-desk.glb");
    const opened = new Set(actEntries(placeFile, "place.english-test-centre"));
    expect(entry.stages.filter((id) => !opened.has(id))).toEqual([]);
  });
});
