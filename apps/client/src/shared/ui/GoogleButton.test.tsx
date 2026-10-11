// Google's sign-in button to Google's branding guidelines (docs/rules/account.md R-ACCOUNT-023, amended 11 Oct 2026;
// developers.google.com/identity/branding-guidelines, read that day): the G as Google gives it, the light and dark
// themes' colours, the sizes and the face, and only Google's own texts on it.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { say } from "../words/text";
import { GOOGLE_MARK, GoogleButton } from "./GoogleButton";

afterEach(cleanup);

const CLIENT = join(import.meta.dirname, "..", "..", "..");
const CSS = readFileSync(join(CLIENT, "src", "index.css"), "utf8");
const MARK = readFileSync(join(CLIENT, "public", GOOGLE_MARK), "utf8");
/** The texts the guidelines give the button. */
const GOOGLE_TEXTS = ["Sign in with Google", "Sign up with Google", "Continue with Google"];

function ruleOf(selector: string): string {
  const start = CSS.indexOf(`${selector} {`);
  return start < 0 ? "" : CSS.slice(start, CSS.indexOf("}", start));
}

describe("Google's own button", () => {
  test("[R-ACCOUNT-023] given the button, when it is drawn, then it holds the G at its left and the words, and a tap goes through", () => {
    const tap = vi.fn();
    render(<GoogleButton label={say("ui.secure.google")} onClick={tap} />);
    const button = screen.getByRole("button", { name: "Continue with Google" });
    expect(button.firstElementChild?.tagName).toBe("IMG");
    expect(button.firstElementChild?.getAttribute("src")).toBe(GOOGLE_MARK);
    fireEvent.click(button);
    expect(tap).toHaveBeenCalledTimes(1);
  });

  test("[R-ACCOUNT-023] given every place Google is offered, then its words are one of Google's own texts", () => {
    for (const key of ["ui.secure.google", "ui.account.google"]) expect(GOOGLE_TEXTS).toContain(say(key));
  });

  test("[R-ACCOUNT-023] given the G, then it is Google's mark from Google's assets, unchanged, in its 20 by 20 box, with no boundary of its own", () => {
    expect(MARK).toContain('viewBox="10 10 20 20"');
    // The G's own outline and the gradient of colours Google draws it with.
    expect(MARK).toContain("M29.3987 18.1814H19.9849V22.0445H25.3598");
    expect(MARK).toContain("from 90deg,rgba(255, 70, 65, 1) 0deg,rgba(255, 70, 65, 1) 4.14555deg,rgba(49, 134, 255, 1) 39.154deg");
    expect(MARK).not.toContain("M4 0.5H36");
  });

  test("[R-ACCOUNT-023] given the button's style, then it keeps the guidelines' numbers: 40 px tall, a 1 px stroke, 12 px before the G, a 20 px G, 10 px after it, Google Sans Medium 14/20, light and dark in Google's colours", () => {
    const rule = ruleOf(".google-button");
    expect(rule).toContain("min-height: 40px;");
    expect(rule).toContain("padding: 0 12px;");
    expect(rule).toContain("grid-template-columns: 20px 1fr 20px;");
    expect(rule).toContain("column-gap: 10px;");
    expect(rule).toContain("border: 1px solid var(--google-stroke);");
    expect(rule).toContain('font-family: "Google Sans"');
    expect(rule).toContain("font-size: 14px;");
    expect(rule).toContain("font-weight: 500;");
    expect(rule).toContain("line-height: 20px;");
    expect(CSS).toMatch(/:root \{[^}]*--google-fill: #ffffff;\s*--google-stroke: #747775;\s*--google-text: #1f1f1f;/);
    expect(CSS).toMatch(/:root\[data-surface="dark"\] \{[^}]*--google-fill: #131314;\s*--google-stroke: #8e918f;\s*--google-text: #e3e3e3;/);
    expect(CSS).toContain('src: url("/fonts/google-sans-500-latin.woff2") format("woff2");');
  });
});
