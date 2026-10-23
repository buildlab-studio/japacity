import sharp from "sharp";
import { describe, expect, test } from "vitest";

import { drawnFrom, SMALL, toWebp, WEBP, webpChunks, webpProblem } from "./webp";
import { discRender } from "./webp.testing";

describe("the published pictures' encoding", () => {
  test("[assets:pictures-shipped-light] given a render, when it is published, then it is WebP, lossy at quality 85, with its transparency stored losslessly and the same pixel for pixel", async () => {
    expect(WEBP.quality).toBe(85);
    expect(WEBP.alphaQuality).toBe(100);
    const render = await discRender(512, 512);
    const published = await toWebp(render);
    const chunks = webpChunks(published);
    expect([...(chunks?.keys() ?? [])]).toEqual(["VP8X", "ALPH", "VP8 "]);
    expect(webpProblem(published)).toBeNull();
    expect(published).toEqual(await sharp(render).webp({ quality: 85, alphaQuality: 100, effort: WEBP.effort }).toBuffer());
    const alpha = async (file: Uint8Array) => sharp(file).ensureAlpha().extractChannel(3).raw().toBuffer();
    expect(await alpha(published)).toEqual(await alpha(render));
    expect(await drawnFrom(published, render)).toBeNull();
    expect(published.byteLength).toBeLessThan(render.byteLength);
  });

  test("[assets:pictures-shipped-light] given a published picture recoloured, shrunk, or not a WebP, when it is held to its render, then it fails", async () => {
    const render = await discRender(512, 512);
    expect(await drawnFrom(await toWebp(await discRender(512, 512, "#1b2a4a", "#ffffff")), render)).toMatch(/strays .* from its render/);
    expect(await drawnFrom(await toWebp(render, true), render)).toMatch(/is 192 by 192, its render 512 by 512/);
    expect(await drawnFrom(render, render)).toBe("is not a WebP");
    expect(webpProblem(await sharp(render).webp({ lossless: true }).toBuffer())).toBe("is lossless WebP, not lossy");
    expect(webpProblem(await sharp(render).webp({ quality: 85, alphaQuality: 80 }).toBuffer())).toBe("has its transparency quantised");
  });

  test("[assets:pictures-sharp-at-three] given a tile's render, when its small size is made, then it is the small width across and drawn from the render", async () => {
    const render = await discRender(512, 512);
    const small = await toWebp(render, true);
    const size = await sharp(small).metadata();
    expect([size.width, size.height]).toEqual([SMALL.width, SMALL.width]);
    expect(await drawnFrom(small, render, true)).toBeNull();
  });
});
