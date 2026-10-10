// The front door's scene (prologue.md R-PROLOGUE-009): the family compound as the city draws it, with
// the character on a plinth at the gate, seen from the street. One fixed raised camera, low mode, no crowd:
// the sheet covers the bottom of the screen, so the camera keeps the character in the top part. A look
// tapped on the sheet is put on the same character at once; the figure turns slowly and a finger drags it
// round (the design's onboarding). The figure wears the player's own colours (R-PROLOGUE-015), painted once a
// pick, and tells the first screen what it read of the look. Loaded only where WebGL exists; nothing here sends a command.
import { content, text } from "@japacity/content";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Mesh, Object3D } from "three";

import { advanceClock } from "../three/clock";
import { loadModel } from "../three/load";
import { loadJson, loadManifest } from "../three/manifest";
import { figureOf, poseFigure } from "../three/people";
import { modeSettings } from "../../features/city/mode";
import { filesOf, type PlaceFile, stageOf } from "../../features/city/placeFile";
import { animateWorld, buildWorld, colourOf, skyColours, type World } from "../../features/city/world";
import { readLook, wear } from "./colours";
import { idOf } from "./looks";
import { type Spin, SLOW_TURN, turnFrame } from "./spin";
import { type LookStyle, reportOwn, styleKey } from "./style";

/** The compound's file under places/: the family house's own (place.family-house). */
const COMPOUND = "family-house-compound";
const PLACE = "place.family-house";
/**
 * Where the character stands: on the street just outside the gate, which the house's model puts at
 * x 3.4 of a plot centred on the house at (-1, 1.5), the gate on its +Z side 15.5 m out.
 */
export const GATE: readonly [number, number] = [2.4, 18.1];
/** Facing the street, toward the camera and the sheet: where the slow turn starts. */
const TO_SHEET = 0;
/** The plinth: a low round of concrete the figure stands on, this wide and this high. */
const PLINTH_RADIUS = 0.62;
const PLINTH_HIGH = 0.14;
/** The camera: this far back along the street and this high, looking down at this pitch, so the figure on its plinth stands large in the top part of a tall screen. */
const BACK = 6.2;
const HIGH = 2.9;
const LOOK_DOWN = (24 * Math.PI) / 180;
const FOV = 50;

export interface FrontSceneProps {
  /** The look's file, `shared/chr/chr_ada.glb`. */
  look: string;
  /** The finger's pull on the figure, from the gate. */
  spin: Spin;
  /** The player's own colours on the look; as made when absent. */
  style?: LookStyle | undefined;
}

/** What the browser test and the pictures read. */
export interface FrontProbe {
  ready: boolean;
  look: string;
  facing: number;
  /** The style the figure wears, as `styleKey` writes it: empty as made. */
  worn: string;
}

declare global {
  interface Window {
    __front?: FrontProbe;
  }
}

/** Reads the look the figure wears for the first screen's rows, then dresses it in the style. */
function dress(world: World, look: string, style: LookStyle | undefined): void {
  const own = readLook(world.own.root);
  if (own !== null) reportOwn(idOf(look), own);
  wear(world.own.root, style);
}

function Compound({ file, look, spin, style }: FrontSceneProps & { file: PlaceFile }) {
  const [world, setWorld] = useState<World | null>(null);
  const worn = useRef(style);
  worn.current = style;
  const key = styleKey(style);
  const shown = useRef<string | null>(null);
  const facing = useRef(TO_SHEET);
  const speed = useRef(SLOW_TURN);
  const plinth = useRef<Mesh>(null);
  const camera = useThree((state) => state.camera);
  const settings = modeSettings("low", { finePointer: false, width: 390, pixelRatio: 1 }, content.tuning.city);

  // The compound is built once, with the first look; a new look swaps the character only.
  useEffect(() => {
    let alive = true;
    const stage = stageOf(file);
    void (async () => {
      const manifest = await loadManifest();
      const models = new Map<string, Object3D>();
      await Promise.all(filesOf(file, [look]).map(async (path) => models.set(path, await loadModel(manifest, path, (key) => text[key]))));
      if (!alive) return;
      const built = buildWorld(stage, models, [], look, settings, (key) => text[key], PLACE, false);
      built.indicator.visible = false;
      dress(built, look, worn.current);
      shown.current = look;
      setWorld(built);
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
    // Built once per compound file; the look is swapped below.
  }, [file]);

  useEffect(() => {
    if (world === null || shown.current === look) return;
    let alive = true;
    void (async () => {
      const manifest = await loadManifest();
      const model = await loadModel(manifest, look, (key) => text[key]);
      if (!alive) return;
      world.root.remove(world.own.root);
      const own = figureOf(model, "stand", 0.7);
      own.root.userData = { own: true };
      world.own = own;
      dress(world, look, worn.current);
      world.root.add(own.root);
      shown.current = look;
      if (window.__front !== undefined) window.__front.look = look;
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [world, look]);

  // A pick paints the figure once; the frames only turn it.
  useEffect(() => {
    if (world === null || shown.current !== look) return;
    wear(world.own.root, worn.current);
    if (window.__front !== undefined) window.__front.worn = key;
  }, [world, look, key]);

  useEffect(() => {
    if (world === null) return;
    window.__front = { ready: true, look: shown.current ?? look, facing: facing.current, worn: styleKey(worn.current) };
    return () => {
      delete window.__front;
    };
  }, [world]);

  useFrame((_, delta) => {
    const time = advanceClock(delta);
    if (world === null) return;
    animateWorld(world, time, delta);
    const turned = turnFrame(spin, facing.current, speed.current, delta);
    facing.current = turned.angle;
    speed.current = turned.speed;
    world.own.root.position.set(GATE[0], PLINTH_HIGH, GATE[1]);
    plinth.current?.position.set(GATE[0], PLINTH_HIGH / 2, GATE[1]);
    world.own.root.rotation.set(0, facing.current, 0);
    poseFigure(world.own, time, "stand");
    camera.position.set(GATE[0], HIGH, GATE[1] + BACK);
    camera.lookAt(GATE[0], HIGH - Math.tan(LOOK_DOWN) * BACK, GATE[1]);
    if (window.__front !== undefined) window.__front.facing = facing.current;
  });

  const stage = stageOf(file);
  const { sky, background, fog } = skyColours(stage.light.sky, stage.light.ground, settings.haze);
  return (
    <>
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[fog, 30, 70]} />
      <hemisphereLight args={[sky, colourOf(stage.light.ground), 1.1]} />
      <directionalLight intensity={2} color={0xfff0d0} position={[GATE[0] + stage.light.sun[0], stage.light.sun[1], GATE[1] + stage.light.sun[2] - 10]} />
      {world === null ? null : <primitive object={world.root} />}
      <mesh ref={plinth} position={[GATE[0], PLINTH_HIGH / 2, GATE[1]]}>
        <cylinderGeometry args={[PLINTH_RADIUS, PLINTH_RADIUS + 0.05, PLINTH_HIGH, 32]} />
        <meshStandardMaterial color={colourOf("concrete")} />
      </mesh>
    </>
  );
}

export default function FrontScene(props: FrontSceneProps) {
  const [file, setFile] = useState<PlaceFile | null>(null);
  useEffect(() => {
    let alive = true;
    void loadManifest()
      .then((manifest) => loadJson<PlaceFile>(manifest, `places/${COMPOUND}/place.json`))
      .then((found) => {
        if (alive && found !== null) setFile(found);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return (
    <Canvas dpr={1} gl={{ antialias: false, powerPreference: "high-performance" }} camera={{ fov: FOV, near: 0.5, far: 120, position: [GATE[0], HIGH, GATE[1] + BACK] }} aria-hidden>
      {file === null ? null : <Compound file={file} {...props} />}
    </Canvas>
  );
}
