import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { AnyKind, Registry } from "../engine/kind";
import { stepWith } from "../engine/step";
import type { BaseEvent, Content, Ctx, Effect, Id, NewsEntry, NewsStage, ReportLine, RouteSlice, State, World } from "../engine/types";
import { viewWith } from "../engine/view";
import { newState } from "../engine/state";
import { registry } from "../kinds";
import type { RouteEvent } from "../route/route.events";
import { start } from "../testing/play";
import { newsSchedule } from "../world/schedule";
import { standInWorld } from "../world/standIn";

const UK: Id<"route"> = "route.uk-masters";
const RECRUIT: Id<"news"> = "news.uk-unis-recruit";
const RANK: Record<NewsStage, number> = { rumour: 0, announced: 1, "in-force": 2, ended: 3 };

/**
 * The five stories of the first milestone. The timing tests below read the
 * stand-in schedule, which the whole-life stories move about, so they run on
 * these alone.
 */
const FIRST_STORIES: Id<"news">[] = ["news.uk-unis-recruit", "news.uk-living-rise", "news.uk-refusals-up", "news.dollar-scarcity", "news.naira-float"];
const firstContent: Content = { ...content, news: Object.fromEntries(FIRST_STORIES.map((id) => [id, content.news[id]!])) };

function deliveries(lines: ReportLine[]): ReportLine[] {
  return lines.filter((line) => line.key === "line.news.delivered");
}

/**
 * A registry whose route kind really hears: `route/hear` moves an unknown
 * route to heard and records the effect. The route stub does nothing yet, so
 * this stands in for it as turn.test.ts stands in for the offer kind.
 */
function hearingRegistry(heard: Effect[]): Registry {
  return registry().map((kind): AnyKind => {
    if (kind.kind !== "route") return kind;
    return {
      ...kind,
      effects: {
        ...kind.effects,
        "route/hear": (ctx: Ctx, effect: Effect): BaseEvent[] => {
          heard.push(effect);
          if (effect.type !== "route/hear" || ctx.state.route[effect.route]?.state !== "unknown") return [];
          const moved: RouteEvent = { type: "route/moved", route: effect.route, to: "heard" };
          return [moved];
        },
      },
      evolve: (slice: unknown, event: BaseEvent): unknown => {
        const routes = slice as RouteSlice;
        const moved = event as RouteEvent;
        const route = routes[moved.route];
        return route === undefined ? routes : { ...routes, [moved.route]: { ...route, state: moved.to } };
      },
    };
  });
}

/** A life played through a given registry and world, one tick per turn. */
function life(kinds: Registry, worldAt: (tick: number) => World, used: Content = content) {
  let state: State = newState("scenario.ada", "seed-1", used);
  let tick = 0;
  const allLines: ReportLine[] = [];
  return {
    get state() {
      return state;
    },
    endTurn(): ReportLine[] {
      if (state.turn.banked === 0) {
        const granted = stepWith(kinds, state, { type: "turns/grant", count: 1, basedOn: state.v }, worldAt(tick), used, "authority");
        if (!granted.ok) throw new Error(granted.detail);
        state = granted.state;
      }
      const result = stepWith(kinds, state, { type: "turn/end", slots: [], basedOn: state.v }, worldAt(tick), used);
      if (!result.ok) throw new Error(result.detail);
      state = result.state;
      tick += 1;
      allLines.push(...result.lines);
      return result.lines;
    },
    view: () => viewWith(kinds, { state, world: worldAt(tick), content: used }),
    allLines,
  };
}

describe("delivering the news", () => {
  test("[R-NEWS-004] given a world whose stories move, when 40 months are played, then each stage of each story is delivered once and the record holds the latest", () => {
    const game = start({ scenario: "scenario.ada", content, worldSeed: "world-1" });
    const seen: string[] = [];
    for (let month = 0; month < 40; month += 1) {
      if (game.state.turn.banked === 0) game.grant(1);
      for (const line of deliveries(game.endTurn().lines)) seen.push(`${String(line.params.story)} ${String(line.params.stage)}`);
    }
    expect(new Set(seen).size).toBe(seen.length);
    const world = standInWorld("world-1", 39, content);
    expect(world.news.length).toBeGreaterThanOrEqual(2);
    const record: Partial<Record<Id<"news">, NewsStage>> = {};
    for (const story of world.news) record[story.id] = story.stage;
    expect(game.state.news.delivered).toEqual(record);
  });

  test("[R-NEWS-004] given a story reaches a new stage, when the next turn ends, then it is delivered in that turn's news phase, once", () => {
    const schedule = newsSchedule("world-1", firstContent);
    const announced = schedule[RECRUIT]!.announced;
    const game = start({ scenario: "scenario.ada", content: firstContent, worldSeed: "world-1" });
    for (let tick = 0; tick < announced; tick += 1) {
      expect(deliveries(game.endTurn().lines).filter((line) => line.params.story === RECRUIT)).toEqual([]);
    }
    const lines = deliveries(game.endTurn().lines).filter((line) => line.params.story === RECRUIT);
    expect(lines).toEqual([{ key: "line.news.delivered", params: { story: RECRUIT, stage: "announced", forYou: 0 }, tone: "plain", attention: false, counts: [] }]);
    expect(game.state.news.delivered[RECRUIT]).toBe("announced");
    expect(deliveries(game.endTurn().lines).filter((line) => line.params.story === RECRUIT)).toEqual([]);
  });

  test("[R-NEWS-004] given a character away while stories moved on, when they come back, then each story is shown once, at its latest stage only", () => {
    const game = start({ scenario: "scenario.ada", content, worldAt: (tick) => standInWorld("world-1", tick === 0 ? 0 : 80, content) });
    expect(deliveries(game.endTurn().lines)).toEqual([]);
    const lines = deliveries(game.endTurn().lines);
    const late = standInWorld("world-1", 80, content).news;
    expect(lines.map((line) => [line.params.story, line.params.stage])).toEqual(late.map((story) => [story.id, story.stage]));
    expect(late.some((story) => story.stage === "in-force" || story.stage === "ended")).toBe(true);
    expect(deliveries(game.endTurn().lines)).toEqual([]);
  });

  test("[R-NEWS-004] given the delivered line, when its words are looked up, then they exist and every story stage has its headline", () => {
    expect(text["line.news.delivered"]).toBeTruthy();
    const late = standInWorld("world-1", 80, content).news;
    expect(late.filter((story) => text[`${story.id}.${story.stage}.head`] === undefined)).toEqual([]);
  });
});

describe("for you", () => {
  test("[R-NEWS-005] given a story touching a route, when the route is unknown, then it is not for you; once heard of, it is", () => {
    const heard: Effect[] = [];
    const kinds = hearingRegistry(heard);
    const played = life(kinds, (tick) => standInWorld("world-1", tick, firstContent), firstContent);
    const first = newsSchedule("world-1", firstContent)[RECRUIT]!.announced;
    for (let tick = 0; tick <= first; tick += 1) played.endTurn();
    // The recruitment story was not for you when it arrived: you had not heard of the route yet. Reading it told you.
    const recruit = deliveries(played.allLines).find((line) => line.params.story === RECRUIT);
    expect(recruit?.params.forYou).toBe(0);
    expect(played.state.route[UK]?.state).toBe("heard");
    expect(played.view().news.find((story) => story.id === RECRUIT)?.forYou).toBe(true);
    for (let tick = 0; tick < 30; tick += 1) played.endTurn();
    const later = deliveries(played.allLines).filter((line) => line.params.story !== RECRUIT);
    expect(later.length).toBeGreaterThan(0);
    expect(later.every((line) => line.params.forYou === 1 && line.attention)).toBe(true);
  });

  test("[R-NEWS-005] given every story touches a route the character does not know, when the view is read, then none is for you", () => {
    // Nobody can hear of the UK route in this copy, so every story stays outside "for you".
    const deaf: Content = JSON.parse(JSON.stringify(content)) as Content;
    for (const route of Object.values(deaf.route)) route.hearIf = [{ type: "quality/min", quality: "quality.edu-level", value: 99 }];
    const game = start({ scenario: "scenario.ada", content: deaf, worldSeed: "world-1" });
    for (let month = 0; month < 20; month += 1) game.endTurn();
    const news = game.view().news;
    expect(news.length).toBeGreaterThan(0);
    expect(news.every((story) => !story.forYou)).toBe(true);
    expect(news.map(({ id, stage, since }) => ({ id, stage, since }))).toEqual(standInWorld("world-1", 20, deaf).news);
  });
});

describe("hearing through the news", () => {
  test("[R-NEWS-006] given a story with routes to hear, when it is delivered at announced, then route/hear is carried out for each, via news", () => {
    const heard: Effect[] = [];
    const played = life(hearingRegistry(heard), (tick) => standInWorld("world-1", tick, content));
    const announced = newsSchedule("world-1", content)[RECRUIT]!.announced;
    for (let tick = 0; tick < announced; tick += 1) played.endTurn();
    expect(heard).toEqual([]);
    played.endTurn();
    expect(heard).toEqual([{ type: "route/hear", route: UK, via: "news" }]);
  });

  test("[R-NEWS-006] given a story at rumour, when it is delivered, then nobody hears of anything until it is announced", () => {
    const recruit = content.news[RECRUIT]!;
    const rumoured: NewsEntry = { ...recruit, standIn: { ...recruit.standIn, announce: { between: [3, 3] }, rumourLead: 2 } };
    const used: Content = { ...content, news: { [RECRUIT]: rumoured } };
    const heard: Effect[] = [];
    const played = life(hearingRegistry(heard), (tick) => standInWorld("w", tick, used), used);
    played.endTurn();
    const rumour = deliveries(played.endTurn());
    expect(rumour.map((line) => line.params.stage)).toEqual(["rumour"]);
    expect(heard).toEqual([]);
    played.endTurn();
    expect(heard).toEqual([]);
    const announced = deliveries(played.endTurn());
    expect(announced.map((line) => line.params.stage)).toEqual(["announced"]);
    expect(heard).toEqual([{ type: "route/hear", route: UK, via: "news" }]);
    expect(played.state.news.delivered[RECRUIT]).toBe("announced");
    expect(RANK[played.state.news.delivered[RECRUIT]!]).toBeGreaterThan(RANK.rumour);
  });

  test("[R-NEWS-006] given the real route kind, when a story with a route to hear is delivered, then the turn still ends normally", () => {
    const game = start({ scenario: "scenario.ada", content, worldSeed: "world-1" });
    for (let month = 0; month < 6; month += 1) game.endTurn();
    expect(game.state.turn.month).toBe(6);
    expect(game.state.news.delivered[RECRUIT]).toBeDefined();
  });
});
