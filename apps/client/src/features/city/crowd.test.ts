import { content } from "@japacity/content";
import type { PlaceEntry } from "@japacity/sim";
import { afterEach, describe, expect, test, vi } from "vitest";

import hubFile from "../../../public/assets/places/ojuelegba/place.json";
import { actPose, bandOf, crowdSize, hash, localDate, placeCrowd, playersRoom, poolOf, resident, residents, sampleCrowd, type Shown, traditionalCount, walkPose, weekday } from "./crowd";
import { type Person, ROSTER } from "./roster";

const city = content.tuning.city;
const places = Object.values(content.place);
const hub = content.place["place.ojuelegba"];
if (hub === undefined) throw new Error("The hub is missing from content");
const pool = poolOf(hubFile.people.sample);

const FRIDAY = "2026-10-09";
const SATURDAY = "2026-10-10";
const THURSDAY = "2026-10-08";
/** A hundred days from the first of October, so a mix is read over many samples. */
const HUNDRED = Array.from({ length: 100 }, (_, day) => localDate(new Date(2026, 9, 1 + day)));
/** Every day of a year, so a share is read over many samples. */
const YEAR = Array.from({ length: 365 }, (_, day) => localDate(new Date(2026, 0, 1 + day)));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the sample's size and band", () => {
  test("[R-CITY-014] given every place, when its sample is drawn in each mode, then it is at most the mode's figure and the place's own", () => {
    for (const place of places) {
      expect(sampleCrowd(place, pool, THURSDAY, "low", city).people.length).toBe(Math.min(place.crowd.target, city.crowdLow, place.crowd.low));
      expect(sampleCrowd(place, pool, THURSDAY, "high", city).people.length).toBe(Math.min(place.crowd.target, city.crowdHigh, place.crowd.high));
    }
    const wide: PlaceEntry = { ...hub, crowd: { low: city.crowdLow + 1, high: city.crowdHigh + 1, target: city.crowdHigh + 1 } };
    expect(crowdSize(wide, "low", city)).toBe(city.crowdLow);
    expect(crowdSize(wide, "high", city)).toBe(city.crowdHigh);
  });

  test("[R-CITY-014] given a sample against the place's target, when it is shown, then only a band is said: packed at the target, busy from half of it, quiet under half", () => {
    const target = hub.crowd.target;
    const half = Math.ceil(target / 2);
    expect(bandOf(target + 1, target)).toBe("packed");
    expect(bandOf(target, target)).toBe("packed");
    expect(bandOf(target - 1, target)).toBe("busy");
    expect(bandOf(half, target)).toBe("busy");
    expect(bandOf(half - 1, target)).toBe("quiet");
    expect(bandOf(0, target)).toBe("quiet");
  });

  test("[R-CITY-014] given the hub in both modes, when the band is read, then the fuller high mode never says less than the low mode", () => {
    const rank = { quiet: 0, busy: 1, packed: 2 } as const;
    const low = sampleCrowd(hub, pool, THURSDAY, "low", city);
    const high = sampleCrowd(hub, pool, THURSDAY, "high", city);
    expect(high.people.length).toBeGreaterThan(low.people.length);
    expect(rank[high.band]).toBeGreaterThanOrEqual(rank[low.band]);
    expect(low.band).toBe("busy");
    expect(high.band).toBe("packed");
  });
});

describe("players in the sample", () => {
  const others = Array.from({ length: city.playersMax + 2 }, (_, index) => ({ look: "chr_tunde", name: `player${String(index)}` }));

  test("[R-CITY-015] given more players present than playersMax, when the sample is drawn, then at most playersMax of it are players and the rest live in the city", () => {
    const sample = sampleCrowd(hub, pool, THURSDAY, "high", city, others);
    expect(sample.people.filter((shown) => shown.kind === "player")).toHaveLength(city.playersMax);
    expect(sample.people).toHaveLength(crowdSize(hub, "high", city));
  });

  test("[R-CITY-015] given players in the presence sample, when the sample is drawn, then every player carries the display name the server sent, and no resident has a tag", () => {
    const sample = sampleCrowd(hub, pool, THURSDAY, "high", city, others);
    const players = sample.people.filter((shown) => shown.kind === "player");
    expect(players.map((shown) => shown.tag).reverse()).toEqual(others.map((other) => other.name).slice(0, city.playersMax));
    expect(sample.people.filter((shown) => shown.kind === "resident" && shown.tag !== null)).toEqual([]);
  });

  test("[R-CITY-015] given no presence, when the sample is drawn, then everyone in it is a computer person", () => {
    expect(sampleCrowd(hub, pool, THURSDAY, "high", city).people.every((shown) => shown.kind === "resident")).toBe(true);
  });
});

describe("players seen today", () => {
  const live = [{ look: "chr_tunde", name: "here1" }];
  const today = Array.from({ length: city.playersMax + 1 }, (_, index) => ({ look: "chr_tunde", name: `today${String(index)}` }));

  test("[R-CITY-036] given a player here now and players seen today, when the sample is drawn, then those seen today stand in the slots after the live one, tagged with the server's names", () => {
    const sample = sampleCrowd(hub, pool, THURSDAY, "high", city, live, today);
    const players = sample.people.filter((shown) => shown.kind === "player");

    expect(players.map((shown) => shown.tag).reverse()).toEqual(["here1", ...today.map((other) => other.name)].slice(0, city.playersMax));
    expect(sample.people).toHaveLength(crowdSize(hub, "high", city));
  });

  test("[R-CITY-036] [R-CITY-015] given live players filling playersMax, when the sample is drawn, then no one seen today is shown", () => {
    const full = Array.from({ length: city.playersMax }, (_, index) => ({ look: "chr_tunde", name: `here${String(index)}` }));
    const sample = sampleCrowd(hub, pool, THURSDAY, "high", city, full, today);

    expect(sample.people.filter((shown) => shown.tag?.startsWith("today") === true)).toEqual([]);
  });
});

describe("the dress mix", () => {
  const share = (date: string, keep: (file: string, sex: string) => boolean, place: PlaceEntry = hub): { kept: number; of: number } => {
    const people = Array.from({ length: 64 }, (_, slot) => resident(place, pool, date, slot, city));
    const men = people.filter((person) => keep(person.file, person.sex));
    return { kept: men.length, of: people.length };
  };

  test("[R-CITY-016] given a place's traditional share, when a year of samples is drawn, then the share in traditional cloth is near it", () => {
    for (const traditionalBp of [2000, 6000]) {
      const place = { ...hub, traditionalBp };
      const people = YEAR.flatMap((date) => Array.from({ length: 4 }, (_, slot) => resident(place, pool, date, slot, { ...city, fridayBp: 0, saturdayBp: 0 })));
      const traditional = people.filter((person) => person.dress === "traditional").length;
      expect(Math.abs(traditional * 10000 - traditionalBp * people.length)).toBeLessThan(people.length * 700);
    }
  });

  test("[R-CITY-016] given a Friday, when fridayBp is all or none, then every man or no one wears jalamia; on a Thursday no one does", () => {
    const jalamia = (file: string): boolean => ROSTER.some((person) => person.file === file && person.wear === "jalamia");
    const all = { ...city, fridayBp: 10000 };
    const men = Array.from({ length: 64 }, (_, slot) => resident(hub, pool, FRIDAY, slot, all));
    const chosenMen = Array.from({ length: 64 }, (_, slot) => resident(hub, pool, FRIDAY, slot, { ...city, fridayBp: 0 })).filter((person) => person.sex === "m");
    expect(chosenMen.length).toBeGreaterThan(0);
    expect(men.filter((person) => person.sex === "m").every((person) => jalamia(person.file))).toBe(true);
    expect(share(FRIDAY, (file) => jalamia(file)).kept).toBeGreaterThan(0);
    expect(Array.from({ length: 64 }, (_, slot) => resident(hub, pool, FRIDAY, slot, { ...city, fridayBp: 0 })).some((person) => jalamia(person.file))).toBe(false);
    expect(Array.from({ length: 64 }, (_, slot) => resident(hub, pool, THURSDAY, slot, all)).some((person) => jalamia(person.file))).toBe(false);
    expect(weekday(FRIDAY)).toBe(5);
  });

  test("[R-CITY-016] given a Saturday, when the place has occasion true or false, then saturdayBp of the sample wears occasion dress only where it is true", () => {
    const occasion = (file: string): boolean => ROSTER.some((person) => person.file === file && person.wear === "occasion");
    const all = { ...city, saturdayBp: 10000 };
    const party = { ...hub, occasion: true };
    expect(Array.from({ length: 32 }, (_, slot) => resident(party, pool, SATURDAY, slot, all)).every((person) => occasion(person.file))).toBe(true);
    const plain = Array.from({ length: 32 }, (_, slot) => resident({ ...hub, occasion: false }, pool, SATURDAY, slot, all));
    expect(plain.filter((person) => occasion(person.file))).toEqual(plain.filter((person) => pool.includes(person) && occasion(person.file)));
    expect(weekday(SATURDAY)).toBe(6);
  });
});

describe("the same people on the same day", () => {
  test("[R-CITY-017] given the same place, date and slot, when the sample is drawn twice, then it is the same, and Math.random is never called", () => {
    const random = vi.spyOn(Math, "random");
    const first = sampleCrowd(hub, pool, THURSDAY, "high", city);
    const second = sampleCrowd(hub, pool, THURSDAY, "high", city);
    expect(second).toEqual(first);
    expect(random).not.toHaveBeenCalled();
  });

  test("[R-CITY-017] given another day or another place, when the sample is drawn, then the people change", () => {
    const files = (date: string, place: PlaceEntry = hub): string[] => sampleCrowd(place, pool, date, "high", city).people.map((shown) => shown.person.file);
    expect(files(FRIDAY)).not.toEqual(files(THURSDAY));
    const other = content.place["place.oshodi"];
    if (other === undefined) throw new Error("Oshodi is missing from content");
    expect(files(THURSDAY, other)).not.toEqual(files(THURSDAY));
    expect(hash("place.ojuelegba")).toBe(hash("place.ojuelegba"));
    expect(hash("place.ojuelegba")).not.toBe(hash("place.oshodi"));
  });
});

describe("the roster", () => {
  test("[R-CITY-016] given every person the crowd may show, when the roster is read against the people's data, then each is shipped and a man or a woman as built", async () => {
    const { ALL_PEOPLE } = await import("@japacity/assets-src/people/people.data");
    const wrong = ROSTER.filter((person) => !ALL_PEOPLE.some((built) => `shared/chr/${built.name}.glb` === person.file && built.body.startsWith(person.sex)));
    expect(wrong.map((person) => person.file)).toEqual([]);
    expect(pool.length).toBe(hubFile.people.sample.length);
  });
});

describe("the target headcount", () => {
  test("[R-CITY-032] given the hub's target, when its sample is drawn, then it shows min(target, the mode's figure) in each mode", () => {
    expect(sampleCrowd(hub, pool, THURSDAY, "high", city).people).toHaveLength(Math.min(hub.crowd.target, city.crowdHigh));
    expect(sampleCrowd(hub, pool, THURSDAY, "low", city).people).toHaveLength(Math.min(hub.crowd.target, city.crowdLow));
  });

  test("[R-CITY-032] given a target at, under and over the mode's figure, when the size is read, then the smaller of the two is shown", () => {
    for (const target of [city.crowdLow - 1, city.crowdLow, city.crowdLow + 1, city.crowdHigh, city.crowdHigh + 1]) {
      const place = { ...hub, crowd: { low: city.crowdLow, high: city.crowdHigh, target } };
      expect(crowdSize(place, "low", city)).toBe(Math.min(target, city.crowdLow));
      expect(crowdSize(place, "high", city)).toBe(Math.min(target, city.crowdHigh));
    }
  });

  test("[R-CITY-032] given more players than room, when the sample is drawn, then residents never fall under residentFloor, and a sample at the floor shows no player", () => {
    const others = Array.from({ length: city.playersMax + 4 }, (_, index) => ({ look: "chr_tunde", name: `player${String(index)}` }));
    for (const target of [city.residentFloor, city.residentFloor + 1, city.residentFloor + city.playersMax, city.crowdHigh]) {
      const place = { ...hub, crowd: { low: city.crowdLow, high: city.crowdHigh, target } };
      const sample = sampleCrowd(place, pool, THURSDAY, "high", city, others);
      const residentsShown = sample.people.filter((shown) => shown.kind === "resident").length;
      expect(residentsShown).toBeGreaterThanOrEqual(city.residentFloor);
      expect(sample.people.length - residentsShown).toBe(playersRoom(target, city));
    }
    expect(playersRoom(city.residentFloor, city)).toBe(0);
    expect(playersRoom(city.residentFloor + 1, city)).toBe(1);
  });

  test("[R-CITY-014] given players taking slots of the sample, when the band is read, then it follows the sample's whole count against the target, players included", () => {
    const others = Array.from({ length: city.playersMax }, (_, index) => ({ look: "chr_tunde", name: `player${String(index)}` }));
    expect(sampleCrowd(hub, pool, THURSDAY, "high", city, others).band).toBe(bandOf(crowdSize(hub, "high", city), hub.crowd.target));
    expect(sampleCrowd(hub, pool, THURSDAY, "low", city, others).band).toBe(bandOf(crowdSize(hub, "low", city), hub.crowd.target));
  });
});

describe("one sample, many outfits", () => {
  const plain = { ...city, fridayBp: 0, saturdayBp: 0 };

  test("[R-CITY-016] given the hub's traditional share, when a hundred days of samples are drawn in each mode, then every sample holds that share to the nearest person", () => {
    for (const mode of ["low", "high"] as const) {
      let traditional = 0;
      let all = 0;
      for (const date of HUNDRED) {
        const people = sampleCrowd(hub, pool, date, mode, plain).people;
        const count = people.filter((shown) => shown.person.dress === "traditional").length;
        expect(count).toBe(traditionalCount(people.length, hub.traditionalBp));
        traditional += count;
        all += people.length;
      }
      expect(Math.abs(traditional * 10000 - hub.traditionalBp * all)).toBeLessThanOrEqual(all * 10000 * 0.05);
    }
    expect(traditionalCount(12, 6000)).toBe(7);
    expect(traditionalCount(8, 6000)).toBe(5);
    expect(traditionalCount(8, 0)).toBe(0);
    expect(traditionalCount(8, 10000)).toBe(8);
  });

  test("[R-CITY-016] given a hundred days of the hub, Fridays and Saturdays included, when each sample is drawn, then no two people in it wear one outfit", () => {
    for (const date of HUNDRED) {
      for (const mode of ["low", "high"] as const) {
        const files = sampleCrowd(hub, pool, date, mode, city).people.map((shown) => shown.person.file);
        expect(new Set(files).size).toBe(files.length);
      }
    }
  });

  test("[R-CITY-016] given every person the crowd may show, when their clothes are read from the people's data, then no two wear the same outfit", async () => {
    const { ALL_PEOPLE } = await import("@japacity/assets-src/people/people.data");
    const outfit = (file: string): string => {
      const built = ALL_PEOPLE.find((spec) => `shared/chr/${spec.name}.glb` === file);
      return JSON.stringify([built?.top, built?.bottom, built?.over, built?.patterns, built?.head, built?.headFab]);
    };
    const outfits = ROSTER.map((person) => outfit(person.file));
    expect(new Set(outfits).size).toBe(outfits.length);
  });

  test("[R-CITY-016] given a pool smaller than the sample, when it is drawn, then everyone is used once before anyone is shown twice", () => {
    const small = pool.slice(0, 5);
    const people = residents(hub, small, THURSDAY, 8, plain);
    expect(new Set(people.slice(0, 5).map((person) => person.file)).size).toBe(5);
  });
});

describe("where the crowd stands", () => {
  const shown = (files: readonly string[]): Shown[] =>
    files.map((file, slot) => {
      const person = ROSTER.find((row) => row.file === `shared/chr/${file}.glb`) as Person;
      return { slot, person, kind: "resident", tag: null };
    });

  test("[R-CITY-014] given spots kept for a hawker and a trader, when the sample stands, then the hawker and the trader take them and everyone else fills the first spots in slot order", () => {
    const people = shown(["chr_tunde", "chr_hawker_a", "chr_ada", "chr_iya"]);
    const spots = ["a", "b", "c", "d", "e"];
    const placed = placeCrowd(people, spots, { hawker: [3], trader: [0] });
    expect(placed.map(({ shown: one, spot }) => [spot, one.person.file])).toEqual([
      ["a", "shared/chr/chr_iya.glb"],
      ["b", "shared/chr/chr_tunde.glb"],
      ["c", "shared/chr/chr_ada.glb"],
      ["d", "shared/chr/chr_hawker_a.glb"],
    ]);
  });

  test("[R-CITY-014] given a kept spot past the sample's size or no one of its role, when the sample stands, then it is left and only the first spots are used", () => {
    const people = shown(["chr_tunde", "chr_ada"]);
    expect(placeCrowd(people, ["a", "b", "c"], { hawker: [0], trader: [2] }).map(({ spot }) => spot)).toEqual(["a", "b"]);
    expect(placeCrowd(people, ["a"], {}).map(({ shown: one }) => one.slot)).toEqual([0]);
  });

  test("[R-CITY-014] given a spot an act keeps for a man, when the sample stands, then the first man in a plain stand takes it and everyone else fills the rest in slot order", () => {
    const people = shown(["chr_ada", "chr_hawker_b", "chr_tunde", "chr_ngozi"]);
    const placed = placeCrowd(people, ["a", "b", "c", "d"], {}, [{ spot: 0, sex: "m", pose: "cheer" }]);
    expect(placed.map(({ shown: one, spot, index }) => [index, spot, one.person.file])).toEqual([
      [0, "a", "shared/chr/chr_tunde.glb"],
      [1, "b", "shared/chr/chr_ada.glb"],
      [2, "c", "shared/chr/chr_hawker_b.glb"],
      [3, "d", "shared/chr/chr_ngozi.glb"],
    ]);
  });

  test("[R-CITY-014] given a spot kept for a role and an act on it, when the sample stands, then the role keeps it, and an act past the sample or with no one of its sex is left", () => {
    const people = shown(["chr_ada", "chr_rider", "chr_ngozi"]);
    const kept = placeCrowd(people, ["a", "b", "c"], { rider: [2] }, [{ spot: 2, sex: "m", pose: "ride" }]);
    expect(kept.find(({ index }) => index === 2)?.shown.person.file).toBe("shared/chr/chr_rider.glb");
    const women = shown(["chr_ada", "chr_ngozi"]);
    expect(placeCrowd(women, ["a", "b"], {}, [{ spot: 1, sex: "m" }]).map(({ shown: one }) => one.slot)).toEqual([0, 1]);
    expect(placeCrowd(women, ["a", "b", "c"], {}, [{ spot: 2, sex: "f" }]).map(({ index }) => index)).toEqual([0, 1]);
  });

  test("[R-CITY-014] given another player in the sample, when an act keeps a spot for their sex, then a resident takes it and the player is never given a part", () => {
    const people = shown(["chr_tunde", "chr_kunle"]).map((one, slot): Shown => (slot === 0 ? { ...one, kind: "player", tag: "Femi" } : one));
    const placed = placeCrowd(people, ["a", "b"], {}, [{ spot: 0, sex: "m", pose: "cheer" }]);
    expect(placed[0]?.shown.kind).toBe("resident");
    expect(placed[1]?.shown.kind).toBe("player");
  });

  test("[R-CITY-038] given an act's pose, when a person idles at its spot, then one in a plain stand takes it and a hawker keeps her tray, a trader his sale", () => {
    const of = (file: string): Person => ROSTER.find((row) => row.file === `shared/chr/${file}.glb`) as Person;
    expect(actPose(of("chr_tunde"), { pose: "cheer" })).toBe("cheer");
    expect(actPose(of("chr_zainab"), { pose: "cheer" })).toBe("cheer");
    expect(actPose(of("chr_kemi"), { pose: "ride" })).toBe("ride");
    expect(actPose(of("chr_hawker_a"), { pose: "cheer" })).toBe("tray");
    expect(actPose(of("chr_iya"), { pose: "cheer" })).toBe("sell");
    expect(actPose(of("chr_tunde"), {})).toBe("stand");
    expect(actPose(of("chr_tobi"), undefined)).toBe("hip");
  });

  test("[R-CITY-038] given someone crossing, when they walk, then a hawker walks steadying her tray and everyone else swings both arms", () => {
    for (const row of ROSTER) expect(walkPose(row)).toBe(row.pose === "tray" ? "trayWalk" : "walk");
    expect(walkPose({ pose: "tray" })).toBe("trayWalk");
    expect(walkPose({ pose: "stand" })).toBe("walk");
  });
});
