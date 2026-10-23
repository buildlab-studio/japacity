// world:back-closes-topmost on the phone: Back and Escape close an app's inner screen, then the app, then the phone, one at a
// time; the phone's own Back arrow takes its entry off, so the browser's Back never steps through what is already closed.
import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { type BackStack, createBack } from "../../shared/back/back";
import { richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { resetLines } from "../../shared/world/Lines";
import { reloadSeen } from "./seen";
import { PhoneApps } from "./PhoneApps";

const NOON = () => new Date(2026, 9, 8, 12, 5);
let stack: BackStack;

beforeEach(() => {
  resetLines();
  localStorage.clear();
  reloadSeen();
  history.replaceState(null, "", "/");
  stack = createBack(window);
});

afterEach(() => stack.dispose());

function depth(): number {
  const value = (history.state as Record<string, unknown> | null)?.japacityBack;
  return typeof value === "number" ? value : 0;
}

async function openPhone(onClose: () => void) {
  return renderWithView(<PhoneApps onClose={onClose} area="Ojuelegba" now={NOON} talk={null} />, richView());
}

const has = (selector: string) => document.querySelector(selector) !== null;

function tap(selector: string): void {
  const found = document.querySelector<HTMLElement>(selector);
  if (found === null) throw new Error(`Nothing at ${selector}.`);
  fireEvent.click(found);
}

describe("the phone and Back", () => {
  test("[world:back-closes-topmost] given the phone on a Chats thread, when Back is pressed three times, then the thread closes, then the app, then the phone, one at a time", async () => {
    const onClose = vi.fn();
    await openPhone(onClose);
    await waitFor(() => expect(depth()).toBe(1));
    tap('[data-app="chats"]');
    tap('[data-chat-row="family"]');
    await waitFor(() => expect(depth()).toBe(3));
    act(() => history.back());
    await waitFor(() => expect(has('[data-chat-row="family"]')).toBe(true));
    expect(has('[data-app-screen="chats"]')).toBe(true);
    act(() => history.back());
    await waitFor(() => expect(has('[data-app-screen="chats"]')).toBe(false));
    expect(has("[data-phone-home]")).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    act(() => history.back());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test("[world:back-closes-topmost] given the phone on an app, when Escape is pressed twice, then the app closes and then the phone", async () => {
    const onClose = vi.fn();
    await openPhone(onClose);
    tap('[data-app="bank"]');
    await waitFor(() => expect(depth()).toBe(2));
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(has('[data-app-screen="bank"]')).toBe(false));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test("[world:back-closes-topmost] given the phone on an app, when its own Back arrow is tapped, then the app's entry is taken off and the browser's Back closes the phone", async () => {
    const onClose = vi.fn();
    await openPhone(onClose);
    tap('[data-app="bank"]');
    await waitFor(() => expect(depth()).toBe(2));
    tap("[data-phone-back]");
    await waitFor(() => expect(depth()).toBe(1));
    act(() => history.back());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
