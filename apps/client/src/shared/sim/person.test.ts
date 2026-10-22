import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { courted, eagerContent, peopleGame, playMonth, SEE as SEE_SLOT } from "../testing/person";
import { nameOf, words } from "../words/text";
import { bondName, conversationPhrases, endCost, fillWords, momentWords, optionWords, personOf, phraseWords, slotOrder, timeWith, CALL, SEE } from "./person";

const SIBLING_FACTS = { label: "computer" as const, ageMonths: 0, where: "home" as const, country: null, status: null, statusMonthsLeft: null, monthsInCountry: 0, job: null, meetsFloor: {}, eduLevel: 1, englishBand: null, home: "town" as const, joint: null, funds: null, assistanceTaken: 0, sponsorReady: null };

const partners = Object.values(content.person).filter((entry) => entry.role === "partner" && !entry.behaviour.papers);

describe("who a bond is with", () => {
  test.each(partners.map((entry) => [entry.id]))("[person:computers-follow-same-rules] given %s courted, then the bond is named from content through its facts alone", (person) => {
    const game = peopleGame(eagerContent());
    // Some partners are offered only at home or from a certain age; the engine's own list decides.
    if (!game.view().people.candidates.some((candidate) => candidate.person === person)) return;
    const bond = courted(game, person);
    const shown = game.view().people.bonds.find((entry) => entry.id === bond)!;
    expect(shown.label).toBe("computer");
    expect(personOf(shown)).toBe(person);
    expect(bondName(shown)).toBe(text[`${person}.name`]);
  });

  test("[person:view-shows-people] given the view's bond, then the person is read from the view, not guessed from the facts", () => {
    const game = peopleGame();
    game.endTurn([]);
    for (const bond of game.view().people.bonds) {
      expect(personOf(bond)).toBe(bond.person);
      const blind: Pick<typeof bond, "person" | "facts"> = { ...bond, facts: null };
      expect(personOf(blind)).toBe(bond.person);
    }
  });

  test("[person:computer-siblings-drawn-with-family] given two siblings drawn from one entry, then their names are told apart by age; given one, then the entry's name alone", () => {
    const base = { role: "sibling" as const, label: "computer" as const, person: "person.sibling-home" as const };
    const facts = (ageMonths: number) => ({ ...SIBLING_FACTS, ageMonths });
    const older = { ...base, id: "bond-1", facts: facts(360) };
    const younger = { ...base, id: "bond-2", facts: facts(240) };
    // The name as the screen says it: the sibling at home names where the life is from (prologue:family-draw-on-first-answer).
    const name = nameOf("person.sibling-home");
    expect(bondName(older, [older, younger])).toBe(words("ui.people.sibling.older", { name }));
    expect(bondName(younger, [older, younger])).toBe(words("ui.people.sibling.younger", { name }));
    expect(bondName(older, [older])).toBe(name);
    const other = { ...base, id: "bond-3", person: "person.sibling-gulf" as const, facts: facts(300) };
    expect(bondName(older, [older, other])).toBe(name);
    expect(bondName(older, [older, { ...younger, facts: facts(360) }])).not.toBe(bondName({ ...younger, facts: facts(360) }, [older, { ...younger, facts: facts(360) }]));
  });

  test("[person:family-and-partner-slots] given the slots in any order, then partner comes first, the siblings by number, then the parents", () => {
    expect(slotOrder(["father", "sibling-10", "mother", "sibling-2", "partner", "sibling-1"])).toEqual(["partner", "sibling-1", "sibling-2", "sibling-10", "mother", "father"]);
  });
});

describe("words for the people's lists", () => {
  test("[person:time-together-is-an-act] given every spot, what and call a computer can draw, then a moment reads in words with no raw id", () => {
    for (const entry of partners) {
      for (const spot of entry.spots) for (const what of entry.whats) expect(momentWords({ n: 1, by: "me", kind: "met", spot, what, tick: 0 })).not.toMatch(/[a-z]-[a-z]|\{|\}/);
      for (const what of entry.calls) expect(momentWords({ n: 1, by: "me", kind: "call", spot: null, what, tick: 0 })).not.toMatch(/[a-z]-[a-z]|\{|\}/);
    }
    expect(momentWords({ n: 1, by: "them", kind: "wedding", spot: "family-compound", what: "wedding", tick: 0 })).toContain(text["people.wedding-spot.family-compound"]);
  });

  test("[person:time-together-is-an-act] given the people's lines, then who, where, what and the step read as words", () => {
    expect(words("line.people.met", { who: "person.tobi-banker", spot: "suya-spot", what: "argued-made-up" })).toBe(
      `Time with ${text["person.tobi-banker.name"]!} at ${text["people.spot.suya-spot"]!}. You ${text["people.what.argued-made-up"]!}.`,
    );
    expect(words("line.people.called", { who: "player", what: "long-call" })).toBe(`Your friend on the phone: ${text["people.call.long-call"]!}.`);
    expect(words("line.people.proposed", { who: "player", step: "marry" })).toBe("You asked your friend: get married.");
    expect(words("line.people.invited", { slot: "sibling-2" })).toBe("Your card is out. Looking for: sibling.");
  });

  test("[interview:one-question-at-a-time] given every question and every option its lists can give, then each option reads as words, never an id", () => {
    const entry = content.interview["interview.genuineness"]!;
    const lists: Record<string, string[]> = {
      spots: content.people.spots,
      whats: partners[0]!.whats,
      calls: partners.find((partner) => partner.calls.length > 0)!.calls,
      "wedding-spots": ["family-compound", "church", "mosque", "registry", "event-hall"],
      jobs: ["no-job", ...partners.flatMap((partner) => (partner.profile.job === null ? [] : [partner.profile.job]))],
      phrases: Object.keys(content.phrase),
    };
    for (const question of entry.questions) {
      const options = Array.isArray(question.options) ? question.options : (lists[question.options] ?? []);
      expect(options.length).toBeGreaterThan(0);
      for (const option of options) {
        const shown = optionWords(question.id, option);
        expect(shown).not.toBe(option);
        expect(shown).not.toMatch(/\b[a-z]+\.[a-z-]+\b|[{}]/);
      }
    }
  });

  test("[pair:preset-phrases-only] given every phrase that may be said in a conversation and each fill from its fixed list, then it reads with the fill put in", () => {
    const said = conversationPhrases();
    expect(said.map((phrase) => phrase.id)).not.toContain("phrase.evening");
    expect(said).toHaveLength(Object.values(content.phrase).filter((phrase) => phrase.where !== "place").length);
    for (const phrase of said.filter((entry) => entry.fill === null)) expect(phraseWords(phrase.id, null)).toBe(text[`${phrase.id}.name`]);
    for (const phrase of said) {
      if (phrase.fill === null) continue;
      const fills = phrase.fill === "spot" ? content.people.spots : (phrase.options ?? []);
      for (const fill of fills) {
        const shown = phraseWords(phrase.id, fill);
        expect(shown).not.toMatch(/[{}]/);
        expect(shown).toContain(fillWords(phrase.id, phrase.fill, fill));
      }
    }
  });
});

describe("time with someone", () => {
  test("[person:time-together-is-an-act] given a bond at home and one abroad, then seeing someone goes to the one at home and calling to the one abroad", () => {
    const game = peopleGame();
    const home = courted(game, "person.tobi-banker");
    const away = courted(game, "person.kelechi-developer");
    const view = game.view();
    expect(timeWith(view, SEE)?.id).toBe(home);
    expect(timeWith(view, CALL)?.id).toBe(away);
    expect(timeWith(view, "activity.rest")).toBeNull();
  });

  test("[person:time-together-is-an-act] given two bonds at home, when one has just had a moment, then the next slot of time goes to the other, as the engine sends it", () => {
    const game = peopleGame();
    courted(game, "person.tobi-banker");
    courted(game, "person.amaka-nurse");
    // activity:now-acts-and-month-acts: seeing someone is an act done at once, so a moment in the month both bonds were courted would
    // tie them on that month; a month passes first.
    playMonth(game, []);
    for (let month = 0; month < 3; month += 1) {
      const predicted = timeWith(game.view(), SEE)?.id;
      const before = Object.fromEntries(Object.entries(game.state.people.bonds).map(([id, bond]) => [id, bond.moments.length]));
      playMonth(game, [SEE_SLOT]);
      const grew = Object.entries(game.state.people.bonds).find(([id, bond]) => bond.moments.length > (before[id] ?? 0))?.[0];
      expect(grew).toBe(predicted);
    }
  });
});

describe("ending it", () => {
  test("[person:ender-pays-in-standing] given a connected bond, then ending it costs no standing, only the wellbeing", () => {
    const game = peopleGame();
    const bond = courted(game, "person.tobi-banker");
    const view = game.view();
    const held = view.people.bonds.find((entry) => entry.id === bond)!;
    expect(endCost(view, { ...held, stage: "connected" })).toEqual({ absence: false, standing: 0, wellbeing: content.tuning.people.endWellbeing, joint: false });
    expect(endCost(view, { ...held, standIn: "on" })).toEqual({ absence: true, standing: 0, wellbeing: 0, joint: false });
  });
});
