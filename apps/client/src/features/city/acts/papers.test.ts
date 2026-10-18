// The papers box opens the phone's Papers app (docs/rules/world.md R-WORLD-019): one
// source for what is in the box, and no sheet of its own.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { stageOf } from "../../../shared/scene/placeFile";
import { builtPlaces } from "../../../shared/scene/placeFile.testing";
import { sceneWords } from "../scene.words";
import { thingsOf } from "../scene/things";

/** The papers box in each home's file: the family house's, the room in a compound's, the hostel room's and the room on the water's. */
const BOXES = builtPlaces().flatMap(({ folder, file }) => thingsOf(stageOf(file)).filter((thing) => thing.label === "city.thing.papers").map((thing) => ({ folder, thing })));

describe("the papers box", () => {
  test("[R-WORLD-019] given the papers box in every home, when its acts are read, then its one act opens the Papers app, named Look in the box, and no sheet of papers is left", () => {
    expect(BOXES.map(({ folder }) => folder).sort()).toEqual(["home-family-house", "home-hostel-house", "home-room-house", "makoko"]);
    for (const { folder, thing } of BOXES) {
      expect({ folder, acts: thing.acts }).toEqual({ folder, acts: [{ id: "papers", label: "city.act.papers", kind: "app", app: "papers" }] });
      expect(sceneWords(thing.acts[0]!.label)).toBe("Look in the box");
    }
  });

  test("[R-WORLD-019] given the homes, when what they stage is read, then no paper is requested there: the calls are made on the phone and the passport at Immigration", () => {
    const papers = Object.values(content.activity).filter((entry) => entry.effects.some((effect) => effect.type === "document/request")).map((entry) => entry.id as string);
    for (const home of ["place.family-house", "place.makoko", "place.compound-room", "place.hostel-room"] as const) {
      expect({ home, papers: (content.place[home]?.stages ?? []).filter((id) => papers.includes(id)) }).toEqual({ home, papers: [] });
    }
    expect(content.place["place.passport-office"]?.stages).toEqual(["activity.get-passport"]);
  });
});
