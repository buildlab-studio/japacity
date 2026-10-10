// What stands behind the figure on the door's first two screens (prologue.md R-PROLOGUE-016), drawn once and still:
// the tailor's corner behind "Who are you?", the family compound behind "Your life so far". The canvas draws a frame
// only when what it shows is built or the screen changes size, never on a clock, so nothing in it moves. While the
// corner is up the compound is fetched, so the cut to the second screen finds it waiting. Loaded only where WebGL
// exists; nothing here sends a command.
import { content, text } from "@japacity/content";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useState } from "react";
import type { Object3D, PerspectiveCamera } from "three";

import { modeSettings } from "../../features/city/mode";
import { filesOf, type PlaceFile, stageOf } from "../../features/city/placeFile";
import { buildWorld, colourOf, skyColours, type World } from "../../features/city/world";
import { loadModel } from "../three/load";
import { loadJson, loadManifest } from "../three/manifest";
import { boltTexture } from "./colours";
import { compoundCamera, loadCompound, PLACE } from "./compound";
import type { Backdrop as Kind } from "./backdrop";
import { boltPrints, CORNER, cornerCamera } from "./corner";
import { doorPixels } from "./pixels";

export interface BackdropProps {
  kind: Kind;
  /** The look's file, `shared/chr/chr_ada.glb`: the world is built around a character, which the backdrop leaves out. */
  look: string;
}

/** What the browser test and the pictures read: what stands behind the figure, and what it cost to draw. */
export interface BackdropProbe {
  ready: boolean;
  kind: Kind;
  drawCalls: number;
  triangles: number;
}

declare global {
  interface Window {
    __backdrop?: BackdropProbe;
  }
}

const settings = modeSettings("low", { finePointer: false, width: 390, pixelRatio: 1 }, content.tuning.city);

/** A place's models and the look, loaded once a session through the city's loader. */
async function modelsOf(file: PlaceFile, look: string): Promise<Map<string, Object3D>> {
  const manifest = await loadManifest();
  const models = new Map<string, Object3D>();
  await Promise.all(filesOf(file, [look]).map(async (path) => models.set(path, await loadModel(manifest, path, (key) => text[key]))));
  return models;
}

/** The place built as the city builds it, with nobody in it: the figure stands on its own turntable in front. */
function stillWorld(file: PlaceFile, models: ReadonlyMap<string, Object3D>, look: string): World {
  const world = buildWorld(stageOf(file), models, [], look, settings, (key) => text[key], PLACE, false);
  world.indicator.visible = false;
  world.root.remove(world.own.root);
  return world;
}

let cornerOnce: Promise<PlaceFile | null> | null = null;

function loadCorner(): Promise<PlaceFile | null> {
  cornerOnce ??= loadManifest().then((manifest) => loadJson<PlaceFile>(manifest, `places/${CORNER}/place.json`));
  cornerOnce.catch(() => {
    cornerOnce = null;
  });
  return cornerOnce;
}

/** Tells the probe what the last frame drew, once it has been drawn. */
function useProbe(kind: Kind, ready: boolean): void {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    if (!ready) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        window.__backdrop = { ready: true, kind, drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles };
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      delete window.__backdrop;
    };
  }, [gl, kind, ready]);
}

function Corner({ look }: { look: string }) {
  const [built, setBuilt] = useState<{ file: PlaceFile; world: World } | null>(null);
  const { camera, size, invalidate } = useThree();

  useEffect(() => {
    let alive = true;
    void (async () => {
      const file = await loadCorner();
      if (file === null) return;
      const models = await modelsOf(file, look);
      if (!alive) return;
      const world = stillWorld(file, models, look);
      world.root.add(boltPrints(boltTexture));
      setBuilt({ file, world });
      // The second screen's compound, fetched while this one is read.
      void loadCompound()
        .then((compound) => (compound === null ? null : modelsOf(compound, look)))
        .catch(() => undefined);
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
    // Built once; a new look changes only the figure on the turntable.
  }, []);

  useLayoutEffect(() => {
    const lens = camera as PerspectiveCamera;
    const shot = cornerCamera(size.height);
    lens.fov = shot.fov;
    lens.near = 0.5;
    lens.far = 40;
    lens.position.set(...shot.position);
    lens.lookAt(...shot.target);
    lens.setViewOffset(size.width, shot.fullHeight, 0, shot.offsetY, size.width, size.height);
    lens.updateProjectionMatrix();
    invalidate();
  }, [camera, size, invalidate]);

  useEffect(() => {
    if (built !== null) invalidate();
  }, [built, invalidate]);
  useProbe("corner", built !== null);

  if (built === null) return null;
  const light = stageOf(built.file).light;
  return (
    <>
      <hemisphereLight args={[colourOf(light.sky), colourOf(light.ground), 1.3]} />
      <directionalLight intensity={1.7} color={0xfff0d0} position={light.sun} />
      <primitive object={built.world.root} />
    </>
  );
}

function Compound({ look }: { look: string }) {
  const [built, setBuilt] = useState<{ file: PlaceFile; world: World } | null>(null);
  const { camera, size, invalidate } = useThree();

  useEffect(() => {
    let alive = true;
    void (async () => {
      const file = await loadCompound();
      if (file === null) return;
      const models = await modelsOf(file, look);
      if (!alive) return;
      setBuilt({ file, world: stillWorld(file, models, look) });
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // The page's own camera, so the compound behind the second screen is the one the third shows.
  useLayoutEffect(() => {
    const lens = camera as PerspectiveCamera;
    const shot = compoundCamera();
    lens.clearViewOffset();
    lens.fov = shot.fov;
    lens.near = 0.5;
    lens.far = 120;
    lens.aspect = size.width / Math.max(1, size.height);
    lens.position.set(...shot.position);
    lens.lookAt(...shot.target);
    lens.updateProjectionMatrix();
    invalidate();
  }, [camera, size, invalidate]);

  useEffect(() => {
    if (built !== null) invalidate();
  }, [built, invalidate]);
  useProbe("compound", built !== null);

  if (built === null) return null;
  const stage = stageOf(built.file);
  const { sky, fog } = skyColours(stage.light.sky, stage.light.ground, settings.haze);
  const shot = compoundCamera();
  return (
    <>
      <fog attach="fog" args={[fog, 30, 70]} />
      <hemisphereLight args={[sky, colourOf(stage.light.ground), 1.1]} />
      <directionalLight intensity={2} color={0xfff0d0} position={[shot.target[0] + stage.light.sun[0], stage.light.sun[1], shot.target[2] + stage.light.sun[2] - 10]} />
      <primitive object={built.world.root} />
    </>
  );
}

export default function BackdropCanvas({ kind, look }: BackdropProps) {
  return (
    <Canvas frameloop="demand" dpr={doorPixels()} gl={{ alpha: true, antialias: true }} camera={{ manual: true, fov: 50, near: 0.5, far: 120 }} aria-hidden data-backdrop-canvas>
      {kind === "corner" ? <Corner key="corner" look={look} /> : <Compound key="compound" look={look} />}
    </Canvas>
  );
}
