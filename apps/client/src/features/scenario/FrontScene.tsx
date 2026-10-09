// The front door's scene (prologue.md R-PROLOGUE-009): the family compound as the city draws it, with
// the character standing at the gate, seen from the street. One fixed raised camera, low mode, no crowd:
// the sheet covers the bottom of the screen, so the camera keeps the character in the top part. A look
// tapped on the sheet is put on the same character at once; when the sheet is up the character turns
// round to face it. Loaded only where WebGL exists; nothing here sends a command.
import { content, text } from "@japacity/content";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Object3D } from "three";

import { advanceClock } from "../../shared/three/clock";
import { loadModel } from "../../shared/three/load";
import { loadJson, loadManifest } from "../../shared/three/manifest";
import { figureOf, poseFigure } from "../../shared/three/people";
import { modeSettings } from "../city/mode";
import { filesOf, type PlaceFile, stageOf } from "../city/placeFile";
import { animateWorld, buildWorld, colourOf, skyColours, type World } from "../city/world";

/** The compound's file under places/: the family house's own (place.family-house). */
const COMPOUND = "family-house-compound";
const PLACE = "place.family-house";
/**
 * Where the character stands: on the street just outside the gate, which the house's model puts at
 * x 3.4 of a plot centred on the house at (-1, 1.5), the gate on its +Z side 15.5 m out.
 */
export const GATE: readonly [number, number] = [2.4, 18.1];
/** Facing the house, back to the street; and facing the street, toward the camera and the sheet. */
const TO_HOUSE = Math.PI;
const TO_SHEET = 0;
/** How quickly the character turns round, a share a second. */
const TURN = 5;
/** The camera: this far back along the street and this high, looking down at this pitch, so the character stands in the top part of a tall screen. */
const BACK = 10;
const HIGH = 4;
const LOOK_DOWN = (31 * Math.PI) / 180;
const FOV = 60;

export interface FrontSceneProps {
  /** The look's file, `shared/chr/chr_ada.glb`. */
  look: string;
  /** True while a sheet is up: the character turns to face it. */
  facingSheet: boolean;
}

/** What the browser test and the pictures read. */
export interface FrontProbe {
  ready: boolean;
  look: string;
  facing: number;
}

declare global {
  interface Window {
    __front?: FrontProbe;
  }
}

function Compound({ file, look, facingSheet }: FrontSceneProps & { file: PlaceFile }) {
  const [world, setWorld] = useState<World | null>(null);
  const shown = useRef<string | null>(null);
  const facing = useRef(TO_HOUSE);
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
      world.root.add(own.root);
      shown.current = look;
      if (window.__front !== undefined) window.__front.look = look;
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [world, look]);

  useEffect(() => {
    if (world === null) return;
    window.__front = { ready: true, look: shown.current ?? look, facing: facing.current };
    return () => {
      delete window.__front;
    };
  }, [world]);

  useFrame((_, delta) => {
    const time = advanceClock(delta);
    if (world === null) return;
    animateWorld(world, time, delta);
    const goal = facingSheet ? TO_SHEET : TO_HOUSE;
    facing.current += (goal - facing.current) * Math.min(1, delta * TURN);
    world.own.root.position.set(GATE[0], 0, GATE[1]);
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
