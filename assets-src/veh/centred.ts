// Shapes placed by their centre, as the vehicles and the stall are drawn: a box centred on its position and turned
// about z, a wheel on an axle along z, and a cylinder along an axis. The kit's shapes sit on their base and turn only
// about y, so each shape here is a kit shape in a small frame.
import { box, cylinder, extrude, paletteMaterial } from "@japacity/assets/kit";
import type { PaletteName } from "@japacity/assets";
import { Group, IcosahedronGeometry, Mesh, type Object3D } from "three";

function frame(g: Object3D, x: number, y: number, z: number): Group {
  const f = new Group();
  f.position.set(x, y, z);
  g.add(f);
  return f;
}

/** A w by h by d box centred on (x, y, z), turned rz about z. */
export function cbox(g: Object3D, w: number, h: number, d: number, x: number, y: number, z: number, colour: PaletteName, rz = 0): void {
  const f = frame(g, x, y, z);
  f.rotation.z = rz;
  box(f, w, h, d, 0, -h / 2, 0, colour);
}

/** A cylinder of radius r and length `length` centred on (x, y, z), its axis along x, y or z. */
export function ccyl(g: Object3D, r: number, length: number, x: number, y: number, z: number, colour: PaletteName, axis: "x" | "y" | "z", segments = 8): void {
  const f = frame(g, x, y, z);
  if (axis === "z") f.rotation.x = Math.PI / 2;
  if (axis === "x") f.rotation.z = Math.PI / 2;
  cylinder(f, r, length, 0, -length / 2, 0, colour, segments);
}

/** A wheel: a tyre and its hub on an axle along z. */
export function wheel(g: Object3D, r: number, w: number, x: number, y: number, z: number): void {
  ccyl(g, r, w, x, y, z, "tyre", "z", 12);
  ccyl(g, r * 0.5, w + 0.02, x, y, z, "hub", "z", 8);
}

/** A side profile in x and y pushed `depth` along z, centred on z. */
export function profile(g: Object3D, points: readonly (readonly [number, number])[], depth: number, colour: PaletteName): void {
  extrude(g, points, depth, colour);
}

/** A rough low lump: a sack or a fruit. */
export function lump(g: Object3D, r: number, x: number, y: number, z: number, colour: PaletteName, scale: [number, number, number] = [1, 1, 1]): void {
  const mesh = new Mesh(new IcosahedronGeometry(r, 0), paletteMaterial(colour));
  mesh.scale.set(...scale);
  mesh.position.set(x, y, z);
  g.add(mesh);
}

/**
 * Wraps a model so it faces +z (assets:metre-units-and-origin), centred on its footprint with its lowest point on y = 0.
 * `fromX` turns a model built facing +x, as every vehicle is.
 */
export function facePlusZ(inner: Group, name: string, fromX = true): Group {
  const outer = new Group();
  outer.name = name;
  const turn = new Group();
  if (fromX) turn.rotation.y = -Math.PI / 2;
  turn.add(inner);
  outer.add(turn);
  outer.updateMatrixWorld(true);
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  outer.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox?.clone().applyMatrix4(mesh.matrixWorld);
    if (bb === undefined) return;
    minX = Math.min(minX, bb.min.x);
    minY = Math.min(minY, bb.min.y);
    minZ = Math.min(minZ, bb.min.z);
    maxX = Math.max(maxX, bb.max.x);
    maxZ = Math.max(maxZ, bb.max.z);
  });
  turn.position.set(-(minX + maxX) / 2, -minY, -(minZ + maxZ) / 2);
  return outer;
}
