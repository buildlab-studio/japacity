// advert:one-labelled-still-image: what an image is, read from its own bytes. Only one still PNG,
// JPEG or WebP is an advert; an animated one is refused.
import type { CreativeFile } from "@japacity/store";

export type ImageFacts = Omit<CreativeFile, "bytes"> & { animated: boolean };

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function ascii(bytes: Uint8Array, at: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(at, at + length));
}

function u32be(bytes: Uint8Array, at: number): number {
  return ((bytes[at] ?? 0) * 0x1000000) + (((bytes[at + 1] ?? 0) << 16) | ((bytes[at + 2] ?? 0) << 8) | (bytes[at + 3] ?? 0));
}

function u16be(bytes: Uint8Array, at: number): number {
  return ((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0);
}

function u16le(bytes: Uint8Array, at: number): number {
  return (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
}

function u24le(bytes: Uint8Array, at: number): number {
  return (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8) | ((bytes[at + 2] ?? 0) << 16);
}

function png(bytes: Uint8Array): ImageFacts | null {
  if (!PNG.every((value, index) => bytes[index] === value) || ascii(bytes, 12, 4) !== "IHDR") return null;
  let animated = false;
  for (let at = 8; at + 8 <= bytes.length; ) {
    const type = ascii(bytes, at + 4, 4);
    if (type === "acTL") animated = true;
    if (type === "IDAT" || type === "IEND") break;
    at += 12 + u32be(bytes, at);
  }
  return { format: "png", width: u32be(bytes, 16), height: u32be(bytes, 20), animated };
}

/** Start-of-frame markers carry the size; C4, C8 and CC are other tables. */
function isFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

function jpeg(bytes: Uint8Array): ImageFacts | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  for (let at = 2; at + 9 <= bytes.length; ) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1] ?? 0;
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    if (isFrame(marker)) return { format: "jpeg", width: u16be(bytes, at + 7), height: u16be(bytes, at + 5), animated: false };
    at += 2 + u16be(bytes, at + 2);
  }
  return null;
}

function webp(bytes: Uint8Array): ImageFacts | null {
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return null;
  const chunk = ascii(bytes, 12, 4);
  switch (chunk) {
    case "VP8 ":
      return { format: "webp", width: u16le(bytes, 26) & 0x3fff, height: u16le(bytes, 28) & 0x3fff, animated: false };
    case "VP8L": {
      const bits = u24le(bytes, 21) | (((bytes[24] ?? 0) & 0x0f) << 24);
      return { format: "webp", width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, animated: false };
    }
    case "VP8X":
      return { format: "webp", width: u24le(bytes, 24) + 1, height: u24le(bytes, 27) + 1, animated: ((bytes[20] ?? 0) & 0x02) !== 0 };
    default:
      return null;
  }
}

/** The image's format, pixel size and whether it moves, or null when it is none of the three formats. */
export function imageFacts(bytes: Uint8Array): ImageFacts | null {
  return png(bytes) ?? jpeg(bytes) ?? webp(bytes);
}
