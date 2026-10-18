// Loading a place's files (city:places-load-on-entry, city:place-words-are-text-keys). Every file is fetched by the name
// tools/assets/publish.ts gave it, which carries the hash of its contents, so the browser keeps it
// and a second visit downloads nothing. Models are decoded with meshopt, given flat shading, and
// lettered from the place's text keys once the sign font has loaded.
import { attachSigns, prepareModel, SIGN_FONT } from "@japacity/model-kit/load";
import type { Group, Mesh, MeshStandardMaterial, Object3D } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

import { assetUrl, type PublishManifest } from "./manifest";

let fontOnce: Promise<unknown> | null = null;

/** The sign font, loaded once, so no sign is lettered in the fallback face. */
function loadSignFont(): Promise<unknown> {
  fontOnce ??= typeof document === "undefined" || !("fonts" in document) ? Promise.resolve() : document.fonts.load(`64px ${SIGN_FONT}`).catch(() => undefined);
  return fontOnce;
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const models = new Map<string, Promise<Group>>();

/** Smooth shading on the parts a builder named round (assets:flat-and-smooth-shading), wherever prepareModel left them flat. */
function keepRoundPartsSmooth(root: Object3D): void {
  root.traverse((object) => {
    if ((object.userData as { smooth?: unknown }).smooth !== true) return;
    object.traverse((part) => {
      const mesh = part as Mesh;
      if (!mesh.isMesh) return;
      if (mesh.geometry.getAttribute("normal") === undefined) mesh.geometry.computeVertexNormals();
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const standard = material as MeshStandardMaterial;
        if (standard.flatShading) {
          standard.flatShading = false;
          standard.needsUpdate = true;
        }
      }
    });
  });
}

/**
 * One model, ready to draw: decoded, flat-shaded but for its round parts, its signs lettered from
 * `text`. Loaded once a session; callers clone what they show.
 */
export function loadModel(manifest: PublishManifest, path: string, text: (key: string) => string | undefined, onProgress?: (loaded: number, total: number) => void): Promise<Group> {
  const held = models.get(path);
  if (held !== undefined) return held;
  const url = assetUrl(manifest, path);
  if (url === null) return Promise.reject(new Error(`${path} is not published; run pnpm assets:publish`));
  const loading = Promise.all([loader.loadAsync(url, (event) => onProgress?.(event.loaded, event.total)), loadSignFont()]).then(([gltf]) => {
    const root = gltf.scene;
    prepareModel(root);
    keepRoundPartsSmooth(root);
    attachSigns(root, (key) => text(key) ?? "");
    return root;
  });
  models.set(path, loading);
  loading.catch(() => models.delete(path));
  return loading;
}
