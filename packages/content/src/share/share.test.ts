import { describe, expect, test } from "vitest";

import { content, officialAccounts, shareChapters, shareKinds, text } from "../index";

/** The words on any card, the kind's own and the shared ones. */
function cardWords(kind: string): string[] {
  const shared = ["share.disclaimer", "share.sender", "share.address", "share.official-line", "share.route", "share.japacity", "share.months", "share.standing", "share.most"];
  return [...shared, `share.${kind}.title`, `share.${kind}.kicker`, `share.${kind}.ready`].map((key) => text[key] ?? "");
}

const ART = /^art\.[a-z]+(?:-[a-z]+)*$/;

describe("the share cards' words", () => {
  test("[R-SHARE-004] given every kind a card is made for, when its words are looked up, then it has a title, a kicker and a tile line", () => {
    for (const kind of shareKinds) {
      for (const part of ["title", "kicker", "ready"]) expect(text[`share.${kind}.${part}`]?.trim()).toBeTruthy();
    }
  });

  test("[R-SHARE-004] given the disclaimer, when it is read, then it says Japacity is a game, and the game is the sender with its address", () => {
    expect(text["share.disclaimer"]).toBe("Japacity is a game.");
    expect(text["share.sender"]).toBe("Japacity");
    expect(text["share.address"]).toBe(officialAccounts.find((account) => account.platform === "web")?.address);
  });

  test("[R-SHARE-005] given the words of every card, when they are searched, then none carries a currency sign, a currency name or a figure", () => {
    for (const kind of shareKinds) {
      for (const words of cardWords(kind)) {
        expect(words).not.toMatch(/[₦£$€]|\bnaira\b|\bpounds?\b|\bdollars?\b|\beuros?\b|\bkobo\b|\d/i);
      }
    }
  });

  test("[R-SHARE-006] given the words of every card, when they are searched, then none reads as a bank alert, a receipt or a government letter", () => {
    const banned = /alert|credit|debit|transaction|receipt|ref(?:erence)?\b|account no|balance|transfer|embassy|home office|ministry|approved|stamp/i;
    for (const kind of shareKinds) {
      for (const words of cardWords(kind)) expect(words).not.toMatch(banned);
    }
  });

  test("[R-SHARE-007] given every kind and every chapter, when its art is looked up, then it names a composition and never an image file", () => {
    const keys = [...shareKinds.map((kind) => `share.${kind}.art`), ...shareChapters.map((id) => `share.${id}.art`)];
    for (const key of keys) expect(text[key]).toMatch(ART);
    expect(shareChapters).toEqual(Object.keys(content.chapter));
  });

  test("[R-SHARE-012] given the entries table, when the official accounts are listed, then every platform it names has a row and the words to name it", () => {
    const platforms = ["web", "email", "whatsapp", "instagram", "tiktok", "x", "youtube", "facebook", "repository"];
    expect(officialAccounts.map((account) => account.platform)).toEqual(platforms);
    for (const platform of platforms) expect(text[`share.official.platform.${platform}`]?.trim()).toBeTruthy();
  });

  test("[R-SHARE-013] given the official page's words, when they are read, then they say the game never asks for money, never sells turns, never messages first about a prize, never sells an advert by direct message, has no agents, and where to report", () => {
    expect(text["share.official.never.money"]).toMatch(/never ask you for money/);
    expect(text["share.official.never.turns"]).toMatch(/never sell turns/);
    expect(text["share.official.never.prize"]).toMatch(/never message you first about a prize/);
    expect(text["share.official.never.advert"]).toMatch(/never sell an advert by direct message/);
    expect(text["share.official.never.agents"]).toMatch(/no agents/);
    expect(text["share.official.report"]).toContain("{email}");
  });
});
