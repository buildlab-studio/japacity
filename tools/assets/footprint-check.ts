// The build check's part for footprints and walkable ground (R-ASSET-030): every model carries its
// footprint, every staged place its walkable ground, and every spot and the start of a place stand
// on walkable ground that no model's footprint covers, in the place's plain stage and in each of its dressings.
import { type Footprint, isFootprint, isWalkable, onWalkable, inBox, type PlacedBox, placeFootprint, type WalkablePolygon } from "@japacity/assets";

/** x, z and the turn about +Y, as a place file writes a position. */
export type At = [number, number, number];

interface StagedModels {
  models: { file: string; at: At[] }[];
  people: At[];
}

/** The parts of a place's stage the check reads. */
export interface StagedGround extends StagedModels {
  start: At;
  walkable?: unknown;
  dressings?: (StagedModels & { offer: string; hide?: string[] })[];
}

/** 12. Every model under public/assets carries a footprint in its root's extras: boxes, or `none`. */
export function checkFootprints(shipped: readonly { file: string; extras: Record<string, unknown> }[]): string[] {
  return shipped
    .filter((file) => file.file.endsWith(".glb") && !isFootprint(file.extras.footprint))
    .map((file) => `R-ASSET-030: ${file.file} has no footprint in its extras (boxes in metres, or none)`);
}

/** Every box the models of a stage block, placed where each copy stands. */
export function placedBoxes(models: StagedModels["models"], footprints: ReadonlyMap<string, Footprint>): PlacedBox[] {
  return models.flatMap((model) => {
    const footprint = footprints.get(model.file);
    return footprint === undefined ? [] : model.at.flatMap((at) => placeFootprint(footprint, at));
  });
}

/** Why a point may not be stood on: off the walkable ground, or inside a model's footprint; null when it may. */
export function standingProblem(walkable: readonly WalkablePolygon[], boxes: readonly PlacedBox[], x: number, z: number): string | null {
  if (!onWalkable(walkable, x, z)) return "is off its walkable ground";
  return boxes.some((box) => inBox(box, x, z)) ? "stands on a model's footprint" : null;
}

/**
 * 13. A staged place has walkable ground, and its start and every spot, in its plain stage and in
 * each dressing, stand on it clear of every footprint.
 */
export function checkWalkable(place: string, stage: StagedGround | undefined, footprints: ReadonlyMap<string, Footprint>): string[] {
  if (stage === undefined) return [];
  const walkable = stage.walkable;
  if (!isWalkable(walkable)) return [`R-ASSET-030: ${place} has no walkable ground (polygons of at least three corners in metres)`];
  const problems: string[] = [];
  const missing = new Set<string>();
  const check = (models: StagedModels["models"], points: { name: string; at: At }[], where: string): void => {
    for (const model of models) if (!footprints.has(model.file)) missing.add(model.file);
    const boxes = placedBoxes(models, footprints);
    for (const point of points) {
      const problem = standingProblem(walkable, boxes, point.at[0], point.at[1]);
      if (problem !== null) problems.push(`R-ASSET-030: ${place}${where}: ${point.name} at ${point.at[0].toFixed(2)}, ${point.at[1].toFixed(2)} ${problem}`);
    }
  };
  const spots = (people: At[]): { name: string; at: At }[] => people.map((at, index) => ({ name: `spot ${String(index)}`, at }));
  check(stage.models, [{ name: "the start", at: stage.start }, ...spots(stage.people)], "");
  for (const dressing of stage.dressings ?? []) {
    const hidden = new Set(dressing.hide ?? []);
    check([...stage.models.filter((model) => !hidden.has(model.file)), ...dressing.models], [{ name: "the start", at: stage.start }, ...spots(dressing.people)], ` dressed for ${dressing.offer}`);
  }
  for (const file of missing) problems.push(`R-ASSET-030: ${place} places ${file}, which carries no footprint`);
  return problems;
}
