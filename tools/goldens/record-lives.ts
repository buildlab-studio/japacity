// Records the golden lives as saves for the goldens, by playing
// the simulated players on the real content with the world `golden-world`.
// Run `pnpm record:lives` after a content change moves the world's schedule,
// then `pnpm bless`. It writes packages/sim/src/goldens/lives.data.ts.
//
// Two recordings per life: the first ends on the flight; the second, named
// `<life>-abroad`, is a careful player's own life that carries on 36 months
// abroad on a status it renews, and ends with a return home by choice.
// Names given on the command line (`pnpm record:lives ada-abroad`)
// record only those and keep every other recording as it is.
//
// The simulated lives played beside the goldens (SIMULATED) are recorded into
// packages/sim/src/simulated-play/lives.data.ts, and replayed by their own test there.
import type { FlatSave, Id } from "@japacity/sim";
import { lastSegment, lifeStart, savedCommands } from "@japacity/sim";
import type { StrategyName } from "@japacity/sim/testing";
import { lifeSaves, countryLifeSaves, simulatedLifeSaves, FLIGHT_WINDOW, MONTHS_ABROAD, runLife, start } from "@japacity/sim/testing";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { content } from "../../packages/content/src/index";
import { REPO_ROOT } from "../repo";

const WORLD = "golden-world";
const WANTED: { name: string; life: Id<"scenario">; strategy: StrategyName; refusedFirst: boolean }[] = [
  { name: "ada-careful", life: "scenario.ada", strategy: "careful", refusedFirst: false },
  { name: "tunde-borrower", life: "scenario.tunde", strategy: "borrower", refusedFirst: true },
  { name: "zainab-remote", life: "scenario.zainab", strategy: "risky", refusedFirst: false },
];
/** The simulated lives played beside the goldens. */
const SIMULATED: (typeof WANTED)[number][] = [{ name: "aniekan-borrower", life: "scenario.aniekan", strategy: "borrower", refusedFirst: false }];
const ABROAD: { name: string; life: Id<"scenario"> }[] = [
  { name: "ada-abroad", life: "scenario.ada" },
  { name: "tunde-abroad", life: "scenario.tunde" },
  { name: "zainab-abroad", life: "scenario.zainab" },
];

/**
 * One life per country beyond the UK (design page 11 section 7; `pnpm record:lives zainab-canada tunde-gulf`):
 * the strategy that takes that route, played on until some months after the landing, and cut there; no return. They go to
 * packages/sim/src/simulated-play/lives.countries.data.ts and are replayed by their own test, never blessed into the goldens.
 */
const COUNTRIES: { name: string; life: Id<"scenario">; strategy: StrategyName; country: Id<"country">; route: Id<"route"> }[] = [
  { name: "tunde-gulf", life: "scenario.tunde", strategy: "borrower", country: "country.uae", route: "route.gulf-contract" },
  { name: "zainab-canada", life: "scenario.zainab", strategy: "canada", country: "country.canada", route: "route.canada-points" },
  // Italy has no life here: the `road` strategy's journey starts too late to land within the recording.
];
/** The months a country's life carries on after the landing before its save is cut. */
const MONTHS_IN_COUNTRY = 12;

/** The first seed tried, so a life whose first in-window seed fails a coupled test can be recorded on the next (RECORD_FROM=<n>). */
const FROM = Number(process.env["RECORD_FROM"] ?? 0);

function pick(want: (typeof WANTED)[number]): { seed: string; save: FlatSave; departed: number } {
  let fallback: { seed: string; save: FlatSave; departed: number } | null = null;
  for (let n = FROM; n < FROM + 80; n += 1) {
    const seed = `golden-${want.life.slice("scenario.".length)}-${String(n)}`;
    const { record, game } = runLife(want.strategy, want.life, seed, content, { months: FLIGHT_WINDOW.last, worldSeed: WORLD, keepSave: true });
    if (record.departed === null || record.departed < FLIGHT_WINDOW.first || record.departed > FLIGHT_WINDOW.last || record.flown !== "route.uk-masters") continue;
    // The golden ends on the flight: the strategies' months abroad are not its business.
    const commands = savedCommands(game.save);
    const flight = commands.findIndex((entry) => entry.command.type === "route/depart");
    const start = lifeStart(game.save);
    if (start === null) throw new Error("A recorded life starts from its scenario.");
    // A recorded life is one segment under one content, kept flat; the golden scripts read it as a segment.
    const save: FlatSave = { schema: 2, content: lastSegment(game.save).content, ...start, commands: flight === -1 ? commands : commands.slice(0, flight + 1) };
    const found = { seed, save, departed: record.departed };
    const refusedFirst = record.decisions.length >= 2 && record.decisions[0]?.granted === false;
    if (!want.refusedFirst || refusedFirst) return found;
    fallback ??= found;
  }
  if (fallback === null) throw new Error(`No seed in 80 gives ${want.name} a flight within ${String(FLIGHT_WINDOW.first)} to ${String(FLIGHT_WINDOW.last)} months.`);
  return fallback;
}

/**
 * A careful life that flies, holds a lawful status for 36 months abroad,
 * renews it, pays its rent every month, answers the December scene, and is
 * then brought home by choice: the save is cut at the 36th month abroad and
 * `return/home` added.
 */
function pickAbroad(want: (typeof ABROAD)[number]): { seed: string; save: FlatSave; departed: number } {
  for (let n = 0; n < 200; n += 1) {
    const seed = `golden-${want.life.slice("scenario.".length)}-abroad-${String(n)}`;
    const { record, game } = runLife("careful", want.life, seed, content, { months: 100, worldSeed: WORLD, keepSave: true });
    if (record.departed === null || record.months < record.departed + MONTHS_ABROAD) continue;
    const replay = start({ scenario: want.life, seed, worldSeed: WORLD, content });
    let renewed = false;
    let december = false;
    let missedRent = false;
    let lawful = true;
    for (const { command, sender } of savedCommands(game.save)) {
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
    const first = lifeStart(replay.save);
    if (first === null) throw new Error("The abroad life does not start from a scenario.");
    return { seed, save: { schema: 2, content: lastSegment(replay.save).content, ...first, commands: savedCommands(replay.save) }, departed: record.departed };
  }
  throw new Error(`No seed in 200 gives ${want.name} ${String(MONTHS_ABROAD)} lawful months abroad with a renewal, the December scene and a return by choice.`);
}

function pickCountry(want: (typeof COUNTRIES)[number]): { seed: string; save: FlatSave; departed: number } {
  for (let n = 0; n < 300; n += 1) {
    const seed = `golden-${want.life.slice("scenario.".length)}-${want.country.slice("country.".length)}-${String(n)}`;
    const { record, game } = runLife(want.strategy, want.life, seed, content, { months: 100, worldSeed: WORLD, keepSave: true });
    if (record.departed === null || record.flown !== want.route || record.months < record.departed + MONTHS_IN_COUNTRY) continue;
    const replay = start({ scenario: want.life, seed, worldSeed: WORLD, content });
    for (const { command, sender } of savedCommands(game.save)) {
      if (replay.state.turn.month >= record.departed + MONTHS_IN_COUNTRY && command.type === "turn/end") break;
      replay.accept(command, sender);
    }
    if (replay.state.place.where !== "abroad" || replay.state.place.country !== want.country) continue;
    const first = lifeStart(replay.save);
    if (first === null) throw new Error("The country life does not start from a scenario.");
    return { seed, save: { schema: 2, content: lastSegment(replay.save).content, ...first, commands: savedCommands(replay.save) }, departed: record.departed };
  }
  throw new Error(`No seed in 300 lands ${want.name} in ${want.country} by ${want.route} with ${String(MONTHS_IN_COUNTRY)} months there.`);
}

const only = new Set(process.argv.slice(2));
const record = (name: string): boolean => only.size === 0 || only.has(name);

const lines: string[] = [
  "// Generated by tools/goldens/record-lives.ts: the golden lives played by the",
  "// simulated players on the real content with the world `golden-world`. Do not edit by hand.",
  'import type { FlatSave } from "../engine/types";',
  "",
  "export const lifeSaves: Record<string, FlatSave> = {",
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
writeFileSync(join(REPO_ROOT, "packages", "sim", "src", "goldens", "lives.data.ts"), lines.join("\n"));

const simulatedLines: string[] = [
  "// Generated by tools/goldens/record-lives.ts: the simulated lives played beside the goldens, played by the",
  "// simulated players on the real content with the world `golden-world`. Do not edit by hand.",
  'import type { FlatSave } from "../engine/types";',
  "",
  "export const simulatedLifeSaves: Record<string, FlatSave> = {",
];
for (const want of SIMULATED) {
  const kept = simulatedLifeSaves[want.name];
  const chosen = record(want.name) || kept === undefined ? pick(want) : null;
  if (chosen === null) console.log(`${want.name}: kept as recorded`);
  else console.log(`${want.name}: seed ${chosen.seed}, flies in month ${String(chosen.departed)}, ${String(chosen.save.commands.length)} commands`);
  simulatedLines.push(`  ${JSON.stringify(want.name)}: ${JSON.stringify(chosen?.save ?? kept)},`);
}
simulatedLines.push("};", "");
writeFileSync(join(REPO_ROOT, "packages", "sim", "src", "simulated-play", "lives.data.ts"), simulatedLines.join("\n"));

const countryLines: string[] = [
  "// Generated by tools/goldens/record-lives.ts: one life per country beyond the UK (design page 11), played by the",
  "// simulated players on the real content with the world `golden-world`. Do not edit by hand.",
  'import type { FlatSave } from "../engine/types";',
  "",
  "export const countryLifeSaves: Record<string, FlatSave> = {",
];
for (const want of COUNTRIES) {
  const kept = countryLifeSaves[want.name];
  const chosen = record(want.name) || kept === undefined ? pickCountry(want) : null;
  if (chosen === null) console.log(`${want.name}: kept as recorded`);
  else console.log(`${want.name}: seed ${chosen.seed}, lands in month ${String(chosen.departed)}, ${String(MONTHS_IN_COUNTRY)} months there, ${String(chosen.save.commands.length)} commands`);
  countryLines.push(`  ${JSON.stringify(want.name)}: ${JSON.stringify(chosen?.save ?? kept)},`);
}
countryLines.push("};", "");
writeFileSync(join(REPO_ROOT, "packages", "sim", "src", "simulated-play", "lives.countries.data.ts"), countryLines.join("\n"));
