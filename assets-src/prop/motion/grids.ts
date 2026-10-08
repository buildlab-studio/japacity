// The moving sheets and the water grid as data (assets.md R-ASSET-028, R-ASSET-029): each piece ships
// at two mesh levels, `coarse` for the low mode and `fine` for the high, as the file variants
// shared/prop/prop_<piece>_<level>.glb. The client reads the variant its mode picks (city.md R-CITY-028).
// No three.js here, so the client can read the table without the builder.

export type MeshLevel = "coarse" | "fine";
export type GridPiece = "sheet-flag" | "sheet-hang" | "sheet-frond" | "sheet-pennant" | "water";
export type PinnedEdge = "top" | "bottom" | "left" | "right";

export const MESH_LEVELS: readonly MeshLevel[] = ["coarse", "fine"];

/** Water ships as one square tile this many metres a side; a place lays as many as it needs. */
export const WATER_TILE = 12;

export interface GridSpec {
  /** The motion the client gives it (the shared motion material's kinds). */
  motion: "flag" | "hang" | "frond" | "water";
  /** The edge that holds still, in the sheet's own frame; water has none. */
  pinned: PinnedEdge | null;
  /** Segments across and down a sheet (or across and along a water tile), by level. A pennant is a triangle cut into this many rows. */
  segments: Record<MeshLevel, [number, number]>;
}

export const GRIDS: Record<GridPiece, GridSpec> = {
  "sheet-flag": { motion: "flag", pinned: "left", segments: { coarse: [10, 5], fine: [22, 10] } },
  "sheet-hang": { motion: "hang", pinned: "top", segments: { coarse: [3, 4], fine: [6, 8] } },
  "sheet-frond": { motion: "frond", pinned: "left", segments: { coarse: [6, 2], fine: [12, 2] } },
  "sheet-pennant": { motion: "hang", pinned: "top", segments: { coarse: [1, 1], fine: [3, 3] } },
  water: { motion: "water", pinned: null, segments: { coarse: [6, 6], fine: [16, 16] } },
};

export const GRID_PIECES = Object.keys(GRIDS) as GridPiece[];

/** The shipped path of a piece at a level, under public/assets. */
export function gridFile(piece: GridPiece, level: MeshLevel): string {
  return `shared/prop/prop_${piece}_${level}.glb`;
}
