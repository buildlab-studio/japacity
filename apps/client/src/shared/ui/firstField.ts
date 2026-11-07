// The first field to fill on a screen takes the focus as the screen opens, so the caret shows where to type
// (prologue:front-door-builds-a-person, account:username-typed-and-checked). A sheet standing over the screen keeps its own focus: the
// field waits under it. The page does not scroll for it, so the screen opens at its top.

/** The mark a first field carries, so a screen that would focus its heading leaves the focus in the field. */
export const FIRST_FIELD = "data-first-field";

/** A dialog that stands over `field` rather than holding it. */
function sheetOver(field: HTMLElement): boolean {
  return [...document.querySelectorAll<HTMLElement>("[role='dialog'], [role='alertdialog']")].some((sheet) => !sheet.contains(field));
}

/** Focuses `field` as its screen opens, unless a sheet stands over it; `reveal` also brings it to the middle of the view. */
export function focusFirstField(field: HTMLElement | null, reveal = false): void {
  if (field === null || !field.isConnected || sheetOver(field)) return;
  field.focus({ preventScroll: true });
  if (reveal && typeof field.scrollIntoView === "function") field.scrollIntoView({ block: "center" });
}
