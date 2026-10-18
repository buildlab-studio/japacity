// What the phone's tests share: the phone opened on one app, the commands it sent,
// the card it holds open, the bank's lately lines, and the phone held only while a life plays.
import type { Command, PlayerView } from "@japacity/sim";
import { fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";

import { useGame } from "../../authority/GameProvider";
import { renderWithView } from "../../shared/testing/render";
import { PhoneApps } from "./PhoneApps";

/** The commands sent, without the version stamp. */
export function sent(authority: { sent: Command[] }): unknown[] {
  return authority.sent.map((command) => {
    const rest: Partial<Command> = { ...command };
    delete rest.basedOn;
    return rest;
  });
}

/** The ask card the phone holds open, or a throw. */
export function askCard(): HTMLElement {
  const main = document.querySelector<HTMLElement>("[data-ask-main]");
  const dialog = main?.closest<HTMLElement>("[role='dialog']") ?? main?.parentElement?.parentElement ?? null;
  if (dialog === null) throw new Error("No card is open.");
  return dialog;
}

/** The phone over the view in `area`, on Papers. */
export async function openPapers(view: PlayerView, area = "Ojuelegba") {
  const rendered = await renderWithView(<PhoneApps onClose={() => undefined} area={area} now={() => new Date(2026, 9, 11, 12, 0)} talk={null} />, view);
  fireEvent.click(document.querySelector<HTMLElement>('[data-app="papers"]')!);
  return rendered;
}

/** The phone over the view, on Japa. */
export async function openJapa(view: PlayerView) {
  const rendered = await renderWithView(<PhoneApps onClose={() => undefined} area="Ojuelegba" now={() => new Date(2026, 9, 8, 12, 5)} talk={null} />, view);
  fireEvent.click(document.querySelector<HTMLElement>('[data-app="japa"]')!);
  return rendered;
}

/** The bank's lately lines as they read. */
export function lately(): string[] {
  return [...document.querySelectorAll("[data-money-lines] li")].map((row) => row.textContent ?? "");
}

/** The phone as the shell holds it: only while a life is playing, as WorldPlaying does. */
export function WhilePlaying({ children }: { children: ReactNode }) {
  return useGame((state) => state.view) === null ? null : children;
}
