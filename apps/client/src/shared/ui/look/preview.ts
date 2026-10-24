// The look preview's switch (development only): `?look` on the address opens the page of primitives in place of the
// game; a build for players never does.

export function lookAsked(search: string, dev: boolean = import.meta.env.DEV): boolean {
  return import.meta.env.DEV && dev && new URLSearchParams(search).has("look");
}
