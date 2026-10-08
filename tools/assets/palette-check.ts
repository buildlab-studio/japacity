// The palette check (R-ASSET-001, R-ASSET-013): every vertex colour, converted to 8-bit sRGB, is a
// palette entry within 1 on each channel, and so is every pixel of every texture in the file.
import type { Document as GltfDocument } from "@gltf-transform/core";
import { linearToSrgb, nearestPaletteName } from "@japacity/assets";

import { decodePng } from "./png";

export interface PaletteProblem {
  where: string;
  rgb: [number, number, number];
}

export function checkPalette(doc: GltfDocument): PaletteProblem[] {
  const problems: PaletteProblem[] = [];
  const seen = new Set<string>();
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const colour = prim.getAttribute("COLOR_0");
      if (colour === null) continue;
      const element: number[] = [];
      for (let i = 0; i < colour.getCount(); i++) {
        colour.getElement(i, element);
        const rgb: [number, number, number] = [
          Math.round(linearToSrgb(element[0] ?? 0) * 255),
          Math.round(linearToSrgb(element[1] ?? 0) * 255),
          Math.round(linearToSrgb(element[2] ?? 0) * 255),
        ];
        const key = rgb.join(",");
        if (seen.has(key)) continue;
        seen.add(key);
        if (nearestPaletteName(rgb) === null) problems.push({ where: `${mesh.getName()} vertex ${String(i)}`, rgb });
      }
    }
  }
  for (const texture of doc.getRoot().listTextures()) {
    const image = texture.getImage();
    if (image === null) continue;
    if (texture.getMimeType() !== "image/png") {
      problems.push({ where: `texture ${texture.getName()}: not a PNG, so its pixels cannot be checked`, rgb: [0, 0, 0] });
      continue;
    }
    const { pixels } = decodePng(image);
    const checked = new Set<number>();
    for (let i = 0; i < pixels.length; i += 4) {
      const value = ((pixels[i] ?? 0) << 16) | ((pixels[i + 1] ?? 0) << 8) | (pixels[i + 2] ?? 0);
      if (checked.has(value)) continue;
      checked.add(value);
      const rgb: [number, number, number] = [pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0];
      if ((pixels[i + 3] ?? 255) !== 255 || nearestPaletteName(rgb) === null) problems.push({ where: `texture ${texture.getName()} pixel ${String(i / 4)}`, rgb });
    }
  }
  return problems;
}
