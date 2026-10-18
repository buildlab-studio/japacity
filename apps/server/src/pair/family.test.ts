import { describe, expect, test } from "vitest";

import { held, view } from "../authority/authority.testing";
import { FRIEND, INVITER, must, pairServer, siblings, stateOf, tuned, twoSiblings } from "./pair.testing";

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

/** Two linked siblings, the request open in the inviter's life and copied to the friend's, then paid by the inviter. */
async function paidInOne() {
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
  const sibling = await stateOf(target, b);
  await must(target, INVITER, { type: "offer/choose", offer: opened.id, choice: "pay" });
  return { target, b, opened, copies, sibling, after: await stateOf(target, b) };
}

describe("a family request shared between sibling players", () => {
  test("[person:family-requests-shared] given two linked siblings at home, when the request opens in one life and that life pays it, then the other life gets a copy with the same terms and then the handled notice and standing +1, and nothing is paid there", async () => {
    const { target, b, opened, copies, sibling, after } = await paidInOne();
    expect(copies.at(-1)).toMatchObject({ type: "people/family-request", offer: REQUEST, terms: opened.terms });
    expect(copies.at(-1)).not.toHaveProperty("handled");
    expect(Object.values(sibling.offer.items).some((item) => item.entry === REQUEST)).toBe(true);

    const handled = (await authorityRequests(target, b)).at(-1);
    expect(handled).toMatchObject({ offer: REQUEST, terms: opened.terms, handled: true });
    expect(after.quality["quality.standing"]).toBe((sibling.quality["quality.standing"] ?? 0) + 1);
    expect((await held(target, b)).character.v).toBeGreaterThan(sibling.v);
    expect(after.wallet).toEqual(sibling.wallet);
  });

  test("[person:family-requests-shared] given a copy open in a sibling's life, when the other life pays the request, then the copy closes there through offer/close: gone from the state and the view", async () => {
    const { target, after } = await paidInOne();
    expect(Object.values(after.offer.items).some((item) => item.entry === REQUEST)).toBe(false);
    const shown = (await view(target, FRIEND)).body;
    if (!shown.ok) throw new Error(`No view: ${shown.code}`);
    expect(shown.view.offers.some((offer) => offer.entry === REQUEST)).toBe(false);
  });
});
