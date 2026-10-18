// The police certificate in content: document:police-certificate-for-routes.
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { content, text } from "../index";

const POLICE: Id<"document"> = "document.police-certificate";
const GET_POLICE: Id<"activity"> = "activity.get-police-certificate";
const ASKING: Id<"route">[] = ["route.canada-points", "route.uk-skilled", "route.uk-care", "route.gulf-contract"];
const MASTERS: Id<"route"> = "route.uk-masters";

describe("the police certificate", () => {
  test("[document:police-certificate-for-routes] given the entry, when it is read, then it waits one to three months, lasts twelve, and has a name and a line about it", () => {
    expect(content.document[POLICE]).toEqual({ id: POLICE, wait: [1, 3], validMonths: 12, result: null });
    expect(text[`${POLICE}.name`]).toBe("Police character certificate");
    expect(text[`${POLICE}.blurb`]).toBeDefined();
  });

  test("[document:police-certificate-for-routes] given the act that asks for it, when it is read, then it costs ₦5,000 as a paper's fee, requests the certificate, counts toward the four routes and stands at the visa centre", () => {
    const act = content.activity[GET_POLICE]!;
    expect(act.cost).toEqual([{ currency: "NGN", amount: 500000, reason: "fee-document" }]);
    expect(act.effects).toEqual([{ type: "document/request", document: POLICE }]);
    expect([...act.counts].sort()).toEqual([...ASKING].sort());
    const staging = Object.values(content.place).filter((place) => (place.stages as readonly string[]).includes(GET_POLICE)).map((place) => place.id);
    expect(staging).toEqual(["place.visa-centre"]);
    expect(text[`${GET_POLICE}.name`]).toBeDefined();
  });

  test("[document:police-certificate-for-routes] given the checklists, when they are read, then the four routes that take one ask for it with a weight and words, the master's does not, and every checklist still adds up to 100", () => {
    for (const id of ASKING) {
      const route = content.route[id]!;
      const police = route.checklist.find((item) => item.id === "police");
      expect(police).toMatchObject({ requirement: { type: "document/held", document: POLICE }, partial: false });
      expect(police!.weight).toBeGreaterThan(0);
      expect(text[`${id}.item.police`]).toBe("Police certificate held");
    }
    expect(content.route[MASTERS]!.checklist.some((item) => item.id === "police")).toBe(false);
    const asking = Object.values(content.route).filter((route) => route.checklist.some((item) => item.requirement.type === "document/held" && item.requirement.document === POLICE));
    expect(asking.map((route) => route.id).sort()).toEqual([...ASKING].sort());
    for (const route of Object.values(content.route)) {
      if (route.checklist.length === 0) continue;
      expect(route.checklist.reduce((sum, item) => sum + item.weight, 0)).toBe(100);
    }
  });
});
