import { describe, expect, test } from "vitest";

import { productionConfig } from "../config";
import { countryOf, regionOf } from "./region";

const { regions } = productionConfig;

describe("a request's region", () => {
  test("[R-ACCOUNT-008] given Cloudflare's country on the request, when the region is read, then it is used before the header", () => {
    const request = Object.assign(new Request("https://japacity.test/", { headers: { "cf-ipcountry": "GB" } }), { cf: { country: "NG" } });
    expect(countryOf(request)).toBe("NG");
    expect(countryOf(new Request("https://japacity.test/", { headers: { "cf-ipcountry": "gb" } }))).toBe("GB");
  });

  test("[R-ACCOUNT-008] given XX, T1 or no country, when the row is read, then the unknown row applies and the code is kept as given", () => {
    for (const code of ["XX", "T1"]) {
      const request = new Request("https://japacity.test/", { headers: { "cf-ipcountry": code } });
      expect(regionOf(regions, request)).toEqual({ country: code, policy: regions.unknown });
    }
    expect(regionOf(regions, new Request("https://japacity.test/"))).toEqual({ country: "XX", policy: regions.unknown });
  });

  test("[R-ACCOUNT-007] given the policy table, when Australia and Nigeria are read, then one row is closed and the other open, from config alone", () => {
    const at = (code: string) => regionOf(regions, new Request("https://japacity.test/", { headers: { "cf-ipcountry": code } })).policy;
    expect(at("AU").open).toBe(false);
    expect(at("NG").open).toBe(true);
    const moved = { ...regions, AU: { open: true, interaction: "none" as const, ageCheck: "declared" as const } };
    expect(regionOf(moved, new Request("https://japacity.test/", { headers: { "cf-ipcountry": "AU" } })).policy.open).toBe(true);
  });
});
