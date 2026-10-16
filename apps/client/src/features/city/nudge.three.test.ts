// The landing chapter's steps in each country abroad (world.md R-WORLD-003, R-WORLD-039 as amended): the nudge's way goes
// to the country's own doors, the strip mall's notice and Calgary's workplaces, the site's post and trolley, the vans at
// the roundabout and the gangmaster's table, and money home to each country's counter.
import { describe, expect, test } from "vitest";

import calgary from "../../../public/assets/places/calgary-north-east/place.json";
import castel from "../../../public/assets/places/castel-volturno/place.json";
import deira from "../../../public/assets/places/deira/place.json";
import farm from "../../../public/assets/places/farm-it/place.json";
import site from "../../../public/assets/places/site-uae/place.json";
import { engineView } from "../../shared/testing/fixtures";
import { stepWayOf } from "./nudge";
import { type PlaceFile, stageOf } from "./placeFile";

const FILES: Readonly<Record<string, unknown>> = { "place.calgary-north-east": calgary, "place.castel-volturno": castel, "place.deira": deira, "place.farm-it": farm, "place.site-uae": site };

function landing(step: "job" | "request", country: "country.uk" | "country.canada" | "country.uae" | "country.italy") {
  const base = engineView();
  return stepWayOf({ ...base, place: { ...base.place, where: "abroad", country }, chapter: { current: "chapter.landing", items: [{ id: step, met: false }], done: [], closes: false, next: null } });
}

describe("the landing's steps abroad", () => {
  test("[R-WORLD-003] [R-WORLD-039] given the landing's job step in each country, when its way is read, then it goes to the country's own stop and names its doors there", () => {
    expect(landing("job", "country.uk")?.go).toBe("place.peckham");
    expect(landing("job", "country.canada")?.go).toBe("place.calgary-north-east");
    expect(landing("job", "country.uae")?.go).toBe("place.site-uae");
    expect(landing("job", "country.italy")?.go).toBe("place.castel-volturno");
    const at = landing("job", "country.canada")?.at ?? [];
    for (const door of ["place.calgary-north-east:jobs-notice", "place.warehouse-ca:clock-in", "place.care-home-ca:reception", "place.office-ca:desk", "place.site-uae:guard-post", "place.site-uae:cleaner-trolley", "place.castel-volturno:roundabout", "place.farm-it:table"]) expect(at).toContain(door);
  });

  test("[R-WORLD-003] [R-WORLD-039] given the landing's money step in each country, when its way is read, then it goes to the country's counter, and every door it names is a thing of that place's file", () => {
    expect(landing("request", "country.uk")?.go).toBe("place.rye-lane");
    expect(landing("request", "country.canada")?.go).toBe("place.calgary-north-east");
    expect(landing("request", "country.uae")?.go).toBe("place.deira");
    expect(landing("request", "country.italy")?.go).toBe("place.castel-volturno");
    const named = [...(landing("request", "country.uae")?.at ?? []), ...(landing("job", "country.uae")?.at ?? [])];
    for (const door of named) {
      const [place, thing] = door.split(":");
      const file = FILES[place ?? ""];
      if (file === undefined) continue;
      expect([door, (stageOf(file as PlaceFile).things ?? []).some((candidate) => candidate.id === thing)]).toEqual([door, true]);
    }
  });
});
