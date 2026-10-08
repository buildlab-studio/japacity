// From docs/rules/news.md, "Stories", and docs/rules/director.md, "The story pool"
// and "Eras". The five stories of news.md keep their fixed schedule and gain the
// director's fields; the pool's stories are the director's.
//
// `needs` reads only the world's variables and the era, so "a story in
// force" is read as the variable that story sets. "After a closure ended" is read
// as its window still at 0, and the opening story ends the closure through `endedBy`.
// the page gives no cooldowns. A story that may fire again waits 12
// ticks; a story fired once has none.
// `standIn.announce` is only what the fixed schedule reads until the
// director runs. A story that follows another follows it there too; any other
// is announced between ticks 6 and 120, after the longest rumour lead.
import type { Id, NewsEntry, Requirement } from "@japacity/sim";

import { pct } from "../units";

const UK: Id<"route"> = "route.uk-masters";
const CARE: Id<"route"> = "route.uk-care";
const SKILLED: Id<"route"> = "route.uk-skilled";
const CANADA: Id<"route"> = "route.canada-points";
const TALENT: Id<"route"> = "route.uk-talent";
const GULF: Id<"route"> = "route.gulf-contract";

/** Every route a player can see. The road never appears in the routes view (R-ROAD-001). */
const EVERY_ROUTE: Id<"route">[] = [UK, CARE, SKILLED, CANADA, TALENT, GULF];

const WINDOWS: Id<"var">[] = [
  "var.uk-study-window",
  "var.uk-care-window",
  "var.uk-skilled-window",
  "var.uk-talent-window",
  "var.ca-window",
  "var.uae-window",
];

const REPEAT_COOLDOWN = 12;

/** "Over n" in the page is at least n + 1. */
function over(variable: Id<"var">, value: number): Requirement {
  return { type: "var/min", var: variable, value: value + 1 };
}

function atLeast(variable: Id<"var">, value: number): Requirement {
  return { type: "var/min", var: variable, value };
}

function atMost(variable: Id<"var">, value: number): Requirement {
  return { type: "var/max", var: variable, value };
}

function era(...eras: Id<"era">[]): Requirement {
  return { type: "era/is", eras };
}

const ANY_TICK = { between: [6, 120] as [number, number] };

function after(story: Id<"news">, lag: [number, number]) {
  return { after: story, stage: "in-force" as const, lag };
}

interface PoolStory {
  id: Id<"news">;
  touches: Id<"route">[];
  hear?: Id<"route">[];
  group: string;
  needs: Requirement[];
  chanceBp: number;
  rumourLead: number;
  forceLag: number;
  endsAfter: number | null;
  sets?: { var: Id<"var">; value: number }[];
  adds?: { var: Id<"var">; value: number }[];
  revert?: boolean;
  once?: boolean;
  shock?: boolean;
  endedBy?: Id<"news">;
  announce?: NewsEntry["standIn"]["announce"];
}

/** A story of the director's pool, as the page's table reads. */
function pool(story: PoolStory): NewsEntry {
  const once = story.once ?? false;
  return {
    id: story.id,
    touches: story.touches,
    hear: story.hear ?? [],
    director: {
      group: story.group,
      needs: story.needs,
      cooldown: once ? 0 : REPEAT_COOLDOWN,
      once,
      shock: story.shock ?? false,
      endedBy: story.endedBy ?? null,
      adds: story.adds ?? [],
    },
    standIn: {
      chanceBp: story.chanceBp,
      announce: story.announce ?? ANY_TICK,
      rumourLead: story.rumourLead,
      forceLag: story.forceLag,
      endsAfter: story.endsAfter,
      sets: story.sets ?? [],
      revert: story.revert ?? false,
    },
  };
}

/**
 * An era's own story, announced on the tick the era begins (R-DIRECTOR-002). It touches
 * every route (R-DIRECTOR-009). its chance is 0 because the director announces
 * it with the era, never by a roll; it ends with the era, which no field holds.
 */
function eraStory(id: Id<"news">): NewsEntry {
  return {
    id,
    touches: EVERY_ROUTE,
    hear: [],
    director: { group: "front-page", needs: [], cooldown: 0, once: false, shock: false, endedBy: null, adds: [] },
    standIn: { chanceBp: 0, announce: { between: [0, 0] }, rumourLead: 0, forceLag: 2, endsAfter: null, sets: [], revert: false },
  };
}

export const newsTable: Record<Id<"news">, NewsEntry> = {
  // news.md, with director.md's preconditions. their groups are `openings` for the recruiting
  // fair, `strictness` for the two UK rules and `fx` for the two currency stories.

  "news.uk-unis-recruit": {
    id: "news.uk-unis-recruit",
    touches: [UK],
    // Hearing it tells you of the UK master's route (R-NEWS-006).
    hear: [UK],
    director: { group: "openings", needs: [], cooldown: 0, once: true, shock: false, endedBy: null, adds: [] },
    standIn: {
      chanceBp: pct(100),
      announce: { between: [1, 3] },
      rumourLead: 0,
      forceLag: 2,
      endsAfter: null,
      sets: [],
      revert: false,
    },
  },
  "news.uk-living-rise": {
    id: "news.uk-living-rise",
    touches: [UK],
    hear: [],
    director: {
      group: "strictness",
      needs: [atLeast("var.uk-study-window", 1)],
      cooldown: 0,
      once: true,
      shock: false,
      endedBy: null,
      adds: [],
    },
    standIn: {
      chanceBp: pct(100),
      announce: { between: [4, 14] },
      rumourLead: 2,
      forceLag: 4,
      endsAfter: null,
      // Pence a month: £1,203.
      sets: [{ var: "var.uk-living-line", value: 120300 }],
      revert: false,
    },
  },
  "news.uk-refusals-up": {
    id: "news.uk-refusals-up",
    touches: [UK],
    hear: [],
    // The study route's backlash: the surge over 40 (R-DIRECTOR-005).
    director: {
      group: "strictness",
      needs: [over("var.uk-study-surge", 40)],
      cooldown: REPEAT_COOLDOWN,
      once: false,
      shock: false,
      endedBy: null,
      adds: [],
    },
    standIn: {
      chanceBp: pct(60),
      announce: { between: [8, 30] },
      rumourLead: 3,
      forceLag: 2,
      endsAfter: null,
      sets: [{ var: "var.uk-study-strictness", value: 70 }],
      revert: false,
    },
  },
  "news.dollar-scarcity": {
    id: "news.dollar-scarcity",
    touches: [UK],
    hear: [],
    // It cannot fire during a scarcity. It ends when the float comes into force.
    director: {
      group: "fx",
      needs: [atLeast("var.fx-supply", 80)],
      cooldown: REPEAT_COOLDOWN,
      once: false,
      shock: false,
      endedBy: "news.naira-float",
      adds: [],
    },
    standIn: {
      chanceBp: pct(60),
      announce: { between: [6, 26] },
      rumourLead: 2,
      forceLag: 2,
      // it ends when the float comes into force. The engine ends it by
      // reading the stage of news.naira-float, so no count of ticks is given here.
      endsAfter: null,
      sets: [
        { var: "var.fx-supply", value: 40 },
        { var: "var.fx-bank-queue", value: 2 },
        // US cents.
        { var: "var.fx-bank-allowance", value: 20000 },
      ],
      revert: true,
    },
  },
  "news.naira-float": {
    id: "news.naira-float",
    touches: [UK],
    hear: [],
    // It keeps its `after`: the scarcity in force is the supply at 40.
    director: {
      group: "fx",
      needs: [atMost("var.fx-supply", 40)],
      cooldown: REPEAT_COOLDOWN,
      once: false,
      shock: false,
      endedBy: null,
      adds: [],
    },
    standIn: {
      // It happens whenever the scarcity reaches in force (R-NEWS-003).
      chanceBp: pct(100),
      announce: { after: "news.dollar-scarcity", stage: "in-force", lag: [3, 6] },
      rumourLead: 1,
      forceLag: 2,
      endsAfter: null,
      sets: [
        { var: "var.fx-supply", value: 90 },
        { var: "var.fx-bank-queue", value: 0 },
        // US cents.
        { var: "var.fx-bank-allowance", value: 50000 },
      ],
      revert: false,
    },
  },

  // director.md, "The story pool". The UK study cycle.

  "news.uk-dependants-ban": pool({
    id: "news.uk-dependants-ban",
    touches: [UK],
    group: "closures",
    needs: [over("var.uk-study-surge", 60)],
    chanceBp: 400,
    rumourLead: 2,
    forceLag: 3,
    endsAfter: null,
    adds: [{ var: "var.uk-study-strictness", value: 15 }],
    once: true,
  }),
  "news.uk-study-narrows": pool({
    id: "news.uk-study-narrows",
    touches: [UK],
    group: "closures",
    // The restriction: the refusals story in force is strictness at its 70. the surge must still be over
    // 40, so a reopened route runs the cycle again before it narrows again. the window must be open, so a
    // closed or narrowing route is never narrowed again (R-DIRECTOR-005: no step is skipped).
    needs: [atLeast("var.uk-study-strictness", 70), over("var.uk-study-surge", 40), atLeast("var.uk-study-window", 2)],
    chanceBp: 500,
    rumourLead: 1,
    forceLag: 2,
    endsAfter: null,
    sets: [{ var: "var.uk-study-window", value: 1 }],
    announce: after("news.uk-refusals-up", [2, 12]),
  }),
  "news.uk-study-closes": pool({
    id: "news.uk-study-closes",
    touches: [UK],
    group: "closures",
    // The closure: the narrowing in force is the window at 1.
    needs: [atLeast("var.uk-study-window", 1), atMost("var.uk-study-window", 1), era("era.hard-line")],
    chanceBp: 300,
    rumourLead: 2,
    forceLag: 2,
    endsAfter: 12,
    sets: [{ var: "var.uk-study-window", value: 0 }],
    revert: true,
    shock: true,
    // the reopening ends the closure, as with the Gulf ban.
    endedBy: "news.uk-study-reopens",
    announce: after("news.uk-study-narrows", [2, 12]),
  }),
  "news.uk-study-reopens": pool({
    id: "news.uk-study-reopens",
    touches: [UK],
    hear: [UK],
    group: "openings",
    // A shortage: the window at 0, for `tuning.director.closedTicks` (R-DIRECTOR-005).
    needs: [atMost("var.uk-study-window", 0)],
    chanceBp: 800,
    rumourLead: 0,
    forceLag: 2,
    endsAfter: null,
    sets: [
      { var: "var.uk-study-window", value: 2 },
      { var: "var.uk-study-surge", value: 0 },
    ],
    announce: after("news.uk-study-closes", [8, 16]),
  }),

  // The UK care cycle.

  "news.uk-care-opens": pool({
    id: "news.uk-care-opens",
    touches: [CARE],
    hear: [CARE],
    group: "openings",
    needs: [atMost("var.uk-care-window", 0), era("era.open-door", "era.calm")],
    chanceBp: 400,
    rumourLead: 2,
    forceLag: 2,
    endsAfter: null,
    sets: [{ var: "var.uk-care-window", value: 2 }],
  }),
  "news.uk-care-dependants": pool({
    id: "news.uk-care-dependants",
    touches: [CARE],
    group: "closures",
    needs: [over("var.uk-care-surge", 50)],
    chanceBp: 500,
    rumourLead: 2,
    forceLag: 3,
    endsAfter: null,
    adds: [{ var: "var.uk-care-strictness", value: 10 }],
    once: true,
  }),
  "news.uk-care-sponsors-revoked": pool({
    id: "news.uk-care-sponsors-revoked",
    touches: [CARE],
    group: "abroad",
    needs: [over("var.uk-care-surge", 50)],
    chanceBp: 400,
    rumourLead: 1,
    forceLag: 2,
    endsAfter: 10,
    // A one-employer job on the care route ends with this chance a month while it is in force.
    sets: [{ var: "var.uk-care-sponsor-risk", value: 1200 }],
    revert: true,
    shock: true,
  }),
  "news.uk-care-closes": pool({
    id: "news.uk-care-closes",
    touches: [CARE],
    group: "closures",
    // "fired" is read as in force: the revocations' risk at its 1200.
    needs: [atLeast("var.uk-care-sponsor-risk", 1200)],
    chanceBp: 600,
    rumourLead: 2,
    forceLag: 2,
    endsAfter: null,
    sets: [{ var: "var.uk-care-window", value: 0 }],
    once: true,
    announce: after("news.uk-care-sponsors-revoked", [1, 8]),
  }),

  // UK skilled work, settlement and the graduate stay.

  "news.uk-skilled-bar-rises": pool({
    id: "news.uk-skilled-bar-rises",
    touches: [SKILLED],
    group: "closures",
    needs: [era("era.hard-line")],
    chanceBp: 500,
    rumourLead: 2,
    forceLag: 3,
    endsAfter: null,
    // Pence a year: £46,000.
    sets: [{ var: "var.uk-skilled-salary", value: 4600000 }],
  }),
  "news.uk-settle-ten-years": pool({
    id: "news.uk-settle-ten-years",
    touches: [CARE, SKILLED, TALENT],
    group: "closures",
    needs: [era("era.hard-line")],
    chanceBp: 300,
    rumourLead: 4,
    forceLag: 6,
    endsAfter: null,
    sets: [{ var: "var.uk-settle-months", value: 120 }],
    once: true,
    shock: true,
  }),
  "news.uk-graduate-shortened": pool({
    id: "news.uk-graduate-shortened",
    touches: [UK],
    group: "closures",
    needs: [],
    chanceBp: 400,
    rumourLead: 3,
    forceLag: 4,
    endsAfter: null,
    sets: [{ var: "var.uk-graduate-months", value: 18 }],
    once: true,
  }),

  // The UK talent route.

  "news.uk-talent-body-closes": pool({
    id: "news.uk-talent-body-closes",
    touches: [TALENT],
    group: "closures",
    needs: [],
    chanceBp: 200,
    rumourLead: 1,
    forceLag: 2,
    endsAfter: 4,
    sets: [{ var: "var.uk-talent-window", value: 0 }],
    revert: true,
    once: true,
    endedBy: "news.uk-talent-reappointed",
  }),
  "news.uk-talent-reappointed": pool({
    id: "news.uk-talent-reappointed",
    touches: [TALENT],
    // route-gates.md: the talent route is heard of through this story.
    hear: [TALENT],
    group: "openings",
    needs: [atMost("var.uk-talent-window", 0)],
    chanceBp: 900,
    rumourLead: 0,
    forceLag: 2,
    endsAfter: null,
    sets: [{ var: "var.uk-talent-window", value: 2 }],
    once: true,
    announce: after("news.uk-talent-body-closes", [1, 4]),
  }),

  // Canada.

  "news.ca-care-draw": pool({
    id: "news.ca-care-draw",
    touches: [CANADA],
    group: "openings",
    needs: [atLeast("var.ca-window", 2)],
    chanceBp: 600,
    rumourLead: 1,
    forceLag: 2,
    endsAfter: null,
    adds: [{ var: "var.ca-care-cutoff", value: -20 }],
  }),
  "news.ca-general-stops": pool({
    id: "news.ca-general-stops",
    touches: [CANADA],
    group: "closures",
    needs: [over("var.ca-surge", 40)],
    chanceBp: 400,
    rumourLead: 2,
    forceLag: 3,
    endsAfter: null,
    adds: [{ var: "var.ca-cutoff", value: 30 }],
    once: true,
  }),
  "news.ca-points-overhaul": pool({
    id: "news.ca-points-overhaul",
    touches: [CANADA],
    group: "closures",
    needs: [era("era.hard-line")],
    chanceBp: 300,
    rumourLead: 3,
    forceLag: 4,
    endsAfter: null,
    adds: [
      { var: "var.ca-cutoff", value: 15 },
      { var: "var.ca-care-cutoff", value: 10 },
    ],
    once: true,
  }),
  "news.ca-funds-rise": pool({
    id: "news.ca-funds-rise",
    touches: [CANADA],
    group: "closures",
    needs: [],
    chanceBp: 300,
    rumourLead: 1,
    forceLag: 3,
    endsAfter: null,
    // Canadian cents: C$16,000.
    sets: [{ var: "var.ca-funds", value: 1600000 }],
  }),

  // The Gulf.

  "news.uae-ban": pool({
    id: "news.uae-ban",
    touches: [GULF],
    group: "closures",
    needs: [atLeast("var.uae-window", 2)],
    chanceBp: 200,
    rumourLead: 1,
    forceLag: 2,
    endsAfter: 18,
    sets: [{ var: "var.uae-window", value: 0 }],
    revert: true,
    shock: true,
    endedBy: "news.uae-lifted",
  }),
  "news.uae-lifted": pool({
    id: "news.uae-lifted",
    touches: [GULF],
    group: "openings",
    needs: [atMost("var.uae-window", 0)],
    chanceBp: 10000,
    rumourLead: 0,
    forceLag: 2,
    endsAfter: null,
    sets: [{ var: "var.uae-window", value: 2 }],
    announce: after("news.uae-ban", [8, 16]),
  }),

  // Home.

  "news.passport-fee-doubles": pool({
    id: "news.passport-fee-doubles",
    touches: EVERY_ROUTE,
    group: "home",
    needs: [],
    chanceBp: 200,
    rumourLead: 2,
    forceLag: 3,
    endsAfter: null,
    // Kobo: ₦200,000.
    sets: [{ var: "var.passport-fee", value: 20000000 }],
    once: true,
  }),
  "news.fuel-subsidy": pool({
    id: "news.fuel-subsidy",
    touches: [],
    group: "home",
    needs: [era("era.crash", "era.calm")],
    chanceBp: 200,
    rumourLead: 1,
    forceLag: 2,
    endsAfter: null,
    adds: [{ var: "var.inflation", value: 2000 }],
    once: true,
    shock: true,
  }),
  "news.inflation-eases": pool({
    id: "news.inflation-eases",
    touches: [],
    group: "home",
    needs: [over("var.inflation", 1000)],
    chanceBp: 300,
    rumourLead: 2,
    forceLag: 3,
    endsAfter: null,
    adds: [{ var: "var.inflation", value: -800 }],
  }),
  "news.strike-starts": pool({
    id: "news.strike-starts",
    touches: [UK],
    group: "study",
    needs: [era("era.strike")],
    chanceBp: 3000,
    rumourLead: 1,
    forceLag: 2,
    endsAfter: 8,
    // Months added to the transcript's wait.
    sets: [{ var: "var.transcript-wait-extra", value: 4 }],
    revert: true,
    shock: true,
  }),

  // The pandemic.

  "news.pandemic-borders": pool({
    id: "news.pandemic-borders",
    touches: EVERY_ROUTE,
    group: "closures",
    needs: [era("era.pandemic")],
    chanceBp: 10000,
    rumourLead: 0,
    forceLag: 2,
    endsAfter: 10,
    // Every window 0, and flights cost twice as much.
    sets: [...WINDOWS.map((window) => ({ var: window, value: 0 })), { var: "var.flight-factor", value: 20000 }],
    revert: true,
    once: true,
    shock: true,
  }),
  "news.remote-hiring-boom": pool({
    id: "news.remote-hiring-boom",
    touches: [],
    group: "remote",
    needs: [era("era.pandemic")],
    chanceBp: 5000,
    rumourLead: 1,
    forceLag: 2,
    endsAfter: 18,
    // Basis points added to the remote job's hire chance.
    sets: [{ var: "var.remote-hire-bonus", value: 1500 }],
    revert: true,
    once: true,
  }),

  // One story for each era (R-DIRECTOR-002).

  "news.era-calm": eraStory("news.era-calm"),
  "news.era-open-door": eraStory("news.era-open-door"),
  "news.era-hard-line": eraStory("news.era-hard-line"),
  "news.era-crash": eraStory("news.era-crash"),
  "news.era-scandal": eraStory("news.era-scandal"),
  "news.era-strike": eraStory("news.era-strike"),
  "news.era-pandemic": eraStory("news.era-pandemic"),
};
