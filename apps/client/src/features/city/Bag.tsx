// The bag by the door read as japacity (world.md R-WORLD-029, japacity.md R-JAPACITY-003; the design
// lab's brief, section 6): the room's one bag model, scaled about its own spot from the figure and eased
// toward a new size, so a rise is seen and not only counted. What is held sits on top (the passport, the
// papers, the flyer of a way out), a few pieces from the kit, and a small tag on the handle carries the
// figure. Nothing else: no particles, no glow. Loaded with the scene, inside its canvas.
import { box } from "@japacity/assets/kit";
import { drawSign } from "@japacity/assets/load";
import type { PlayerView } from "@japacity/sim";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, Group, Matrix4, type Object3D, SRGBColorSpace, Sprite, SpriteMaterial } from "three";

import type { Spot, Stage } from "./placeFile";

/** The bag's model, the same file in the parlour and in the room abroad. */
export const BAG_FILE = "shared/prop/prop_travel-bag.glb";
/** The height of the bag's body as built (assets-src/places/room-basics/build.ts). */
export const BAG_HEIGHT = 0.5;
/** The top of the zip along it, where what is packed sits. */
const BAG_TOP = 0.518;
/** The bag's scale along its own length, height and depth with nothing toward leaving: it sags. */
export const BAG_EMPTY: readonly [number, number, number] = [0.8, 0.4, 0.8];
/** And at 100: packed full and standing. */
export const BAG_FULL: readonly [number, number, number] = [1.15, 1.25, 1.15];
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

declare module "./scene.types" {
  interface CityProbe {
    /** The bag by the door, in a room that has one. */
    bag?: BagProbe;
  }
}

/** How far from empty to full the figure puts the bag; no route yet is empty (R-JAPACITY-003). */
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

/** The tag's figure, as the figure is shown; no tag with no route yet. */
export function tagWords(percent: number | null): string | null {
  return percent === null ? null : `${String(percent)}%`;
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

/** The luggage tag: the figure lettered as a sign is, on a small card that always faces the camera. */
function tagOf(words: string): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx !== null) drawSign(ctx, [0, 0, 128, 64], words, { board: "cream", ink: "indigo", border: "indigo" });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const sprite = new Sprite(new SpriteMaterial({ map: texture }));
  sprite.scale.set(0.56, 0.28, 1);
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
  /** The figure as the band shows it, or null with no route yet. */
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
    if (tagAt.current !== null) tagAt.current.position.set(0.24 * scale[0], BAG_TOP * scale[1] + 0.2, 0.1 * scale[2]);
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
