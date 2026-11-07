// The first field to fill on a screen takes the focus as the screen opens on a desktop, so the caret shows where to type
// (prologue:front-door-builds-a-person, account:username-typed-and-checked, account:code-form-forgives). On a touch phone
// the opening moves no focus: a focus there raises the keyboard by itself on Android's browsers and covers the screen, so the
// field stands out by its label and its placeholder alone. A desktop is a fine pointer that hovers, read as the screen
// opens, never the layout's width: a narrow desktop window still focuses, a tablet does not. After the player's own act
// was refused (a Begin, a code, a form's submit) the field the reason is under takes the focus on every device. A sheet
// standing over the screen keeps its own focus: the field waits under it. The page does not scroll for an opening, so the
// screen opens at its top.

/** The mark a first field carries, so a screen that would focus its heading leaves the focus in the field. */
export const FIRST_FIELD = "data-first-field";

/** A desktop's pointer: fine, and it hovers. */
export const FINE_POINTER = "(hover: hover) and (pointer: fine)";

/** Whether the screen opens on a desktop, by its pointer. */
function onDesktop(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(FINE_POINTER).matches;
}

/** A dialog that stands over `field` rather than holding it. */
function sheetOver(field: HTMLElement): boolean {
  return [...document.querySelectorAll<HTMLElement>("[role='dialog'], [role='alertdialog']")].some((sheet) => !sheet.contains(field));
}

/**
 * Focuses `field` as its screen opens, on a desktop only, unless a sheet stands over it. `refused`: the screen opens after the
 * player's own act was refused for this field, so it takes the focus on every device and comes to the middle of the view.
 */
export function focusFirstField(field: HTMLElement | null, refused = false): void {
  if (field === null || !field.isConnected || sheetOver(field)) return;
  if (!refused && !onDesktop()) return;
  field.focus({ preventScroll: true });
  if (refused && typeof field.scrollIntoView === "function") field.scrollIntoView({ block: "center" });
}
