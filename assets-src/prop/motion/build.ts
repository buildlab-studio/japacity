// The moving sheets and the water tile, built flat at both mesh levels (assets.md R-ASSET-029). A
// sheet stands in its own x-y plane facing +Z with its lowest point on y = 0 (R-ASSET-003): a flag and
// a frond 1 by 1 with the pinned edge at x = 0, a hang 1 by 1 centred on x with the pinned edge along
// the top, a pennant a triangle 1 wide and 1 deep pinned along its top. The water tile lies on y = 0,
// WATER_TILE metres a side. The client scales a sheet to its size and bends it in the vertex shader;
// the vertex colour is never shown, the place's palette colours are.
import { paletteMaterial } from "@japacity/assets/kit";
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, PlaneGeometry } from "three";

import { GRIDS, type GridPiece, type MeshLevel, WATER_TILE } from "./grids";

/** A triangle with its top edge from (-0.5, 1) to (0.5, 1) and its point at (0, 0), cut into `rows` rows of smaller triangles. */
function pennant(rows: number): BufferGeometry {
  const positions: number[] = [];
  const point = (row: number, along: number): [number, number] => {
    // Row 0 is the point; row `rows` is the top edge, `row + 1` points wide.
    const width = row / rows;
    return [row === 0 ? 0 : -width / 2 + (along * width) / row, row / rows];
  };
  const push = (...corners: [number, number][]): void => {
    for (const [x, y] of corners) positions.push(x, y, 0);
  };
  for (let row = 0; row < rows; row += 1) {
    for (let along = 0; along <= row; along += 1) {
      push(point(row, along), point(row + 1, along + 1), point(row + 1, along));
      if (along < row) push(point(row, along), point(row, along + 1), point(row + 1, along + 1));
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return geometry;
}

function geometryOf(piece: GridPiece, level: MeshLevel): BufferGeometry {
  const [across, down] = GRIDS[piece].segments[level];
  switch (piece) {
    case "sheet-flag":
    case "sheet-frond":
      return new PlaneGeometry(1, 1, across, down).translate(0.5, 0.5, 0);
    case "sheet-hang":
      return new PlaneGeometry(1, 1, across, down).translate(0, 0.5, 0);
    case "sheet-pennant":
      return pennant(down);
    case "water":
      return new PlaneGeometry(WATER_TILE, WATER_TILE, across, down).rotateX(-Math.PI / 2);
    default: {
      const never: never = piece;
      throw new Error(`Unknown grid: ${String(never)}`);
    }
  }
}

/** One piece at one level, as a group the bake reads: one mesh in the palette's white. */
export function buildGrid(piece: GridPiece, level: MeshLevel): Group {
  const group = new Group();
  group.name = `prop_${piece}_${level}`;
  group.add(new Mesh(geometryOf(piece, level), paletteMaterial("white")));
  return group;
}
