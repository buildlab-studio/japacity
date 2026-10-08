// Ambient motion, all of it in the vertex shader: sheets bent
// from their pinned edge, water rolled with white crests, smoke and leaves as instanced meshes that
// shrink to nothing instead of fading, so nothing is transparent. Every one reads the shared clock
// and wind (clock.ts). The dial is mesh fineness: `fine` sheets and water in the high mode, `coarse`
// in the low mode; the motion itself is the same in both.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  type Material,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  type Object3D,
  PlaneGeometry,
  Vector3,
} from "three";

import { motionUniforms } from "./clock";
import { PUFF_INDEX, PUFF_POSITIONS } from "./puff.data";

export type SheetKind = "flag" | "hang" | "frond";
export type MotionShader = SheetKind | "water" | "smoke" | "leaf";
export type MeshLevel = "fine" | "coarse";

const HEAD = /* glsl */ `
uniform float uTime;
uniform vec2 uWind;
float gust(vec3 at) {
  return 0.62 + 0.30 * sin(uTime * 0.7 + at.x * 0.16 + at.z * 0.12) + 0.16 * sin(uTime * 1.9 + at.x * 0.45);
}
`;

// Each body runs after three's begin_vertex, so it moves `transformed` in the model's own frame.
const BODY: Record<MotionShader, string> = {
  // Pinned along uv.x = 0, as on a pole: a travelling wave that grows toward the free edge.
  flag: /* glsl */ `{
    vec3 at = (modelMatrix * vec4(position, 1.0)).xyz;
    float free = uv.x;
    float g = gust(at);
    float phase = at.x * 0.7 + at.z * 0.9;
    float wave = sin(uTime * 5.0 - uv.x * 7.0 + phase) * 0.20
      + sin(uTime * 8.3 - uv.x * 15.0 + uv.y * 4.0 + phase) * 0.06
      + sin(uTime * 2.1 - uv.x * 3.0) * 0.10;
    transformed.z += wave * free * g;
    transformed.y -= free * free * 0.30 * (1.0 - g);
    transformed.x -= free * abs(wave) * 0.25;
  }`,
  // Pinned along the top edge (uv.y = 1): washing, bunting, an awning's skirt.
  hang: /* glsl */ `{
    vec3 at = (modelMatrix * vec4(position, 1.0)).xyz;
    float free = 1.0 - uv.y;
    float g = gust(at);
    float wave = sin(uTime * 3.1 + at.x * 2.3 + uv.y * 3.0) * 0.09 + sin(uTime * 6.3 + at.x * 5.1 - uv.y * 6.0) * 0.035;
    transformed.z += (wave + 0.16 * g) * free;
    transformed.y += free * free * 0.05 * g;
  }`,
  // A palm frond pinned at its stalk (uv.x = 0), heavier toward the tip.
  frond: /* glsl */ `{
    vec3 at = (modelMatrix * vec4(position, 1.0)).xyz;
    float free = uv.x * uv.x;
    float g = gust(at);
    float phase = at.x * 1.3 + at.z * 1.7 + at.y;
    transformed.y += sin(uTime * 2.2 + phase + uv.x * 2.5) * 0.16 * free * g;
    transformed.z += sin(uTime * 1.6 + phase) * 0.20 * free * g;
    transformed.y += sin(uTime * 7.0 + phase * 3.0 + uv.x * 9.0) * 0.04 * free;
  }`,
  // Three waves rolling across a flat grid; the crest height is passed on to whiten the tops.
  water: /* glsl */ `{
    vec2 p = position.xz;
    float h = 0.0;
    vec2 d = normalize(vec2(1.0, 0.3));
    float f = dot(d, p) * 0.8 + uTime * 1.3;
    h += sin(f) * 0.075;
    transformed.xz -= d * cos(f) * 0.06;
    d = normalize(vec2(0.4, 1.0));
    f = dot(d, p) * 1.5 + uTime * 1.7;
    h += sin(f) * 0.045;
    transformed.xz -= d * cos(f) * 0.03;
    d = normalize(vec2(-0.7, 0.6));
    f = dot(d, p) * 2.9 + uTime * 2.6;
    h += sin(f) * 0.02;
    transformed.y += h;
    vCrest = h;
  }`,
  // One puff of many: it rises, drifts downwind and swells into the puffs above it, turning as it
  // goes so its facets never sit still, then shrinks to nothing and starts again at the fire.
  smoke: /* glsl */ `{
    float life = fract(uTime * 0.11 + aSeed);
    float g = gust(vec3(0.0));
    float size = mix(0.3, 1.25, sqrt(life)) * (1.0 - smoothstep(0.75, 1.0, life)) * (0.7 + fract(aSeed * 17.0) * 0.6);
    float spin = uTime * (0.3 + fract(aSeed * 11.0) * 0.4) + aSeed * 20.0;
    transformed.xz = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * transformed.xz;
    transformed *= vec3(size, size * 0.8, size);
    transformed += vec3(
      uWind.x * life * life * 3.4 * g + sin(aSeed * 40.0 + uTime * 0.6) * 0.55 * life,
      life * 3.6,
      uWind.y * life * life * 3.4 * g + cos(aSeed * 23.0 + uTime * 0.5) * 0.45 * life);
  }`,
  // A leaf or a scrap of paper tumbling downwind along the ground, across a strip `aSpan` long.
  leaf: /* glsl */ `{
    float speed = 1.6 + fract(aSeed * 7.0) * 1.6;
    float x = mod(aSeed * 53.0 + uTime * speed * gust(vec3(0.0)), aSpan) - aSpan * 0.5;
    float turn = uTime * (4.0 + aSeed * 5.0) + aSeed * 30.0;
    float c = cos(turn);
    float s = sin(turn);
    transformed.xy = mat2(c, -s, s, c) * transformed.xy;
    transformed += vec3(x, 0.06 + abs(sin(uTime * 2.6 + aSeed * 20.0)) * 0.28, (fract(aSeed * 13.0) - 0.5) * aDepth);
  }`,
};

// A puff's normals turn with the puff, as BODY.smoke turns it, so the lit side stays toward the sun.
const SMOKE_NORMAL = /* glsl */ `{
    float spin = uTime * (0.3 + fract(aSeed * 11.0) * 0.4) + aSeed * 20.0;
    objectNormal.xz = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * objectNormal.xz;
  }`;

const CREST = /* glsl */ `
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.90, 0.96, 0.93), smoothstep(0.085, 0.13, vCrest));
`;

/** A flat-shaded material whose vertices move by the shared clock. */
export function motionMaterial(kind: MotionShader, color: Color | number = 0xffffff, vertexColors = false): MeshLambertMaterial {
  const material = new MeshLambertMaterial({ color, flatShading: true, side: DoubleSide, vertexColors });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, motionUniforms);
    const attributes = kind === "smoke" ? "attribute float aSeed;\n" : kind === "leaf" ? "attribute float aSeed;\nattribute float aSpan;\nattribute float aDepth;\n" : "";
    const varying = kind === "water" ? "varying float vCrest;\n" : "";
    const turned = kind === "smoke" ? shader.vertexShader.replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>\n${SMOKE_NORMAL}`) : shader.vertexShader;
    shader.vertexShader = HEAD + attributes + varying + turned.replace("#include <begin_vertex>", `#include <begin_vertex>\n${BODY[kind]}`);
    if (kind === "water") shader.fragmentShader = varying + shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>\n${CREST}`);
  };
  material.customProgramCacheKey = () => `motion-${kind}`;
  return material;
}

/** Segments across and down a sheet, by mesh level. */
const SHEET_SEGMENTS: Record<SheetKind, Record<MeshLevel, [number, number]>> = {
  flag: { fine: [22, 10], coarse: [10, 5] },
  hang: { fine: [6, 8], coarse: [3, 4] },
  frond: { fine: [12, 2], coarse: [6, 2] },
};

/** A sheet of `width` by `height`, its pinned edge at the origin: the left edge for a flag or frond, the top for a hang. */
export function sheetGeometry(kind: SheetKind, width: number, height: number, level: MeshLevel): BufferGeometry {
  const [across, down] = SHEET_SEGMENTS[kind][level];
  const geometry = new PlaneGeometry(width, height, across, down);
  return kind === "hang" ? geometry.translate(0, -height / 2, 0) : geometry.translate(width / 2, 0, 0);
}

/**
 * A palm frond `length` long and `width` across, pinned at its stalk: it lies nearly flat, arches up
 * from the crown and droops toward its tip, widest a third of the way out and folded down from its
 * spine like the two rows of leaflets, so from below and from the side it reads as a feather.
 */
export function frondGeometry(length: number, width: number, level: MeshLevel): BufferGeometry {
  const geometry = sheetGeometry("frond", length, width, level);
  const position = geometry.getAttribute("position");
  for (let at = 0; at < position.count; at += 1) {
    const along = position.getX(at) / length;
    const across = position.getY(at) / (width / 2);
    const spread = Math.sin(Math.PI * Math.min(1, along * 1.35)) * (along < 0.08 ? along / 0.08 : 1);
    const arch = (along * 0.42 - along * along * 0.95) * length;
    position.setY(at, arch - Math.abs(across) * spread * width * 0.32);
    position.setZ(at, across * spread * (width / 2));
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Copies of one sheet as one draw call, each at its own matrix and in its own colour. */
export function instancedSheets(kind: SheetKind, geometry: BufferGeometry, matrices: readonly Matrix4[], colours: readonly Color[]): InstancedMesh {
  const mesh = new InstancedMesh(geometry, motionMaterial(kind), matrices.length);
  matrices.forEach((matrix, index) => {
    mesh.setMatrixAt(index, matrix);
    const colour = colours[index % Math.max(1, colours.length)];
    if (colour !== undefined) mesh.setColorAt(index, colour);
  });
  mesh.frustumCulled = false;
  mesh.name = `motion-${kind}`;
  return mesh;
}

/** Columns across a striped flag and rows a stripe, by mesh level: the hoist's quarter and every stripe end on a grid line. */
const FLAG_GRID: Record<MeshLevel, [number, number]> = { fine: [24, 4], coarse: [12, 2] };

/**
 * A flag of stripes from the top down, with a band of `hoist` along its pinned edge when given, as one
 * sheet coloured by face, so the whole cloth bends as one and no stripe tears from the next.
 */
export function stripedFlag(width: number, height: number, level: MeshLevel, stripes: readonly Color[], hoist: Color | null): Mesh {
  const [across, perStripe] = FLAG_GRID[level];
  const rows = Math.max(1, stripes.length) * perStripe;
  const geometry = new PlaneGeometry(width, height, across, rows).translate(width / 2, 0, 0).toNonIndexed();
  const position = geometry.getAttribute("position");
  const colours = new Float32Array(position.count * 3);
  for (let face = 0; face < position.count; face += 3) {
    const x = (position.getX(face) + position.getX(face + 1) + position.getX(face + 2)) / 3;
    const y = (position.getY(face) + position.getY(face + 1) + position.getY(face + 2)) / 3;
    const stripe = Math.min(stripes.length - 1, Math.max(0, Math.floor(((height / 2 - y) / height) * stripes.length)));
    const colour = hoist !== null && x < width / 4 ? hoist : (stripes[stripe] ?? new Color(0xffffff));
    for (let corner = 0; corner < 3; corner += 1) colour.toArray(colours, (face + corner) * 3);
  }
  geometry.setAttribute("color", new BufferAttribute(colours, 3));
  const mesh = new Mesh(geometry, motionMaterial("flag", 0xffffff, true));
  mesh.name = "motion-flag";
  return mesh;
}

const BOB = /* glsl */ `{
  #ifdef USE_INSTANCING
  vec2 home = instanceMatrix[3].xz;
  #else
  vec2 home = vec2(0.0);
  #endif
  float phase = home.x * 0.37 + home.y * 0.23;
  float roll = sin(uTime * 1.1 + phase) * 0.045;
  float pitch = sin(uTime * 0.8 + phase * 1.7) * 0.025;
  transformed.xy = mat2(cos(roll), sin(roll), -sin(roll), cos(roll)) * transformed.xy;
  transformed.yz = mat2(cos(pitch), sin(pitch), -sin(pitch), cos(pitch)) * transformed.yz;
  transformed.y += sin(uTime * 1.4 + phase) * 0.05 - 0.04;
}`;

/**
 * A boat's materials made to ride the water: each copy rolls, pitches and rises in the vertex
 * shader on the shared clock, phased by where it is moored, so no boat has a loop of its own.
 */
export function rideWater(root: Object3D): void {
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const riding = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((material) => {
      const copy = material.clone();
      copy.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, motionUniforms);
        shader.vertexShader = HEAD + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\n${BOB}`);
      };
      copy.customProgramCacheKey = () => `motion-bob-${material.uuid}`;
      return copy;
    });
    mesh.material = riding.length === 1 && riding[0] !== undefined ? riding[0] : riding;
  });
}

export function sheet(kind: SheetKind, width: number, height: number, level: MeshLevel, color: Color): Mesh {
  const mesh = new Mesh(sheetGeometry(kind, width, height, level), motionMaterial(kind, color));
  mesh.name = `motion-${kind}`;
  return mesh;
}

/** Water: a grid of `width` by `depth` at y = 0, finer in the high mode. */
export function water(width: number, depth: number, level: MeshLevel, color: Color): Mesh {
  const per = level === "fine" ? 0.75 : 2;
  const geometry = new PlaneGeometry(width, depth, Math.max(1, Math.round(width / per)), Math.max(1, Math.round(depth / per))).rotateX(-Math.PI / 2);
  const mesh = new Mesh(geometry, motionMaterial("water", color));
  mesh.name = "motion-water";
  return mesh;
}

function seeded(geometry: BufferGeometry, count: number): BufferGeometry {
  const copy = geometry.clone();
  const seeds = new Float32Array(count);
  for (let at = 0; at < count; at += 1) seeds[at] = (at + 0.37) / count;
  copy.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
  return copy;
}

/** One instanced mesh: the shader moves each copy from its seed, so the matrices stay at rest. */
function instanced(geometry: BufferGeometry, material: Material, count: number, name: string): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, count);
  const rest = new Matrix4();
  for (let at = 0; at < count; at += 1) mesh.setMatrixAt(at, rest);
  // The shader moves every copy away from the mesh's own bounds.
  mesh.frustumCulled = false;
  mesh.name = name;
  return mesh;
}

/** The blended puff of assets-src/prop/smoke, its vertices shared so the normals run smooth across it. */
export function puffGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([...PUFF_POSITIONS], 3));
  geometry.setIndex([...PUFF_INDEX]);
  geometry.computeVertexNormals();
  return geometry;
}

/** Smoke as soft pale puffs: a blended shape shown smooth (R-ASSET-005), each copy in one of `colours` in turn. */
export function smoke(count: number, colours: readonly Color[]): InstancedMesh {
  const material = motionMaterial("smoke");
  // A soft shape is the one moving surface shown smooth; a little glow keeps its shaded side pale like smoke.
  material.flatShading = false;
  material.emissive = new Color(0xffffff).multiplyScalar(0.22);
  const mesh = instanced(seeded(puffGeometry(), count), material, count, "motion-smoke");
  for (let at = 0; at < count; at += 1) {
    const colour = colours[at % Math.max(1, colours.length)];
    if (colour !== undefined) mesh.setColorAt(at, colour);
  }
  return mesh;
}

/** Leaves tumbling downwind across a strip `span` long and `depth` deep, centred where the mesh stands. */
export function leaves(count: number, span: number, depth: number, color: Color): InstancedMesh {
  const geometry = seeded(new PlaneGeometry(0.11, 0.07), count);
  geometry.setAttribute("aSpan", new InstancedBufferAttribute(new Float32Array(count).fill(span), 1));
  geometry.setAttribute("aDepth", new InstancedBufferAttribute(new Float32Array(count).fill(depth), 1));
  return instanced(geometry, motionMaterial("leaf", color), count, "motion-leaves");
}

/** Pennants on a line from `from` to `to`, sagging in the middle, each pinned along its top. */
export function bunting(from: Vector3, to: Vector3, count: number, colours: readonly Color[]): InstancedMesh {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([-0.16, 0, 0, 0.16, 0, 0, 0, -0.36, 0], 3));
  geometry.setAttribute("uv", new Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2));
  geometry.computeVertexNormals();
  const mesh = new InstancedMesh(geometry, motionMaterial("hang"), count);
  const place = new Matrix4();
  const turn = new Matrix4().makeRotationY(Math.atan2(-(to.z - from.z), to.x - from.x));
  const at = new Vector3();
  for (let index = 0; index < count; index += 1) {
    const along = count === 1 ? 0.5 : index / (count - 1);
    at.lerpVectors(from, to, along);
    at.y -= Math.sin(along * Math.PI) * 0.55;
    mesh.setMatrixAt(index, place.makeTranslation(at.x, at.y, at.z).multiply(turn));
    const colour = colours[index % Math.max(1, colours.length)];
    if (colour !== undefined) mesh.setColorAt(index, colour);
  }
  mesh.frustumCulled = false;
  mesh.name = "motion-bunting";
  return mesh;
}

/** Texture coordinates from a geometry's bounds, for a part of a model named to move but shipped without them. */
function boundsUv(geometry: BufferGeometry): void {
  if (geometry.getAttribute("uv") !== undefined) return;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const position = geometry.getAttribute("position");
  if (box === null) return;
  const width = Math.max(box.max.x - box.min.x, 1e-6);
  const height = Math.max(box.max.y - box.min.y, 1e-6);
  const uv = new Float32Array(position.count * 2);
  for (let at = 0; at < position.count; at += 1) {
    uv[at * 2] = (position.getX(at) - box.min.x) / width;
    uv[at * 2 + 1] = (position.getY(at) - box.min.y) / height;
  }
  geometry.setAttribute("uv", new BufferAttribute(uv, 2));
}

const SHEETS = new Set<string>(["flag", "hang", "frond", "water"]);

/**
 * Sets the motion material on every part of a model whose node extras name a motion
 * (`"motion": "flag" | "hang" | "frond" | "water"`), keeping its colours. Returns how many moved.
 */
export function applyNodeMotion(root: Object3D): number {
  let moved = 0;
  root.traverse((object) => {
    const kind = (object.userData as { motion?: unknown }).motion;
    if (typeof kind !== "string" || !SHEETS.has(kind)) return;
    object.traverse((part) => {
      const mesh = part as Mesh;
      if (!mesh.isMesh) return;
      boundsUv(mesh.geometry);
      const vertexColors = mesh.geometry.getAttribute("color") !== undefined;
      mesh.material = motionMaterial(kind as MotionShader, 0xffffff, vertexColors);
      moved += 1;
    });
  });
  return moved;
}
