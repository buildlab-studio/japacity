// The broken screen (analytics.md R-ANALYTICS-002): what broke goes to the console with the
// build, the catch counts once as client/error render, and the screen offers Reload and Tell us, which opens the
// feedback box with the error's name and the build written in and nothing else of the error.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ModerationProvider } from "../moderation/ModerationProvider";
import { words } from "../moderation/moderation.words";
import { STAMP_META } from "../stamp/stamp";
import { fakeModeration } from "../testing/moderation";
import { say } from "../words/text";
import { CountedBoundary, nameOf } from "./CountedBoundary";
import { makeCounters, type CounterRow } from "./counters";
import { countInto } from "./start";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

const BUILD = "1a2b3c4d5e6f";
/** A message as an error can carry one: words the player must never see, and the team never gets from this box. */
const SECRET = "Cannot read properties of null (reading 'Bisi')";

let bodies: string[] = [];
let counters = makeCounters({ send: (body) => bodies.push(body) });
let restore: () => void = () => undefined;

beforeEach(() => {
  bodies = [];
  counters = makeCounters({ send: (body) => bodies.push(body) });
  restore = countInto(counters);
  const meta = document.createElement("meta");
  meta.name = STAMP_META;
  meta.content = BUILD;
  document.head.append(meta);
});

afterEach(() => {
  restore();
  document.head.querySelector(`meta[name="${STAMP_META}"]`)?.remove();
});

function sent(): CounterRow[] {
  counters.flush();
  return bodies.flatMap((body) => (JSON.parse(body) as { rows: CounterRow[] }).rows);
}

function Throws(): never {
  throw new TypeError(SECRET);
}

function Screen() {
  return (
    <section>
      <h2>The world</h2>
      <Throws />
    </section>
  );
}

/** Renders a screen that throws under the boundary, the console's error lines caught; answers them. */
function broken(moderation: ReturnType<typeof fakeModeration> | null): unknown[][] {
  const logged: unknown[][] = [];
  const quiet = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    logged.push(args);
  });
  try {
    render(
      <ModerationProvider api={moderation}>
        <CountedBoundary>
          <Screen />
        </CountedBoundary>
      </ModerationProvider>,
    );
  } finally {
    quiet.mockRestore();
  }
  return logged;
}

describe("the broken screen", () => {
  test("[R-ANALYTICS-002] given a screen that throws while it draws, then the console says the error's name, message and component stack with the build stamp, and client/error counts render once", () => {
    const logged = broken(fakeModeration());
    const ours = logged.find((args) => typeof args[0] === "string" && args[0].startsWith("Japacity build"));
    expect(ours).toBeDefined();
    const [line, error, stack] = ours as [string, unknown, string];
    expect(line).toContain(BUILD);
    expect(line).toContain("TypeError");
    // The error itself goes with it, so the console prints its name and its message.
    expect(error).toBeInstanceOf(TypeError);
    expect(String(error)).toBe(`TypeError: ${SECRET}`);
    expect(stack).toContain("Throws");
    expect(stack).toContain("Screen");
    expect(sent().filter((row) => row.name === "client/error")).toEqual([{ name: "client/error", key: "render", count: 1 }]);
  });

  test("[R-ANALYTICS-002] given a broken screen online, then it offers Reload and Tell us in words, and shows nothing of the error itself", () => {
    broken(fakeModeration());
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(say("ui.broken"));
    const buttons = within(alert).getAllByRole("button").map((button) => button.textContent);
    expect(buttons).toEqual([say("ui.broken.reload"), say("ui.broken.tell")]);
    expect(document.body.textContent).not.toContain(SECRET);
    expect(document.body.textContent).not.toContain("TypeError");
  });

  test("[R-ANALYTICS-002] [R-MODERATION-020] given Tell us, then the feedback box opens with the error's name and the build written in, never the message or the stack, and sends it from the broken screen", async () => {
    const moderation = fakeModeration();
    broken(moderation);
    fireEvent.click(screen.getByRole("button", { name: say("ui.broken.tell") }));
    const box = await screen.findByRole("dialog", { name: words("ui.feedback.title") });
    const text = within(box).getByRole("textbox");
    if (!(text instanceof HTMLTextAreaElement)) throw new Error("No feedback box.");
    expect(text.value).toBe(say("ui.broken.feedback", { error: "TypeError", build: BUILD }));
    expect(text.value).not.toContain(SECRET);
    expect(text.value).not.toContain("Throws");
    fireEvent.click(within(box).getByRole("button", { name: words("ui.feedback.send") }));
    await within(box).findByText(words("ui.feedback.sent"));
    expect(moderation.calls).toHaveLength(1);
    expect(moderation.calls[0]).toContain('"screen":"broken"');
    expect(moderation.calls[0]).toContain(BUILD);
    expect(moderation.calls[0]).not.toContain(SECRET);
  });

  test("[R-ANALYTICS-002] given a broken screen with no server, where the feedback box does not exist, then it offers Reload alone", () => {
    broken(null);
    const alert = screen.getByRole("alert");
    expect(within(alert).getAllByRole("button").map((button) => button.textContent)).toEqual([say("ui.broken.reload")]);
  });

  test("[R-ANALYTICS-002] given an error's name, then only a name's characters are kept, and a thrown value that is no error is called Error", () => {
    expect(nameOf(new RangeError("x"))).toBe("RangeError");
    expect(nameOf(Object.assign(new Error("x"), { name: "Bad <b>name</b> here" }))).toBe("Badbnamebhere");
    expect(nameOf("a string")).toBe("Error");
    expect(nameOf(null)).toBe("Error");
  });
});
