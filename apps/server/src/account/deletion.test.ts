import { describe, expect, test } from "vitest";

import { forgettingPresence } from "../app.testing";
import { newLife, testServer } from "../authority/authority.testing";
import { memoryStores } from "../dependencies";
import { requestDeletion } from "./deletion";

describe("deleting an account", () => {
  test("[account:player-deletes-account] given a player standing in a place, when its deletion is asked for, then its sockets close at once and its name leaves the day's list", async () => {
    const presence = forgettingPresence();
    const server = testServer({ stores: { ...memoryStores(), presence } });
    await newLife(server, "acc-gone");
    await newLife(server, "acc-stays");
    for (const account of ["acc-gone", "acc-stays"]) {
      await presence.join("place.ojuelegba", `socket-${account}`, { account, name: account, look: "person_ada", place: "place.ojuelegba", joinedAt: 0 });
    }

    await requestDeletion(server.deps, "acc-gone");

    expect(presence.forgotten).toEqual([{ account: "acc-gone", name: "acc-gone", places: expect.arrayContaining(["place.ojuelegba"]) as string[] }]);
    expect((await presence.sample("place.ojuelegba", 20, null, 0)).map((member) => member.account)).toEqual(["acc-stays"]);
  });
});
