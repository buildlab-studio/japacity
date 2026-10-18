import { describe, expect, test } from "vitest";

import type { SwitchName, SwitchStore } from "../switches";
import { DEFAULT_SWITCH_ROW, MAX_DIAL } from "../switches";

/** The switches on by default. */
const NAMES: SwitchName[] = [
  "signups",
  "lottery",
  "adverts",
  "partnerPlay",
  "boards.this-week.everyone",
  "boards.this-week.friends",
  "boards.all-time.everyone",
  "boards.all-time.friends",
];

/** The contract every SwitchStore keeps. `make` returns an empty store each time it is called. */
export function suiteForSwitchStore(make: () => Promise<SwitchStore>): void {
  describe("SwitchStore contract", () => {
    test("[server:four-off-switches] given an empty store, when it is read, then every switch is on, no dial is set and the log is empty", async () => {
      const store = await make();
      expect(await store.read()).toEqual(DEFAULT_SWITCH_ROW);
      expect(await store.log()).toEqual([]);
    });

    test.each(NAMES)("[server:four-off-switches] given the %s switch turned off and on again, when the row is read after each, then only that switch moved", async (name) => {
      const store = await make();

      const off = await store.set(name, false, "account.owner", "busy", 1_000);
      expect(off).toEqual({ ...DEFAULT_SWITCH_ROW, switches: { ...DEFAULT_SWITCH_ROW.switches, [name]: false } });
      expect(await store.read()).toEqual(off);

      await store.set(name, true, "account.owner", "calm", 2_000);
      expect(await store.read()).toEqual(DEFAULT_SWITCH_ROW);
    });

    test("[city:boards-switch-when-and-who] given an empty store, when it is read, then the four boards are on and the joined-week board is off; when that one is turned on and off, then only it moved", async () => {
      const store = await make();
      const { switches } = await store.read();
      expect([switches["boards.this-week.everyone"], switches["boards.this-week.friends"], switches["boards.all-time.everyone"], switches["boards.all-time.friends"]]).toEqual([true, true, true, true]);
      expect(switches["boards.joined-week"]).toBe(false);

      const on = await store.set("boards.joined-week", true, "account.owner", "trying it", 1_000);
      expect(on).toEqual({ ...DEFAULT_SWITCH_ROW, switches: { ...DEFAULT_SWITCH_ROW.switches, "boards.joined-week": true } });
      expect(await store.read()).toEqual(on);
      await store.set("boards.joined-week", false, "account.owner", "quiet week", 2_000);
      expect(await store.read()).toEqual(DEFAULT_SWITCH_ROW);
      expect((await store.log()).map((row) => row.change)).toEqual([
        { switch: "boards.joined-week", on: true },
        { switch: "boards.joined-week", on: false },
      ]);
    });

    test("[server:private-settings-and-dials] given each dial set, when the row is read, then it holds them; when one is unset, then it is absent again and the others stay", async () => {
      const store = await make();
      await store.setDial({ dial: "placeTarget", place: "place.ojuelegba", value: 40 }, "account.owner", "crowd tuning", 1);
      await store.setDial({ dial: "placeTarget", place: "place.yaba", value: 0 }, "account.owner", "crowd tuning", 2);
      const set = await store.setDial({ dial: "computerAfterMonths", value: 3 }, "account.owner", "crowd tuning", 3);

      const dials = { placeTargets: { "place.ojuelegba": 40, "place.yaba": 0 }, computerAfterMonths: 3 };
      expect(set).toEqual({ ok: true, value: { switches: DEFAULT_SWITCH_ROW.switches, dials } });
      expect(await store.read()).toEqual({ switches: DEFAULT_SWITCH_ROW.switches, dials });

      await store.setDial({ dial: "placeTarget", place: "place.ojuelegba", value: null }, "account.owner", "crowd came", 5);
      expect((await store.read()).dials).toEqual({ placeTargets: { "place.yaba": 0 }, computerAfterMonths: 3 });
      await store.setDial({ dial: "computerAfterMonths", value: null }, "account.owner", "crowd came", 6);
      expect((await store.read()).dials).toEqual({ placeTargets: { "place.yaba": 0 }, computerAfterMonths: null });
    });

    test("[server:private-settings-and-dials] given a dial value below 0, above the largest or not whole, when it is set, then it is refused with bad-write, the row keeps its value and nothing is logged", async () => {
      const store = await make();
      await store.setDial({ dial: "computerAfterMonths", value: 2 }, "account.owner", "crowd tuning", 1);
      const before = await store.read();

      for (const value of [-1, 0.5, MAX_DIAL + 1, Number.NaN, Number.POSITIVE_INFINITY]) {
        const refused = await store.setDial({ dial: "computerAfterMonths", value }, "account.owner", "typo", 2);
        expect(refused).toMatchObject({ ok: false, code: "bad-write" });
      }
      expect(await store.setDial({ dial: "placeTarget", place: "place.yaba", value: -1 }, "account.owner", "typo", 3)).toMatchObject({ ok: false, code: "bad-write" });

      expect(await store.read()).toEqual(before);
      expect(await store.log()).toHaveLength(1);

      expect(await store.setDial({ dial: "computerAfterMonths", value: MAX_DIAL }, "account.owner", "edge", 4)).toMatchObject({ ok: true });
      expect(await store.setDial({ dial: "computerAfterMonths", value: 0 }, "account.owner", "edge", 5)).toMatchObject({ ok: true });
    });

    test("[server:four-off-switches] given switches and dials changed, when the log is read, then it holds every change with who, when and why, in order, the repeats included", async () => {
      const store = await make();
      await store.set("lottery", false, "account.owner", "draw fault", 10);
      await store.set("lottery", false, "account.second", "still off", 20);
      await store.setDial({ dial: "placeTarget", place: "place.ojuelegba", value: 25 }, "account.owner", "quiet night", 30);
      await store.set("lottery", true, "account.owner", "fixed", 40);

      const log = await store.log();
      expect(log.map(({ at, admin, reason, change }) => ({ at, admin, reason, change }))).toEqual([
        { at: 10, admin: "account.owner", reason: "draw fault", change: { switch: "lottery", on: false } },
        { at: 20, admin: "account.second", reason: "still off", change: { switch: "lottery", on: false } },
        { at: 30, admin: "account.owner", reason: "quiet night", change: { dial: "placeTarget", place: "place.ojuelegba", value: 25 } },
        { at: 40, admin: "account.owner", reason: "fixed", change: { switch: "lottery", on: true } },
      ]);
      const numbers = log.map((row) => row.n);
      expect(numbers).toEqual([...numbers].sort((left, right) => left - right));
      expect(new Set(numbers).size).toBe(numbers.length);
    });

    test("[server:four-off-switches] given a row read, when the caller changes what it holds, then the stored row does not change", async () => {
      const store = await make();
      const read = await store.read();
      read.switches.signups = false;
      read.dials.placeTargets["place.yaba"] = 9;
      const log = await store.log();
      log.push({ n: 1, at: 1, admin: "nobody", reason: "nothing", change: { switch: "adverts", on: false } });

      expect(await store.read()).toEqual(DEFAULT_SWITCH_ROW);
      expect(await store.log()).toEqual([]);
    });
  });
}
