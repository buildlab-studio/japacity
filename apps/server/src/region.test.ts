import { describe, expect, test } from "vitest";

import { productionConfig } from "./config";
import { policyFor, stricter } from "./region";
import type { RegionPolicy } from "./region";

const row = (interaction: RegionPolicy["interaction"], ageCheck: RegionPolicy["ageCheck"] = "declared", open = true): RegionPolicy => ({
  open,
  interaction,
  ageCheck,
});

describe("regions", () => {
  test("[R-ACCOUNT-009] given two rows, when they meet, then the stricter interaction and age check apply", () => {
    expect(stricter(row("matched"), row("invited"))).toEqual(row("invited"));
    expect(stricter(row("none"), row("free-text"))).toEqual(row("none"));
    expect(stricter(row("matched", "verified"), row("matched"))).toEqual(row("matched", "verified"));
    expect(stricter(row("matched"), row("matched", "declared", false)).open).toBe(false);
  });

  test("[R-ACCOUNT-009] given any two rows, when stricter is taken either way round, then the answer is the same", () => {
    const rows: RegionPolicy[] = ["none", "invited", "matched", "free-text"].flatMap((interaction) =>
      (["declared", "verified"] as const).map((ageCheck) => row(interaction as RegionPolicy["interaction"], ageCheck)),
    );
    for (const a of rows) for (const b of rows) expect(stricter(a, b)).toEqual(stricter(b, a));
  });

  test("[R-ACCOUNT-008] given the codes XX and T1 or no country, when the policy is read, then the unknown row applies", () => {
    const { regions } = productionConfig;
    expect(policyFor(regions, "XX")).toBe(regions.unknown);
    expect(policyFor(regions, "T1")).toBe(regions.unknown);
    expect(policyFor(regions, null)).toBe(regions.unknown);
    expect(policyFor(regions, "ZZ")).toBe(regions.default);
    expect(policyFor(regions, "GB")).toBe(regions["GB"]);
  });

  test("[R-ACCOUNT-010] given the launch table, when every open row is read, then none is verified and free-text is set nowhere", () => {
    const rows = Object.entries(productionConfig.regions);
    expect(rows.filter(([, policy]) => policy.interaction === "free-text").map(([name]) => name)).toEqual([]);
    expect(rows.filter(([, policy]) => policy.open && policy.ageCheck !== "declared").map(([name]) => name)).toEqual([]);
    expect(productionConfig.regions["AU"]?.open).toBe(false);
    expect(productionConfig.regions["GB"]?.interaction).toBe("invited");
    expect(productionConfig.regions["NG"]?.interaction).toBe("matched");
  });
});
