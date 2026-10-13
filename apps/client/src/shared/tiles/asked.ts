// Apart from the contact sheet, so the boot can ask without pulling the sheet into the first chunk.

/** Whether the address asks for the contact sheet of every tile (development only). */
export function tilesAsked(search: string): boolean {
  return import.meta.env.DEV && new URLSearchParams(search).has("tiles");
}
