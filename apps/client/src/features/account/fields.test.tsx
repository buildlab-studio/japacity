// The account's fields each say their state the same way (world:field-says-its-state): the label, the help under it, the box, and
// directly under the box one state line; a problem in the out colour with its circle-and-mark icon and the box marked invalid and
// described by the line, a free name with the tick in money in's colour, help in the quiet ink with no icon.
import type { AccountView } from "@japacity/api";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import type { AccountApi, FreeAnswer } from "../../shared/net/auth";
import { engineView } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { loadLaterWords } from "../../shared/words/later";
import { say } from "../../shared/words/text";
import { AccountGate } from "./AccountGate";
import { pickBirth } from "./age.testing";
import { AgeScreen } from "./AgeScreen";
import { codeAccount } from "./code.testing";
import { CodeForm } from "./CodeForm";
import { AccountSettings } from "./Settings";
import { TEST_SITE_KEY, type LoadTurnstile } from "./Turnstile";

// The account sheet's words ride a chunk of their own (engine:first-download-has-budget): added before the sheet is drawn.
beforeAll(() => loadLaterWords("sheet"));

const passing: LoadTurnstile = () =>
  Promise.resolve({
    render: (_container, options) => {
      setTimeout(() => options.callback("XXXX.DUMMY.TOKEN.XXXX"), 0);
      return "widget-1";
    },
    reset: () => undefined,
    remove: () => undefined,
  });

/** `a` stands before `b` in the page. */
const before = (a: Element, b: Element): boolean => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

const classes = (line: Element): string[] => line.className.split(/\s+/);

/** A problem line: the out colour at the bold weight, the circle-and-mark icon before its words. */
function isProblem(line: Element): void {
  expect(classes(line)).toContain("text-out");
  expect(classes(line)).toContain("font-bold");
  expect(line.querySelector("svg")?.getAttribute("class")).toContain("lucide-circle-alert");
}

/** A help line: the quiet ink, never bold, no icon. */
function isHelp(line: Element): void {
  expect(classes(line)).toContain("text-text-2");
  expect(line.className).not.toMatch(/font-(bold|semibold)/);
  expect(line.querySelector("svg")).toBeNull();
}

/** The box marked invalid and described by the line. */
function marks(box: Element, line: Element): void {
  expect(box.getAttribute("aria-invalid")).toBe("true");
  expect(box.getAttribute("aria-describedby")?.split(" ")).toContain(line.id);
}

/** The state lines under a box that hold words: at most one. */
const saying = (lines: Element[]): Element[] => lines.filter((line) => (line.textContent ?? "") !== "");

describe("the username at the door (world:field-says-its-state)", () => {
  function door(answer: FreeAnswer | null, over: Partial<AccountApi> = {}) {
    const account = codeAccount({ ageStatus: () => Promise.resolve("passed"), usernameFree: () => Promise.resolve(answer), ...over });
    const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("unused")) }, { account });
    store.getState().leave(null);
    render(
      <GameProvider store={store}>
        <AccountGate load={passing} sitekey={TEST_SITE_KEY} embedded />
      </GameProvider>,
    );
  }
  const box = () => screen.getByLabelText<HTMLInputElement>(say("ui.account.name.label"));
  const help = () => document.getElementById("guest-username-help")!;
  const check = () => document.getElementById("guest-username-check")!;
  const said = () => document.getElementById("guest-username-said");

  test("[world:field-says-its-state] given one letter typed in the username box, then the line directly under the box says the shape is wrong as a problem, the box is marked, and the help on who sees it stands under the label in the quiet ink", async () => {
    door(null);
    fireEvent.change(await screen.findByLabelText(say("ui.account.name.label")), { target: { value: "a" } });
    expect(check().textContent).toBe(say("ui.account.name.format"));
    isProblem(check());
    marks(box(), check());
    expect(help().textContent).toBe(say("ui.account.name.intro"));
    isHelp(help());
    const label = document.querySelector("label[for='guest-username']")!;
    expect(before(label, help()) && before(help(), box()) && before(box(), check())).toBe(true);
    expect(box().nextElementSibling).toBe(check());
  });

  test("[world:field-says-its-state] given a name taken, then it is a problem under the box; given a free name, then the tick in money in's colour and the box unmarked", async () => {
    door("taken");
    fireEvent.change(await screen.findByLabelText(say("ui.account.name.label")), { target: { value: "ada_lagos" } });
    await waitFor(() => expect(check().textContent).toBe(say("ui.account.name.taken")));
    isProblem(check());
    marks(box(), check());
    document.body.innerHTML = "";
    door("free");
    fireEvent.change(await screen.findByLabelText(say("ui.account.name.label")), { target: { value: "ada_ikeja" } });
    await waitFor(() => expect(check().textContent).toBe(say("ui.account.name.available")));
    expect(classes(check())).toContain("text-in");
    expect(classes(check())).toContain("font-bold");
    expect(check().querySelector("svg")?.getAttribute("class")).toContain("lucide-check");
    expect(box().getAttribute("aria-invalid")).toBe("false");
  });

  test("[world:field-says-its-state] given Begin refused for the name, then its reason is the one state line under the box, a problem, with the check's line emptied", async () => {
    door("free", { startGuest: () => Promise.resolve({ ok: false, why: "taken" }) });
    fireEvent.change(await screen.findByLabelText(say("ui.account.name.label")), { target: { value: "ada_lagos" } });
    await waitFor(() => expect(check().textContent).toBe(say("ui.account.name.available")));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.name.go") }));
    await waitFor(() => expect(said()?.textContent).toBe(say("ui.account.name.taken")));
    isProblem(said()!);
    marks(box(), said()!);
    expect(saying([check(), said()!])).toEqual([said()]);
    expect(before(box(), said()!)).toBe(true);
    expect(before(said()!, document.querySelector("[data-guest-line]")!)).toBe(true);
  });
});

describe("the rename box in Settings (world:field-says-its-state)", () => {
  const SECURED: AccountView = { id: "account-1", country: "NG", age: { passed: true, method: "declared" }, createdAt: 1, character: "c-1", sendUsageCounts: true, admin: false, state: "secured", username: "ada_lagos", renameFrom: 0, ways: { google: null, email: "ada@example.com", passkeys: 0 } };

  async function rename(answer: FreeAnswer) {
    const account = codeAccount({ view: () => Promise.resolve(SECURED), usernameFree: () => Promise.resolve(answer) });
    const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("unused")) }, { account });
    await store.getState().refresh();
    render(
      <GameProvider store={store}>
        <AccountSettings account={account} />
      </GameProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.name.change") }));
    return screen.getByLabelText<HTMLInputElement>(say("ui.account.name.label"));
  }
  const check = () => document.querySelector("[data-rename-check]")!;

  test("[world:field-says-its-state] given the rename box, then the first change's line is the help over the box, and a name of the wrong shape is a problem directly under it with the box marked", async () => {
    const box = await rename("free");
    const help = screen.getByText(say("ui.account.name.free"));
    isHelp(help);
    expect(before(document.querySelector(`label[for='${box.id}']`)!, help) && before(help, box)).toBe(true);
    fireEvent.change(box, { target: { value: "ada ib" } });
    expect(check().textContent).toBe(say("ui.account.name.format"));
    isProblem(check());
    marks(box, check());
    expect(box.nextElementSibling).toBe(check());
  });

  test("[world:field-says-its-state] given a free name in the rename box, then the tick in money in's colour and the box unmarked", async () => {
    const box = await rename("free");
    fireEvent.change(box, { target: { value: "ada_ibadan" } });
    await waitFor(() => expect(check().textContent).toBe(say("ui.account.name.available")));
    expect(classes(check())).toContain("text-in");
    expect(check().querySelector("svg")?.getAttribute("class")).toContain("lucide-check");
    expect(box.getAttribute("aria-invalid")).toBe("false");
  });
});

describe("the email and the code (world:field-says-its-state)", () => {
  const slot = () => screen.getByRole("status");

  test("[world:field-says-its-state] given an address of the wrong shape, then the slot directly under the email box says so as a problem, over Send me a code, with the box marked", () => {
    render(<CodeForm account={codeAccount()} onSignedIn={() => undefined} />);
    const email = screen.getByLabelText(say("ui.account.email.label"));
    expect(email.getAttribute("aria-invalid")).toBe("false");
    fireEvent.change(email, { target: { value: "ada@example" } });
    const send = screen.getByRole("button", { name: say("ui.account.email.send") });
    fireEvent.click(send);
    expect(slot().textContent).toBe(say("ui.account.email.shape"));
    isProblem(slot());
    marks(email, slot());
    expect(before(email, slot()) && before(slot(), send)).toBe(true);
  });

  test("[world:field-says-its-state] given a wrong code, then the slot directly under the code box says so as a problem, over Sign in, with the box marked; a send refused for its limits is a problem that leaves the box unmarked", async () => {
    const account = codeAccount({ signInWithCode: () => Promise.resolve({ ok: false, why: "wrong-code" }) });
    render(<CodeForm account={account} onSignedIn={() => undefined} />);
    fireEvent.change(screen.getByLabelText(say("ui.account.email.label")), { target: { value: "ada@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.email.send") }));
    const code = await screen.findByLabelText(say("ui.account.code.label"));
    fireEvent.change(code, { target: { value: "123456" } });
    await waitFor(() => expect(slot().textContent).toBe(say("ui.account.fail.wrong-code")));
    isProblem(slot());
    marks(code, slot());
    expect(code.nextElementSibling).toBe(slot());
    expect(before(slot(), screen.getByRole("button", { name: say("ui.account.code.go") }))).toBe(true);
    document.body.innerHTML = "";
    render(<CodeForm account={codeAccount({ sendCode: () => Promise.resolve({ ok: false, why: "too-many" }) })} onSignedIn={() => undefined} />);
    const email = screen.getByLabelText(say("ui.account.email.label"));
    fireEvent.change(email, { target: { value: "ada@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.email.send") }));
    await waitFor(() => expect(slot().textContent).toBe(say("ui.account.fail.too-many")));
    isProblem(slot());
    expect(email.getAttribute("aria-invalid")).toBe("false");
  });
});

describe("the age answer (world:field-says-its-state)", () => {
  const fields = () => [say("ui.account.age.day"), say("ui.account.age.month"), say("ui.account.age.year")].map((name) => screen.getByRole("combobox", { name }));

  test("[world:field-says-its-state] given Continue with no date picked, then the line directly under the three fields says so as a problem, over Continue, with each field marked", async () => {
    render(<AgeScreen account={codeAccount()} onStanding={() => undefined} />);
    const go = screen.getByRole("button", { name: say("ui.account.age.go") });
    fireEvent.click(go);
    const line = await screen.findByRole("alert");
    expect(line.textContent).toBe(say("ui.account.age.empty"));
    isProblem(line);
    for (const field of fields()) marks(field, line);
    expect(document.querySelector("[data-age-fields]")?.nextElementSibling).toBe(line);
    expect(before(line, go)).toBe(true);
  });

  test("[world:field-says-its-state] given a date the server cannot read, then it is a problem under the fields with them marked; given a refusal that is not the answer's, then a problem with the fields unmarked", async () => {
    render(<AgeScreen account={codeAccount({ declareAge: () => Promise.resolve("bad-date") })} onStanding={() => undefined} />);
    await pickBirth("1990-02-30");
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.age.go") }));
    const line = await screen.findByText(say("ui.account.age.bad-date"));
    const note = line.closest("[data-field-note]")!;
    isProblem(note);
    for (const field of fields()) marks(field, note);
    document.body.innerHTML = "";
    render(<AgeScreen account={codeAccount({ declareAge: () => Promise.resolve("bot-check") })} onStanding={() => undefined} />);
    await pickBirth("1990-02-12");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: say("ui.account.age.go") }));
      await Promise.resolve();
    });
    const refused = (await screen.findByText(say("ui.account.bot.failed"))).closest("[data-field-note]")!;
    isProblem(refused);
    for (const field of fields()) expect(field.getAttribute("aria-invalid")).toBe("false");
  });
});
