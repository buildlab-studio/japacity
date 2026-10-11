import type { ReportLine } from "@japacity/sim";
import { time } from "@japacity/sim";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore, type GameStore } from "../../authority/store";
import { engineView, fakeAuthority } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { isGoodMoment, mayAsk } from "./ask";
import type { DeviceSubscription, NotifyApi, NotifyDevice, NotifyStatus, Permission } from "./notify.api";
import { httpNotifyApi } from "./notify.api";
import { NotifyAsk } from "./NotifyAsk";
import { NotifySetting } from "./NotifySetting";

const REASK_DAYS = 14;
const START = Date.UTC(2026, 9, 10, 9, 0, 0);
const KEY = "BAAA";

function line(tone: ReportLine["tone"], over: Partial<ReportLine> = {}): ReportLine {
  return { key: "line.wallet.salary", params: {}, tone, attention: false, counts: [], ...over };
}

const SALARY = line("good", { big: true });

function fakeServer(over: Partial<NotifyStatus> = {}) {
  const calls: string[] = [];
  const subscribed: DeviceSubscription[] = [];
  let status: NotifyStatus = { on: false, reaskDays: REASK_DAYS, key: KEY, ...over };
  const api: NotifyApi = {
    status: () => (calls.push("status"), Promise.resolve(status)),
    subscribe: (subscription) => {
      subscribed.push(subscription);
      status = { ...status, on: true };
      return Promise.resolve(true);
    },
    turnOff: () => {
      calls.push("turnOff");
      status = { ...status, on: false };
      return Promise.resolve(true);
    },
  };
  return { api, calls, subscribed };
}

const DEVICE: DeviceSubscription = { endpoint: "https://push.example.test/a", keys: { p256dh: "p", auth: "a" } };

function fakeDevice(permission: Permission = "default", answer: Permission = "granted") {
  const state = { permission, now: START, dismissedAt: null as number | null, asked: 0, unsubscribed: 0 };
  const device: NotifyDevice = {
    permission: () => state.permission,
    requestPermission: () => {
      state.asked += 1;
      state.permission = answer;
      return Promise.resolve(answer);
    },
    subscribe: (key) => Promise.resolve(key === KEY ? DEVICE : null),
    unsubscribe: () => {
      state.unsubscribed += 1;
      return Promise.resolve();
    },
    dismissedAt: () => state.dismissedAt,
    dismiss: (at) => {
      state.dismissedAt = at;
    },
    now: () => state.now,
  };
  return { device, state };
}

/** `storeWin`: the store's own early-win flag, which the ask reads when no `earlyWin` is handed in. */
async function askScreen(options: { lines?: ReportLine[]; device?: NotifyDevice; api?: NotifyApi; earlyWin?: () => boolean; storeWin?: boolean } = {}) {
  const store: GameStore = createGameStore(fakeAuthority(engineView()));
  await store.getState().refresh();
  store.setState({ earlyWin: options.storeWin ?? true });
  if (options.lines !== undefined) store.setState({ lines: options.lines });
  const counted: string[] = [];
  render(
    <GameProvider store={store}>
      <NotifyAsk
        api={options.api ?? fakeServer().api}
        device={options.device ?? fakeDevice().device}
        {...(options.earlyWin === undefined ? {} : { earlyWin: options.earlyWin })}
        count={(name, ask, when) => counted.push(`${name}:${ask}:${when}`)}
      />
    </GameProvider>,
  );
  return { store, counted };
}

/** A command's reply with these lines, its moments shown and closed. */
async function moment(store: GameStore, lines: ReportLine[]) {
  await act(async () => {
    store.setState({ lines, moments: lines.filter((each) => each.big === true) });
    await Promise.resolve();
  });
  await act(async () => {
    store.setState({ moments: [] });
    await Promise.resolve();
  });
}

const askTitle = () => screen.queryByText(say("ui.notify.ask.title"));

describe("when the notice may be asked for", () => {
  test("[R-CLOCK-031] given good lines that are big or ask for attention, and plain, bad or quiet good ones, when they are read, then only the first are a good moment", () => {
    expect(isGoodMoment([line("plain"), SALARY])).toBe(true);
    expect(isGoodMoment([line("good", { attention: true })])).toBe(true);
    expect(isGoodMoment([line("good"), line("bad", { big: true }), line("plain", { attention: true })])).toBe(false);
    expect(isGoodMoment([])).toBe(false);
  });

  test("[R-CLOCK-031] given a dismissal, when the ask is weighed one ms and one day short of reaskDays and at it, then only at it may it come again", () => {
    const terms = { permission: "default" as const, key: KEY, dismissedAt: START, reaskDays: REASK_DAYS };
    expect(mayAsk({ ...terms, now: START + REASK_DAYS * time.DAY_MS - time.DAY_MS })).toBe(false);
    expect(mayAsk({ ...terms, now: START + REASK_DAYS * time.DAY_MS - 1 })).toBe(false);
    expect(mayAsk({ ...terms, now: START + REASK_DAYS * time.DAY_MS })).toBe(true);
    expect(mayAsk({ ...terms, dismissedAt: null, now: START })).toBe(true);
  });

  test("[R-CLOCK-031] given the browser's refusal, a browser without notices, or a deployment with no key, when the ask is weighed, then it never comes", () => {
    const terms = { key: KEY, dismissedAt: null, now: START, reaskDays: REASK_DAYS };
    expect(mayAsk({ ...terms, permission: "denied" })).toBe(false);
    expect(mayAsk({ ...terms, permission: "unsupported" })).toBe(false);
    expect(mayAsk({ ...terms, permission: "granted" })).toBe(false);
    expect(mayAsk({ ...terms, permission: "default", key: null })).toBe(false);
  });
});

describe("the ask", () => {
  test("[R-CLOCK-031] given a big good line already held when the screen loads, when nothing else happens, then nothing is asked", async () => {
    const server = fakeServer();
    await askScreen({ lines: [SALARY], api: server.api });
    await act(() => Promise.resolve());

    expect(askTitle()).toBeNull();
    expect(server.calls).toEqual([]);
  });

  test("[R-CLOCK-031] given a big good line, when its moment is on screen and then closed, then the ask comes only after it, once, and is counted as after the early win", async () => {
    const { store, counted } = await askScreen();
    await act(async () => {
      store.setState({ lines: [SALARY], moments: [SALARY] });
      await Promise.resolve();
    });
    expect(askTitle()).toBeNull();

    await act(async () => {
      store.setState({ moments: [] });
      await Promise.resolve();
    });
    await waitFor(() => expect(askTitle()).not.toBeNull());
    expect(counted).toEqual(["ask/shown:notify:after"]);
  });

  test("[R-CLOCK-031] given plain and bad lines, when their month closes, then nothing is asked", async () => {
    const server = fakeServer();
    const { store } = await askScreen({ api: server.api });
    await moment(store, [line("plain"), line("bad", { big: true })]);

    expect(askTitle()).toBeNull();
    expect(server.calls).toEqual([]);
  });

  test("[R-GUIDE-015] given a good moment before the early win, when it closes, then nothing is asked", async () => {
    const server = fakeServer();
    const { store } = await askScreen({ api: server.api, earlyWin: () => false });
    await moment(store, [SALARY]);

    expect(askTitle()).toBeNull();
    expect(server.calls).toEqual([]);
  });

  test("[R-GUIDE-015] given the store's early-win flag not yet set, when a good moment closes, then nothing is asked; once the flag is set, the next good moment asks", async () => {
    const server = fakeServer();
    const { store } = await askScreen({ api: server.api, storeWin: false });
    await moment(store, [SALARY]);
    expect(askTitle()).toBeNull();
    act(() => store.setState({ earlyWin: true }));
    await moment(store, [{ ...SALARY }]);
    await waitFor(() => expect(askTitle()).not.toBeNull());
  });

  test("[R-CLOCK-031] given the ask, when the player says not now, then it is kept on the device and the next good moment one day short of reaskDays asks nothing, and the one at reaskDays asks again", async () => {
    const { device, state } = fakeDevice();
    const { store } = await askScreen({ device });
    await moment(store, [SALARY]);
    await waitFor(() => expect(askTitle()).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: say("ui.notify.ask.no") }));
    expect(state.dismissedAt).toBe(START);

    state.now = START + (REASK_DAYS - 1) * time.DAY_MS;
    await moment(store, [line("good", { big: true, key: "line.chapter.done" })]);
    await act(() => Promise.resolve());
    expect(askTitle()).toBeNull();

    state.now = START + REASK_DAYS * time.DAY_MS;
    await moment(store, [line("good", { attention: true, key: "line.goal.met" })]);
    await waitFor(() => expect(askTitle()).not.toBeNull());
  });

  test("[R-CLOCK-031] given the ask, when the player agrees and the browser allows it, then this device is kept on the server and the yes is counted", async () => {
    const server = fakeServer();
    const { device, state } = fakeDevice();
    const { store, counted } = await askScreen({ api: server.api, device });
    await moment(store, [SALARY]);
    await waitFor(() => expect(askTitle()).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: say("ui.notify.ask.yes") }));

    await waitFor(() => expect(server.subscribed).toEqual([DEVICE]));
    expect(state.asked).toBe(1);
    expect(counted).toEqual(["ask/shown:notify:after", "ask/accepted:notify:after"]);
    await waitFor(() => expect(askTitle()).toBeNull());
  });

  test("[R-CLOCK-031] given the ask, when the player agrees and the browser refuses, then nothing is kept and no later good moment asks again", async () => {
    const server = fakeServer();
    const { device, state } = fakeDevice("default", "denied");
    const { store } = await askScreen({ api: server.api, device });
    await moment(store, [SALARY]);
    await waitFor(() => expect(askTitle()).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: say("ui.notify.ask.yes") }));
    await waitFor(() => expect(askTitle()).toBeNull());
    expect(server.subscribed).toEqual([]);
    expect(state.dismissedAt).toBeNull();

    state.now = START + 10 * REASK_DAYS * time.DAY_MS;
    await moment(store, [SALARY]);
    await act(() => Promise.resolve());
    expect(askTitle()).toBeNull();
  });
});

describe("the setting", () => {
  test("[R-CLOCK-031] given the setting off, when the player turns it on and then off, then this device is kept and then every device is forgotten", async () => {
    const server = fakeServer();
    const { device, state } = fakeDevice();
    render(<NotifySetting api={server.api} device={device} />);
    const toggle = await screen.findByRole<HTMLInputElement>("switch", { name: say("ui.notify.setting") });
    expect(toggle.checked).toBe(false);

    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.checked).toBe(true));
    expect(server.subscribed).toEqual([DEVICE]);

    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.checked).toBe(false));
    expect(server.calls).toContain("turnOff");
    expect(state.unsubscribed).toBe(1);
  });

  test("[R-CLOCK-031] given a browser that refused, when the setting shows, then it cannot be turned on and says why", async () => {
    const { device } = fakeDevice("denied");
    render(<NotifySetting api={fakeServer().api} device={device} />);

    expect((await screen.findByRole<HTMLInputElement>("switch", { name: say("ui.notify.setting") })).disabled).toBe(true);
    expect(screen.getByText(say("ui.notify.blocked"))).not.toBeNull();
  });

  test("[R-CLOCK-031] given a deployment with no key, or no server, when the settings open, then the switch is not shown", async () => {
    const server = fakeServer({ key: null });
    render(<NotifySetting api={server.api} device={fakeDevice().device} />);
    await waitFor(() => expect(server.calls).toEqual(["status"]));
    expect(screen.queryByRole("switch")).toBeNull();

    render(<NotifySetting api={null} device={fakeDevice().device} />);
    expect(screen.queryByRole("switch")).toBeNull();
  });
});

describe("the notice's routes from the client", () => {
  test("[R-CLOCK-031] given the server, when the status, a device and the setting off are sent, then each goes to its route with the session", async () => {
    const asked: { url: string; init?: RequestInit }[] = [];
    const answers: Record<string, unknown> = {
      "GET https://api.example.test/api/notify": { ok: true, on: true, reaskDays: REASK_DAYS },
      "GET https://api.example.test/api/notify/key": { ok: true, key: KEY },
      "POST https://api.example.test/api/notify/subscribe": { ok: true, on: true, reaskDays: REASK_DAYS },
      "PUT https://api.example.test/api/notify": { ok: false, code: "signed-out", detail: "Sign in first." },
    };
    const api = httpNotifyApi("https://api.example.test/", (url, init) => {
      asked.push({ url, ...(init === undefined ? {} : { init }) });
      return Promise.resolve(new Response(JSON.stringify(answers[`${init?.method ?? "GET"} ${url}`])));
    });

    expect(await api.status()).toEqual({ on: true, reaskDays: REASK_DAYS, key: KEY });
    expect(await api.subscribe(DEVICE)).toBe(true);
    expect(await api.turnOff()).toBe(false);
    // R-ENGINE-015: every call goes through the one request function, same-origin.
    expect(asked.every((each) => each.init?.credentials === "same-origin")).toBe(true);
    expect(JSON.parse(asked.at(-2)?.init?.body as string)).toEqual({ subscription: DEVICE });
  });
});
