import { describe, expect, test } from "vitest";

import { checkContent } from "./content";
import { miniContent } from "../testing/miniContent";
import type { Content } from "./types";

function copy(): Content {
  return JSON.parse(JSON.stringify(miniContent)) as Content;
}

describe("[engine:content-checked-before-play] the content check", () => {
  test("[engine:content-checked-before-play] given the mini content, when checked, then nothing is wrong", () => {
    expect(checkContent(miniContent)).toEqual([]);
  });

  test("[engine:content-checked-before-play] given a key that differs from its entry's id, when checked, then it is reported", () => {
    const content = copy();
    content.quality["quality.tech"] = { ...content.quality["quality.tech"]!, id: "quality.technology" };
    expect(checkContent(content).join("\n")).toMatch(/quality\.tech.*quality\.technology/);
  });

  test("[engine:content-checked-before-play] given a badly formed id, when checked, then it is reported", () => {
    const content = copy();
    (content.quality as Record<string, unknown>)["quality.Bad_Id"] = { ...content.quality["quality.tech"]!, id: "quality.Bad_Id" };
    expect(checkContent(content).join("\n")).toMatch(/not a well-formed quality id/);
  });

  test("[engine:content-checked-before-play] given a reference to an entry that does not exist, when checked, then it is reported", () => {
    const content = copy();
    content.route["route.mini"]!.schools.push("school.nowhere");
    expect(checkContent(content).join("\n")).toMatch(/school\.nowhere, which does not exist/);
  });

  test("[engine:content-checked-before-play] given a record key that names nothing, when checked, then it is reported", () => {
    const content = copy();
    content.scenario["scenario.plain"]!.qualities["quality.ghost"] = 1;
    expect(checkContent(content).join("\n")).toMatch(/quality\.ghost, which names nothing/);
  });

  test("[engine:content-checked-before-play] given a fractional amount, when checked, then it is reported", () => {
    const content = copy();
    // Half a kobo, built without a decimal literal, which the lint rules refuse.
    content.activity["activity.study"]!.cost[0]!.amount = 1000000 + Number("0.5");
    expect(checkContent(content).join("\n")).toMatch(/not a whole number/);
  });

  test("[engine:content-checked-before-play] given checklist weights that do not add up to 100, when checked, then it is reported", () => {
    const content = copy();
    content.route["route.mini"]!.checklist[0]!.weight = 41;
    expect(checkContent(content).join("\n")).toMatch(/add up to 101/);
  });

  test("[engine:content-checked-before-play] given a story that comes into force one tick after announcement, when checked, then it is reported", () => {
    const content = copy();
    content.news["news.mini"]!.standIn.forceLag = 1;
    expect(checkContent(content).join("\n")).toMatch(/under 2/);
  });
});
