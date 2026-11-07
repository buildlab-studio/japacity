// Shipped lives carried across a content version raise on the real bundles (server:newer-content-upgrades-state,
// server:older-contents-bundled, server:save-is-list-of-segments, server:snapshot-before-deploy): for every older
// version the server bundles, and for a stand-in older version so the path runs while the list is empty, typical
// lives are played through the server's own routes under that version, then the worker's contents change to the
// current one and each life is loaded and played on. Nothing may diverge or be rejected, the upgrade is written
// once, and the carried state holds the current shape.
import { content, olderContents, presetAnswer } from "@japacity/content";
import type { PresetReply, ServerReply, ViewReply } from "@japacity/api";
import type { Command, Content, FlatSave, PlayerView, State, World } from "@japacity/sim";
import { checkContent, checkInvariants, hashState, newState, offlineCalendar, stepWorld, upgradeState } from "@japacity/sim";
import { lifeSaves } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { productionConfig } from "../config";
import type { Contents } from "../dependencies";
import { rollbackCheck } from "../ops/rollback";
import { snapshotAll } from "../ops/snapshot";
import { workerContents } from "../ops/database";
import { apply } from "./load";
import { contentsFor, withContentBefore } from "./overlay";
import type { TestServer } from "./authority.testing";
import { call, held, signUp, testServer } from "./authority.testing";
import { transact } from "./transaction";

const { epoch, worldTickMs } = productionConfig.clock;
const ACCOUNT = "acc-carried";
const PROLOGUE = "scenario.prologue";
const DEVELOPER = { archetype: "developer", age: 0, home: "family-house" } as const;
const WATER = { archetype: "water", age: 0, home: "makoko" } as const;
const HUNT = "activity.job-hunt";
const ASK_FISHERMAN = "activity.ask-fisherman";
const CREW = "activity.job-canoe-crew";
const RACKS = "activity.job-fish-racks";
const DELIVERIES = "activity.canoe-deliveries";
/** The shortest recorded life that ends abroad. */
const ABROAD = "developer-remote";

/** The current data under the name "0": stands in for an older version while `olderContents` is empty. */
const standIn: Content = { ...content, version: "0" };

/** Each older version with the worker's contents that carry a life from it: the worker's own for a frozen version. */
const VERSIONS: [string, Content, Contents][] = [
  ...olderContents.map((older): [string, Content, Contents] => [`content ${older.version} as it shipped`, older, workerContents(undefined)]),
  ["a stand-in older content", standIn, withContentBefore(contentsFor(content, undefined), undefined, [...olderContents, standIn])],
];

type Loose = Command extends infer C ? (C extends { basedOn: number } ? Omit<C, "basedOn"> : never) : never;

/** One life on the test server: its character and the account that plays it. */
interface Life {
  server: TestServer;
  id: string;
}

/** A server whose worker runs `older` alone, as the commit before the raise does. */
function serverUnder(older: Content): TestServer {
  const server = testServer();
  server.deps.contents = { current: older, previous: null };
  return server;
}

async function storedV(life: Life): Promise<number> {
  return (await held(life.server, life.id)).character.v;
}

/** Sends `command` on the stored version through the command route; a rejection fails the case with its code. */
async function play(life: Life, command: Loose): Promise<PlayerView> {
  const reply = await call<ServerReply>(life.server, "POST", "/api/command", ACCOUNT, { command: { ...command, basedOn: await storedV(life) }, basedOn: await storedV(life) });
  if (reply.status !== 200 || !reply.body.ok) throw new Error(`${command.type} answered ${String(reply.status)}: ${reply.text}`);
  return reply.body.view;
}

/** A month ended one world tick later, every free slot resting. */
async function month(life: Life): Promise<PlayerView> {
  life.server.wait(worldTickMs);
  return play(life, { type: "turn/end", slots: [] });
}

async function viewOf(life: Life): Promise<PlayerView> {
  const reply = await call<ViewReply>(life.server, "GET", "/api/view", ACCOUNT);
  if (reply.status !== 200 || !reply.body.ok) throw new Error(`The view answered ${String(reply.status)}: ${reply.text}`);
  return reply.body.view;
}

/** A new account's life at the door, as Begin makes it: a guest's when asked. */
async function atTheDoor(older: Content, guest = false): Promise<Life> {
  const server = serverUnder(older);
  await signUp(server, ACCOUNT, ACCOUNT, guest ? "guest" : "secured");
  const made = await call<ViewReply>(server, "POST", "/api/character", ACCOUNT, { scenario: PROLOGUE });
  if (!made.body.ok) throw new Error(`No character: ${made.text}`);
  const row = await server.deps.stores.account.get(ACCOUNT);
  if (row === null || row.character === null) throw new Error("The account names no character.");
  return { server, id: row.character };
}

/** Begin's preset, played by the server from the stored version. */
async function preset(life: Life, door: { archetype: string; age: number; home: string }): Promise<PlayerView> {
  const reply = await call<PresetReply>(life.server, "POST", "/api/prologue/preset", ACCOUNT, { ...door, basedOn: await storedV(life) });
  if (!reply.body.ok || reply.body.refusal !== undefined) throw new Error(`The preset answered ${reply.text}`);
  return reply.body.view;
}

async function handedOver(older: Content, door: { archetype: string; age: number; home: string } = DEVELOPER): Promise<Life> {
  const life = await atTheDoor(older);
  expect((await preset(life, door)).prologue).toBeNull();
  return life;
}

/** The hunt applied for now, for the first job the view offers it. */
async function hunt(life: Life): Promise<PlayerView> {
  const job = (await viewOf(life)).activities.find((option) => option.id === HUNT)?.params?.[0];
  if (job === undefined) throw new Error("The life has no job to hunt.");
  return play(life, { type: "activity/now", activity: HUNT, param: job });
}

/** activity:boat-work-at-the-net-shed: Sewanu asked at the net shed, and his place in the canoe taken. */
async function takeTheCanoe(life: Life): Promise<void> {
  const asked = await play(life, { type: "activity/now", activity: ASK_FISHERMAN, param: null });
  const offer = asked.offers.find((open) => open.entry === "offer.canoe-place")?.id;
  if (offer === undefined) throw new Error("Sewanu offered no place.");
  await play(life, { type: "offer/choose", offer, choice: "accept" });
}

function jobOffer(view: PlayerView): string | null {
  return view.offers.find((offer) => offer.entry === "offer.job")?.id ?? null;
}

async function pastOneSnapshot(older: Content): Promise<Life> {
  const life = await handedOver(older);
  while ((await storedV(life)) <= life.server.deps.config.server.snapshotEvery + 4) await month(life);
  const stored = await held(life.server, life.id);
  expect(stored.snapshot.v).toBeGreaterThan(0);
  expect(stored.tail.length).toBeGreaterThan(0);
  return life;
}

/** server:snapshot-before-deploy: the snapshot step run by the commit before the raise, on every character. */
async function snapshotStep(life: Life): Promise<void> {
  const done = await snapshotAll(life.server.deps);
  expect(done.map((one) => one.outcome)).toEqual(["snapshotted"]);
  const stored = await held(life.server, life.id);
  expect(stored.tail).toEqual([]);
  expect(stored.segments.at(-1)?.start).toHaveProperty("base");
}

/** The stored worlds a recorded life was played on, under the older content, one row a tick. */
async function storeWorlds(server: TestServer, older: Content, worldSeed: string, upTo: number): Promise<World[]> {
  const worlds: World[] = [];
  let book = null;
  for (let tick = 0; tick <= upTo; tick += 1) {
    const stepped = stepWorld(book, worldSeed, older, offlineCalendar(tick), 1);
    book = stepped.book;
    worlds.push(stepped.world);
    await server.deps.stores.world.insertTick({ tick, world: stepped.world, book, content: older.version, hash: hashState(stepped) });
  }
  return worlds;
}

/** A recorded life stored through the server's command path under the older content, every command logged at its own tick. */
async function recorded(older: Content, save: FlatSave): Promise<Life> {
  const server = serverUnder(older);
  const last = save.commands.at(-1)?.tick ?? 0;
  const worlds = await storeWorlds(server, older, save.worldSeed, last);
  server.setNow(epoch + last * worldTickMs);
  await signUp(server, ACCOUNT);
  const id = "character-recorded";
  const start = { scenario: save.scenario, seed: save.seed, worldSeed: save.worldSeed };
  const state = newState(save.scenario, save.seed, older);
  await server.deps.stores.player.create({ id, account: ACCOUNT, refilledAt: server.deps.now(), content: older.version, start, state });
  await server.deps.stores.account.setCharacter(ACCOUNT, id);
  const stored = await transact(
    server.deps,
    [id],
    (lives) => {
      const live = lives[0];
      if (live === undefined) throw new Error("No character.");
      for (const entry of save.commands) {
        const result = apply(live, entry.command, entry.sender, worlds[entry.tick] as World, server.deps.now(), server.deps.config.server.snapshotEvery);
        if (!result.ok) throw new Error(`${entry.command.type} rejected with ${result.code}.`);
      }
      return { ok: true, value: null };
    },
    { grant: false },
  );
  if (stored.kind !== "done") throw new Error(`The life was not stored: ${stored.kind}.`);
  return { server, id };
}

/** The state a load reaches under the worker's contents as they stand, with nothing written. */
async function loadedState(life: Life): Promise<State> {
  const outcome = await transact(life.server.deps, [life.id], (lives) => ({ ok: true, value: lives[0]?.state }), { grant: false });
  if (outcome.kind !== "done" || outcome.value === undefined) throw new Error(`The life did not load: ${outcome.kind}.`);
  return outcome.value;
}

/**
 * The deploy: the worker's contents become the current one's with `older` bundled, and the life's view is fetched.
 * The load replays the segment under its own content and opens one new segment under the current content whose base
 * is the replayed state carried by `upgradeState`, checked as a new life's state is.
 */
async function deploy(life: Life, older: Content, worker: Contents): Promise<void> {
  const before = await held(life.server, life.id);
  const ended = await loadedState(life);
  expect(ended.content).toBe(older.version);
  const carried = upgradeState(ended, older, content);
  life.server.deps.contents = worker;

  await viewOf(life);
  const after = await held(life.server, life.id);
  expect(after.segments.map((segment) => [segment.segment, segment.content])).toEqual([
    ...before.segments.map((segment) => [segment.segment, segment.content]),
    [before.character.segment + 1, content.version],
  ]);
  expect(after.segments.at(-1)).toMatchObject({ fromV: before.character.v, start: { base: carried } });
  expect(after.snapshot).toMatchObject({ segment: before.character.segment + 1, v: before.character.v, content: content.version, state: carried });
  expect(after.tail).toEqual([]);
  const base = after.snapshot.state;
  expect(base.content).toBe(content.version);
  expect(base.schema).toBe(newState(PROLOGUE, "any-seed", content).schema);
  expect(checkInvariants(base, content)).toEqual([]);
  expect(checkContent(content)).toEqual([]);
  expect(JSON.parse(JSON.stringify(base))).toEqual(base);
}

/** Played on under the current content: the upgrade stays written once, and the whole log replays to every stored hash. */
async function carriedOn(life: Life): Promise<void> {
  const segments = (await held(life.server, life.id)).segments;
  await viewOf(life);
  const after = await held(life.server, life.id);
  expect(after.segments).toEqual(segments);
  expect(after.snapshot.content).toBe(content.version);
  expect(checkInvariants(await loadedState(life), content)).toEqual([]);
  const checked = await rollbackCheck(life.server.deps, life.id);
  if (!checked.ok) throw new Error(`The rollback check could not run: ${checked.code} ${checked.detail}`);
  expect(checked.report).toMatchObject({ firstDiff: null, dropped: [] });
}

describe.each(VERSIONS)("lives carried from %s to the current content", (_label, older, worker) => {
  test("[server:newer-content-upgrades-state] [server:older-contents-bundled] [server:save-is-list-of-segments] given a guest in the middle of the years before, when the content changes, then the life loads at the same card under the current content and the preset plays the rest of the years", async () => {
    const life = await atTheDoor(older, true);
    for (let step = 0; step < 3; step += 1) {
      const card = (await viewOf(life)).prologue;
      if (card === null) throw new Error("The prologue closed early.");
      const answer = presetAnswer(DEVELOPER.archetype, DEVELOPER.age, DEVELOPER.home, card.step, card.answers);
      if (answer === null) throw new Error(`No preset answer for ${card.step}.`);
      await play(life, { type: "prologue/choose", step: card.step, answer });
    }
    const open = (await viewOf(life)).prologue;
    expect(open).not.toBeNull();

    await deploy(life, older, worker);
    expect((await viewOf(life)).prologue?.step).toBe(open?.step);
    expect((await preset(life, DEVELOPER)).prologue).toBeNull();
    await month(life);
    await carriedOn(life);
  }, 30_000);

  test("[server:newer-content-upgrades-state] [server:older-contents-bundled] given a life just handed over, at month one with nothing played, when the content changes, then it loads under the current content and its first hunt and month play", async () => {
    const life = await handedOver(older);
    expect((await viewOf(life)).month).toBe(0);
    await deploy(life, older, worker);
    await hunt(life);
    expect(jobOffer(await month(life))).not.toBeNull();
    await carriedOn(life);
  }, 30_000);

  test("[server:newer-content-upgrades-state] [server:older-contents-bundled] given a life with its month planned (the hunt applied for now) and not ended, when the content changes, then the hunt stays done and the month ends with the job's offer", async () => {
    const life = await handedOver(older);
    await hunt(life);
    await deploy(life, older, worker);
    expect((await viewOf(life)).activities.find((option) => option.id === HUNT)).toMatchObject({ done: true });
    const ended = await month(life);
    const offer = jobOffer(ended);
    if (offer === null) throw new Error("The hunt landed no offer.");
    await play(life, { type: "offer/choose", offer, choice: "accept" });
    await carriedOn(life);
  }, 30_000);

  test("[server:newer-content-upgrades-state] [server:older-contents-bundled] given a life with a job offer open from its hunt, when the content changes, then the offer is still open and its Accept and the next month play", async () => {
    const life = await handedOver(older);
    await hunt(life);
    const offer = jobOffer(await month(life));
    if (offer === null) throw new Error("The hunt landed no offer.");
    await deploy(life, older, worker);
    expect(jobOffer(await viewOf(life))).toBe(offer);
    expect((await play(life, { type: "offer/choose", offer, choice: "accept" })).job).not.toBeNull();
    await month(life);
    await carriedOn(life);
  }, 30_000);

  test("[server:newer-content-upgrades-state] [server:snapshots-bound-replay] [server:log-rows-hash-state] given a life past one snapshot with commands logged after it, when the content changes, then the tail replays under the older content and the carried state is the base of the new segment", async () => {
    const life = await pastOneSnapshot(older);
    await deploy(life, older, worker);
    expect((await held(life.server, life.id)).segments.map((segment) => segment.content)).toEqual([older.version, content.version]);
    await month(life);
    await carriedOn(life);
  }, 30_000);

  test("[server:snapshot-before-deploy] [server:newer-content-upgrades-state] given a life the snapshot step opened a new segment for before the deploy, when the content changes, then the snapshot's segment is carried in one more segment and plays on", async () => {
    const life = await pastOneSnapshot(older);
    await snapshotStep(life);
    await deploy(life, older, worker);
    expect((await held(life.server, life.id)).segments.map((segment) => segment.content)).toEqual([older.version, older.version, content.version]);
    await month(life);
    await carriedOn(life);
  }, 30_000);

  test("[server:snapshot-before-deploy] [server:newer-content-upgrades-state] [server:log-rows-hash-state] given a life with commands logged after the snapshot step and before the new code serves it, when the content changes, then those commands replay under the older content and the life is carried and plays on", async () => {
    const life = await pastOneSnapshot(older);
    await snapshotStep(life);
    await hunt(life);
    await month(life);
    expect((await held(life.server, life.id)).tail.length).toBeGreaterThan(0);
    await deploy(life, older, worker);
    await month(life);
    await carriedOn(life);
  }, 30_000);

  test("[server:newer-content-upgrades-state] [server:older-contents-bundled] given the water life in Makoko two months in, when the content changes, then it is carried still living in Makoko and plays on", async () => {
    const life = await handedOver(older, WATER);
    await month(life);
    await month(life);
    expect((await loadedState(life)).home.place).toBe("place.makoko");
    await deploy(life, older, worker);
    expect((await loadedState(life)).home.place).toBe("place.makoko");
    await month(life);
    await carriedOn(life);
  }, 30_000);

  test("[server:newer-content-upgrades-state] [server:older-contents-bundled] [activity:boat-work-at-the-net-shed] given the water life past its first month with work on the water held and its month planned, when the content changes, then it is carried mid-month, takes Sewanu's place in his canoe and is paid by the catch", async () => {
    const life = await handedOver(older, WATER);
    // The boats where the older content has them, else the racks: either way a job on the water is held before the change.
    const boats = older.activity[ASK_FISHERMAN] !== undefined;
    if (boats) await takeTheCanoe(life);
    else {
      await play(life, { type: "activity/now", activity: HUNT, param: RACKS });
      const offer = jobOffer(await month(life));
      if (offer === null) throw new Error("The racks' hunt landed no offer.");
      await play(life, { type: "offer/choose", offer, choice: "accept" });
    }
    while ((await viewOf(life)).month < 2) await month(life);
    // Mid-month: the canoe deliveries asked for now, answered with the month.
    await play(life, { type: "activity/now", activity: HUNT, param: DELIVERIES });
    const held = (await loadedState(life)).activity.job;
    expect(held).toBe(boats ? CREW : RACKS);
    await deploy(life, older, worker);
    expect((await viewOf(life)).activities.find((option) => option.id === HUNT)).toMatchObject({ done: true });
    if (!boats) await takeTheCanoe(life);
    expect((await viewOf(life)).job.id).toBe(CREW);
    await month(life);
    expect((await loadedState(life)).activity.tenure[CREW]).toBeGreaterThan(0);
    expect((await loadedState(life)).draws.catch).toBeGreaterThan(0);
    await carriedOn(life);
  }, 30_000);

  test("[server:newer-content-upgrades-state] [server:older-contents-bundled] [server:save-is-list-of-segments] given the recorded life that ends abroad stored under the older content, when the content changes, then it is carried still abroad and its next month plays", async () => {
    const save = lifeSaves[ABROAD];
    if (save === undefined) throw new Error(`No recorded life ${ABROAD}.`);
    const life = await recorded(older, save);
    expect((await loadedState(life)).place.where).toBe("abroad");
    await deploy(life, older, worker);
    expect((await loadedState(life)).place.where).toBe("abroad");
    await month(life);
    await carriedOn(life);
  }, 60_000);
});
