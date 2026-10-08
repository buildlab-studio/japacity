import { content } from "@japacity/content";
import type { PlaceEntry } from "@japacity/sim";
import { afterEach, describe, expect, test, vi } from "vitest";

import hubFile from "../../../public/assets/places/ojuelegba/place.json";
import { bandOf, crowdSize, hash, localDate, poolOf, resident, sampleCrowd, weekday } from "./crowd";
import { ROSTER } from "./roster";

const city = content.tuning.city;
const places = Object.values(content.place);
const hub = content.place["place.ojuelegba"];
if (hub === undefined) throw new Error("The hub is missing from content");
const pool = poolOf(hubFile.people.sample);

const FRIDAY = "2026-10-09";
const SATURDAY = "2026-10-10";
const THURSDAY = "2026-10-08";
/** Every day of a year, so a share is read over many samples. */
const YEAR = Array.from({ length: 365 }, (_, day) => localDate(new Date(2026, 0, 1 + day)));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the sample's size and band", () => {
  test("[R-CITY-014] given every place, when its sample is drawn in each mode, then it is at most the mode's figure and the place's own", () => {
    for (const place of places) {
      expect(sampleCrowd(place, pool, THURSDAY, "low", city).people.length).toBe(Math.min(city.crowdLow, place.crowd.low));
      expect(sampleCrowd(place, pool, THURSDAY, "high", city).people.length).toBe(Math.min(city.crowdHigh, place.crowd.high));
    }
    const wide: PlaceEntry = { ...hub, crowd: { low: city.crowdLow + 1, high: city.crowdHigh + 1 } };
    expect(crowdSize(wide, "low", city)).toBe(city.crowdLow);
    expect(crowdSize(wide, "high", city)).toBe(city.crowdHigh);
  });

  test("[R-CITY-014] given a sample's size, when it is shown, then only a band is said: packed at the mode's figure, quiet under half of it", () => {
    expect(bandOf(city.crowdHigh, "high", city)).toBe("packed");
    expect(bandOf(city.crowdHigh - 1, "high", city)).toBe("busy");
    expect(bandOf(Math.ceil(city.crowdHigh / 2), "high", city)).toBe("busy");
    expect(bandOf(Math.ceil(city.crowdHigh / 2) - 1, "high", city)).toBe("quiet");
    expect(bandOf(city.crowdLow, "low", city)).toBe("packed");
    expect(sampleCrowd(hub, pool, THURSDAY, "low", city).band).toBe("packed");
  });
});

describe("players in the sample", () => {
  const others = Array.from({ length: city.playersMax + 2 }, (_, index) => ({ look: "chr_tunde", name: index === 0 ? null : `player${String(index)}` }));

  test("[R-CITY-015] given more players present than playersMax, when the sample is drawn, then at most playersMax of it are players and the rest live in the city", () => {
    const sample = sampleCrowd(hub, pool, THURSDAY, "high", city, others);
    expect(sample.people.filter((shown) => shown.kind === "player")).toHaveLength(city.playersMax);
    expect(sample.people).toHaveLength(crowdSize(hub, "high", city));
  });

  test("[R-CITY-015] given a stranger and a named player, when the sample is drawn, then the stranger has no tag and the name is the server's, and no resident has a tag", () => {
    const sample = sampleCrowd(hub, pool, THURSDAY, "high", city, others);
    const players = sample.people.filter((shown) => shown.kind === "player");
    expect(players.map((shown) => shown.tag).reverse()).toEqual([null, "player1", "player2", "player3"].slice(0, city.playersMax));
    expect(sample.people.filter((shown) => shown.kind === "resident" && shown.tag !== null)).toEqual([]);
  });

  test("[R-CITY-015] given no presence, when the sample is drawn, then everyone in it is a computer person", () => {
    expect(sampleCrowd(hub, pool, THURSDAY, "high", city).people.every((shown) => shown.kind === "resident")).toBe(true);
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
    for (const person of ROSTER) {
      const spec = ALL_PEOPLE.find((built) => `shared/chr/${built.name}.glb` === person.file);
      expect(spec, person.file).toBeDefined();
      expect(spec?.body.startsWith(person.sex), person.file).toBe(true);
    }
    expect(pool.length).toBe(hubFile.people.sample.length);
  });
});
