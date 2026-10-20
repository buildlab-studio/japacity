// Report lines over the real content: money is typed, and every key has words.
// docs/rules/text.md, "Money on screen" and "Where words live".
import { content, text } from "@japacity/content";
import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";

import type { SlotFailure } from "../activity/activity.events";
import { lifeSaves } from "../goldens/lives.data";
import { legalCommands } from "../testing/legal";
import { start } from "../testing/play";
import { newState } from "./state";
import { step } from "./step";
import type { Id, ReportLine } from "./types";
import { standInWorld } from "../world/standIn";

declare global {
  interface ImportMeta {
    /** Vite's static import of many files at once. Vitest runs on Vite, so it is there in tests. */
    glob<T>(pattern: string, options: { query: "?raw"; import: "default"; eager: true }): Record<string, T>;
  }
}

const LIVES = Object.keys(content.scenario) as Id<"scenario">[];
const MONTHS = 40;
/** Enough commands for 40 months with the between-turn commands random play mixes in. */
const MOST_COMMANDS = 600;

/**
 * Param names that hold money. Each must carry `{ currency, amount }`
 * wherever it appears, so the client never guesses money from a bare number.
 */
const MONEY_NAMES = [
  "amount",
  "price",
  "show",
  "gift",
  "cost",
  "fee",
  "pay",
  "paid",
  "due",
  "owed",
  "principal",
  "salary",
  "deposit",
  "refund",
  "shown",
  "required",
  "total",
  "discount",
  "min",
  "max",
];

/**
 * Plays one life for 40 months from the legal list. Every other command is a
 * turn when one is legal, so the life moves on; the rest are any legal
 * command. Returns every report line the accepted commands produced.
 */
function playForty(life: Id<"scenario">, seed: string, picks: readonly number[]): ReportLine[] {
  const game = start({ scenario: life, seed, content });
  const lines: ReportLine[] = [];
  for (let index = 0; index < MOST_COMMANDS && game.state.turn.month < MONTHS && !game.state.turn.ended; index += 1) {
    const view = game.view();
    if (view.turns.banked === 0 && view.setpiece === null) {
      game.grant(1);
      continue;
    }
    const legal = legalCommands(view);
    const turns = legal.filter((command) => command.type === "turn/end");
    const pool = index % 2 === 0 && turns.length > 0 ? turns : legal;
    const pick = picks[index % picks.length] ?? 0;
    const command = pool[pick % pool.length];
    if (command === undefined) throw new Error(`Nothing legal for ${life} in month ${String(view.month)}.`);
    lines.push(...game.accept(command).lines);
  }
  expect(game.state.turn.month >= MONTHS || game.state.turn.ended).toBe(true);
  return lines;
}

/** The params of a line named like money that are bare numbers. */
function bareMoney(line: ReportLine): string[] {
  return Object.entries(line.params)
    .filter(([name, value]) => MONEY_NAMES.includes(name) && typeof value === "number")
    .map(([name]) => `${line.key}: ${name} is a bare number`);
}

describe("report lines on the real lives", () => {
  for (const life of LIVES) {
    describe(`the life ${life}`, () => {
      test.prop([fc.string({ minLength: 1, maxLength: 8 }), fc.array(fc.nat(), { minLength: 50, maxLength: 50 })], { numRuns: 3 })(
        "[engine:report-money-is-typed] given this life, when 40 months of random legal commands are played, then no line carries money as a bare number under a name that holds money",
        (seed, picks) => {
          const lines = playForty(life, seed, picks);
          expect(lines.length).toBeGreaterThan(0);
          expect(lines.flatMap(bareMoney)).toEqual([]);
        },
      );
    });
  }

  test.each(LIVES)("[engine:content-checked-before-play] given %s, when 40 months of random legal commands are played, then every line key emitted has words in content", (life) => {
    const picks = Array.from({ length: 50 }, (_unused, index) => index * 7 + 3);
    const keys = new Set(playForty(life, `words-${life}`, picks).map((line) => line.key));
    expect([...keys].filter((key) => (text[key] ?? "").trim() === "")).toEqual([]);
  });
});

/** Every source file of the simulation, tests left out, as raw text. */
const sources = Object.entries(import.meta.glob<string>("../**/*.ts", { query: "?raw", import: "default", eager: true })).filter(
  ([path]) => !path.endsWith(".test.ts"),
);

/** Why a slot can fail: the activity kind's `line.activity.failed-<why>` keys. */
const SLOT_FAILURES: readonly SlotFailure[] = ["requirements", "param", "cost"];

/**
 * Every `line.` key written out in the source. Two kinds build their keys
 * from a short name, `line("heard", ...)` under `line.route.`, so their calls
 * are read with the prefix their helper adds. The activity kind's failure
 * keys are built from the failure, so each failure is listed.
 */
function keysInSource(): string[] {
  const keys = new Set<string>();
  for (const [, source] of sources) {
    for (const match of source.matchAll(/["'`](line\.[a-z-]+\.[a-z-]+)["'`]/g)) keys.add(match[1]!);
    const prefix = /key: `(line\.[a-z-]+\.)\$\{key\}`/.exec(source)?.[1];
    if (prefix !== undefined) {
      for (const match of source.matchAll(/\bline\("([a-z-]+)"/g)) keys.add(`${prefix}${match[1]!}`);
    }
  }
  for (const why of SLOT_FAILURES) keys.add(`line.activity.failed-${why}`);
  return [...keys].sort();
}

describe("report line keys in the source", () => {
  test("[engine:content-checked-before-play] given every line key the simulation's source names, when looked up in content, then each has words", () => {
    const keys = keysInSource();
    expect(keys).toContain("line.route.granted");
    expect(keys).toContain("line.document.issued");
    expect(keys.filter((key) => (text[key] ?? "").trim() === "")).toEqual([]);
  });
});

describe("staged wins", () => {
  test("[activity:one-job-paid-monthly] [route:grant-moves-to-granted] [route:departure-pays-flight] [luck:big-wins-are-staged] given the graduate-careful golden, when its save is replayed, then the first salary, the first dollar salary, the grant and the send-off each come once as a big line, and nothing else is big", () => {
    const save = lifeSaves["graduate-careful"]!;
    let state = newState(save.scenario, save.seed, content);
    const lines: ReportLine[] = [];
    for (const { command, tick, sender } of save.commands) {
      const result = step(state, command, standInWorld(save.worldSeed, tick, content), content, sender);
      if (!result.ok) throw new Error(`The golden's ${command.type} was rejected with ${result.code}.`);
      state = result.state;
      lines.push(...result.lines);
    }
    const big = lines.filter((line) => line.big === true).map((line) => line.key);
    // The recorded life ends on the flight; the first pay abroad is staged in the activity tests abroad.
    expect(big).toEqual(["line.activity.salary", "line.activity.salary-first-foreign", "line.route.granted", "line.route.departed"]);
    expect(lines.filter((line) => line.key === "line.activity.salary").length).toBeGreaterThan(1);
  });
});
