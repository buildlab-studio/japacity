// Images and a reviewed campaign for the advert tests. The images are only
// their headers and padding: the server reads the header, never the pixels.

function u32be(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function chunk(type: string, data: number[]): number[] {
  return [...u32be(data.length), ...[...type].map((char) => char.charCodeAt(0)), ...data, 0, 0, 0, 0];
}

const PNG_BASE = 69;

/** A PNG header of the given size, padded to exactly `bytes` bytes (at least 69). */
export function pngOf(width: number, height: number, bytes = 1000, animated = false): Uint8Array {
  const head = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk("IHDR", [...u32be(width), ...u32be(height), 8, 6, 0, 0, 0])];
  const moving = animated ? chunk("acTL", [0, 0, 0, 2, 0, 0, 0, 0]) : [];
  const padding = bytes - PNG_BASE - moving.length;
  if (padding < 0) throw new Error(`A test PNG is at least ${String(PNG_BASE + moving.length)} bytes.`);
  return Uint8Array.from([...head, ...moving, ...chunk("pADd", new Array<number>(padding).fill(0)), ...chunk("IDAT", []), ...chunk("IEND", [])]);
}

/** A baseline JPEG header of the given size. */
export function jpegOf(width: number, height: number): Uint8Array {
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, height >>> 8, height & 0xff, width >>> 8, width & 0xff, 1, 1, 0x11, 0, 0xff, 0xd9]);
}

function riff(chunkType: string, data: number[]): Uint8Array {
  const body = [..."WEBP"].map((char) => char.charCodeAt(0)).concat([...chunkType].map((char) => char.charCodeAt(0)), [data.length & 0xff, (data.length >>> 8) & 0xff, 0, 0], data);
  return Uint8Array.from([..."RIFF"].map((char) => char.charCodeAt(0)).concat([body.length & 0xff, (body.length >>> 8) & 0xff, 0, 0], body));
}

/** A WebP header of the given size: lossy, lossless, or extended and maybe animated. */
export function webpOf(width: number, height: number, kind: "lossy" | "lossless" | "extended" = "lossy", animated = false): Uint8Array {
  switch (kind) {
    case "lossy":
      return riff("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, width & 0xff, (width >>> 8) & 0x3f, height & 0xff, (height >>> 8) & 0x3f]);
    case "lossless": {
      const bits = (width - 1) | ((height - 1) << 14);
      return riff("VP8L", [0x2f, bits & 0xff, (bits >>> 8) & 0xff, (bits >>> 16) & 0xff, (bits >>> 24) & 0x0f]);
    }
    case "extended":
      return riff("VP8X", [animated ? 0x02 : 0, 0, 0, 0, (width - 1) & 0xff, ((width - 1) >>> 8) & 0xff, ((width - 1) >>> 16) & 0xff, (height - 1) & 0xff, ((height - 1) >>> 8) & 0xff, ((height - 1) >>> 16) & 0xff]);
    default: {
      const never: never = kind;
      throw new Error(`Unknown WebP kind ${String(never)}.`);
    }
  }
}

export function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
