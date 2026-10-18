// pnpm exec tsx apps/client/src/shared/tiles/missing.ts: the ids whose picture is an emoji standing in for a
// model (tiles.data.ts), by kind, to show which models are missing. It lives beside the table because
// nothing outside apps/client may import from it (tests/boundaries.test.ts).
import { isMain } from "../../../../../tools/repo";
import { standIns, TILE_TABLE } from "./tiles.data";

export function missingListing(): string {
  const missing = standIns();
  const kinds = new Map<string, string[]>();
  for (const { id, emoji } of missing) {
    const kind = id.split(".")[0] ?? "";
    kinds.set(kind, [...(kinds.get(kind) ?? []), `  ${emoji} ${id}`]);
  }
  const head = `${String(missing.length)} of ${String(Object.keys(TILE_TABLE).length)} pictures stand in for a model not yet made.`;
  return [head, ...[...kinds].flatMap(([kind, lines]) => ["", kind, ...lines])].join("\n");
}

if (isMain(import.meta.url)) console.log(missingListing());
