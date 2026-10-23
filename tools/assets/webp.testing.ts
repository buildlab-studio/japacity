// Renders for the publish and check tests: a disc on a clear ground, as the shooter writes a tile, so a published
// picture has a round, soft transparent edge to keep whole.
import sharp from "sharp";

/** A PNG `width` by `height` with a disc of `fill` filling most of it on a clear ground, and a stripe of `stripe` across it. */
export async function discRender(width: number, height: number, fill = "#c0392b", stripe = "#f4c430"): Promise<Buffer> {
  const r = Math.round(Math.min(width, height) * 0.42);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}"><circle cx="${String(width / 2)}" cy="${String(height / 2)}" r="${String(r)}" fill="${fill}"/><rect x="${String(width * 0.2)}" y="${String(height * 0.45)}" width="${String(width * 0.6)}" height="${String(height * 0.1)}" fill="${stripe}"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
