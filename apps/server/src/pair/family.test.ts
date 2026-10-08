import { describe, expect, test } from "vitest";

import { held } from "../authority/testing";
import { INVITER, must, pairServer, siblings, stateOf, tuned, twoSiblings } from "./pair.testing";

const REQUEST = "offer.nepa-bill";

/** Two linked siblings at home, with the bill request opening on every month it may. */
function server() {
  return pairServer(
    tuned((copy) => {
      twoSiblings(copy);
      const entry = copy.offer[REQUEST];
      if (entry === undefined) throw new Error(`No ${REQUEST}.`);
      entry.chanceBp = 10000;
      entry.cooldown = 0;
    }),
  );
}

async function authorityRequests(target: ReturnType<typeof server>, character: string) {
  return (await target.deps.stores.player.log(character, 0)).filter((row) => row.sender === "authority" && row.command.type === "people/family-request").map((row) => row.command);
}

describe("a family request shared between sibling players", () => {
  test("[R-PEOPLE-034] given two linked siblings at home, when the request opens in one life and that life pays it, then the other life gets a copy with the same terms and then the handled notice and standing +1", async () => {
    const target = server();
    const { a, b } = await siblings(target);
    const before = (await authorityRequests(target, b)).length;

    let opened = null;
    for (let month = 0; month < 6 && opened === null; month += 1) {
      await must(target, INVITER, { type: "turn/end", slots: [] });
      opened = Object.values((await stateOf(target, a)).offer.items).find((item) => item.entry === REQUEST) ?? null;
    }
    if (opened === null) throw new Error("The request never opened.");

    const copies = (await authorityRequests(target, b)).slice(before);
    expect(copies.at(-1)).toMatchObject({ type: "people/family-request", offer: REQUEST, terms: opened.terms });
    expect(copies.at(-1)).not.toHaveProperty("handled");
    const sibling = await stateOf(target, b);
    expect(Object.values(sibling.offer.items).some((item) => item.entry === REQUEST)).toBe(true);
    const standing = sibling.quality["quality.standing"] ?? 0;

    await must(target, INVITER, { type: "offer/choose", offer: opened.id, choice: "pay" });

    const handled = (await authorityRequests(target, b)).at(-1);
    expect(handled).toMatchObject({ offer: REQUEST, terms: opened.terms, handled: true });
    const after = await stateOf(target, b);
    expect(after.quality["quality.standing"]).toBe(standing + 1);
    // The copy's close is the simulation's offer/close effect (main after this branch's last merge); it is not asserted here.
    expect((await held(target, b)).character.v).toBeGreaterThan(sibling.v);
  });
});
