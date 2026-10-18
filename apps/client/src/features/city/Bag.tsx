// The bag by the door read as japacity (world:room-seen-down-its-length, japacity.md
// japacity:best-open-route-is-japacity): the room's one bag model, scaled about its own spot from the figure and eased
// toward a new size, so a rise is seen and not only counted. What is held sits on top (the passport, the
// papers, the flyer of a way out), a few pieces from the kit, and a small tag on the handle carries the
// figure. Nothing else: no particles, no glow. Loaded with the scene, inside its canvas.
import { box } from "@japacity/model-kit/kit";
import { paletteCss } from "@japacity/model-kit";
import type { PlayerView } from "@japacity/sim";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, Group, Matrix4, type Object3D, SRGBColorSpace, Sprite, SpriteMaterial } from "three";

import type { Spot, Stage } from "../../shared/scene/placeFile";

/** The bag's model, the same file in the parlour and in the room abroad. */
export const BAG_FILE = "shared/prop/prop_travel-bag.glb";
/** The height of the bag's body as built (models/places/room-basics/build.ts). */
export const BAG_HEIGHT = 0.5;
/** The top of the zip along it, where what is packed sits. */
const BAG_TOP = 0.518;
/** The bag's scale along its own length, height and depth with nothing toward leaving: it sags. */
export const BAG_EMPTY: readonly [number, number, number] = [0.7, 0.4, 0.7];
/** And at 100: packed full and standing. */
export const BAG_FULL: readonly [number, number, number] = [1.2, 1.25, 1.2];
/** The bag reaches a new size in about this long. */
export const BAG_EASE_SECONDS = 0.5;
/** The share of the way left that goes in a second: about a twentieth is left after half a second. */
const EASE_RATE = 6;

export type BagPiece = "passport" | "papers" | "flyer";
/** A route with its flyer in the bag: one the character knows, has applied for, holds or has flown on. */
const FLYER_STATES = new Set<PlayerView["routes"][number]["state"]>(["known", "applying", "granted", "departed"]);

/** What the bag reports to the browser test each frame. */
export interface BagProbe {
  /** How far from empty to full the bag stands now, 0 to 1. */
  share: number;
  /** Where it is easing to. */
  goal: number;
  scale: [number, number, number];
  figure: number | null;
  pieces: BagPiece[];
}

declare module "./scene/scene.types" {
  interface CityProbe {
    /** The bag by the door, in a room that has one. */
    bag?: BagProbe;
  }
}

/** How far from empty to full the figure puts the bag; no route yet is empty (japacity:best-open-route-is-japacity). */
export function bagShare(percent: number | null): number {
  return percent === null ? 0 : Math.min(100, Math.max(0, percent)) / 100;
}

function scaleAt(share: number): [number, number, number] {
  return [0, 1, 2].map((axis) => (BAG_EMPTY[axis] ?? 1) + ((BAG_FULL[axis] ?? 1) - (BAG_EMPTY[axis] ?? 1)) * share) as [number, number, number];
}

/** The bag's scale along its own length, height and depth at a figure. */
export function bagScale(percent: number | null): [number, number, number] {
  return scaleAt(bagShare(percent));
}

/** One frame of the bag easing toward its goal: never past it, however long the frame. */
export function easeBag(share: number, goal: number, seconds: number): number {
  return share + (goal - share) * Math.min(1, Math.max(0, seconds) * EASE_RATE);
}

/** Where the bag stands in a stage, or null for a place with no bag. */
export function bagSpot(stage: Stage): Spot | null {
  return stage.models.find((model) => model.file === BAG_FILE)?.at[0] ?? null;
}

/** The bag's copy scaled about its own spot on the floor, along its own turned axes: its foot stays where it stands. */
export function bagMatrix(spot: Spot, scale: readonly [number, number, number]): Matrix4 {
  const [x, z, turn] = spot;
  const place = new Matrix4().makeRotationY(turn).setPosition(x, 0, z);
  return place.clone().multiply(new Matrix4().makeScale(...scale)).multiply(place.invert());
}

/** What sits on top of the bag: the passport once held, the other papers once any is, the flyer once a way out is known. */
export function bagPieces(view: Pick<PlayerView, "documents" | "routes">): BagPiece[] {
  const held = view.documents.filter((paper) => paper.state === "held");
  const pieces: BagPiece[] = [];
  if (held.some((paper) => paper.id === "document.passport")) pieces.push("passport");
  if (held.some((paper) => paper.id !== "document.passport")) pieces.push("papers");
  if (view.routes.some((route) => FLYER_STATES.has(route.state))) pieces.push("flyer");
  return pieces;
}

/** The tag's figure, a bare number as the rise's "+N" is, never a percentage; no tag with no route yet. */
export function tagWords(percent: number | null): string | null {
  return percent === null ? null : String(percent);
}

/** Hands the browser test the bag as it stands this frame. */
export function reportBag(state: Omit<BagProbe, "scale">): void {
  const probe = typeof window === "undefined" ? undefined : window.__city;
  if (probe === undefined) return;
  probe.bag = { ...state, scale: scaleAt(state.share) };
}

/** The pieces on top, in the bag's own frame on its top: a folder of papers, the green passport, the flyer. */
function piecesOf(pieces: readonly BagPiece[]): Group {
  const g = new Group();
  const papers = pieces.includes("papers");
  if (papers) box(g, 0.22, 0.02, 0.3, -0.33, 0.004, 0, "tan", 0.08);
  if (pieces.includes("passport")) box(g, 0.1, 0.016, 0.14, -0.32, papers ? 0.036 : 0.004, 0.03, "green", -0.2);
  if (pieces.includes("flyer")) {
    const flyer = new Group();
    flyer.position.set(0.33, 0.004, 0);
    flyer.rotation.y = -0.25;
    box(flyer, 0.2, 0.012, 0.28, 0, 0, 0, "cream");
    box(flyer, 0.2, 0.012, 0.07, 0, 0.024, -0.09, "red");
    g.add(flyer);
  }
  return g;
}

/** The tag's width and height in metres: about the bag's own length, so the figure reads on a phone from the room's whole view. */
const TAG_SIZE: readonly [number, number] = [1, 0.5];

/** The luggage tag: a card cut to a point with its string hole, the figure on it in bold, always facing the camera. */
function tagOf(words: string): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx !== null) {
    ctx.fillStyle = paletteCss("cream");
    ctx.strokeStyle = paletteCss("indigo");
    ctx.lineWidth = 8;
    // The card cut to a point at one end, with its string hole.
    ctx.beginPath();
    ctx.moveTo(6, 6);
    ctx.lineTo(208, 6);
    ctx.lineTo(250, 64);
    ctx.lineTo(208, 122);
    ctx.lineTo(6, 122);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = paletteCss("indigo");
    ctx.beginPath();
    ctx.arc(216, 64, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "900 84px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(words, 104, 68, 186);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  // Drawn over the floor it hangs above whatever the view's pitch, as a label is.
  const sprite = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }));
  sprite.renderOrder = 1;
  sprite.scale.set(TAG_SIZE[0], TAG_SIZE[1], 1);
  // It hangs just below the bag on screen, on the open floor, so it never hides the bag, the character coming in at
  // the door beside it, or the labels of the things along the wall behind it.
  sprite.center.set(0.5, 2);
  sprite.name = "bag-tag";
  return sprite;
}

/** The bag's copy in the scene, kept while it is still in it; a place rebuilt gives a new one. */
function bagBody(scene: Object3D, kept: Object3D | null): Object3D | null {
  for (let at = kept; at !== null; at = at.parent) if (at === scene) return kept;
  return scene.getObjectByName(BAG_FILE) ?? null;
}

export interface BagProps {
  stage: Stage;
  /** The figure as the world shows it (it waits while a sheet covers the world), or null with no route yet. */
  figure: number | null;
  documents: PlayerView["documents"];
  routes: PlayerView["routes"];
}

/** The bag by the door, swelling with the figure, its pieces on top and its tag on the handle. */
export default function Bag({ stage, figure, documents, routes }: BagProps) {
  const scene = useThree((state) => state.scene);
  const spot = useMemo(() => bagSpot(stage), [stage]);
  const pieces = bagPieces({ documents, routes });
  const piecesKey = pieces.join("|");
  const top = useMemo(() => piecesOf(piecesKey === "" ? [] : (piecesKey.split("|") as BagPiece[])), [piecesKey]);
  const words = tagWords(figure);
  const tag = useMemo(() => (words === null ? null : tagOf(words)), [words]);
  useEffect(
    () => () => {
      tag?.material.map?.dispose();
      tag?.material.dispose();
    },
    [tag],
  );
  const share = useRef<number | null>(null);
  const body = useRef<Object3D | null>(null);
  const onTop = useRef<Group>(null);
  const tagAt = useRef<Group>(null);
  const goal = bagShare(figure);

  useFrame((_, seconds) => {
    if (spot === null) return;
    // A room entered shows the bag at its size; only a change of the figure is eased.
    const now = share.current === null ? goal : easeBag(share.current, goal, seconds);
    share.current = now;
    const scale = scaleAt(now);
    const found = bagBody(scene, body.current);
    body.current = found;
    if (found !== null) {
      found.matrixAutoUpdate = false;
      found.matrix.copy(bagMatrix(spot, scale));
      found.matrixWorldNeedsUpdate = true;
    }
    if (onTop.current !== null) {
      onTop.current.position.y = BAG_TOP * scale[1];
      onTop.current.scale.set(scale[0], 1, scale[2]);
    }
    if (tagAt.current !== null) tagAt.current.position.set(0, BAG_TOP * scale[1] + 0.05, 0);
    reportBag({ share: now, goal, figure, pieces });
  });

  if (spot === null) return null;
  return (
    <group position={[spot[0], 0, spot[1]]} rotation={[0, spot[2], 0]}>
      <group ref={onTop}>
        <primitive object={top} />
      </group>
      <group ref={tagAt}>{tag === null ? null : <primitive object={tag} />}</group>
    </group>
  );
}
