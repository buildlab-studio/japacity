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
import { firstTick } from "../testing/world";
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
 * A registry whose route kind hears without conditions: `route/hear` moves an
 * unknown route to heard and records the effect, so a test can watch every
 * hearing the news asks for. The real route kind is tested on its own below.
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
      for (const line of deliveries(game.endTurn().lines)) seen.push(`${JSON.stringify(line.params.story)} ${JSON.stringify(line.params.stage)} ${String(game.state.news.delivered[line.params.story as Id<"news">]?.since)}`);
    }
    expect(new Set(seen).size).toBe(seen.length);
    const world = standInWorld("world-1", 39, content);
    expect(world.news.length).toBeGreaterThanOrEqual(2);
    const record: Partial<Record<Id<"news">, { stage: NewsStage; since: number }>> = {};
    for (const story of world.news) record[story.id] = { stage: story.stage, since: story.since };
    expect(game.state.news.delivered).toEqual(record);
  });

  test("[R-NEWS-004] given a story reaches a new stage, when the next turn ends, then it is delivered in that turn's news phase, once", () => {
    const announced = firstTick("world-1", firstContent, RECRUIT, "announced")!;
    const game = start({ scenario: "scenario.ada", content: firstContent, worldSeed: "world-1" });
    for (let tick = 0; tick < announced; tick += 1) {
      expect(deliveries(game.endTurn().lines).filter((line) => line.params.story === RECRUIT)).toEqual([]);
    }
    const lines = deliveries(game.endTurn().lines).filter((line) => line.params.story === RECRUIT);
    // The story tells Ada of the route, and is judged for her after that (R-NEWS-005). Announced, it does not yet ask for attention.
    expect(lines).toEqual([{ key: "line.news.delivered", params: { story: RECRUIT, stage: "announced", forYou: 1 }, tone: "plain", attention: false, counts: [] }]);
    expect(game.state.news.delivered[RECRUIT]).toMatchObject({ stage: "announced" });
    expect(deliveries(game.endTurn().lines).filter((line) => line.params.story === RECRUIT)).toEqual([]);
  });

  test("[R-NEWS-004] given a character away while stories moved on, when they come back, then each story is shown once, at its latest stage only", () => {
    const game = start({ scenario: "scenario.ada", content, worldAt: (tick) => standInWorld("world-1", tick === 0 ? 0 : 80, content) });
    // Tick 0 carries only the opening era's story (R-DIRECTOR-002).
    const opening = standInWorld("world-1", 0, content).news;
    expect(deliveries(game.endTurn().lines).map((line) => line.params.story)).toEqual(opening.map((story) => story.id));
    const lines = deliveries(game.endTurn().lines);
    const late = standInWorld("world-1", 80, content).news;
    const shown = game.state.news.delivered;
    const changed = late.filter((story) => opening.find((item) => item.id === story.id)?.since !== story.since || opening.find((item) => item.id === story.id)?.stage !== story.stage);
    expect(lines.map((line) => [line.params.story, line.params.stage])).toEqual(changed.map((story) => [story.id, story.stage]));
    expect(Object.keys(shown).length).toBe(late.length);
    expect(late.some((story) => story.stage === "in-force" || story.stage === "ended")).toBe(true);
    expect(deliveries(game.endTurn().lines)).toEqual([]);
  });

  test("[R-DIRECTOR-002] given three months played on the stand-in world, when the view is read, then the era's ticks are shown as this player's months", () => {
    const game = start({ scenario: "scenario.ada", content });
    for (let month = 0; month < 3; month += 1) game.endTurn();
    const era = game.view().era;
    if (era === null) throw new Error("The stand-in world has an era from tick 0.");
    expect(game.state.tick).toBeGreaterThan(0);
    expect(era.sinceMonth).toBe(game.state.turn.month - game.state.tick + era.since);
    expect(era.untilMonth - era.sinceMonth).toBe(era.until - era.since);
    expect(era.sinceMonth).toBeLessThanOrEqual(game.state.turn.month);
  });

  test("[R-NEWS-004] given the delivered line, when its words are looked up, then they exist and every story stage has its headline", () => {
    expect(text["line.news.delivered"]).toBeTruthy();
    const late = standInWorld("world-1", 80, content).news;
    expect(late.filter((story) => text[`${story.id}.${story.stage}.head`] === undefined)).toEqual([]);
  });
});

describe("for you", () => {
  test("[R-NEWS-004] [R-NEWS-005] given a story touching a route that tells you of it, when it is delivered, then it is for you, and so is every later story touching the route", () => {
    const heard: Effect[] = [];
    const kinds = hearingRegistry(heard);
    const played = life(kinds, (tick) => standInWorld("world-1", tick, firstContent), firstContent);
    const first = firstTick("world-1", firstContent, RECRUIT, "announced")!;
    for (let tick = 0; tick <= first; tick += 1) played.endTurn();
    // The recruitment story is judged after its own hearing: reading it told you of the route, so it is for you.
    const recruit = deliveries(played.allLines).find((line) => line.params.story === RECRUIT);
    expect(recruit?.params.forYou).toBe(1);
    expect(recruit?.attention).toBe(recruit?.params.stage === "in-force");
    expect(played.state.route[UK]?.state).toBe("heard");
    expect(played.view().news.find((story) => story.id === RECRUIT)?.forYou).toBe(true);
    for (let tick = 0; tick < 30; tick += 1) played.endTurn();
    // Every story delivered after that one, touching the route the character now knows of, is for them.
    const all = deliveries(played.allLines);
    const after = all.slice(all.findIndex((line) => line.params.story === RECRUIT) + 1);
    const later = after.filter((line) => line.params.story !== RECRUIT && (firstContent.news[line.params.story as Id<"news">]?.touches.includes(UK) ?? false));
    expect(later.length).toBeGreaterThan(0);
    expect(later.every((line) => line.params.forYou === 1 && line.attention === (line.params.stage === "in-force"))).toBe(true);
    // R-NEWS-004: a story asks for attention only once it is in force and for you.
    expect(all.every((line) => line.attention === (line.params.forYou === 1 && line.params.stage === "in-force"))).toBe(true);
    expect(all.some((line) => line.attention)).toBe(true);
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
    const announced = firstTick("world-1", content, RECRUIT, "announced")!;
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
    expect(played.state.news.delivered[RECRUIT]).toMatchObject({ stage: "announced" });
    expect(RANK[played.state.news.delivered[RECRUIT]!.stage]).toBeGreaterThan(RANK.rumour);
  });

  test("[R-NEWS-006] given the real route kind, when a story with a route to hear is delivered before the route's month for hearing, then the route is heard through the news", () => {
    const announced = firstTick("golden-world", content, RECRUIT, "announced")!;
    expect(announced + 1).toBeLessThan(content.route[UK]!.hearBy!);
    const game = start({ scenario: "scenario.ada", content, worldSeed: "golden-world" });
    for (let tick = 0; tick < announced; tick += 1) game.endTurn();
    expect(game.state.route[UK]?.state).toBe("unknown");
    const result = game.endTurn();
    expect(game.state.news.delivered[RECRUIT]).toMatchObject({ stage: "announced" });
    expect(game.state.route[UK]?.state).toBe("heard");
    expect(result.lines).toContainEqual({ key: "line.route.heard", params: { route: UK, via: "news" }, tone: "good", attention: false, counts: [] });
    expect(deliveries(result.lines).find((line) => line.params.story === RECRUIT)?.params.forYou).toBe(1);
  });
});
