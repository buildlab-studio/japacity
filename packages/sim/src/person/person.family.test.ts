import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { hashState } from "../engine/hash";
import { replay } from "../engine/replay";
import { newState } from "../engine/state";
import type { PersonFacts, Save } from "../engine/types";
import type { Game } from "../testing/play";
import { finishPrologue, start } from "../testing/play";
import { legalCommands } from "../testing/legal";
import { standInWorld } from "../world/standIn";
import { INVITER_SLOT } from "./person.family";
import { PROLOGUE } from "../testing/ids";

const SEED = "family";
const WORLD_SEED = "world-1";

/** The inviter's family: drawn far from what this seed draws on its own, so a copy shows. */
const FAMILY: NonNullable<Save["family"]> = { from: "character-inviter", draw: { familyMeans: 77, town: "town", siblings: 3, parentsEducated: true } };

const FACTS: PersonFacts = {
  label: "player",
  ageMonths: 300,
  where: "home",
  country: null,
  status: null,
  statusMonthsLeft: null,
  monthsInCountry: 0,
  job: null,
  meetsFloor: {},
  eduLevel: 3,
  englishBand: null,
  home: "town",
  joint: null,
  funds: null,
  assistanceTaken: 0,
  sponsorReady: null,
};

/** A sibling's life begun from a save that carries the inviter's family. */
function siblingLife(): Game {
  const game = start({ scenario: PROLOGUE, content, seed: SEED, worldSeed: WORLD_SEED });
  game.state = newState(PROLOGUE, SEED, content, { family: FAMILY });
  game.save = { ...game.save, family: FAMILY };
  return game;
}

function siblingSlots(game: Game): string[] {
  return Object.keys(game.state.people.slots).filter((key) => key.startsWith("sibling-"));
}

describe("a sibling made from an invite", () => {
  test("[person:real-sibling-shares-family-draw] given a save with the inviter's family, when the prologue's first card is answered, then the draw is the inviter's, copied with no draw of its own, and its qualities follow it", () => {
    const game = siblingLife();
    const [first] = legalCommands(game.view());
    if (first === undefined) throw new Error("The prologue has no first answer.");
    const drawsBefore = game.state.draws.prologue ?? 0;
    const result = game.accept(first);
    expect(result.events.some((event) => event.type === "prologue/drawn")).toBe(true);
    expect(game.state.prologue.draw).toEqual(FAMILY.draw);
    expect(game.state.quality["quality.family-means"]).toBe(FAMILY.draw.familyMeans);
    const own = start({ scenario: PROLOGUE, content, seed: SEED, worldSeed: WORLD_SEED });
    own.accept(first);
    expect(own.state.prologue.draw).not.toEqual(FAMILY.draw);
    expect((game.state.draws.prologue ?? 0) - drawsBefore).toBeLessThan((own.state.draws.prologue ?? 0) - drawsBefore);
  });

  test("[person:real-sibling-shares-family-draw] given a save with the inviter's family, when the life begins, then its sibling slots mirror the family with the inviter's slot waiting for the link and the others drawn as computer lives after the prologue", () => {
    const game = siblingLife();
    expect(siblingSlots(game)).toEqual(["sibling-1", "sibling-2", "sibling-3"]);
    expect(game.state.people.slots[INVITER_SLOT]).toEqual({ state: "invited", bond: null, person: null, invite: { looking: "sibling", fill: null } });
    finishPrologue(game);
    game.grant(1);
    game.endTurn();
    expect(siblingSlots(game)).toHaveLength(FAMILY.draw.siblings);
    expect(game.state.people.slots[INVITER_SLOT]?.state).toBe("invited");
    for (const key of ["sibling-2", "sibling-3"]) {
      const slot = game.state.people.slots[key]!;
      expect(slot.state).toBe("computer");
      expect(content.person[slot.person!]?.role).toBe("sibling");
    }
    game.accept({ type: "people/link", slot: INVITER_SLOT, pair: "pair-sib", facts: FACTS }, "authority");
    const slot = game.state.people.slots[INVITER_SLOT]!;
    expect(slot.state).toBe("player");
    expect(game.state.people.bonds[slot.bond!]).toMatchObject({ role: "sibling", stage: "connected", with: { kind: "player", pair: "pair-sib" } });
  });

  test("[person:real-sibling-shares-family-draw] given a sibling's life played some way, when its save is replayed, then the family comes back from the save and the state is the same, and the same commands without the family make another life", () => {
    const game = siblingLife();
    finishPrologue(game);
    game.grant(1);
    game.endTurn();
    const worldAt = (tick: number) => standInWorld(WORLD_SEED, tick, content);
    // A command the inviter's family allowed may be refused in a life drawn on its own; that is another life too.
    const rebuilt = (save: Save): string => {
      try {
        return hashState(replay(save, content, worldAt).state);
      } catch {
        return "refused";
      }
    };
    expect(rebuilt(game.save)).toBe(hashState(game.state));
    expect(rebuilt({ schema: game.save.schema, segments: game.save.segments })).not.toBe(hashState(game.state));
  });
});
