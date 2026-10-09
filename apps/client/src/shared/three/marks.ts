// The marks over heads: the player's own indicator, always, and another player's
// name exactly as the server gave it. People who live in the city carry none.
import { CanvasTexture, Mesh, MeshBasicMaterial, OctahedronGeometry, SRGBColorSpace, Sprite, SpriteMaterial } from "three";

/** The accent, danfo yellow, as the interface uses it. */
const ACCENT = 0xf2b705;

/** A small turning diamond over the player's own head. */
export function ownIndicator(): Mesh {
  const mesh = new Mesh(new OctahedronGeometry(0.1, 0), new MeshBasicMaterial({ color: ACCENT }));
  mesh.scale.set(1, 1.5, 1);
  mesh.name = "own-indicator";
  return mesh;
}

/** A name over a player's head, drawn once onto a small canvas. */
export function nameTag(name: string, doc: Document = document): Sprite {
  const canvas = doc.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx !== null) {
    ctx.font = "600 30px system-ui, sans-serif";
    const width = Math.min(248, ctx.measureText(name).width + 28);
    ctx.fillStyle = "rgba(29, 26, 22, 0.82)";
    ctx.beginPath();
    ctx.roundRect((256 - width) / 2, 10, width, 44, 22);
    ctx.fill();
    ctx.fillStyle = "#f3efe6";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, 128, 33, 232);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const sprite = new Sprite(new SpriteMaterial({ map: texture, depthWrite: false }));
  sprite.scale.set(1.2, 0.3, 1);
  sprite.name = "name-tag";
  return sprite;
}
