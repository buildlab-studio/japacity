import { content as realContent } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { englishBand } from "../document/document.logic";
import { appliedAmount } from "../quality/quality.logic";
import { offerChanceBp, refusalChanceBp, refusalReasons } from "../route/route.logic";
import { miniContent } from "../testing/miniContent";
import { start } from "../testing/play";
import { standInWorld } from "../world/standIn";
import { checkContent } from "./content";
import { applyOverlay } from "./overlay";
import { newSave, replay } from "./replay";
import type { Content, VisaApplication } from "./types";

describe("[R-ENGINE-017] the overlay", () => {
  test("[R-ENGINE-017] given an overlay of a few numbers, when applied, then those change and nothing else does", () => {
    const over = applyOverlay(miniContent, { version: "dials-1", tuning: { route: { refusalPerRefusalBp: 1200 } }, school: { "school.mini": { offerBp: 5000 } } });
    expect(over.tuning.route.refusalPerRefusalBp).toBe(1200);
    expect(over.tuning.route.refusalMinBp).toBe(miniContent.tuning.route.refusalMinBp);
    expect(over.school["school.mini"]?.offerBp).toBe(5000);
    expect(over.school["school.mini"]?.tuition).toBe(miniContent.school["school.mini"]?.tuition);
    expect(over.quality).toEqual(miniContent.quality);
    expect(checkContent(over)).toEqual([]);
  });

  test("[R-ENGINE-017] given an overlay, when applied, then the defaults are untouched", () => {
    const before = JSON.stringify(miniContent);
    applyOverlay(miniContent, { version: "dials-1", tuning: { turn: { cap: 99 } } });
    expect(JSON.stringify(miniContent)).toBe(before);
  });

  test("[R-ENGINE-017] given an overlay that changes nothing, when applied, then the content equals the defaults but for the overlay's version, and the content's own version is kept", () => {
    const over = applyOverlay(miniContent, { version: "dials-1" });
    expect(over).toEqual({ ...miniContent, overlay: "dials-1" });
    expect(over.version).toBe(miniContent.version);
  });

  test("[R-ENGINE-017] given an overlay that replaces a list, when applied, then the list is replaced whole", () => {
    const over = applyOverlay(miniContent, { version: "dials-1", route: { "route.mini": { schools: [] } } });
    expect(over.route["route.mini"]?.schools).toEqual([]);
  });

  test("[R-ENGINE-017] [R-ENGINE-014] given an overlay whose result breaks a schema, when applied, then it throws", () => {
    expect(() => applyOverlay(miniContent, { version: "dials-bad", tuning: { turn: { cap: -1 } } })).toThrow(/does not fit the content schemas/);
    expect(() => applyOverlay(miniContent, { version: "dials-bad", tuning: { route: { offerMaxBp: 10001 } } })).toThrow(/does not fit the content schemas/);
  });

  test("[R-ENGINE-017] [R-ENGINE-014] given an overlay whose result fails the content check, when applied, then it throws", () => {
    const route = miniContent.route["route.mini"]!;
    const heavier = route.checklist.map((item, index) => (index === 0 ? { ...item, weight: item.weight + 1 } : item));
    expect(() => applyOverlay(miniContent, { version: "dials-bad", route: { "route.mini": { checklist: heavier } } })).toThrow(/fails the content check/);
    expect(() => applyOverlay(miniContent, { version: "dials-bad", route: { "route.mini": { schools: ["school.nowhere"] } } })).toThrow(/fails the content check/);
  });
});

describe("[R-ENGINE-010] the overlay in the save", () => {
  const worldOf = (content: Content) => (tick: number) => standInWorld("world-1", tick, content);

  test("[R-ENGINE-010] [R-ENGINE-017] given content with an overlay, when a save is made and played, then it records the overlay's version and replays under it", () => {
    const over = applyOverlay(miniContent, { version: "dials-2", tuning: { quality: { wellbeingRest: 20 } } });
    expect(newSave("scenario.plain", "seed-1", "world-1", over).overlay).toBe("dials-2");
    expect(newSave("scenario.plain", "seed-1", "world-1", miniContent)).not.toHaveProperty("overlay");
    const game = start({ scenario: "scenario.plain", content: over });
    game.endTurn();
    game.endTurn();
    expect(game.save.overlay).toBe("dials-2");
    expect(replay(game.save, over, worldOf(over)).state).toEqual(game.state);
  });

  test("[R-ENGINE-010] [R-ENGINE-017] given a save made under one overlay, when it is replayed under another or under none, then the replay is refused", () => {
    const over = applyOverlay(miniContent, { version: "dials-2", tuning: { quality: { wellbeingRest: 20 } } });
    const other = applyOverlay(miniContent, { version: "dials-3", tuning: { quality: { wellbeingRest: 20 } } });
    const game = start({ scenario: "scenario.plain", content: over });
    game.endTurn();
    expect(() => replay(game.save, other, worldOf(other))).toThrow(/overlay dials-2, not dials-3/);
    expect(() => replay(game.save, miniContent, worldOf(miniContent))).toThrow(/overlay dials-2, not none/);
    const plain = start({ scenario: "scenario.plain", content: miniContent });
    plain.endTurn();
    expect(() => replay(plain.save, over, worldOf(over))).toThrow(/overlay none, not dials-2/);
  });
});

describe("[R-ENGINE-017] no rule number lives in code", () => {
  const route = realContent.tuning.route;
  const northgate = realContent.school["school.northgate"]!;

  test("[R-ENGINE-017] [R-ROUTE-007] given an overlay of the offer chance per grade and its cap, when an offer's chance is worked out, then it follows the overlay", () => {
    const over = applyOverlay(realContent, { version: "dials-offer", tuning: { route: { offerPerGradeBp: 1000, offerMaxBp: 9000 } } });
    expect(offerChanceBp(northgate, northgate.minGrade + 1, route)).toBe(northgate.offerBp + 500);
    expect(offerChanceBp(northgate, northgate.minGrade, over.tuning.route)).toBe(northgate.offerBp);
    expect(offerChanceBp({ ...northgate, offerBp: 7000 }, northgate.minGrade + 1, over.tuning.route)).toBe(8000);
    expect(offerChanceBp(northgate, northgate.minGrade + 1, over.tuning.route)).toBe(9000);
  });

  test("[R-ENGINE-017] [R-ROUTE-016] given an overlay of the good grade, and two routes' own bases, when the chance of refusal is worked out, then each follows its source", () => {
    const file = { strictness: 0, unexplainedBp: 0, refusals: 0, interviewScore: 0, grade: 4 };
    const over = applyOverlay(realContent, { version: "dials-grade", tuning: { route: { goodGrade: 5 } } });
    expect(refusalChanceBp(route, 900, file)).toBe(900 - route.refusalGoodGradeBp);
    expect(refusalChanceBp(over.tuning.route, 900, file)).toBe(900);
    expect(refusalChanceBp(route, 1500, file)).toBe(1500 - route.refusalGoodGradeBp);
    expect(realContent.route["route.uk-masters"]?.refusalBaseBp).toBe(900);
  });

  test("[R-ENGINE-017] [R-ROUTE-019] given an overlay of the funds share that makes a refusal reason, when reasons are given, then the edge moves with it", () => {
    const visa: VisaApplication = {
      submittedMonth: 1,
      decisionMonth: 2,
      rules: { livingLine: 0, livingMonths: 0, strictness: 0 },
      unexplainedBp: 2000,
      interviewScore: 0,
      surchargePaid: 0,
    };
    const over = applyOverlay(realContent, { version: "dials-funds", tuning: { route: { fundsReasonBp: 2000 } } });
    expect(refusalReasons(visa, 0, route)).toEqual(["credibility"]);
    expect(refusalReasons(visa, 0, over.tuning.route)).toEqual(["funds"]);
    expect(refusalReasons({ ...visa, unexplainedBp: 1999 }, 0, over.tuning.route)).toEqual(["credibility"]);
  });

  test("[R-ENGINE-017] [R-DOCUMENT-005] given an overlay of the band step, when a band is worked out, then it moves and rounds in the overlay's steps", () => {
    const english = realContent.tuning.english;
    const over = applyOverlay(realContent, { version: "dials-band", tuning: { english: { bandStep: 10 } } });
    // English 72: 40 + 25 = 65, a step of 5 up is 70, a step of 10 up is 75 and then down to 70.
    expect(englishBand(72, english, 0)).toBe(65);
    expect(englishBand(72, english, 1)).toBe(70);
    expect(englishBand(72, over.tuning.english, 0)).toBe(60);
    expect(englishBand(72, over.tuning.english, 1)).toBe(70);
  });

  test("[R-ENGINE-017] [R-QUALITY-005] given an overlay of the share a skill keeps at the soft cap, when a gain is applied there, then that share is kept, rounding up", () => {
    const tech = realContent.quality["quality.tech"]!;
    const numbers = realContent.tuning.quality;
    const over = applyOverlay(realContent, { version: "dials-soft", tuning: { quality: { skillSoftBp: 2500 } } });
    expect(appliedAmount(tech, numbers.skillSoftAt, 5, numbers)).toBe(3);
    expect(appliedAmount(tech, numbers.skillSoftAt, 5, over.tuning.quality)).toBe(2);
    expect(appliedAmount(tech, numbers.skillSoftAt, 4, over.tuning.quality)).toBe(1);
    expect(appliedAmount(tech, numbers.skillSoftAt - 1, 5, over.tuning.quality)).toBe(5);
  });
});
