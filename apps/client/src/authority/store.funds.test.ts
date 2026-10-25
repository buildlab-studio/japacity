// A refusal the engine gives a reason for is said by its reason (route-gates:canada-funds-checked-at-departure): the flight refused
// for Canada's funds says the money is short, never only "not possible".
import { text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { fakeAuthority, newGame } from "../shared/testing/fixtures";
import { createGameStore, rejectionWords } from "./store";

describe("a refusal for the funds", () => {
  test("[route-gates:canada-funds-checked-at-departure] given the flight refused with the reason funds, when the reply comes, then the words say the funds are short on the day", async () => {
    const authority = fakeAuthority(newGame("scenario.teacher").view());
    const store = createGameStore(authority);
    await store.getState().refresh();
    authority.rejectNext({ code: "not-legal", detail: "The money to show is short.", reason: "funds" });
    await store.getState().send({ type: "route/depart", route: "route.canada-points" });
    expect(store.getState().rejection?.words).toBe(text["reject.not-legal.funds"]);
    expect(rejectionWords("not-legal", "funds")).not.toBe(rejectionWords("not-legal"));
  });
});
