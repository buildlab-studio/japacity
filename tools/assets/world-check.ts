// The limits of a place in the world-first design (docs/rules/world.md R-WORLD-011): a place is one
// screen, its crowd small and its moving sheets few. The client applies the same numbers when it
// builds a place (features/city/limits.ts), so a file that passes here draws as checked. Pure.

/** R-WORLD-011's numbers. */
export const WORLD_LIMITS = {
  /** People shown, by scope and mode. */
  people: { exterior: { low: 6, high: 10 }, interior: { low: 4, high: 6 } },
  /** The send-off party keeps its ten, its dancers among them. */
  party: 10,
  /** Moving sheets (a flag, a hang, a frond) a place may show in each mode. */
  sheets: { low: 0, high: 1 },
  /** An outdoor place is a frontage about this wide, in metres. */
  frontage: 24,
  /** An indoor place is a room about this wide and deep, in metres. */
  room: [12, 10],
  /** How far "about" stretches. */
  slack: 1.25,
} as const;

/** The motion kinds that are moving sheets (assets.md R-ASSET-028). */
export const SHEET_KINDS: ReadonlySet<string> = new Set(["flag", "hang", "frond"]);

/** The parts of a world-first place file the check reads. */
export interface LimitedFile {
  place: string;
  scope: "exterior" | "interior";
  people: { low: number; high: number };
  stage?: {
    shot?: { width?: number };
    walkable?: [number, number][][];
    ground: { size: [number, number] };
    motion: { kind: string }[];
    dancers?: unknown[];
    dressings?: { offer: string; motion: { kind: string }[]; dancers: unknown[]; crowd: { low: number; high: number } }[];
    things?: { id: string; acts: unknown[] }[];
  };
}

/** No thing offers more than two acts (R-WORLD-005); a third goes on a sheet. */
export const MAX_ACTS = 2;

/** R-WORLD-005 for one file: every thing has at least one act and at most two. */
export function checkThings(file: Pick<LimitedFile, "place" | "stage">): string[] {
  return (file.stage?.things ?? []).flatMap((thing) =>
    thing.acts.length === 0 ? [`R-WORLD-005: ${file.place} has a thing ${thing.id} with no act`] : thing.acts.length > MAX_ACTS ? [`R-WORLD-005: ${file.place} has a thing ${thing.id} with ${String(thing.acts.length)} acts, over ${String(MAX_ACTS)}`] : [],
  );
}

/** A world-first file declares its camera; older files are drawn by the earlier rules until they are rebuilt. */
export function isWorldFile(file: Pick<LimitedFile, "stage">): boolean {
  return file.stage?.shot !== undefined;
}

/** The width and depth of a stage's walkable ground, or of its ground when it records none. */
export function walkableSize(stage: NonNullable<LimitedFile["stage"]>): [number, number] {
  const corners = (stage.walkable ?? []).flat();
  if (corners.length === 0) return stage.ground.size;
  const xs = corners.map(([x]) => x);
  const zs = corners.map(([, z]) => z);
  return [Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)];
}

/** R-WORLD-011 for one file: its crowd, its moving sheets, its size, and each dressing's. */
export function checkLimits(file: LimitedFile): string[] {
  const stage = file.stage;
  if (stage === undefined) return [];
  const problems: string[] = [];
  const say = (line: string): number => problems.push(`R-WORLD-011: ${file.place} ${line}`);
  const people = WORLD_LIMITS.people[file.scope];
  if (file.people.low > people.low) say(`shows ${String(file.people.low)} people in low mode, over ${String(people.low)} for an ${file.scope} place`);
  if (file.people.high > people.high) say(`shows ${String(file.people.high)} people in high mode, over ${String(people.high)} for an ${file.scope} place`);
  const sheets = stage.motion.filter((motion) => SHEET_KINDS.has(motion.kind)).length;
  if (sheets > WORLD_LIMITS.sheets.high) say(`has ${String(sheets)} moving sheets, over ${String(WORLD_LIMITS.sheets.high)}`);
  for (const dressing of stage.dressings ?? []) {
    const crowd = dressing.crowd.high + dressing.dancers.length + (stage.dancers?.length ?? 0);
    if (crowd > WORLD_LIMITS.party) say(`dressed for ${dressing.offer} shows ${String(crowd)} people with its dancers, over ${String(WORLD_LIMITS.party)}`);
    const dressed = sheets + dressing.motion.filter((motion) => SHEET_KINDS.has(motion.kind)).length;
    if (dressed > WORLD_LIMITS.sheets.high) say(`dressed for ${dressing.offer} has ${String(dressed)} moving sheets, over ${String(WORLD_LIMITS.sheets.high)}`);
  }
  if (file.scope === "exterior") {
    const width = stage.shot?.width ?? 0;
    const most = WORLD_LIMITS.frontage * WORLD_LIMITS.slack;
    if (width > most) say(`is a frontage ${width.toFixed(1)} m wide, over about ${String(WORLD_LIMITS.frontage)} m (at most ${most.toFixed(1)})`);
  } else {
    const [width, depth] = walkableSize(stage);
    const [long, short] = [Math.max(width, depth), Math.min(width, depth)];
    const [roomLong, roomShort] = WORLD_LIMITS.room;
    if (long > roomLong * WORLD_LIMITS.slack || short > roomShort * WORLD_LIMITS.slack) say(`is a room of ${width.toFixed(1)} by ${depth.toFixed(1)} m, over about ${String(roomLong)} by ${String(roomShort)} m`);
  }
  return problems;
}
