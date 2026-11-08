// Where the guest's "Not saved" chip stands (account:guest-secures-the-life, account:guest-reminded-to-secure, world:top-band-is-a-pill):
// hung under the band over the world, and never on the years or the handover's page.
import type { AccountView } from "@japacity/api";
import { content } from "@japacity/content";
import type { PlayerView, ReportLine } from "@japacity/sim";
import { start } from "@japacity/sim/testing";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import Life from "./Life";
import { GameProvider } from "../authority/GameProvider";
import { createGameStore } from "../authority/store";
import { codeAccount } from "../features/account/code.testing";
import { PROLOGUE_CLOSED } from "../features/prologue/PrologueView";
import { accountView, engineView } from "../shared/testing/fixtures";
import { say } from "../shared/words/text";
// Registers Testing Library's cleanup for this file.
import "../shared/testing/render";

/** A guest's account, read as `state`. */
function guest(state: AccountView["state"] = "guest") {
  const view = accountView({ id: `account-life-${state}`, state });
  return codeAccount({ view: () => Promise.resolve(view), passkeysWork: () => Promise.resolve(false) });
}

async function life(view: PlayerView, lines: ReportLine[] = [], state: AccountView["state"] = "guest"): Promise<void> {
  const store = createGameStore({ view: () => Promise.resolve(view), send: () => Promise.reject(new Error("unused")) }, { account: guest(state) });
  await store.getState().refresh();
  store.setState({ lines });
  render(
    <GameProvider store={store}>
      <Life handedOver={null} onHandedOver={() => undefined} />
    </GameProvider>,
  );
}

/** A life past its years, in the world. */
function inTheWorld(): PlayerView {
  return start({ scenario: "scenario.banker", content }).view();
}

const chip = () => screen.queryByRole("button", { name: say("ui.guest.chip") });

describe("the chip over the world", () => {
  test("[account:guest-reminded-to-secure] [world:top-band-is-a-pill] given a guest's life in the world, then the Not saved chip hangs in the band", async () => {
    const view = inTheWorld();
    expect(view.prologue).toBeNull();
    await life(view);
    await waitFor(() => expect(chip()).not.toBeNull());
    expect(chip()?.closest("[data-band]")).not.toBeNull();
  });

  test("[account:guest-secures-the-life] given a guest's life in its years, or at the handover's page, then no chip stands", async () => {
    const years = engineView("scenario.prologue");
    expect(years.prologue).not.toBeNull();
    await life(years);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(chip()).toBeNull();
    cleanup();
    await life(inTheWorld(), [{ key: PROLOGUE_CLOSED, tone: "plain", params: {}, attention: false, counts: [] }]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(document.querySelector("[data-band]")).toBeNull();
    expect(chip()).toBeNull();
  });

  test("[account:guest-reminded-to-secure] given a secured account's life in the world, then the band carries no chip", async () => {
    await life(inTheWorld(), [], "secured");
    await waitFor(() => expect(document.querySelector("[data-band]")).not.toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(chip()).toBeNull();
  });
});
