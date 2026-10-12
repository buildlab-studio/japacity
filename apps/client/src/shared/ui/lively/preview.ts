// The lively preview's switch (development only): `?lively` on the address opens the page of primitives in place of the
// game, as `?classic` opens the old month page; a build for players never does.

export function livelyAsked(search: string, dev: boolean = import.meta.env.DEV): boolean {
  return dev && new URLSearchParams(search).has("lively");
}
