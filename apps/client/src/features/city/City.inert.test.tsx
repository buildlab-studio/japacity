// world:reach-and-read: under an open sheet, the phone or the map the scene behind is inert: no Tab stop and no tap, the band and
// the thumbs with it. The scene itself needs WebGL and is not drawn here; its box is.
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";

import { type BackStack, createBack, useBackLayer } from "../../shared/back/back";
import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { City } from "./City";
import { cityWords } from "./city.words";

let stack: BackStack;

beforeEach(() => {
  history.replaceState(null, "", "/");
  stack = createBack(window);
});

afterEach(() => stack.dispose());

/** A phone that covers the scene while it stands, as the real one does. */
function Covering() {
  useBackLayer(true, () => undefined, { cover: true });
  return <p data-phone-stand-in />;
}

const inert = (selector: string) => document.querySelector(selector)?.closest("[inert]") !== null && document.querySelector(selector) !== null;

test("[world:reach-and-read] given the world, when the phone opens over it, then the scene, the band and the thumbs are inert, and not before", async () => {
  await renderWithView(<City world results={() => null} phone={() => <Covering />} />, engineView());
  const go = document.querySelector<HTMLElement>("[data-opening-go]");
  if (go !== null) fireEvent.click(go);
  const mapClose = screen.queryByRole("button", { name: cityWords("city.close") });
  if (mapClose !== null) fireEvent.click(mapClose);
  await waitFor(() => expect(document.querySelector("[data-thumb-bar]")).not.toBeNull());
  expect(inert("[data-city]")).toBe(false);
  expect(inert("[data-thumb-bar]")).toBe(false);
  fireEvent.click(document.querySelector<HTMLElement>('[data-thumb="phone"]')!);
  await waitFor(() => expect(document.querySelector("[data-phone-stand-in]")).not.toBeNull());
  await waitFor(() => expect(inert("[data-city]")).toBe(true));
  expect(inert("[data-thumb-bar]")).toBe(true);
  expect(inert("[data-band]")).toBe(true);
  expect(document.querySelector("[data-phone-stand-in]")?.closest("[inert]")).toBeNull();
});
