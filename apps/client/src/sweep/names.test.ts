// One name for one thing (text:bands-not-figures, the nearest rule): the
// results said "The savings circle" where the ask said "Join the ajo", "Something on the street" where it
// said "A market behind the station", and the mother was "Mama" at home and "Mummy" at her stall.
import { text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { say, words } from "../shared/words/text";
import { cityWords } from "../features/city/city.words";

describe("one name for one thing", () => {
  test("[text:bands-not-figures] given the savings circle, when its ask, its results and its bill name it, then each says the savings circle, and the ask says ajo once beside it", () => {
    expect(text["offer.join-ajo.name"]).toBe("The savings circle");
    // The ask's title is the neighbour's own words: it says ajo, and the line beside it the savings circle.
    expect(text["offer.join-ajo.title"]).toBe("Join our ajo");
    expect(text["offer.join-ajo.body"]).toMatch(/savings circle/);
    expect(text["obligation.ajo.name"]).toBe("Savings circle");
  });

  test("[text:bands-not-figures] given a find on the street abroad, when the results and the ask name it, then they say the same thing", () => {
    // The ask's title is the person's words; the line under it names the very thing the results name.
    expect(text["offer.street-find-uk.name"]).toBe("A market behind the station");
    expect(text["offer.street-find-uk.body"]).toContain("market behind the station");
    expect(text["offer.street-find-uae.name"]).toBe("A dhow at the creek");
    expect(text["offer.street-find-uae.body"]).toContain("dhow is loading");
    expect(text["offer.street-find-uae.body"]).toContain("at the creek");
  });

  test("[text:bands-not-figures] given the character's mother, when home, Chats, her stall and her shop name her, then she is Mama everywhere", () => {
    expect(text["chats.from.mum"]).toBe("Mama");
    expect(text["family.from.mum"]).toBe("Mama");
    expect(cityWords("city.thing.mama")).toBe("Mama");
    expect(cityWords("city.thing.mummy")).toBe("Mama");
    expect(cityWords("city.thing.mum-stall")).toBe("Mama's stall");
    expect(cityWords("city.act.greet-mum")).toBe("Greet Mama");
    expect(cityWords("city.act.mum-shop")).toBe("Help Mama");
    // Her ask is in her own voice: the title is hers, and the pill names her Mama.
    expect(words("offer.mum-shop.title")).toBe("Help my shop");
    expect(say("offer.family-send-off.who")).toBe("Mama");
    expect(words("offer.mum-shop.name")).toBe("Mama's shop");
    expect(say("ui.line.family-paid.offer.mum-shop", { amount: "₦1" })).toBe("For Mama's shop: ₦1.");
    expect(cityWords("city.act.greet-mum.done")).not.toMatch(/Mummy/);
  });

  test("[text:bands-not-figures] given the scam text opened, when the results name it, then it reads as a message that says you won, never as a prize", () => {
    expect(words("line.offer.opened", { offer: "offer.telco-promo" })).toBe("Something new needs an answer: A message says you have won.");
    // The ask's title is the text's own shout in a few words; the results' name says it is a message.
    expect(text["offer.telco-promo.title"]).toBe("You have won");
    expect(text["offer.telco-promo.name"]).toBe(`A message says you have won`);
  });
});
