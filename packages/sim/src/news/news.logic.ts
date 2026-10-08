// News: docs/rules/news.md. The world decides when stories move; this kind
// keeps, for one character, the latest stage they have been shown.
import type { RegisteredKind } from "../engine/kind";
import type { BaseEvent, Content, Ctx, Effect, Id, NewsSlice, NewsStage, ReportLine, State } from "../engine/types";
import type { NewsEvent } from "./news.events";

/** Stages in the order a story passes through them (R-NEWS-001). */
const RANK: Record<NewsStage, number> = { rumour: 0, announced: 1, "in-force": 2, ended: 3 };

/** R-NEWS-005: the story touches a route the character has heard of, or got further with. */
export function isForYou(state: State, content: Content, id: Id<"news">): boolean {
  const entry = content.news[id];
  if (entry === undefined) return false;
  return entry.touches.some((route) => {
    const known = state.route[route]?.state;
    return known !== undefined && known !== "unknown";
  });
}

/**
 * R-PEOPLE-033: a sibling's facts show them living in the route's country, on
 * any status there, as the people kind judges `people/sibling-abroad`.
 * the page puts no age on it, so a sibling of any age passes it on.
 */
function siblingIn(ctx: Ctx, route: Id<"route">): boolean {
  const country = ctx.content.route[route]?.country ?? null;
  if (country === null) return false;
  const statuses = Object.values(ctx.content.status).filter((status) => status.country === country).map((status) => status.id);
  return ctx.check({ type: "people/sibling-abroad", country, statuses, minAgeMonths: 0 }).met;
}

/**
 * R-NEWS-004: each story the world has moved past what this character was
 * shown is delivered once, at its latest stage only, so a character who was
 * away is not walked through stages they missed. R-NEWS-005: "for you" is
 * judged after the story's own hearing has run, so the story that tells you
 * of a route is for you.
 */
function deliver(ctx: Ctx): BaseEvent[] {
  const events: BaseEvent[] = [];
  // R-ROAD-005: no news reaches the road; back home, the latest stage of each story is shown.
  if (ctx.state.place.where === "road") return events;
  for (const story of ctx.world.news) {
    // A new stage, or a new pass of a story that fired again (R-DIRECTOR-003), begins on a new tick.
    const shown = ctx.state.news.delivered[story.id];
    if (shown !== undefined && shown.since === story.since && shown.stage === story.stage) continue;
    const entry = ctx.content.news[story.id];
    if (entry === undefined) throw new Error(`The world names the story ${story.id}, which is not in content.`);
    // R-NEWS-006: reading it at announced or later is one more way to hear of a route.
    // The route kind applies its usual conditions.
    if (RANK[story.stage] >= RANK.announced && entry.hear.length > 0) {
      const hear: Effect[] = entry.hear.map((route) => ({ type: "route/hear", route, via: "news" }));
      events.push(...ctx.apply(hear, { source: story.id, param: null, terms: {} }));
    }
    // R-PEOPLE-033: a sibling living in a route's country passes the story on at rumour.
    if (story.stage === "rumour") {
      const hear: Effect[] = entry.hear.filter((route) => siblingIn(ctx, route)).map((route) => ({ type: "route/hear", route, via: "sibling" }));
      if (hear.length > 0) events.push(...ctx.apply(hear, { source: story.id, param: null, terms: {} }));
    }
    const delivered: NewsEvent = { type: "news/delivered", story: story.id, stage: story.stage, since: story.since, forYou: isForYou(ctx.state, ctx.content, story.id) };
    events.push(delivered);
  }
  return events;
}

function evolve(slice: NewsSlice, event: NewsEvent): NewsSlice {
  switch (event.type) {
    case "news/delivered":
      return { ...slice, delivered: { ...slice.delivered, [event.story]: { stage: event.stage, since: event.since } } };
    default: {
      const never: never = event.type;
      throw new Error(`Unknown news event ${String(never)}.`);
    }
  }
}

function lines(event: NewsEvent): ReportLine[] {
  switch (event.type) {
    case "news/delivered":
      // The interface looks up the headline and body from the story and stage.
      return [
        {
          key: "line.news.delivered",
          params: { story: event.story, stage: event.stage, forYou: event.forYou ? 1 : 0 },
          tone: "plain",
          // R-NEWS-004: only a story in force that touches your plans asks you to stop and look.
          attention: event.forYou && event.stage === "in-force",
          counts: [],
        },
      ];
    default: {
      const never: never = event.type;
      throw new Error(`Unknown news event ${String(never)}.`);
    }
  }
}

export const newsKind: RegisteredKind<NewsSlice, NewsEvent> = {
  kind: "news",
  initial: () => ({ delivered: {} }),
  phases: { news: deliver },
  evolve,
  lines,
  invariants(state, content) {
    return Object.keys(state.news.delivered)
      .filter((id) => content.news[id as Id<"news">] === undefined)
      .map((id) => `The character was shown ${id}, which is not a story in content.`);
  },
  view: ({ state, world, content }) => ({
    news: world.news.map((story) => ({ id: story.id, stage: story.stage, since: story.since, forYou: isForYou(state, content, story.id) })),
  }),
};
