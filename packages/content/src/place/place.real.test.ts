import type { Content, Id, PlaceEntry } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { content, text } from "../index";
import { realNameChecks } from "./place.check";
import { type RealNameEntry, type RealNameTrade, realNames, realNameSigns } from "./place.real";

const READ = { title: "A page that says it is well known", url: "https://example.org/well-known", readOn: "2026-10-09" };

function place(id: Id<"place">): PlaceEntry {
  const entry = content.place[id];
  if (entry === undefined) throw new Error(`No place ${id}`);
  return entry;
}

function withPlace(entry: PlaceEntry): Content {
  return { ...content, place: { ...content.place, [entry.id]: entry } };
}

/** A register entry switched on for a sign, and the words that sign then shows. */
function onSign(sign: string, trade: RealNameTrade, realName: string, words: string = realName.toUpperCase()): { register: Record<string, RealNameEntry>; words: Record<string, string> } {
  const entry: RealNameEntry = { sign, trade, realName, words, plain: "SHOP TO LET", source: READ };
  return { register: { ...realNames, [sign]: entry }, words: { ...text, [sign]: words } };
}

function signProblems(sign: string, trade: RealNameTrade, realName: string): string {
  const { register, words } = onSign(sign, trade, realName);
  return realNameChecks(content, words, register).join("\n");
}

describe("real names as neutral scenery", () => {
  test("[city:invented-names-for-risky-businesses] given the shipped places, signs and register of real names, when the real-name check runs, then it finds nothing", () => {
    expect(Object.keys(realNames).length).toBeGreaterThanOrEqual(3);
    expect(realNameChecks(content, text, realNames)).toEqual([]);
  });

  test("[city:sponsor-shows-name-only] given the register, when the signs it names are read, then each shows its real name while it is on, as plain words", () => {
    const shown = realNameSigns(realNames);
    expect(Object.entries(shown).filter(([sign, words]) => text[sign] !== words)).toEqual([]);
    expect(Object.values(realNames).filter((entry) => entry.realName !== null && !entry.words.replace(/\s+/g, " ").toLowerCase().includes(entry.realName.toLowerCase()))).toEqual([]);
  });

  test("[city:sponsor-shows-name-only] given a real name switched off in its one entry, when the sign is read, then it shows its plain words and the check passes", () => {
    const gold = realNames["place.deira.sign.2"]!;
    const off = { ...realNames, [gold.sign]: { ...gold, realName: null } };
    expect(realNameSigns(off)[gold.sign]).toBe(gold.plain);
    expect(realNameChecks(content, { ...text, ...realNameSigns(off) }, off)).toEqual([]);
    expect(realNameChecks(content, text, off).join("\n")).toMatch(/place\.deira\.sign\.2: shows "DEIRA GOLD SOUK", not its register's words "GOLD & DIAMONDS"/);
  });

  test("[city:invented-names-for-risky-businesses] given each trade that lends, charges, employs, sponsors, refuses or can fail, when a real name is put on it, then the check fails it, and a market, a mall and a food spot pass", () => {
    const invented: RealNameTrade[] = ["bank", "lender", "agent", "employer", "sponsor", "school", "airline"];
    for (const trade of invented) {
      expect(signProblems("place.deira.sign.11", trade, "A Real Name")).toMatch(new RegExp(`real name A Real Name on a ${trade}, which only an invented name may be \\(city:invented-names-for-risky-businesses\\)`));
    }
    for (const trade of ["market", "mall", "food"] as const) {
      expect(signProblems("place.deira.sign.11", trade, "A Real Name")).toBe("");
    }
  });

  test("[city:sponsor-shows-name-only] given a real food spot's name at a place that stages a mishap or a fraud, when it is checked, then it fails, and at a place that stages neither it passes", () => {
    expect(signProblems("place.computer-village.sign.10", "food", "A Real Buka")).toMatch(/stages offer\.laptop-fault, which can be a fraud, a mishap or bad news \(city:sponsor-shows-name-only\)/);
    expect(signProblems("place.ojuelegba.sign.13", "food", "A Real Buka")).toMatch(/stages offer\.fuel-scarcity/);
    expect(signProblems("place.bode-thomas.sign.6", "food", "A Real Buka")).toBe("");
  });

  test("[city:sponsor-shows-name-only] given the hub's own public name on a sign, when it is checked, then it passes though the hub stages bad news, and a name called public that is no place's fails", () => {
    expect(signProblems("place.ojuelegba.sign.13", "public", "Ojuelegba")).toBe("");
    expect(signProblems("place.ojuelegba.sign.13", "public", "A Real Buka")).toMatch(/A Real Buka is called public but is no public place's name/);
  });

  test("[city:road-places-are-stylised] given a real name on the road's places, as a sign or as the place's own name, when it is checked, then it fails", () => {
    expect(signProblems("place.road-night.sign.1", "food", "A Real Buka")).toMatch(/at place\.road-night, a stylised place \(city:road-places-are-stylised\)/);
    expect(signProblems("place.motor-park.sign.1", "market", "A Real Park")).toMatch(/at place\.motor-park, a stylised place/);
    expect(realNameChecks(withPlace({ ...place("place.road-night"), realName: "A Real Yard" }), text, realNames).join("\n")).toMatch(/the road's place carries the real name A Real Yard \(city:road-places-are-stylised\)/);
  });

  test("[city:invented-names-for-risky-businesses] given a lender, an agent and an employer with a real name, when the place table is checked, then each is failed", () => {
    const lender = realNameChecks(withPlace({ ...place("place.olokun-office"), realName: "A Real Lender", sponsor: { key: "sponsor.lender" } }), text, realNames).join("\n");
    expect(lender).toMatch(/place\.olokun-office: carries the real name A Real Lender and lends, charges or employs through offer\.held-funds; only an invented name may \(city:invented-names-for-risky-businesses\)/);
    const agent = realNameChecks(withPlace({ ...place("place.agent-office"), realName: "A Real Agent" }), text, realNames).join("\n");
    expect(agent).toMatch(/stages offer\.held-funds-agent, offer\.gulf-agent, which can be a fraud, a mishap or bad news \(city:sponsor-shows-name-only\)/);
    // Every country's jobs are staged at its own places (city.md, design page 11), so the
    // employer is Calgary's warehouse, which stages Canada's warehouse job.
    const employer = realNameChecks(withPlace({ ...place("place.warehouse-canada"), realName: "A Real Warehouse" }), text, realNames).join("\n");
    expect(employer).toMatch(/A Real Warehouse and employs through activity\.job-canada-warehouse/);
  });

  test("[city:invented-names-for-risky-businesses] given a real place staging the visa interview or a paid activity, when the place table is checked, then it is failed for refusing and for charging", () => {
    const centre = realNameChecks(withPlace({ ...place("place.yaba-hub"), realName: "A Real Hub", stages: ["setpiece.credibility-interview", "activity.sit-english-test"] }), text, realNames).join("\n");
    expect(centre).toMatch(/stages setpiece\.credibility-interview, which can refuse/);
    expect(centre).toMatch(/charges through activity\.sit-english-test/);
  });

  test("[city:invented-names-for-risky-businesses] given a business with a real name that stages nothing, when the place table is checked, then it passes", () => {
    expect(realNameChecks(withPlace({ ...place("place.yaba-hub"), realName: "A Real Hub", stages: [] }), text, realNames)).toEqual([]);
  });

  test("[city:sponsor-shows-name-only] given public places that stage a fraud or a mishap, when the place table is checked, then their public names stand", () => {
    expect(place("place.computer-village").stages).toContain("offer.laptop-fault");
    expect(place("place.ojuelegba").stages).toContain("offer.agent-stop");
    expect(realNameChecks(content, text, realNames).filter((problem) => /computer-village|ojuelegba/.test(problem))).toEqual([]);
  });

  test("[city:invented-names-for-risky-businesses] given a real name on a sign, when the same name stands in an offer's words, then the check fails it", () => {
    const { register, words } = onSign("place.deira.sign.11", "market", "A Real Souk");
    const leaked = { ...words, "offer.held-funds.body": `${words["offer.held-funds.body"] ?? ""} Meet at A Real Souk.` };
    expect(realNameChecks(content, leaked, register).join("\n")).toMatch(/the real name A Real Souk also stands in offer\.held-funds\.body, outside the places \(city:invented-names-for-risky-businesses\)/);
  });

  test("[city:sponsor-shows-name-only] given a register entry with no source, or words without its name, when it is checked, then it fails", () => {
    const { register, words } = onSign("place.deira.sign.11", "market", "A Real Souk");
    const sign = register["place.deira.sign.11"]!;
    const unsourced = { ...register, [sign.sign]: { ...sign, source: { ...READ, url: "http://example.org" } } };
    expect(realNameChecks(content, words, unsourced).join("\n")).toMatch(/has no source with a title, an https link and the day it was read/);
    const nameless = { ...register, [sign.sign]: { ...sign, words: "SOUK" } };
    expect(realNameChecks(content, { ...words, [sign.sign]: "SOUK" }, nameless).join("\n")).toMatch(/do not hold its real name A Real Souk/);
    expect(realNameChecks(content, words, { ...register, "place.nowhere.sign.1": { ...sign, sign: "place.nowhere.sign.1" } }).join("\n")).toMatch(/place\.nowhere\.sign\.1: is not the sign of a place/);
  });
});
