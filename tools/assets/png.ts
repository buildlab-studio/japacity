// A small PNG writer and reader for the pipeline's own images: patterns (R-ASSET-013) are
// written as palette-indexed PNGs, and the palette check reads every pixel back. Only
// 8-bit, non-interlaced images of colour types 2, 3 and 6 are read, which is all the tools write
// and all Chromium's screenshots use.
import { deflateSync, inflateSync } from "node:zlib";

export interface RgbaImage {
  width: number;
  height: number;
  /** Four bytes a pixel, rows top to bottom. */
  pixels: Uint8Array;
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** Writes an image whose pixels use at most 256 colours as an indexed PNG: the smallest form for a pattern. */
export function encodeIndexedPng(image: RgbaImage): Buffer {
  const colours = new Map<number, number>();
  const { width, height, pixels } = image;
  const rows = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    rows[y * (width + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const rgb = ((pixels[i] ?? 0) << 16) | ((pixels[i + 1] ?? 0) << 8) | (pixels[i + 2] ?? 0);
      let index = colours.get(rgb);
      if (index === undefined) {
        index = colours.size;
        if (index > 255) throw new Error("encodeIndexedPng: more than 256 colours");
        colours.set(rgb, index);
      }
      rows[y * (width + 1) + 1 + x] = index;
    }
  }
  const plte = Buffer.alloc(colours.size * 3);
  for (const [rgb, index] of colours) {
    plte[index * 3] = (rgb >> 16) & 0xff;
    plte[index * 3 + 1] = (rgb >> 8) & 0xff;
    plte[index * 3 + 2] = rgb & 0xff;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 3;
  return Buffer.concat([SIGNATURE, chunk("IHDR", ihdr), chunk("PLTE", plte), chunk("IDAT", deflateSync(rows, { level: 9 })), chunk("IEND", new Uint8Array())]);
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Reads an 8-bit, non-interlaced PNG of colour type 2, 3 or 6 into RGBA pixels. */
export function decodePng(file: Uint8Array): RgbaImage {
  const data = Buffer.from(file);
  if (!data.subarray(0, 8).equals(SIGNATURE)) throw new Error("decodePng: not a PNG");
  let offset = 8;
  let width = 0;
  let height = 0;
  let type = 0;
  let palette = Buffer.alloc(0);
  let alpha = Buffer.alloc(0);
  const idat: Buffer[] = [];
  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const kind = data.toString("ascii", offset + 4, offset + 8);
    const body = data.subarray(offset + 8, offset + 8 + length);
    if (kind === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      type = body[9] ?? 0;
      if (body[8] !== 8 || body[12] !== 0) throw new Error("decodePng: only 8-bit, non-interlaced images are read");
    } else if (kind === "PLTE") palette = body;
    else if (kind === "tRNS") alpha = body;
    else if (kind === "IDAT") idat.push(body);
    offset += 12 + length;
  }
  const channels = type === 2 ? 3 : type === 6 ? 4 : type === 3 ? 1 : 0;
  if (channels === 0) throw new Error(`decodePng: colour type ${String(type)} is not read`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(width * height * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] ?? 0;
    const line = new Uint8Array(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? (line[i - channels] ?? 0) : 0;
      const b = prev[i] ?? 0;
      const c = i >= channels ? (prev[i - channels] ?? 0) : 0;
      const x = line[i] ?? 0;
      line[i] = (filter === 1 ? x + a : filter === 2 ? x + b : filter === 3 ? x + ((a + b) >> 1) : filter === 4 ? x + paeth(a, b, c) : x) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (channels === 1) {
        const index = line[x] ?? 0;
        out[o] = palette[index * 3] ?? 0;
        out[o + 1] = palette[index * 3 + 1] ?? 0;
        out[o + 2] = palette[index * 3 + 2] ?? 0;
        out[o + 3] = alpha[index] ?? 255;
      } else {
        out[o] = line[x * channels] ?? 0;
        out[o + 1] = line[x * channels + 1] ?? 0;
        out[o + 2] = line[x * channels + 2] ?? 0;
        out[o + 3] = channels === 4 ? (line[x * channels + 3] ?? 255) : 255;
      }
    }
    prev = line;
  }
  return { width, height, pixels: out };
}
