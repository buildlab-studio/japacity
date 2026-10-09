// One name for one thing (docs/rules/text.md R-TEXT-005, the nearest rule): the
// results said "The savings circle" where the ask said "Join the ajo", "Something on the street" where it
// said "A market behind the station", and the mother was "Mama" at home and "Mummy" at her stall.
import { text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { sceneWords } from "../../features/city/scene.words";
import { say, words } from "./text";

describe("one name for one thing", () => {
  test("[R-TEXT-005] given the savings circle, when its ask, its results and its bill name it, then each says the savings circle, and the ask says ajo once beside it", () => {
    expect(text["offer.join-ajo.name"]).toBe("The savings circle");
    expect(text["offer.join-ajo.title"]).toBe("Join the savings circle (ajo)");
    expect(text["offer.join-ajo.body"]).toMatch(/savings circle/);
    expect(text["obligation.ajo.name"]).toBe("Savings circle");
  });

  test("[R-TEXT-005] given a find on the street abroad, when the results and the ask name it, then they say the same thing", () => {
    for (const offer of ["offer.street-find-uk", "offer.street-find-uae"]) expect(text[`${offer}.name`]).toBe(text[`${offer}.title`]);
    expect(text["offer.street-find-uk.name"]).toBe("A market behind the station");
  });

  test("[R-TEXT-005] given the character's mother, when home, Chats, her stall and her shop name her, then she is Mama everywhere", () => {
    expect(text["chats.from.mum"]).toBe("Mama");
    expect(text["family.from.mum"]).toBe("Mama");
    expect(sceneWords("city.thing.mama")).toBe("Mama");
    expect(sceneWords("city.thing.mummy")).toBe("Mama");
    expect(sceneWords("city.thing.mum-stall")).toBe("Mama's stall");
    expect(sceneWords("city.act.greet-mum")).toBe("Greet Mama");
    expect(sceneWords("city.act.mum-shop")).toBe("Help Mama");
    expect(words("offer.mum-shop.title")).toBe("Mama's shop");
    expect(words("offer.mum-shop.name")).toBe("Mama's shop");
    expect(say("ui.line.family-paid.offer.mum-shop", { amount: "₦1" })).toBe("For Mama's shop: ₦1.");
    expect(sceneWords("city.act.greet-mum.done")).not.toMatch(/Mummy/);
  });

  test("[R-TEXT-005] given the scam text opened, when the results name it, then it reads as a message that says you won, never as a prize", () => {
    expect(words("line.offer.opened", { offer: "offer.telco-promo" })).toBe("Something new needs an answer: A message says you have won.");
    expect(text["offer.telco-promo.title"]).toBe(text["offer.telco-promo.name"]);
  });
});
