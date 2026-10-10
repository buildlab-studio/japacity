// The figure alone on its turntable (prologue.md R-PROLOGUE-009; the design's onboarding, as drawn): the look on a
// low round plinth, no compound behind it, over the theme's own band. It turns slowly by itself and a finger drags it
// round. The figure wears the player's own colours (R-PROLOGUE-015), painted once a pick, and tells the first screen
// what it read of the look. Loaded only where WebGL exists; nothing here sends a command.
import { paletteCss } from "@japacity/assets";
import { text } from "@japacity/content";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { Color } from "three";

import { advanceClock } from "../three/clock";
import { loadModel } from "../three/load";
import { loadManifest } from "../three/manifest";
import { type Figure, figureOf, poseFigure } from "../three/people";
import { readLook, wear } from "./colours";
import { idOf } from "./looks";
import { type Spin, SLOW_TURN, turnFrame } from "./spin";
import { type LookStyle, reportOwn, styleKey } from "./style";

/** The plinth: a low round the figure stands on, this wide and this high. */
const PLINTH_RADIUS = 0.7;
const PLINTH_HIGH = 0.1;
/** The design's framing: the camera back and up from the figure, looking at its middle, so the whole look stands in the space above the sheet. */
const CAMERA: readonly [number, number, number] = [0, 1.25, 4.4];
const LOOK_AT_Y = 0.88;
const FOV = 30;

export interface TurntableProps {
  /** The look's file, `shared/chr/chr_ada.glb`. */
  look: string;
  /** The finger's pull on the figure. */
  spin: Spin;
  /** The player's own colours on the look; as made when absent. */
  style?: LookStyle | undefined;
  /** Called once the figure stands, so the stand-in picture can come down. */
  onShown?: (() => void) | undefined;
}

/** Reads the look the figure wears for the first screen's rows, then dresses it in the style. */
function dress(root: Figure["root"], look: string, style: LookStyle | undefined): void {
  const own = readLook(root);
  if (own !== null) reportOwn(idOf(look), own);
  wear(root, style);
}

function Stand({ look, spin, style, onShown }: TurntableProps) {
  const [figure, setFigure] = useState<{ look: string; figure: Figure } | null>(null);
  const worn = useRef(style);
  worn.current = style;
  const key = styleKey(style);
  const facing = useRef(0);
  const speed = useRef(SLOW_TURN);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const manifest = await loadManifest();
      const model = await loadModel(manifest, look, (id) => text[id]);
      if (!alive) return;
      const made = figureOf(model, "stand", 0.7);
      dress(made.root, look, worn.current);
      setFigure({ look, figure: made });
      onShown?.();
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [look]);

  // A pick paints the figure once; the frames only turn it.
  useEffect(() => {
    if (figure === null) return;
    wear(figure.figure.root, worn.current);
    if (window.__front !== undefined) window.__front.worn = key;
  }, [figure, key]);

  useEffect(() => {
    if (figure === null) return;
    window.__front = { ready: true, look: figure.look, facing: facing.current, worn: styleKey(worn.current) };
    return () => {
      delete window.__front;
    };
  }, [figure]);

  useFrame((_, delta) => {
    const time = advanceClock(delta);
    camera.lookAt(0, LOOK_AT_Y, 0);
    if (figure === null) return;
    const turned = turnFrame(spin, facing.current, speed.current, delta);
    facing.current = turned.angle;
    speed.current = turned.speed;
    figure.figure.root.position.set(0, PLINTH_HIGH, 0);
    figure.figure.root.rotation.set(0, facing.current, 0);
    poseFigure(figure.figure, time, "stand");
    if (window.__front !== undefined) window.__front.facing = facing.current;
  });

  return (
    <>
      <hemisphereLight args={[new Color(paletteCss("white")), new Color(paletteCss("darkWood")), 1.6]} />
      <directionalLight position={[2, 4, 3]} intensity={1.8} />
      {figure === null ? null : <primitive object={figure.figure.root} />}
      <mesh position={[0, PLINTH_HIGH / 2, 0]}>
        <cylinderGeometry args={[PLINTH_RADIUS, PLINTH_RADIUS + 0.05, PLINTH_HIGH, 40]} />
        <meshStandardMaterial color={new Color(paletteCss("marking"))} />
      </mesh>
    </>
  );
}

export default function Turntable(props: TurntableProps) {
  return (
    <Canvas dpr={[1, 2]} gl={{ alpha: true, antialias: true }} camera={{ fov: FOV, near: 0.1, far: 40, position: [...CAMERA] }} aria-hidden data-turntable-canvas>
      <Stand {...props} />
    </Canvas>
  );
}
