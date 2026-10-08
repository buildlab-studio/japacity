// The interface theme (docs/rules/world.md R-WORLD-021): one attribute on <html> switches every
// role token in index.css. Remembered on the device; a private window keeps it for the visit only.
import { type Theme, THEME_KEY } from "./contract";

export const THEMES: readonly Theme[] = ["adire", "danfo"];

function isTheme(value: unknown): value is Theme {
  return value === "adire" || value === "danfo";
}

export function currentTheme(root: Pick<HTMLElement, "dataset"> = document.documentElement): Theme {
  const set = root.dataset.ui;
  return isTheme(set) ? set : "adire";
}

export function setTheme(theme: Theme, root: Pick<HTMLElement, "dataset"> = document.documentElement, storage: Pick<Storage, "setItem"> | null = safeStorage()): void {
  if (theme === "adire") delete root.dataset.ui;
  else root.dataset.ui = theme;
  try {
    storage?.setItem(THEME_KEY, theme);
  } catch {
    // Storage may be shut; the theme still holds for this visit.
  }
}

/** The theme this device chose last time, applied before the first frame. */
export function restoreTheme(root: Pick<HTMLElement, "dataset"> = document.documentElement, storage: Pick<Storage, "getItem"> | null = safeStorage()): Theme {
  const kept = readKept(storage);
  const theme = isTheme(kept) ? kept : "adire";
  if (theme === "adire") delete root.dataset.ui;
  else root.dataset.ui = theme;
  return theme;
}

function readKept(storage: Pick<Storage, "getItem"> | null): string | null {
  try {
    return storage?.getItem(THEME_KEY) ?? null;
  } catch {
    return null;
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
