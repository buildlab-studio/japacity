// Where the guide pages are served: under /guides/, beside the game at /.
export const GUIDES_ROOT = "/guides/";
export const MADE_PATH = "/guides/how-this-game-was-made/";
export const NUMBERS_PATH = "/guides/numbers/";

export function guidePath(id: string): string {
  return `${GUIDES_ROOT}${id.replace(/^guide\./, "")}/`;
}

export function numbersPath(page: string): string {
  return `${NUMBERS_PATH}${page}/`;
}
