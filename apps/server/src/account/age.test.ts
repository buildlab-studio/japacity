import { describe, expect, test } from "vitest";

import { productionConfig } from "../config";
import { ageOn, parseBirthDate, plausible, readCookie } from "./age";

const at = (text: string) => Date.parse(`${text}T12:00:00Z`);
const birth = (text: string) => {
  const parsed = parseBirthDate(text);
  if (parsed === null) throw new Error(`Not a date: ${text}`);
  return parsed;
};

describe("the age screen's arithmetic", () => {
  test("[account:age-screen-refuses-minors] given a birthday exactly the least age ago today, when the age is taken, then it is the least age; a day later born is one short", () => {
    const { minAge } = productionConfig.account;
    expect(ageOn(birth("2008-10-08"), at("2026-10-08"))).toBe(minAge);
    expect(ageOn(birth("2008-10-09"), at("2026-10-08"))).toBe(minAge - 1);
    expect(ageOn(birth("2008-10-08"), Date.parse("2026-10-08T00:00:00Z"))).toBe(minAge);
    expect(ageOn(birth("2008-10-08"), Date.parse("2026-10-07T23:59:59Z"))).toBe(minAge - 1);
  });

  test("[account:age-screen-refuses-minors] given a birthday on 29 February, when a year without one comes, then the age turns on 1 March", () => {
    expect(ageOn(birth("2008-02-29"), at("2026-02-28"))).toBe(17);
    expect(ageOn(birth("2008-02-29"), at("2026-03-01"))).toBe(18);
    expect(ageOn(birth("2008-02-29"), at("2028-02-29"))).toBe(20);
  });

  test("[account:age-screen-refuses-minors] given text that is not a real date, when it is parsed, then it is refused", () => {
    for (const text of ["2008-02-30", "2007-02-29", "2008-13-01", "2008-1-01", "08-01-01", "", "1990-05-17T00:00:00Z"]) {
      expect(parseBirthDate(text)).toBeNull();
    }
    expect(parseBirthDate(19900517)).toBeNull();
    expect(parseBirthDate("1990-05-17")).toEqual({ year: 1990, month: 5, day: 17 });
  });

  test("[account:age-screen-refuses-minors] given a date after today or before 1900, when it is judged, then it is not believed", () => {
    const now = at("2026-10-08");
    expect(plausible(birth("2026-10-09"), now)).toBe(false);
    expect(plausible(birth("1899-12-31"), now)).toBe(false);
    expect(plausible(birth("1900-01-01"), now)).toBe(true);
    expect(plausible(birth("2026-10-08"), now)).toBe(true);
  });

  test("[account:age-screen-refuses-minors] given a cookie header, when the refusal cookie is read, then only that name matches", () => {
    expect(readCookie("a=1; japacity-age-refused=1; b=2", "japacity-age-refused")).toBe("1");
    expect(readCookie("xjapacity-age-refused=1", "japacity-age-refused")).toBeNull();
    expect(readCookie(null, "a")).toBeNull();
  });
});
