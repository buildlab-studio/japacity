import { describe, expect, test } from "vitest";

import { content, text } from "../index";
import { realNames } from "./place.real";

declare global {
  interface ImportMeta {
    /** Vite's static import of many files at once. Vitest runs on Vite, so it is there in tests. */
    glob<T>(pattern: string, options: { query: "?raw"; import: "default"; eager: true }): Record<string, T>;
  }
}

// What this reads: every shipped model and every place.json under the client's public assets, as raw
// text. A model's sign anchors sit in its node extras, in the file's JSON chunk, as plain text keys.
const models = import.meta.glob<string>("../../../../apps/client/public/assets/**/*.glb", { query: "?raw", import: "default", eager: true });
const placeFiles = import.meta.glob<string>("../../../../apps/client/public/assets/places/*/place.json", { query: "?raw", import: "default", eager: true });

const SIGN_KEY = /place\.[a-z0-9]+(?:-[a-z0-9]+)*\.sign\.[0-9]+/g;
const SIGN_OR_TALK = /^place\.[a-z0-9-]+\.(sign|overheard)\.[0-9]+$/;

/** The sign keys each file names, by file. */
function signKeysIn(files: Record<string, string>): { file: string; key: string }[] {
  return Object.entries(files).flatMap(([file, raw]) => [...new Set(raw.match(SIGN_KEY) ?? [])].map((key) => ({ file: file.replace(/^.*public\/assets\//, ""), key })));
}

const named = [...signKeysIn(models), ...signKeysIn(placeFiles)];
const carried = new Set(signKeysIn(models).map((entry) => entry.key));
const signsAndTalk = Object.entries(text).filter(([key]) => SIGN_OR_TALK.test(key));

/** At most two lines on a board, each short enough to read on a phone. */
const BOARD_LINES = 2;
const BOARD_LINE_LENGTH = 20;

const DASHES = /[\u2010\u2012\u2013\u2014\u2015\u2212]|\s-\s|\s-$|^-\s/m;
const MONEY = /[\u20a6\u00a3$\u20ac]|\b(?:N|NGN|GBP|USD|EUR|AED|CAD)\s?\d|\d[\d,]*\s?(?:k|naira|pounds?|dollars?|euros?|dirhams?|kobo)\b/i;

// Real businesses and brands a sign or a street line could slip in by habit, and the working names replaced after the name check.
const REAL_NAMES = [
  "MTN", "Airtel", "Globacom", "9mobile", "GTBank", "Guaranty Trust", "Access Bank", "Zenith", "First Bank", "UBA", "Opay", "Moniepoint", "Palmpay", "Kuda",
  "Dangote", "Indomie", "Peak Milk", "Milo", "Coca-Cola", "Shoprite", "Bet9ja", "SportyBet", "NairaBet", "BetKing", "Chicken Republic", "Mr Biggs",
  "Tecno", "Infinix", "Samsung", "iPhone", "Western Union", "MoneyGram", "WorldRemit", "Lemfi", "Tesco", "Primark", "Lidl", "Aldi", "Uber", "Arik",
  "Air Peace", "ABC Transport", "Swiftlink", "Swift Networks", "First Choice", "Klassik", "Klassic", "Klassique", "Iya Basira", "BetCorrect", "BrightPath",
];
const realName = new RegExp(`(?:^|[^A-Za-z0-9])(?:${REAL_NAMES.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![A-Za-z0-9])`, "i");

describe("the signs the models carry", () => {
  test("[city:place-words-are-text-keys] given every shipped model and place.json, when the sign keys they name are looked up, then each has words and belongs to a place", () => {
    expect(carried.size).toBeGreaterThanOrEqual(12);
    expect(named.filter(({ key }) => (text[key] ?? "").trim() === "").map(({ file, key }) => `${file} ${key}`)).toEqual([]);
    const places = new Set<string>(Object.keys(content.place));
    expect(named.filter(({ key }) => !places.has(key.replace(/\.sign\.[0-9]+$/, ""))).map(({ file, key }) => `${file} ${key}`)).toEqual([]);
  });

  test("[assets:sign-text-drawn-in-code] given every sign a model carries, when its words are split into lines, then there are at most two and each fits a board at phone size", () => {
    const boards = [...carried].map((key) => ({ key, lines: (text[key] ?? "").split("\n") }));
    expect(boards.filter(({ lines }) => lines.length > BOARD_LINES).map(({ key }) => key)).toEqual([]);
    expect(boards.filter(({ lines }) => lines.some((line) => line.trim() === "" || line.length > BOARD_LINE_LENGTH)).map(({ key }) => key)).toEqual([]);
  });

  test("[assets:sign-text-drawn-in-code] given a board's words at the edge, when the line rule is applied, then two lines of twenty pass and a third line or a twenty-first letter does not", () => {
    const fits = (words: string): boolean => {
      const lines = words.split("\n");
      return lines.length <= BOARD_LINES && lines.every((line) => line.trim() !== "" && line.length <= BOARD_LINE_LENGTH);
    };
    const twenty = "A".repeat(BOARD_LINE_LENGTH);
    expect(fits(`${twenty}\n${twenty}`)).toBe(true);
    expect(fits(`${twenty}A`)).toBe(false);
    expect(fits("ONE\nTWO\nTHREE")).toBe(false);
  });
});

describe("the words on signs and in the street", () => {
  test("[city:place-words-are-text-keys] given every sign and every line overheard, when the words are read, then none holds a dash or a figure of money", () => {
    expect(signsAndTalk.length).toBeGreaterThan(200);
    expect(signsAndTalk.filter(([, words]) => DASHES.test(words)).map(([key]) => key)).toEqual([]);
    expect(signsAndTalk.filter(([, words]) => MONEY.test(words)).map(([key]) => key)).toEqual([]);
  });

  test("[city:place-words-are-text-keys] given words that break the rule, when they are tested, then a dash and a figure of money are caught and a hyphen in a name is not", () => {
    expect(DASHES.test("Open \u2014 till late")).toBe(true);
    expect(DASHES.test("Open - till late")).toBe(true);
    expect(DASHES.test("DE-ROYAL\nBARBING SALON")).toBe(false);
    expect(["\u20a6500", "N500", "500 naira", "5k", "\u00a310", "20 dollars"].filter((words) => !MONEY.test(words))).toEqual([]);
    expect(MONEY.test("Who get change for one thousand?")).toBe(false);
  });

  test("[city:made-up-names-checked] given every sign and every line overheard, when the words are read, then none names a business on the list of real ones", () => {
    expect(signsAndTalk.filter(([, words]) => realName.test(words)).map(([key, words]) => `${key}: ${words}`)).toEqual([]);
    expect(realName.test("SWIFTLINK PHONES")).toBe(true);
    expect(realName.test("FIRST CHOICE\nPHARMACY")).toBe(true);
    expect(realName.test("Milord")).toBe(false);
  });

  test("[assets:no-real-brands-on-assets] given every sign a shipped model carries, when its words are read, then none names a real business, a real name on one is only a public place's or a market's from the register, and no place carries a sponsor's", () => {
    const onModels = [...carried].map((key) => ({ key, words: text[key] ?? "" }));
    expect(onModels.filter(({ words }) => realName.test(words)).map(({ key, words }) => `${key}: ${words}`)).toEqual([]);
    const realOnModels = onModels.flatMap(({ key }) => {
      const entry = realNames[key];
      return entry === undefined || entry.realName === null ? [] : [{ key, trade: entry.trade }];
    });
    expect(realOnModels.filter(({ trade }) => trade !== "public" && trade !== "market").map(({ key, trade }) => `${key}: ${trade}`)).toEqual([]);
    expect(Object.values(content.place).filter((place) => place.sponsor !== null).map((place) => place.id)).toEqual([]);
  });
});
