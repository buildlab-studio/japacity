// Records the first-milestone lives as saves for the goldens, by playing
// the simulated players on the real content with the world `golden-world`.
// Run `pnpm record:lives` after a content change moves the world's schedule,
// then `pnpm bless`. It writes packages/sim/src/goldens/lives.data.ts.
//
// Two recordings per life: the first ends on the flight; the second, named
// `<life>-abroad`, is a careful player's own life that carries on 36 months
// abroad on a status it renews, and ends with a return home by choice.
// Names given on the command line (`pnpm record:lives ada-abroad`)
// record only those and keep every other recording as it is.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { content } from "../packages/content/src/index";

import type { Id, Save } from "../packages/sim/src/engine/types";
import { lifeSaves } from "../packages/sim/src/goldens/lives.data";
import { runLife } from "../packages/sim/src/sweep/players";
import type { StrategyName } from "../packages/sim/src/sweep/players";
import { start } from "../packages/sim/src/testing/play";

const WORLD = "golden-world";
const WANTED: { name: string; life: Id<"scenario">; strategy: StrategyName; refusedFirst: boolean }[] = [
  { name: "ada-careful", life: "scenario.ada", strategy: "careful", refusedFirst: false },
  { name: "tunde-borrower", life: "scenario.tunde", strategy: "borrower", refusedFirst: true },
  { name: "zainab-remote", life: "scenario.zainab", strategy: "risky", refusedFirst: false },
];
const ABROAD: { name: string; life: Id<"scenario"> }[] = [
  { name: "ada-abroad", life: "scenario.ada" },
  { name: "tunde-abroad", life: "scenario.tunde" },
  { name: "zainab-abroad", life: "scenario.zainab" },
];
const MONTHS_ABROAD = 36;

function pick(want: (typeof WANTED)[number]): { seed: string; save: Save; departed: number } {
  let fallback: { seed: string; save: Save; departed: number } | null = null;
  for (let n = 0; n < 80; n += 1) {
    const seed = `golden-${want.life.slice("scenario.".length)}-${String(n)}`;
    const { record, game } = runLife(want.strategy, want.life, seed, content, { months: 40, worldSeed: WORLD, keepSave: true });
    if (record.departed === null || record.departed < 24 || record.departed > 40 || record.flown !== "route.uk-masters") continue;
    // The golden ends on the flight: the strategies' months abroad are not its business.
    const flight = game.save.commands.findIndex((entry) => entry.command.type === "route/depart");
    const save: Save = flight === -1 ? game.save : { ...game.save, commands: game.save.commands.slice(0, flight + 1) };
    const found = { seed, save, departed: record.departed };
    const refusedFirst = record.decisions.length >= 2 && record.decisions[0]?.granted === false;
    if (!want.refusedFirst || refusedFirst) return found;
    fallback ??= found;
  }
  if (fallback === null) throw new Error(`No seed in 80 gives ${want.name} a flight within 24 to 40 months.`);
  return fallback;
}

/**
 * A careful life that flies, holds a lawful status for 36 months abroad,
 * renews it, pays its rent every month, answers the December scene, and is
 * then brought home by choice: the save is cut at the 36th month abroad and
 * `return/home` added.
 */
function pickAbroad(want: (typeof ABROAD)[number]): { seed: string; save: Save; departed: number } {
  for (let n = 0; n < 200; n += 1) {
    const seed = `golden-${want.life.slice("scenario.".length)}-abroad-${String(n)}`;
    const { record, game } = runLife("careful", want.life, seed, content, { months: 100, worldSeed: WORLD, keepSave: true });
    if (record.departed === null || record.months < record.departed + MONTHS_ABROAD) continue;
    const replay = start({ scenario: want.life, seed, worldSeed: WORLD, content });
    let renewed = false;
    let december = false;
    let missedRent = false;
    let lawful = true;
    for (const { command, sender } of game.save.commands) {
      if (replay.state.turn.month >= record.departed + MONTHS_ABROAD && command.type === "turn/end") break;
      const result = replay.accept(command, sender);
      if (command.type === "status/renew") renewed = true;
      if (result.events.some((event) => event.type === "setpiece/closed" && (event as { entry?: string }).entry === "setpiece.december")) december = true;
      if (result.events.some((event) => event.type === "obligation/missed" && String((event as { entry?: string }).entry).includes("rent"))) missedRent = true;
      const status = replay.state.status.current;
      if (replay.state.turn.month > record.departed && (status === null || content.status[status.entry]?.work === "cash")) lawful = false;
    }
    if (replay.state.place.where !== "abroad" || !renewed || !december || missedRent || !lawful) continue;
    const home = replay.send({ type: "return/home" });
    if (!home.ok || replay.state.place.returns[replay.state.place.returns.length - 1]?.shape !== "by-choice") continue;
    return { seed, save: replay.save, departed: record.departed };
  }
  throw new Error(`No seed in 200 gives ${want.name} 36 lawful months abroad with a renewal, the December scene and a return by choice.`);
}

const only = new Set(process.argv.slice(2));
const record = (name: string): boolean => only.size === 0 || only.has(name);

const lines: string[] = [
  "// Generated by tools/record-lives.ts: the first-milestone lives played by the",
  "// simulated players on the real content with the world `golden-world`. Do not edit by hand.",
  'import type { Save } from "../engine/types";',
  "",
  "export const lifeSaves: Record<string, Save> = {",
];
for (const want of WANTED) {
  const kept = lifeSaves[want.name];
  const chosen = record(want.name) || kept === undefined ? pick(want) : null;
  if (chosen === null) console.log(`${want.name}: kept as recorded`);
  else console.log(`${want.name}: seed ${chosen.seed}, flies in month ${String(chosen.departed)}, ${String(chosen.save.commands.length)} commands`);
  lines.push(`  ${JSON.stringify(want.name)}: ${JSON.stringify(chosen?.save ?? kept)},`);
}
for (const want of ABROAD) {
  const kept = lifeSaves[want.name];
  const chosen = record(want.name) || kept === undefined ? pickAbroad(want) : null;
  if (chosen === null) console.log(`${want.name}: kept as recorded`);
  else console.log(`${want.name}: seed ${chosen.seed}, flies in month ${String(chosen.departed)}, home by choice ${String(MONTHS_ABROAD)} months later, ${String(chosen.save.commands.length)} commands`);
  lines.push(`  ${JSON.stringify(want.name)}: ${JSON.stringify(chosen?.save ?? kept)},`);
}
lines.push("};", "");
writeFileSync(fileURLToPath(new URL("../packages/sim/src/goldens/lives.data.ts", import.meta.url)), lines.join("\n"));
