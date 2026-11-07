// The first field to fill on a screen takes the focus as it opens on a desktop and never on a touch phone; after a refusal
// it takes it on both; a sheet over the screen keeps its own (account:username-typed-and-checked, prologue:front-door-builds-a-person).
import { afterEach, describe, expect, test, vi } from "vitest";

import { stubPointer } from "../testing/pointer";
import { focusFirstField } from "./firstField";

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

function field(): HTMLInputElement {
  const input = document.createElement("input");
  document.body.append(input);
  return input;
}

describe("the first field's focus", () => {
  test("[account:username-typed-and-checked] given a desktop's fine pointer and no sheet over the screen, when it opens, then its first field takes the focus", () => {
    stubPointer("fine");
    const input = field();
    focusFirstField(input);
    expect(document.activeElement).toBe(input);
  });

  test("[account:username-typed-and-checked] given a touch phone's coarse pointer, when the screen opens, then no focus moves, so no keyboard rises by itself", () => {
    stubPointer("coarse");
    const input = field();
    focusFirstField(input);
    expect(document.activeElement).toBe(document.body);
  });

  test("[account:username-typed-and-checked] given no pointer the page can read, when the screen opens, then no focus moves", () => {
    const input = field();
    focusFirstField(input);
    expect(document.activeElement).toBe(document.body);
  });

  test("[account:username-typed-and-checked] given a touch phone, when the screen opens after the player's act was refused for the field, then the field takes the focus and comes into view", () => {
    stubPointer("coarse");
    const input = field();
    const shown = vi.fn();
    input.scrollIntoView = shown;
    focusFirstField(input, true);
    expect(document.activeElement).toBe(input);
    expect(shown).toHaveBeenCalledWith({ block: "center" });
  });

  test("[account:username-typed-and-checked] given a desktop, when the screen opens after a refusal, then the field takes the focus and comes into view", () => {
    stubPointer("fine");
    const input = field();
    const shown = vi.fn();
    input.scrollIntoView = shown;
    focusFirstField(input, true);
    expect(document.activeElement).toBe(input);
    expect(shown).toHaveBeenCalledWith({ block: "center" });
  });

  test("[account:username-typed-and-checked] given a desktop and a sheet standing over the screen, when the screen opens, then the sheet keeps its focus", () => {
    stubPointer("fine");
    const input = field();
    const sheet = document.createElement("div");
    sheet.setAttribute("role", "dialog");
    const button = document.createElement("button");
    sheet.append(button);
    document.body.append(sheet);
    button.focus();
    focusFirstField(input);
    expect(document.activeElement).toBe(button);
  });

  test("[account:username-typed-and-checked] given a desktop and the field inside the sheet itself, when it opens, then the field takes the focus", () => {
    stubPointer("fine");
    const sheet = document.createElement("div");
    sheet.setAttribute("role", "dialog");
    const input = document.createElement("input");
    sheet.append(input);
    document.body.append(sheet);
    focusFirstField(input);
    expect(document.activeElement).toBe(input);
  });
});
