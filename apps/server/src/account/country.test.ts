import { describe, expect, test } from "vitest";

import { countryOf, signUpCountry } from "./country";

describe("a request's country", () => {
  test("[account:country-comes-from-cloudflare] given Cloudflare's country on the request, when the country is read, then it is used before the header", () => {
    const request = Object.assign(new Request("https://japacity.test/", { headers: { "cf-ipcountry": "GB" } }), { cf: { country: "NG" } });
    expect(countryOf(request)).toBe("NG");
    expect(countryOf(new Request("https://japacity.test/", { headers: { "cf-ipcountry": "gb" } }))).toBe("GB");
  });

  test("[account:country-comes-from-cloudflare] given an empty country on the request or in the header, when the country is read, then it is none", () => {
    const empty = Object.assign(new Request("https://japacity.test/", { headers: { "cf-ipcountry": "gb" } }), { cf: { country: "" } });
    expect(countryOf(empty)).toBe("GB");
    expect(countryOf(new Request("https://japacity.test/", { headers: { "cf-ipcountry": "" } }))).toBeNull();
  });

  test("[account:country-comes-from-cloudflare] given XX, T1 or no country, when the sign-up country is read, then the code is kept as given and none reads as XX", () => {
    for (const code of ["XX", "T1"]) expect(signUpCountry(new Request("https://japacity.test/", { headers: { "cf-ipcountry": code } }))).toBe(code);
    expect(signUpCountry(new Request("https://japacity.test/"))).toBe("XX");
  });
});
