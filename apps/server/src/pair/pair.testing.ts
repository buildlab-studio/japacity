// Helpers for the pair tests: two signed-up players, a card out, the link
// taken, and commands sent at each life's current version. Never imported by
// the Worker.
import type { ServerReply } from "@japacity/api";
import { content } from "@japacity/content";
import type { Command, Content, PairRecord, State } from "@japacity/sim";
import { pairId } from "@japacity/sim";

import type { TestServer } from "../authority/authority.testing";
import { call, held, newLife, send, signUp, testServer, view } from "../authority/authority.testing";
import { load } from "../authority/load";
import { testConfig } from "../config";
import type { ServerDeps } from "../deps";

export const INVITER = "account-a";
export const FRIEND = "account-b";

type WithoutBase<T> = T extends unknown ? Omit<T, "basedOn"> : never;
export type Order = WithoutBase<Command>;

/** A copy of the real content with some numbers changed for the test. */
export function tuned(change: (copy: Content) => void): Content {
  const copy = JSON.parse(JSON.stringify(content)) as Content;
  change(copy);
  return copy;
}

/** A test server on `current`, with the test login on and any config change. */
export function pairServer(current: Content = content, over: Parameters<typeof testConfig>[0] = {}): TestServer {
  const config = testConfig({ ...over, testing: { testLogin: true } });
  return testServer({ config, contents: { current, previous: null } });
}

/** The account's character's version, after the same load a view makes. */
export async function versionOf(server: TestServer, account: string): Promise<number> {
  const reply = await view(server, account);
  if (!reply.body.ok) throw new Error(`No view for ${account}: ${reply.body.code}`);
  return reply.body.view.v;
}

/** Sends a command from the account's player at its current version. */
export async function act(server: TestServer, account: string, order: Order): Promise<ServerReply> {
  const basedOn = await versionOf(server, account);
  return (await send(server, account, { ...order, basedOn }, basedOn)).body;
}

/** Sends a command that must be accepted. */
export async function must(server: TestServer, account: string, order: Order): Promise<void> {
  const reply = await act(server, account, order);
  if (!reply.ok) throw new Error(`${order.type} from ${account} was rejected with ${reply.code}: ${reply.detail}`);
}

/** The character's state as the server would load it now, without writing. */
export async function stateOf(server: TestServer, character: string): Promise<State> {
  const stored = await held(server, character);
  const worlds = new Map((await Promise.all(stored.tail.map((row) => server.deps.stores.world.tick(row.tick)))).flatMap((row) => (row === null ? [] : [[row.tick, row.world] as const])));
  const loaded = load(stored, server.deps.contents, worlds);
  if (!loaded.ok) throw new Error(`${character} diverged: ${loaded.diverged.detail}`);
  return loaded.live.state;
}

export async function recordOf(deps: ServerDeps, key: string): Promise<{ v: number; record: PairRecord } | null> {
  const row = await deps.stores.pair.get(key);
  return row === null ? null : { v: row.v, record: row.record as PairRecord };
}

/** The player's card out on the partner slot and its link made; answers the code. */
export async function cardOut(server: TestServer, account = INVITER, slot = "partner", looking: "partner" | "sibling" = "partner"): Promise<string> {
  await must(server, account, { type: "people/invite", slot, looking, ...(looking === "partner" ? { fill: "who-codes" } : { fill: "to-go-first" }) });
  const made = await call<{ ok: boolean; code: string; detail?: string }>(server, "POST", "/api/invite", account, { slot });
  if (!made.body.ok) throw new Error(`No link: ${JSON.stringify(made.body)}`);
  return made.body.code;
}

export interface Linked {
  server: TestServer;
  a: string;
  b: string;
  key: string;
  code: string;
}

/** Two players with characters, the inviter's partner card taken by the friend. */
export async function linkedPair(server: TestServer = pairServer()): Promise<Linked> {
  const a = await newLife(server, INVITER, "scenario.graduate");
  const b = await newLife(server, FRIEND, "scenario.banker");
  const code = await cardOut(server);
  const taken = await call<{ ok: boolean; detail?: string }>(server, "POST", `/api/invite/${code}/accept`, FRIEND, { slot: "partner" });
  if (!taken.body.ok) throw new Error(`The link was not taken: ${JSON.stringify(taken.body)}`);
  return { server, a, b, key: pairId(a, b), code };
}

/** The open bond a life holds with the pair. */
export function bondIn(state: State, key: string): string {
  const found = Object.entries(state.people.bonds).find(([, bond]) => bond.with.kind === "player" && bond.with.pair === key && bond.stage !== "ended");
  if (found === undefined) throw new Error(`No open bond with ${key}.`);
  return found[0];
}

/** The last bond a life held with the pair, open or ended. */
export function lastBondIn(state: State, key: string): string {
  const found = Object.entries(state.people.bonds).filter(([, bond]) => bond.with.kind === "player" && bond.with.pair === key).at(-1);
  if (found === undefined) throw new Error(`No bond with ${key}.`);
  return found[0];
}

export { call, newLife, signUp };

/** Says a phrase in the pair's conversation from the account; answers the reply body. */
export async function sayFrom(server: TestServer, account: string, key: string, phrase = "phrase.hello", fill: string | null = null): Promise<{ ok: boolean; code?: string; message?: { id: string } }> {
  return (await call<{ ok: boolean; code?: string; message?: { id: string } }>(server, "POST", `/api/pair/${key}/say`, account, fill === null ? { phrase } : { phrase, fill })).body;
}

/** Both sides court, and the inviter says enough phrases for the moments partners need (person:talking-adds-moments). */
export async function courting(linked: Linked): Promise<void> {
  const { server, key } = linked;
  await must(server, INVITER, { type: "people/court", with: key });
  await must(server, FRIEND, { type: "people/court", with: key });
  for (let index = 0; index < content.tuning.people.partnerMoments; index += 1) {
    const said = await sayFrom(server, INVITER, key);
    if (!said.ok) throw new Error(`The phrase was refused: ${String(said.code)}`);
  }
}

/** Courting, then the inviter proposes and the friend says yes. */
export async function partners(linked: Linked): Promise<void> {
  const { server, a, b, key } = linked;
  await courting(linked);
  await must(server, INVITER, { type: "people/propose", bond: bondIn(await stateOf(server, a), key), step: "partner" });
  await must(server, FRIEND, { type: "people/answer", bond: bondIn(await stateOf(server, b), key), step: "partner", yes: true });
}

/** Partners, then married the same way. Needs content where marrying waits no months. */
export async function married(linked: Linked): Promise<void> {
  const { server, a, b, key } = linked;
  await partners(linked);
  await must(server, INVITER, { type: "people/propose", bond: bondIn(await stateOf(server, a), key), step: "marry" });
  await must(server, FRIEND, { type: "people/answer", bond: bondIn(await stateOf(server, b), key), step: "marry", yes: true });
}

/** Content where marrying waits no months and the share is one naira. */
export function quickWeddings(): Content {
  return tuned((copy) => {
    copy.tuning.people.marryAfterMonths = 0;
    copy.tuning.people.weddingShare = 100;
  });
}

/** Answers the first allowed answer of every prologue step until the prologue closes. */
export async function playPrologue(server: TestServer, account: string): Promise<void> {
  for (let guard = 0; guard < 60; guard += 1) {
    const shown = (await view(server, account)).body;
    if (!shown.ok || shown.view.prologue === null) return;
    const answer = shown.view.prologue.answers.find((each) => each.allowed);
    if (answer === undefined) throw new Error("No allowed answer.");
    await act(server, account, { type: "prologue/choose", step: shown.view.prologue.step, answer: answer.id });
  }
}

/** An inviter from the prologue with two siblings drawn, and a friend who took the sibling card and played its own prologue: two linked sibling lives. */
export async function siblings(server: TestServer): Promise<Linked> {
  const a = await newLife(server, INVITER, "scenario.prologue");
  await playPrologue(server, INVITER);
  await must(server, INVITER, { type: "turn/end", slots: [] });
  const code = await cardOut(server, INVITER, "sibling-1", "sibling");
  await signUp(server, FRIEND);
  const taken = await call<{ ok: boolean; character?: string }>(server, "POST", `/api/invite/${code}/accept`, FRIEND, { slot: "sibling-1" });
  if (!taken.body.ok || taken.body.character === undefined) throw new Error(`The sibling card was not taken: ${JSON.stringify(taken.body)}`);
  await playPrologue(server, FRIEND);
  return { server, a, b: taken.body.character, key: pairId(a, taken.body.character), code };
}

/** Content where the prologue draws two siblings. */
export function twoSiblings(copy: Content): void {
  copy.tuning.prologue.siblings = [2, 2];
}
