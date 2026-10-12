// pnpm exec tsx tools/assets/tiles-missing.ts: the ids whose picture is still an emoji standing in for a model
// (apps/client/src/shared/tiles/tiles.data.ts), by kind, so the maintainer knows which models to commission.
import { standIns, TILE_TABLE } from "../../apps/client/src/shared/tiles/tiles.data";

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

if (process.argv[1] !== undefined && import.meta.filename === process.argv[1]) console.log(missingListing());
