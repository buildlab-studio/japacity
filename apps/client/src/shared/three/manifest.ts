// The manifest of published files (city.md R-CITY-018): every shipped file under a name carrying the
// hash of its contents, written by tools/assets/publish.ts. Kept apart from the model loader so a
// screen can read a JSON file without pulling three.js into the first chunk.

/** What tools/assets/publish.ts writes: path under public/assets to path under public/published. */
export interface PublishManifest {
  files: Record<string, string>;
}

/** Where the published files are served from. */
export const PUBLISHED = `${import.meta.env.BASE_URL}published/`;

/** The URL of a shipped file by its path under public/assets, or null when it is not published. */
export function assetUrl(manifest: PublishManifest, path: string): string | null {
  const published = manifest.files[path];
  return published === undefined ? null : `${PUBLISHED}${published}`;
}

let manifestOnce: Promise<PublishManifest> | null = null;

/** The manifest, fetched once a session and always asked of the server, since it is the one name without a hash. */
export function loadManifest(fetcher: typeof fetch = fetch): Promise<PublishManifest> {
  manifestOnce ??= fetcher(`${PUBLISHED}manifest.json`, { cache: "no-cache" }).then(async (response) => {
    if (!response.ok) throw new Error(`The asset manifest could not be fetched: ${String(response.status)}`);
    return (await response.json()) as PublishManifest;
  });
  return manifestOnce;
}

/** A JSON file by its path under public/assets, or null when it is not shipped. */
export async function loadJson<T>(manifest: PublishManifest, path: string, fetcher: typeof fetch = fetch): Promise<T | null> {
  const url = assetUrl(manifest, path);
  if (url === null) return null;
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`${path} could not be fetched: ${String(response.status)}`);
  return (await response.json()) as T;
}
