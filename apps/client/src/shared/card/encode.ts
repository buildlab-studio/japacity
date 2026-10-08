// The size check every drawn card passes before it may travel (docs/rules/share.md
// R-SHARE-009, R-SHARE-010): the image is encoded at falling qualities until it
// is under the limit, and refused when even the lowest is not.

/** JPEG qualities tried in turn, in hundredths. */
export const QUALITIES = [86, 78, 70, 62, 54, 46] as const;

export type Encoded = { ok: true; blob: Blob; quality: number } | { ok: false; reason: "too-big" | "no-image"; bytes: number };

/** "under" the limit is strictly under, so a file of exactly `maxBytes` is refused. */
export function underLimit(bytes: number, maxBytes: number): boolean {
  return bytes < maxBytes;
}

/** Encodes with `encode` at each quality until the file is under `maxBytes`. */
export async function encodeUnder(encode: (quality: number) => Promise<Blob | null>, maxBytes: number): Promise<Encoded> {
  let bytes = 0;
  for (const quality of QUALITIES) {
    const blob = await encode(quality);
    if (blob === null) return { ok: false, reason: "no-image", bytes: 0 };
    if (underLimit(blob.size, maxBytes)) return { ok: true, blob, quality };
    bytes = blob.size;
  }
  return { ok: false, reason: "too-big", bytes };
}
