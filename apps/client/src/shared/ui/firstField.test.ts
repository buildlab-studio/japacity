// The first field to fill on a screen takes the focus as it opens, unless a sheet stands over it (account:username-typed-and-checked,
// prologue:front-door-builds-a-person).
import { afterEach, describe, expect, test } from "vitest";

import { focusFirstField } from "./firstField";

afterEach(() => {
  document.body.replaceChildren();
});

function field(): HTMLInputElement {
  const input = document.createElement("input");
  document.body.append(input);
  return input;
}

describe("the first field's focus", () => {
  test("[account:username-typed-and-checked] given a screen with no sheet over it, when it opens, then its first field takes the focus", () => {
    const input = field();
    focusFirstField(input);
    expect(document.activeElement).toBe(input);
  });

  test("[account:username-typed-and-checked] given a sheet standing over the screen, when the screen opens, then the sheet keeps its focus", () => {
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

  test("[account:username-typed-and-checked] given the field inside the sheet itself, when it opens, then the field takes the focus", () => {
    const sheet = document.createElement("div");
    sheet.setAttribute("role", "dialog");
    const input = document.createElement("input");
    sheet.append(input);
    document.body.append(sheet);
    focusFirstField(input);
    expect(document.activeElement).toBe(input);
  });
});
