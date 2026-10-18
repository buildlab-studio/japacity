import { blockedWords, reservedNames } from "@japacity/content";
import { time } from "@japacity/sim";
import { afterEach, describe, expect, test, vi } from "vitest";

import { harness, makeJar } from "../auth/auth.testing";
import { productionConfig } from "../config";
import { generatedUsername, nameProblem, renameFrom } from "./username";

afterEach(() => {
  vi.useRealTimers();
});

describe("the username's text", () => {
  test("[account:username-and-unconfirmed-email] given names at the edges of the shape, when each is judged, then 3 and 20 letters, digits or underscores pass and 2, 21 or any other sign do not", () => {
    expect(nameProblem("abc")).toBeNull();
    expect(nameProblem("a".repeat(20))).toBeNull();
    expect(nameProblem("Tunde_1990")).toBeNull();
    for (const bad of ["ab", "a".repeat(21), "tunde-1990", "tunde 1990", "tùnde", "tunde!", "", 42, null]) expect(nameProblem(bad)).toBe("format");
  });

  test("[account:username-and-unconfirmed-email] given the reserved names in any capitals or spelling, when each is judged, then it is reserved", () => {
    for (const name of ["Japacity", "japa_city", "J4PACITY", "Admin", "adm1n", "aaadmin", "the_admin", "SUPPORT", "suppport_desk", "staff_ng", "0fficial", "Moderator", "m0d3rat0r"]) {
      expect(nameProblem(name)).toBe("reserved");
    }
    expect(reservedNames.every((word) => nameProblem(word) === "reserved")).toBe(true);
  });

  test("[account:username-and-unconfirmed-email] given the blocked words in any capitals or spelling, when each is judged, then it is blocked; ordinary names that only hold their letters apart are not", () => {
    expect(blockedWords.every((word) => nameProblem(word) === "blocked")).toBe(true);
    for (const name of ["FUCK_off", "sh1t_happens", "b1tch", "big_ashawo"]) expect(nameProblem(name)).toBe("blocked");
    for (const name of ["Dickson_O", "Nazir_Kano", "Essex_girl", "Cassandra", "grapefruit"]) expect(nameProblem(name)).toBeNull();
  });

  test("[account:username-and-unconfirmed-email] given names with and without a listed word, when their capitals change, then the judgement does not", () => {
    for (const name of ["tunde", "admin_ng", "b1tch", "ngozi_okafor", "j4pacity", "kemi_99"]) {
      expect(nameProblem(name.toUpperCase())).toBe(nameProblem(name));
    }
  });

  test("[account:username-and-unconfirmed-email] given an account, when its next change is read, then the free change is open at once and each later one waits renameDays", () => {
    expect(renameFrom({ usernameChangedAt: null }, productionConfig)).toBe(0);
    expect(renameFrom({ usernameChangedAt: 5_000 }, productionConfig)).toBe(5_000 + productionConfig.account.renameDays * time.DAY_MS);
  });

  test("[account:username-and-unconfirmed-email] given random bytes, when a name is generated for a reset, then it has the shape and passes the lists", () => {
    let seed = 3;
    const bytes = (count: number) => Uint8Array.from({ length: count }, () => (seed = (seed * 48271) % 2147483647) & 255);
    for (let round = 0; round < 50; round += 1) expect(nameProblem(generatedUsername(bytes))).toBeNull();
  });
});

describe("the username on the server", () => {
  test("[account:username-and-unconfirmed-email] given a username held in other capitals, when a guest starts with it, then it is refused as taken and nothing is made", async () => {
    const h = harness();
    await h.guest(makeJar(), { username: "Ada_Lagos" });
    const jar = makeJar();
    await h.passAge(jar);
    const reply = await h.startGuest(jar, { username: "ada_lagos" });
    expect(reply.status).toBe(409);
    expect(await reply.json()).toMatchObject({ ok: false, code: "not-legal", name: "taken" });
    expect(h.tables.user).toHaveLength(1);
  });

  test("[account:username-and-unconfirmed-email] given a reserved, blocked or ill-formed name, when a guest starts with it, then the server refuses it and says which", async () => {
    const h = harness();
    for (const [username, name] of [["Admin_NG", "reserved"], ["b1tch_queen", "blocked"], ["no", "format"]] as const) {
      const jar = makeJar();
      await h.passAge(jar);
      const reply = await h.startGuest(jar, { username });
      expect(reply.status).toBe(400);
      expect(await reply.json()).toMatchObject({ code: "not-legal", name });
    }
    expect(h.tables.user).toEqual([]);
  });

  test("[account:username-and-unconfirmed-email] given a guest, when it changes its username, then the first change is free, the next waits exactly renameDays, and a taken name is refused", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.parse("2026-10-09T19:00:00Z");
    vi.setSystemTime(start);
    const h = harness();
    await h.guest(makeJar(), { username: "bola_abuja" });
    const { jar, account } = await h.guest(makeJar(), { username: "ada_lagos" });
    const rename = (username: string) => h.call("/api/account/username", { method: "PUT", jar, json: { username } });

    expect(await (await rename("Bola_Abuja")).json()).toMatchObject({ code: "not-legal", name: "taken" });
    const first = await rename("Ada_Ibadan");
    expect(first.status).toBe(200);
    const waitUntil = start + productionConfig.account.renameDays * time.DAY_MS;
    expect(await first.json()).toMatchObject({ ok: true, account: { id: account, username: "Ada_Ibadan", renameFrom: waitUntil } });

    vi.setSystemTime(waitUntil - 1);
    const early = await rename("Ada_Kano");
    expect(early.status).toBe(403);
    expect(await early.json()).toMatchObject({ name: "wait" });
    vi.setSystemTime(waitUntil);
    expect(await (await rename("Ada_Kano")).json()).toMatchObject({ ok: true, account: { username: "Ada_Kano" } });
    expect((await rename("not ok")).status).toBe(400);
  });

  test("[account:username-and-unconfirmed-email] given a username, when anything tries to sign in with it, then no such way in exists", async () => {
    const h = harness();
    await h.guest(makeJar(), { username: "ada_lagos" });
    for (const path of ["/api/auth/sign-in/username", "/api/auth/sign-in/email"]) {
      const reply = await h.call(path, { method: "POST", jar: makeJar(), json: { username: "ada_lagos", email: "ada_lagos", password: "anything at all here" } });
      expect(reply.status).toBeGreaterThanOrEqual(400);
      expect(reply.headers.get("set-cookie") ?? "").not.toContain("session_token");
    }
  });
});
