// The few shapes every builder is made of: boxes, cylinders, quads, extrusions and
// hand-made solids, each in one palette colour (R-ASSET-001). Every shape sits on
// its base at the y it is given, so builders stack parts by height. Flat shading
// everywhere (R-ASSET-005); the export bakes all of them into one mesh.
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  Quaternion,
  Shape,
  Vector2,
  Vector3,
} from "three";

import { palette, type PaletteName } from "../palette";

export type Vec3 = [number, number, number];

const materials = new Map<PaletteName, MeshStandardMaterial>();

/** The one material for a palette colour. The bake reads `userData.palette`, never the colour value. */
export function paletteMaterial(name: PaletteName): MeshStandardMaterial {
  let material = materials.get(name);
  if (material === undefined) {
    material = new MeshStandardMaterial({ color: palette[name], flatShading: true, roughness: 0.9, metalness: 0 });
    material.name = name;
    material.userData = { palette: name };
    materials.set(name, material);
  }
  return material;
}

function place(g: Object3D, geometry: BufferGeometry, colour: PaletteName, x: number, y: number, z: number, ry = 0): Mesh {
  const mesh = new Mesh(geometry, paletteMaterial(colour));
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  g.add(mesh);
  return mesh;
}

/** A box of w by h by d with its base at y, centred on x and z, turned ry about its own vertical axis. */
export function box(g: Object3D, w: number, h: number, d: number, x: number, y: number, z: number, colour: PaletteName, ry = 0): Mesh {
  const geometry = new BoxGeometry(w, h, d);
  geometry.translate(0, h / 2, 0);
  return place(g, geometry, colour, x, y, z, ry);
}

/** A box between two points: a beam, a rail, a wire. Its cross-section is w by w. */
export function beam(g: Object3D, from: Vec3, to: Vec3, w: number, colour: PaletteName): Mesh {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dy, dz);
  const geometry = new BoxGeometry(w, length, w);
  const mesh = place(g, geometry, colour, (from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2);
  // Point the box's long axis (y) along the segment.
  if (length > 0) mesh.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(dx, dy, dz).normalize()));
  return mesh;
}

/** A cylinder of radius r and height h on its base at y; rTop makes a cone or a tapered post. */
export function cylinder(
  g: Object3D,
  r: number,
  h: number,
  x: number,
  y: number,
  z: number,
  colour: PaletteName,
  segments = 8,
  rTop = r,
  openEnded = false,
): Mesh {
  const geometry = new CylinderGeometry(rTop, r, h, segments, 1, openEnded);
  geometry.translate(0, h / 2, 0);
  return place(g, geometry, colour, x, y, z);
}

/**
 * A flat rectangle of w by h facing +z in its own frame, bottom edge at y, centred on x and z,
 * turned ry. For things painted or fixed flat on a wall: glass, stains, posters, door leaves.
 */
export function quad(g: Object3D, w: number, h: number, x: number, y: number, z: number, colour: PaletteName, ry = 0): Mesh {
  const geometry = new PlaneGeometry(w, h);
  geometry.translate(0, h / 2, 0);
  return place(g, geometry, colour, x, y, z, ry);
}

/** A flat rectangle lying face up at height y. */
export function floorQuad(g: Object3D, w: number, d: number, x: number, y: number, z: number, colour: PaletteName, ry = 0): Mesh {
  const geometry = new PlaneGeometry(w, d);
  geometry.rotateX(-Math.PI / 2);
  return place(g, geometry, colour, x, y, z, ry);
}

/**
 * A profile in the x-y plane of its own frame pushed `depth` along z, centred on z.
 * The profile is given in metres; the result is placed at x, y, z and turned ry.
 */
export function extrude(
  g: Object3D,
  points: readonly (readonly [number, number])[],
  depth: number,
  colour: PaletteName,
  x = 0,
  y = 0,
  z = 0,
  ry = 0,
): Mesh {
  const shape = new Shape(points.map(([a, b]) => new Vector2(a, b)));
  const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
  geometry.translate(0, 0, -depth / 2);
  return place(g, geometry, colour, x, y, z, ry);
}

/**
 * A solid from its corners and its faces, each face a list of corner indices wound
 * anticlockwise seen from outside. Faces with more than three corners are fanned.
 */
export function solid(g: Object3D, corners: readonly Vec3[], faces: readonly (readonly number[])[], colour: PaletteName): Mesh {
  const positions: number[] = [];
  for (const face of faces) {
    for (let i = 1; i < face.length - 1; i++) {
      for (const index of [face[0], face[i], face[i + 1]]) {
        const corner = corners[index ?? 0];
        if (corner === undefined) throw new Error(`solid: no corner ${String(index)}`);
        positions.push(corner[0], corner[1], corner[2]);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return place(g, geometry, colour, 0, 0, 0);
}

/** A named group: the export writes each named part as its own node, so a view can leave it out. */
export function part(g: Object3D, name: string): Group {
  const child = new Group();
  child.name = name;
  child.userData = { node: name };
  g.add(child);
  return child;
}

export { seeded } from "../seeded";

/** Picks one of a list with a seeded generator. */
export function pick<T>(random: () => number, items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error("pick: empty list");
  return item;
}
