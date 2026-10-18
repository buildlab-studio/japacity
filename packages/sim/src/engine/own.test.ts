// engine:player-keys-read-as-own: a key the player sent is read as an own property, so a built-in name is refused, never thrown on.
import { describe, expect, test } from "vitest";

import { start } from "../testing/play";
import { ownOf } from "./kind";

const BUILT_IN = ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"];

describe("ownOf", () => {
  test("[engine:player-keys-read-as-own] given a record, when read with a built-in name or a non-string, then nothing is found", () => {
    const record: Record<string, number> = { "offer-1": 1 };
    expect(ownOf(record, "offer-1")).toBe(1);
    for (const key of BUILT_IN) expect(ownOf(record, key)).toBeUndefined();
    expect(ownOf(record, 7)).toBeUndefined();
    expect(ownOf(record, null)).toBeUndefined();
  });

  test("[engine:player-keys-read-as-own] given a started life, when each command names a built-in key, then it is rejected and nothing throws", () => {
    const game = start();
    const commands = (key: string) => [
      { type: "obligation/pay", obligation: key, amount: 100 },
      { type: "offer/choose", offer: key, choice: "yes" },
      { type: "route/pay-deposit", route: key, school: key },
      { type: "route/depart", route: key },
      { type: "setpiece/answer", question: key, answer: key },
      { type: "chapter/lean", route: key },
      { type: "activity/now", activity: key, param: key },
      { type: "interview/answer", question: key, option: key },
      { type: "people/court", with: key },
      { type: "people/invite", slot: key },
      { type: "people/propose", bond: key, step: "date" },
      { type: "people/withdraw", bond: key },
      { type: "people/end", bond: key },
      { type: "prologue/choose", step: key, answer: key },
    ];
    for (const key of BUILT_IN) {
      for (const command of commands(key)) {
        // A throw here is the finding; a rejection of any code is the rule.
        const result = game.send(command as never);
        expect(result.ok, `${command.type} with ${key}`).toBe(false);
      }
    }
  });
});
