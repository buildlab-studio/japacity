// The city as the map, drawn (docs/rules/world.md R-WORLD-015): one scene, instanced. The ground,
// the water, the plots and the roads are one draw call each; the buildings one for each roof colour;
// the trees, the stop poles, the ring and the route's dots one each; the painted boards and the
// district names share one texture and one draw call. Nothing else is a picture.
import { palette } from "@japacity/assets";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type Object3D,
  Object3D as Holder,
  PlaneGeometry,
  RingGeometry,
  Scene,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import type { PinState } from "../../shared/world/contract";
import { BOUNDS, buildGrid, buildPlots, NAME_HALF, type District, type Grid, pointAlong, ROOF_GROUPS, type RoofGroup, routeLength, toXZ, WATER, type XZ } from "./layout";
import type { MapPin } from "./pins";

/** The map's colours: the interface's map roles for the ground, and the state colours for the stops. */
export interface MapColours {
  land: string;
  land2: string;
  water: string;
  road: string;
  label: string;
  signal: string;
  inGreen: string;
  muted: string;
  strong: string;
  onStrong: string;
  text: string;
  text2: string;
}

/** The roles the map reads, by its name for each. */
const ROLES: Record<keyof MapColours, string> = {
  land: "--land",
  land2: "--land-2",
  water: "--water",
  road: "--road",
  label: "--map-label",
  signal: "--signal",
  inGreen: "--in",
  muted: "--sheet-muted",
  strong: "--strong",
  onStrong: "--on-strong",
  text: "--text",
  text2: "--text-2",
};

/** Where a role is not set (a test page), the 3D world's own palette stands in. */
const FALLBACK: MapColours = {
  land: "#ece5d5",
  land2: "#e1d8c4",
  water: "#2c3f87",
  road: "#fbf9f4",
  label: "#5d564a",
  signal: "#f2b705",
  inGreen: "#2a8656",
  muted: "#e8e2d4",
  strong: "#1c2a5e",
  onStrong: "#f3efe6",
  text: "#131a33",
  text2: "#5a6078",
};

/** The map's colours from the theme's role tokens. */
export function readColours(root: Element | null = typeof document === "undefined" ? null : document.documentElement): MapColours {
  const style = root === null ? null : getComputedStyle(root);
  const colours = { ...FALLBACK };
  for (const key of Object.keys(ROLES) as (keyof MapColours)[]) {
    const value = style?.getPropertyValue(ROLES[key]).trim() ?? "";
    if (/^#[0-9a-f]{3,8}$/i.test(value) || /^rgb/i.test(value)) colours[key] = value;
  }
  return colours;
}

/** The roofs seen from above, from the 3D world's palette. */
const ROOF_COLOURS: Record<RoofGroup, number> = { rust: palette.zincRust, zinc: palette.zinc, tile: palette.roofRed, slab: palette.wallCream };

/** Heights of the flat layers, far enough apart that no two faces share one (R-WORLD-012). */
const LAYER = { water: 0.03, plot: 0.07, road: 0.12, name: 0.16, ring: 0.2, bridge: 0.45, dot: 0.55 } as const;

const POLE_HEIGHT = 3.2;
const BOARD = { width: 11, height: 3.1 } as const;
const NAME_SIZE = { width: NAME_HALF[0] * 2 + 2, height: NAME_HALF[1] * 2 } as const;
/** The boards lean back toward the raised camera so their words read from above. */
const BOARD_LEAN = -0.7;
export const DOT_SPACING = 1.5;
const DOT_SPEED = 7;
const MAX_DOTS = 240;

export type Glyph = "bus" | "market" | "stadium" | "bridge" | "plane" | "house";

/** The small glyph on a stop's board, by what the place is. */
export function glyphOf(id: string, home: boolean): Glyph {
  if (home) return "house";
  if (/market|village/.test(id)) return "market";
  if (/stadium/.test(id)) return "stadium";
  if (/bridge/.test(id)) return "bridge";
  if (/airport/.test(id)) return "plane";
  return "bus";
}

/** A stop as drawn: its pin, where it stands, the middle of its board for picking, and the board's foot. */
export interface Stop {
  pin: MapPin;
  at: XZ;
  board: Vector3;
  foot: number;
  home: boolean;
}

export interface CityMap {
  scene: Scene;
  grid: Grid;
  stops: Stop[];
  /** Lights the route along the roads, or puts it out. */
  setRoute: (route: readonly XZ[] | null) => void;
  /** Moves the ring and the route's dots on: the seconds since the map opened. */
  tick: (seconds: number) => void;
  /** Grows or shrinks the boards about their feet, so their words stay readable as the camera moves. */
  setBoardScale: (scale: number) => void;
  dispose: () => void;
}

/** The words painted on the boards and the ground. */
export interface Painting {
  boards: { text: string; state: PinState | "homeboard"; glyph: Glyph }[];
  names: string[];
}

interface Atlas {
  texture: CanvasTexture | null;
  /** u0, v0, u1, v1 for each board, then each name. */
  boards: [number, number, number, number][];
  names: [number, number, number, number][];
}

const ATLAS = { size: 1024, board: [256, 72], name: [512, 96] } as const;

function stateColours(state: PinState | "homeboard", colours: MapColours): { back: string; ink: string } {
  switch (state) {
    case "here":
    case "been":
      return { back: colours.signal, ink: colours.text };
    case "can":
      return { back: colours.inGreen, ink: colours.onStrong };
    case "not":
      return { back: colours.muted, ink: colours.text2 };
    case "home":
    case "homeboard":
      return { back: colours.strong, ink: colours.onStrong };
    default: {
      const never: never = state;
      throw new Error(`Unknown pin state: ${String(never)}`);
    }
  }
}

function drawGlyph(context: CanvasRenderingContext2D, glyph: Glyph, x: number, y: number, size: number, ink: string): void {
  context.save();
  context.translate(x, y);
  context.scale(size / 40, size / 40);
  context.fillStyle = ink;
  context.strokeStyle = ink;
  context.lineWidth = 4;
  context.lineJoin = "round";
  context.beginPath();
  switch (glyph) {
    case "bus":
      context.roundRect(4, 6, 32, 24, 5);
      context.fill();
      context.clearRect(9, 11, 22, 8);
      context.beginPath();
      context.arc(12, 32, 4, 0, Math.PI * 2);
      context.arc(28, 32, 4, 0, Math.PI * 2);
      context.fill();
      break;
    case "market":
      context.moveTo(4, 16);
      context.lineTo(10, 6);
      context.lineTo(30, 6);
      context.lineTo(36, 16);
      context.closePath();
      context.fill();
      context.fillRect(8, 18, 24, 16);
      break;
    case "stadium":
      context.ellipse(20, 20, 16, 11, 0, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.ellipse(20, 20, 7, 4, 0, 0, Math.PI * 2);
      context.fill();
      break;
    case "bridge":
      context.moveTo(2, 14);
      context.lineTo(38, 14);
      context.stroke();
      context.beginPath();
      context.arc(20, 38, 18, Math.PI, Math.PI * 2);
      context.stroke();
      break;
    case "plane":
      context.moveTo(20, 2);
      context.lineTo(24, 14);
      context.lineTo(38, 22);
      context.lineTo(24, 22);
      context.lineTo(23, 32);
      context.lineTo(29, 37);
      context.lineTo(11, 37);
      context.lineTo(17, 32);
      context.lineTo(16, 22);
      context.lineTo(2, 22);
      context.lineTo(16, 14);
      context.closePath();
      context.fill();
      break;
    case "house":
      context.moveTo(20, 3);
      context.lineTo(37, 18);
      context.lineTo(32, 18);
      context.lineTo(32, 36);
      context.lineTo(8, 36);
      context.lineTo(8, 18);
      context.lineTo(3, 18);
      context.closePath();
      context.fill();
      break;
    default: {
      const never: never = glyph;
      throw new Error(`Unknown glyph: ${String(never)}`);
    }
  }
  context.restore();
}

/** Paints every board and every district name into one texture, so they draw as one. */
function paintAtlas(painting: Painting, colours: MapColours, canvas: HTMLCanvasElement | null): Atlas {
  const { size } = ATLAS;
  const [bw, bh] = ATLAS.board;
  const [nw, nh] = ATLAS.name;
  const perRow = Math.floor(size / bw);
  const boardRows = Math.ceil(painting.boards.length / perRow);
  const namesTop = boardRows * bh;
  const namesPerRow = Math.floor(size / nw);
  const uv = (x: number, y: number, w: number, h: number): [number, number, number, number] => [x / size, 1 - (y + h) / size, (x + w) / size, 1 - y / size];
  const boards = painting.boards.map((_, index) => uv((index % perRow) * bw, Math.floor(index / perRow) * bh, bw, bh));
  const names = painting.names.map((_, index) => uv((index % namesPerRow) * nw, namesTop + Math.floor(index / namesPerRow) * nh, nw, nh));
  const context = canvas?.getContext("2d") ?? null;
  if (canvas === null || context === null) return { texture: null, boards, names };
  canvas.width = size;
  canvas.height = size;
  context.clearRect(0, 0, size, size);
  painting.boards.forEach((board, index) => {
    const x = (index % perRow) * bw;
    const y = Math.floor(index / perRow) * bh;
    const { back, ink } = stateColours(board.state, colours);
    context.fillStyle = back;
    context.beginPath();
    context.roundRect(x + 2, y + 2, bw - 4, bh - 4, 10);
    context.fill();
    context.strokeStyle = colours.text;
    context.globalAlpha = 0.25;
    context.lineWidth = 3;
    context.stroke();
    context.globalAlpha = 1;
    drawGlyph(context, board.glyph, x + 12, y + (bh - 40) / 2, 40, ink);
    context.fillStyle = ink;
    let font = 30;
    context.font = `800 ${String(font)}px system-ui, sans-serif`;
    const room = bw - 70;
    while (context.measureText(board.text).width > room && font > 15) {
      font -= 1;
      context.font = `800 ${String(font)}px system-ui, sans-serif`;
    }
    context.textBaseline = "middle";
    context.fillText(board.text, x + 60, y + bh / 2 + 1, room);
  });
  painting.names.forEach((name, index) => {
    const x = (index % namesPerRow) * nw;
    const y = namesTop + Math.floor(index / namesPerRow) * nh;
    context.fillStyle = colours.label;
    context.globalAlpha = 0.7;
    context.font = "800 46px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    const spaced = name.toUpperCase().split("").join(String.fromCharCode(8202));
    context.fillText(spaced, x + nw / 2, y + nh / 2, nw - 16);
    context.textAlign = "start";
    context.globalAlpha = 1;
  });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, boards, names };
}

/** One quad as positions and uvs, from its four corners in order round the face. */
function quad(corners: readonly Vector3[], [u0, v0, u1, v1]: readonly [number, number, number, number]): { positions: number[]; uvs: number[] } {
  const [a, b, c, d] = corners;
  if (a === undefined || b === undefined || c === undefined || d === undefined) return { positions: [], uvs: [] };
  return {
    positions: [a, b, c, a, c, d].flatMap((point) => [point.x, point.y, point.z]),
    uvs: [u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1],
  };
}

const LEAN = new Matrix4().makeRotationX(BOARD_LEAN);

/** A board's four corners at a scale, standing on its pole's top. */
function boardCorners(stop: Stop, scale: number): Vector3[] {
  const halfW = (BOARD.width * scale) / 2;
  const height = BOARD.height * scale;
  const foot = new Vector3(stop.board.x, stop.foot, stop.board.z);
  return [new Vector3(-halfW, 0, 0), new Vector3(halfW, 0, 0), new Vector3(halfW, height, 0), new Vector3(-halfW, height, 0)].map((corner) => corner.applyMatrix4(LEAN).add(foot));
}

function paintedGeometry(stops: readonly Stop[], districts: readonly District[], atlas: Atlas): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  stops.forEach((stop, index) => {
    const at = atlas.boards[index];
    if (at === undefined) return;
    const made = quad(boardCorners(stop, 1), at);
    positions.push(...made.positions);
    uvs.push(...made.uvs);
  });
  districts.forEach((district, index) => {
    const at = atlas.names[index];
    if (at === undefined) return;
    const [x, z] = district.at;
    const w = NAME_SIZE.width / 2;
    const h = NAME_SIZE.height / 2;
    const corners = [new Vector3(x - w, LAYER.name, z + h), new Vector3(x + w, LAYER.name, z + h), new Vector3(x + w, LAYER.name, z - h), new Vector3(x - w, LAYER.name, z - h)];
    const made = quad(corners, at);
    positions.push(...made.positions);
    uvs.push(...made.uvs);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geometry.computeBoundingSphere();
  return geometry;
}

/** A unit box standing on the ground with no bottom face, which is never seen: ten triangles. */
function openBox(): BufferGeometry {
  const box = new BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  const index = box.getIndex();
  if (index === null) return box;
  // The faces come in the order +x, -x, +y, -y, +z, -z; the fourth is the bottom.
  const kept = box.groups.filter((_, face) => face !== 3).flatMap((group) => Array.from(index.array.slice(group.start, group.start + group.count)));
  box.setIndex(kept);
  box.clearGroups();
  return box;
}

/** A small house for home: walls and a roof in one geometry, coloured by its vertices. */
function houseGeometry(): BufferGeometry {
  const walls = new BoxGeometry(2.6, 1.8, 2.6).toNonIndexed();
  walls.translate(0, 0.9 + LAYER.plot, 0);
  const roof = new ConeGeometry(2.3, 1.5, 4).toNonIndexed();
  roof.rotateY(Math.PI / 4);
  roof.translate(0, 1.8 + 0.75 + LAYER.plot, 0);
  const paint = (geometry: BufferGeometry, hex: number): BufferGeometry => {
    const colour = new Color(hex);
    const count = geometry.getAttribute("position").count;
    const values = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) values.set([colour.r, colour.g, colour.b], index * 3);
    geometry.setAttribute("color", new BufferAttribute(values, 3));
    return geometry;
  };
  const merged = mergeGeometries([paint(walls, palette.wallCream), paint(roof, palette.roofRed)]);
  return merged ?? walls;
}

function waterGeometry(): ShapeGeometry {
  // The rings reach past the map's edge, so panning to the edge shows water, not a seam.
  const shapes = WATER.map((ring) => new Shape(ring.map(([x, z]) => new Vector2(x, -z))));
  const geometry = new ShapeGeometry(shapes);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, LAYER.water, 0);
  return geometry;
}

export interface BuildOptions {
  colours: MapColours;
  /** The home's id, so its stop is a house even when the player stands there. */
  home: string | null;
  districts: readonly District[];
  /** The words on each board and name. */
  boardText: (pin: MapPin, home: boolean) => string;
  districtText: (area: string) => string;
  /** A canvas to paint the boards on, or null where there is none (a test). */
  canvas: HTMLCanvasElement | null;
}

/** Builds the city as the map for the pins given. */
export function buildCityMap(pins: readonly MapPin[], options: BuildOptions): CityMap {
  const { colours } = options;
  const scene = new Scene();
  scene.background = new Color(colours.land);
  scene.fog = new Fog(colours.land, 420, 900);
  scene.add(new HemisphereLight(0xffffff, new Color(colours.land2), 1.9));
  const sun = new DirectionalLight(0xfff4e0, 1.4);
  sun.position.set(-60, 120, 40);
  scene.add(sun);
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(thing: T): T => {
    disposables.push(thing);
    return thing;
  };

  // Stops further from the camera come first, so a nearer board is painted over a further one.
  const stops: Stop[] = pins.map((pin) => {
    const at = toXZ(pin.position);
    const home = options.home === null ? pin.state === "home" : pin.id === options.home;
    const foot = POLE_HEIGHT + (home ? 1.4 : 0);
    return { pin, at, home, foot, board: new Vector3(at[0], foot + BOARD.height / 2, at[1]) };
  }).sort((a, b) => a.at[1] - b.at[1]);

  // The ground, a little wider than the map so the edge never shows.
  const margin = 80;
  const ground = new Mesh(keep(new PlaneGeometry(BOUNDS.east - BOUNDS.west + margin * 2, BOUNDS.south - BOUNDS.north + margin * 2)), keep(new MeshLambertMaterial({ color: colours.land })));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((BOUNDS.east + BOUNDS.west) / 2, 0, (BOUNDS.south + BOUNDS.north) / 2);
  ground.name = "ground";
  scene.add(ground);

  const water = new Mesh(keep(waterGeometry()), keep(new MeshLambertMaterial({ color: colours.water })));
  water.name = "water";
  scene.add(water);

  const holder = new Holder();
  const place = (x: number, y: number, z: number, sx: number, sy: number, sz: number): Matrix4 => {
    holder.position.set(x, y, z);
    holder.rotation.set(0, 0, 0);
    holder.scale.set(sx, sy, sz);
    holder.updateMatrix();
    return holder.matrix;
  };

  const { plots, buildings, trees } = buildPlots(
    stops.map((stop) => stop.at),
    3,
    options.districts.map((district) => ({ at: district.at, half: NAME_HALF })),
  );
  // A plot is only its top, two triangles; it is never seen from the side.
  const plotTop = keep(new PlaneGeometry(1, 1));
  plotTop.rotateX(-Math.PI / 2);
  const plotMesh = new InstancedMesh(plotTop, keep(new MeshLambertMaterial({ color: colours.land2 })), plots.length);
  plots.forEach(([x, z], index) => plotMesh.setMatrixAt(index, place(x, LAYER.plot, z, 4.1, 1, 4.1)));
  plotMesh.name = "plots";
  scene.add(plotMesh);

  const grid = buildGrid();
  const roadMesh = new InstancedMesh(keep(new BoxGeometry(1, 1, 1)), keep(new MeshLambertMaterial({ color: colours.road })), grid.roads.length);
  grid.roads.forEach((road, index) => {
    const [ax, az] = road.from;
    const [bx, bz] = road.to;
    const top = road.bridge ? LAYER.bridge : LAYER.road;
    const along = Math.abs(bx - ax) > 0;
    const length = Math.hypot(bx - ax, bz - az) + road.width;
    roadMesh.setMatrixAt(index, place((ax + bx) / 2, top / 2, (az + bz) / 2, along ? length : road.width, top, along ? road.width : length));
  });
  roadMesh.name = "roads";
  scene.add(roadMesh);

  // One instanced mesh for each roof colour.
  const box = keep(openBox());
  for (const group of ROOF_GROUPS) {
    const mine = buildings.filter((building) => building.group === group);
    const mesh = new InstancedMesh(box, keep(new MeshLambertMaterial({ color: ROOF_COLOURS[group] })), mine.length);
    mine.forEach((building, index) => mesh.setMatrixAt(index, place(building.x, LAYER.plot, building.z, building.width, building.height, building.depth)));
    mesh.name = `buildings-${group}`;
    scene.add(mesh);
  }

  const treeMesh = new InstancedMesh(keep(new IcosahedronGeometry(1, 0)), keep(new MeshLambertMaterial({ color: palette.green, flatShading: true })), trees.length);
  trees.forEach((tree, index) => treeMesh.setMatrixAt(index, place(tree.x, LAYER.plot + tree.size, tree.z, tree.size, tree.size * 1.1, tree.size)));
  treeMesh.name = "trees";
  scene.add(treeMesh);

  // The stops: a pole each, coloured by its state; the boards are painted.
  const poleGeometry = keep(new BoxGeometry(0.35, 1, 0.35));
  poleGeometry.translate(0, 0.5, 0);
  const poles = new InstancedMesh(poleGeometry, keep(new MeshLambertMaterial({ color: 0xffffff })), Math.max(1, stops.length));
  poles.count = stops.length;
  stops.forEach((stop, index) => {
    poles.setMatrixAt(index, place(stop.at[0], LAYER.plot, stop.at[1], 1, stop.foot - LAYER.plot, 1));
    poles.setColorAt(index, new Color(stateColours(stop.home ? "homeboard" : stop.pin.state, colours).back));
  });
  poles.name = "poles";
  scene.add(poles);

  const painting: Painting = {
    boards: stops.map((stop) => ({ text: options.boardText(stop.pin, stop.home), state: stop.home ? "homeboard" : stop.pin.state, glyph: glyphOf(stop.pin.id, stop.home) })),
    names: options.districts.map((district) => options.districtText(district.area)),
  };
  const atlas = paintAtlas(painting, colours, options.canvas);
  if (atlas.texture !== null) keep(atlas.texture);
  const painted = new Mesh(
    keep(paintedGeometry(stops, options.districts, atlas)),
    keep(new MeshBasicMaterial({ color: atlas.texture === null ? colours.signal : 0xffffff, map: atlas.texture, transparent: true, depthWrite: false, side: DoubleSide, fog: false })),
  );
  painted.name = "painted";
  painted.renderOrder = 2;
  scene.add(painted);

  // Home is a small house beside its board.
  const homeStop = stops.find((stop) => stop.home);
  const house = new Mesh(keep(houseGeometry()), keep(new MeshLambertMaterial({ vertexColors: true })));
  house.name = "home";
  house.visible = homeStop !== undefined;
  if (homeStop !== undefined) house.position.set(homeStop.at[0] + 2.2, 0, homeStop.at[1] + 0.6);
  scene.add(house);

  // Where the player is: a ring on the ground that breathes.
  const hereStop = stops.find((stop) => stop.pin.state === "here");
  const ring = new Mesh(keep(new RingGeometry(1.7, 2.4, 40)), keep(new MeshBasicMaterial({ color: colours.signal, transparent: true, opacity: 0.9, depthWrite: false })));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(hereStop?.at[0] ?? 0, LAYER.ring, hereStop?.at[1] ?? 0);
  ring.visible = hereStop !== undefined;
  ring.name = "here";
  scene.add(ring);

  // The route: dots that run along the roads toward the stop picked.
  const dotGeometry = keep(new CircleGeometry(0.5, 10));
  dotGeometry.rotateX(-Math.PI / 2);
  const dots = new InstancedMesh(dotGeometry, keep(new MeshBasicMaterial({ color: colours.signal })), MAX_DOTS);
  dots.count = 0;
  dots.visible = false;
  dots.name = "route";
  dots.frustumCulled = false;
  scene.add(dots);
  const bridges = grid.roads.filter((road) => road.bridge);
  let route: readonly XZ[] | null = null;
  let length = 0;

  const setRoute = (next: readonly XZ[] | null): void => {
    route = next;
    length = next === null ? 0 : routeLength(next);
    dots.visible = next !== null && length > 0;
    dots.count = next === null ? 0 : Math.min(MAX_DOTS, Math.floor(length / DOT_SPACING) + 1);
  };

  const tick = (seconds: number): void => {
    const breath = 0.5 + 0.5 * Math.sin(seconds * 2.6);
    ring.scale.setScalar(1 + breath * 0.28);
    (ring.material).opacity = 0.95 - breath * 0.5;
    if (route === null || !dots.visible) return;
    const offset = (seconds * DOT_SPEED) % DOT_SPACING;
    for (let index = 0; index < dots.count; index += 1) {
      const travelled = offset + index * DOT_SPACING;
      const [x, z] = pointAlong(route, length === 0 ? 0 : Math.min(1, travelled / length));
      const bridge = bridges.some((road) => Math.abs(road.from[0] - x) < 0.01 && z >= Math.min(road.from[1], road.to[1]) && z <= Math.max(road.from[1], road.to[1]));
      dots.setMatrixAt(index, place(x, (bridge ? LAYER.bridge : LAYER.road) + LAYER.dot - LAYER.road, z, 1, 1, 1));
    }
    dots.instanceMatrix.needsUpdate = true;
  };

  for (const mesh of [plotMesh, roadMesh, treeMesh, poles]) mesh.computeBoundingSphere();
  scene.traverse((object) => {
    if (object instanceof InstancedMesh) object.computeBoundingSphere();
  });

  return {
    scene,
    grid,
    stops,
    setRoute,
    tick,
    setBoardScale: (scale) => {
      const position = painted.geometry.getAttribute("position");
      stops.forEach((stop, index) => {
        const [a, b, c, d] = boardCorners(stop, scale);
        if (a === undefined || b === undefined || c === undefined || d === undefined) return;
        [a, b, c, a, c, d].forEach((corner, vertex) => position.setXYZ(index * 6 + vertex, corner.x, corner.y, corner.z));
        stop.board.y = stop.foot + (BOARD.height * scale) / 2;
      });
      position.needsUpdate = true;
      painted.geometry.computeBoundingSphere();
    },
    dispose: () => {
      for (const thing of disposables) thing.dispose();
    },
  };
}

/**
 * The draw calls a scene costs: every visible mesh once for each material it draws with. The
 * renderer's own count in the browser test is the measure; this is the same count without one.
 */
export function drawCallsOf(root: Object3D): number {
  let calls = 0;
  root.traverseVisible((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    if (object instanceof InstancedMesh && object.count === 0) return;
    const groups = mesh.geometry.groups.length;
    calls += Array.isArray(mesh.material) ? Math.max(1, groups) : 1;
  });
  return calls;
}
