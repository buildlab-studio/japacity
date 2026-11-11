// The dedication page (account:dedication-page-and-its-doors) and naming a light of the player's
// own in place (account:name-a-light-for-yours); world:motions-under-half-second for the stillness. The server is a stand-in handed to the shared
// lights module, as the shell's would be.
import type { SharedLight } from "@japacity/api";
import { DEDICATION_NICKNAME, DEDICATION_SHORT } from "@japacity/content";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { forgetDedication, setDedicationServer } from "../../shared/dedication/lights";
import type { Api } from "../../shared/net/http";
import "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { Dedication, MOST_DRAWN, placeLights, placesForLights } from "./Dedication";
import { loadLaterWords } from "../../shared/words/later";

// The page's words ride a chunk of their own (engine:first-download-has-budget): added before the page is drawn, as its door adds them before it opens.
beforeAll(() => loadLaterWords("dedication"));

type Animated = { frames: Keyframe[]; on: Element };

let animated: Animated[] = [];

function moving(reduced: boolean): void {
  animated = [];
  Element.prototype.animate = function (this: Element, frames: Keyframe[] | PropertyIndexedKeyframes | null) {
    animated.push({ frames: frames as Keyframe[], on: this });
    return { cancel: () => undefined, startTime: null } as unknown as Animation;
  };
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduced && query.includes("reduce"), addEventListener: () => undefined, removeEventListener: () => undefined }));
}

afterEach(() => {
  forgetDedication();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(Element.prototype, "animate");
});

interface Sent {
  method: string;
  path: string;
  body?: unknown;
}

const MINE = { id: "light.mine", name: "Mama Nkechi", years: { from: 1951, to: 2024 }, approved: false };

/** A stand-in for the server: the read answers `lights`, a light lit answers the account's own, Put it out answers ok. */
function server(reply: { count: number; lights: SharedLight[]; mine?: typeof MINE }, over: Partial<Record<"get" | "put" | "delete", () => Promise<unknown>>> = {}): Sent[] {
  const sent: Sent[] = [];
  const api = {
    get: (path: string) => {
      sent.push({ method: "GET", path });
      return over.get?.() ?? Promise.resolve({ ok: true, ...reply });
    },
    put: (path: string, body: unknown) => {
      sent.push({ method: "PUT", path, body });
      return over.put?.() ?? Promise.resolve({ ok: true, mine: MINE });
    },
    delete: (path: string, body: unknown) => {
      sent.push({ method: "DELETE", path, body });
      return over.delete?.() ?? Promise.resolve({ ok: true });
    },
  };
  setDedicationServer(api as unknown as Api);
  return sent;
}

/** Lights as the read lists them: the named first, then the bare. */
function lights(named: string[], bare: number): SharedLight[] {
  return [...named.map((name, at) => ({ id: `light.n${String(at)}`, name })), ...Array.from({ length: bare }, (_, at) => ({ id: `light.b${String(at)}` }))];
}

async function opened(year = 2026): Promise<HTMLElement> {
  render(<Dedication open onClose={() => undefined} year={year} />);
  await act(async () => {
    await Promise.resolve();
  });
  return screen.getByRole("dialog", { name: say("ui.dedication.page") });
}

describe("the page", () => {
  test("[account:dedication-page-and-its-doors] [city:credits-screen-attributions] given the water read, then the page holds the count and on the water tonight, the owner's light with soksonjr under it, content's short line, Sun re o., the one button and a close", async () => {
    const sent = server({ count: 312, lights: lights(["Grandma", "Chidi"], 20) });
    const page = await opened();
    expect(sent).toEqual([{ method: "GET", path: "/api/dedication/lights" }]);
    expect(page.querySelector("[data-dedication-count]")?.textContent).toBe("312 lightson the water tonight");
    expect(DEDICATION_NICKNAME).toBe("soksonjr");
    expect(page.querySelector("[data-dedication-name]")?.textContent).toBe("soksonjr");
    expect(DEDICATION_SHORT).toBe("For Osoko Emmanuel, 1998 to 2026. From Al-Ameen.");
    expect(page.querySelector("[data-dedication-short]")?.textContent).toBe(DEDICATION_SHORT);
    expect(page.querySelector("[data-dedication-rest]")?.textContent).toBe("Sun re o.");
    const buttons = within(page).getAllByRole("button");
    expect(buttons.map((button) => button.textContent || button.getAttribute("aria-label"))).toEqual(["Light one for yours", "Close"]);
    expect(page.dataset.paint).toBe("night");
    // The count and the close stand still at the head while the page scrolls, so filling the form never takes them out
    // of view.
    expect(page.querySelector("[data-dedication-head]")?.className).toContain("fixed");
    expect(page.querySelector("[data-dedication-head]")?.contains(page.querySelector("[data-dedication-count]"))).toBe(true);
    expect(page.querySelector("[data-dedication-close]")?.className).toContain("fixed");
  });

  test("[account:dedication-page-and-its-doors] given the count, then it is the true number, never rounded, one light said as one", async () => {
    server({ count: 4_812, lights: lights([], 3) });
    const many = render(<Dedication open onClose={() => undefined} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.querySelector("[data-dedication-count] p")?.textContent).toBe("4,812 lights");
    many.unmount();
    server({ count: 1, lights: lights([], 1) });
    expect((await opened()).querySelector("[data-dedication-count] p")?.textContent).toBe("1 light");
  });

  test("[account:dedication-page-and-its-doors] given approved and bare lights, then each approved light carries its name under its bulb and the rest are bare; the top strings are bulbs and the rest plain dots with no glow and no filter", async () => {
    server({ count: 60, lights: lights(["Grandma", "Aunty Ronke", "Chidi"], 57) });
    const page = await opened();
    expect([...page.querySelectorAll("[data-light-name]")].map((name) => name.textContent)).toEqual(["Grandma", "Aunty Ronke", "Chidi"]);
    expect(page.querySelectorAll("[data-bulb='named']")).toHaveLength(3);
    expect(page.querySelectorAll("[data-bulb='bare']").length + 3).toBe(36);
    const dots = [...page.querySelectorAll("[data-dot]")];
    expect(dots).toHaveLength(60 - 36);
    for (const dot of dots) {
      expect(dot.tagName.toLowerCase()).toBe("circle");
      expect(dot.getAttribute("filter")).toBeNull();
    }
    expect(page.querySelector("filter, [filter]")).toBeNull();
    // A handful of glow layers: the owner's and the named ones.
    expect([...page.querySelectorAll<HTMLElement>("[data-dedication-glow]")].map((glow) => glow.dataset.dedicationGlow)).toEqual(["his", "named", "named", "named"]);
    // One picture for the strings, the bulbs and the dots.
    expect(page.querySelectorAll("svg[data-dedication-strings]")).toHaveLength(1);
  });

  test("[account:dedication-page-and-its-doors] given more lights than a phone draws, then at most 240 are drawn while the count says the true number", async () => {
    server({ count: 5_000, lights: lights([], 240) });
    const page = await opened();
    expect(MOST_DRAWN).toBe(240);
    expect(placesForLights(false)).toBeGreaterThanOrEqual(MOST_DRAWN);
    expect(page.querySelectorAll("[data-dot], [data-bulb]")).toHaveLength(240);
    expect(page.querySelector("[data-dedication-count] p")?.textContent).toBe("5,000 lights");
  });

  test("[account:dedication-page-and-its-doors] given named and bare lights on the strings, then a named light takes every other place with a bare one between and every other name sits a row lower, so two names are never neighbours", () => {
    const named = Array.from({ length: 6 }, (_, at) => ({ id: `light.named-${String(at)}`, name: `Name ${String(at)}` }));
    const bare = Array.from({ length: 10 }, (_, at) => ({ id: `light.bare-${String(at)}` }));
    const placed = placeLights([...named, ...bare], null, false).filter((one) => one.kind === "bulb");
    const kinds = placed.map((one) => (one.light.name === undefined ? "bare" : "named"));
    expect(kinds.slice(0, 12)).toEqual(["named", "bare", "named", "bare", "named", "bare", "named", "bare", "named", "bare", "named", "bare"]);
    expect(kinds.slice(12).every((kind) => kind === "bare")).toBe(true);
    expect(placed.filter((one) => one.light.name !== undefined).map((one) => one.row)).toEqual([0, 1, 0, 1, 0, 1]);
    // With no bare lights left to space them, names still fill the strings in order.
    const allNamed = placeLights(named, null, false);
    expect(allNamed.map((one) => one.light.id)).toEqual(named.map((one) => one.id));
  });

  test("[account:dedication-page-and-its-doors] given the account's own light among the lights, then it is never drawn on the strings: it hangs beside the owner's, and with it at most 240 are drawn", () => {
    const listed = [{ id: "light.mine" }, ...lights([], 300)];
    const placed = placeLights(listed, "light.mine", true);
    expect(placed.some((one) => one.light.id === "light.mine")).toBe(false);
    expect(placed).toHaveLength(MOST_DRAWN - 1);
    expect(placeLights(lights([], 300), null, false)).toHaveLength(MOST_DRAWN);
    // The first lights listed (the approved, then the newest) are the bulbs.
    expect(placed.slice(0, 35).every((one) => one.kind === "bulb")).toBe(true);
    expect(placed.slice(35).every((one) => one.kind === "dot")).toBe(true);
  });

  test("[account:dedication-page-and-its-doors] given no server, then the page shows the owner's light, the strings bare, no count, and the button closed with its line", async () => {
    setDedicationServer(null);
    const page = await opened();
    expect(page.dataset.water).toBe("out");
    expect(page.querySelector("[data-dedication-name]")?.textContent).toBe("soksonjr");
    expect(page.querySelector("[data-dedication-strings] path")).not.toBeNull();
    expect(page.querySelectorAll("[data-bulb], [data-dot]")).toHaveLength(0);
    expect(page.querySelector("[data-dedication-count]")).toBeNull();
    expect(within(page).getByRole("button", { name: "Light one for yours" })).toHaveProperty("disabled", true);
    expect(page.querySelector("[data-dedication-out]")?.textContent).toBe("The water is out of reach right now.");
  });

  test("[account:dedication-page-and-its-doors] given a read that fails, then the page is the same as offline", async () => {
    server({ count: 0, lights: [] }, { get: () => Promise.reject(new Error("network")) });
    const page = await opened();
    await act(async () => {
      await Promise.resolve();
    });
    expect(page.dataset.water).toBe("out");
    expect(page.querySelector("[data-dedication-count]")).toBeNull();
    expect(page.querySelector("[data-dedication-out]")?.textContent).toBe("The water is out of reach right now.");
  });

  test("[account:dedication-page-and-its-doors] given the page open, when close is tapped, then it closes", () => {
    server({ count: 0, lights: [] });
    const closed = vi.fn();
    render(<Dedication open onClose={closed} />);
    fireEvent.click(within(screen.getByRole("dialog", { name: say("ui.dedication.page") })).getByRole("button", { name: "Close" }));
    expect(closed).toHaveBeenCalledTimes(1);
  });

  test("[account:dedication-page-and-its-doors] [world:motions-under-half-second] given reduced motion, then the page's lights hold still; otherwise they breathe by opacity alone", async () => {
    server({ count: 3, lights: lights(["Grandma"], 2) });
    moving(true);
    const still = render(<Dedication open onClose={() => undefined} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(animated).toHaveLength(0);
    expect(document.querySelectorAll("[data-dedication-glow][data-still]").length).toBeGreaterThan(0);
    still.unmount();
    moving(false);
    render(<Dedication open onClose={() => undefined} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(animated.length).toBeGreaterThan(0);
    for (const { frames } of animated) for (const frame of frames) expect(Object.keys(frame).filter((key) => key !== "offset")).toEqual(["opacity"]);
  });
});

const lightIt = (page: HTMLElement) => within(page).getByRole("button", { name: "Light it" });
const problems = (page: HTMLElement) => [...page.querySelectorAll("[data-light-problem]")].map((line) => line.textContent);

function type(page: HTMLElement, name: string, from = "", to = ""): void {
  fireEvent.change(within(page).getByRole("textbox", { name: "Who is it for?" }), { target: { value: name } });
  fireEvent.change(within(page).getByRole("textbox", { name: "First year" }), { target: { value: from } });
  fireEvent.change(within(page).getByRole("textbox", { name: "Last year" }), { target: { value: to } });
}

describe("light one for yours", () => {
  test("[account:name-a-light-for-yours] given the button, when it is tapped, then the unlit light beside the owner's is named in place: two boxes drawn alike with the label inside, no sheet, no fieldset or legend, and Light it waits for a name", async () => {
    server({ count: 2, lights: lights([], 2) });
    const page = await opened();
    fireEvent.click(within(page).getByRole("button", { name: "Light one for yours" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(page.querySelector("[data-unlit]")).not.toBeNull();
    expect(page.querySelector("[data-unlit-name]")?.textContent).toBe("yours");
    const form = page.querySelector<HTMLElement>("[data-name-it]")!;
    expect(form.querySelector("fieldset, legend")).toBeNull();
    const boxes = [form.querySelector("label"), within(form).getByRole("group", { name: "Years, if you want" })];
    expect(boxes[0]?.className).toBe(boxes[1]?.className);
    expect(boxes[0]?.textContent).toContain("Who is it for?");
    expect(within(form).getByRole("textbox", { name: "Who is it for?" }).getAttribute("maxlength")).toBe("40");
    expect(lightIt(page)).toHaveProperty("disabled", true);
    expect(problems(page)).toEqual([]);
  });

  test("[account:name-a-light-for-yours] given the limits at each edge, then four words light and five say so; 1900 and this year light, 1899 and next year say so; an end before the start says so", async () => {
    server({ count: 0, lights: [] });
    const page = await opened(2026);
    fireEvent.click(within(page).getByRole("button", { name: "Light one for yours" }));
    type(page, "Mama Nkechi Grace Obi", "1900", "2026");
    expect(lightIt(page)).toHaveProperty("disabled", false);
    expect(problems(page)).toEqual([]);
    type(page, "Mama Nkechi Grace Obi Ade", "1900", "2026");
    expect(problems(page)).toEqual(["Four words at most."]);
    expect(lightIt(page)).toHaveProperty("disabled", true);
    type(page, "Mama Nkechi", "1899", "");
    expect(problems(page)).toEqual(["A year from 1900 to 2026."]);
    type(page, "Mama Nkechi", "1951", "2027");
    expect(problems(page)).toEqual(["A year from 1900 to 2026."]);
    type(page, "Mama Nkechi", "1951", "1950");
    expect(problems(page)).toEqual(["The last year cannot come before the first."]);
    type(page, "Mama Nkechi", "1951", "1951");
    expect(problems(page)).toEqual([]);
  });

  test("[account:name-a-light-for-yours] given a name and years, when Light it is pressed, then the light is sent, shows at once from the reply beside the owner's with its name and years, the count takes it in, and the line says its name shows once looked over", async () => {
    const sent = server({ count: 2, lights: lights([], 2) });
    const page = await opened();
    fireEvent.click(within(page).getByRole("button", { name: "Light one for yours" }));
    type(page, "  Mama Nkechi ", "1951", "2024");
    await act(async () => {
      fireEvent.click(lightIt(page));
      await Promise.resolve();
    });
    expect(sent.at(-1)).toEqual({ method: "PUT", path: "/api/dedication/light", body: { name: "Mama Nkechi", from: 1951, to: 2024 } });
    const own = page.querySelector<HTMLElement>("[data-own-light]")!;
    expect(own.textContent).toBe("Mama Nkechi1951 to 2024");
    expect(own.getAttribute("aria-label")).toBe("Mama Nkechi, 1951 to 2024");
    expect(page.querySelector("[data-dedication-glow='own']")).not.toBeNull();
    expect(page.querySelector("[data-dedication-count] p")?.textContent).toBe("3 lights");
    expect(page.querySelector("[data-dedication-mine]")?.textContent).toBe("Yours is on the water. Its name shows to everyone once it has been looked over.");
    expect(within(page).queryByRole("button", { name: "Light one for yours" })).toBeNull();
    // Under the owner's: the big light keeps its name, and the account's own follows it.
    expect(page.querySelector("[data-dedication-name]")?.compareDocumentPosition(own)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  test("[account:name-a-light-for-yours] given the account's own light, when Put it out is pressed, then it is sent, the light goes, the count lets it go and the button returns", async () => {
    const sent = server({ count: 3, lights: [{ id: "light.mine" }, ...lights([], 2)], mine: MINE });
    const page = await opened();
    expect(page.querySelector("[data-own-light]")).not.toBeNull();
    // Its own light is never also on the strings.
    expect(page.querySelectorAll("[data-bulb]")).toHaveLength(2);
    await act(async () => {
      fireEvent.click(within(page).getByRole("button", { name: "Put it out" }));
      await Promise.resolve();
    });
    expect(sent.at(-1)).toEqual({ method: "DELETE", path: "/api/dedication/light", body: {} });
    expect(page.querySelector("[data-own-light]")).toBeNull();
    expect(page.querySelector("[data-dedication-count] p")?.textContent).toBe("2 lights");
    expect(within(page).getByRole("button", { name: "Light one for yours" })).not.toBeNull();
  });

  test("[account:name-a-light-for-yours] given the server refuses the light with the shared check's problem, then the problem shows and nothing is lit", async () => {
    server({ count: 0, lights: [] }, { put: () => Promise.resolve({ ok: false, code: "bad-light", detail: "x", problems: ["name-words"] }) });
    const page = await opened();
    fireEvent.click(within(page).getByRole("button", { name: "Light one for yours" }));
    type(page, "Mama Nkechi");
    await act(async () => {
      fireEvent.click(lightIt(page));
      await Promise.resolve();
    });
    expect(problems(page)).toEqual(["Four words at most."]);
    expect(page.querySelector("[data-own-light]")).toBeNull();
  });

  test("[account:name-a-light-for-yours] given the server cannot be reached when the light is sent, then the page says the water is out of reach and nothing is lit", async () => {
    server({ count: 0, lights: [] }, { put: () => Promise.reject(new Error("network")) });
    const page = await opened();
    fireEvent.click(within(page).getByRole("button", { name: "Light one for yours" }));
    type(page, "Mama Nkechi");
    await act(async () => {
      fireEvent.click(lightIt(page));
      await Promise.resolve();
    });
    expect(page.querySelector("[data-light-out]")?.textContent).toBe("The water is out of reach right now.");
    expect(page.querySelector("[data-own-light]")).toBeNull();
  });

  test("[account:name-a-light-for-yours] given an approved light of the account's own, then it still hangs beside the owner's with its name", async () => {
    server({ count: 1, lights: [{ id: "light.mine", name: "Mama Nkechi" }], mine: { ...MINE, approved: true } });
    const page = await opened();
    expect(page.querySelector("[data-own-light]")?.textContent).toBe("Mama Nkechi1951 to 2024");
    expect(page.querySelectorAll("[data-light-name]")).toHaveLength(0);
  });
});

describe("the light's boxes say their state (world:field-says-its-state)", () => {
  test("[world:field-says-its-state] given a name of five words and a last year before the first, then each box carries its one problem directly under it, in the out colour with its icon, the box's edge in the out colour and its field marked", async () => {
    server({ count: 0, lights: [] });
    const page = await opened(2026);
    fireEvent.click(within(page).getByRole("button", { name: "Light one for yours" }));
    type(page, "Mama Nkechi Grace Obi Ade", "1951", "1950");
    expect(problems(page)).toEqual(["Four words at most.", "The last year cannot come before the first."]);
    const name = within(page).getByRole("textbox", { name: "Who is it for?" });
    const nameBox = name.closest("label")!;
    const years = within(page).getByRole("group", { name: "Years, if you want" });
    for (const [box, field] of [
      [nameBox, name],
      [years, within(page).getByRole("textbox", { name: "Last year" })],
    ] as const) {
      const line = box.nextElementSibling!;
      expect(line.hasAttribute("data-light-problem")).toBe(true);
      expect(line.className.split(" ")).toContain("text-out");
      expect(line.querySelector("svg")?.getAttribute("class")).toContain("lucide-circle-alert");
      expect(box.className.split(" ")).toContain("border-out");
      expect(field.getAttribute("aria-invalid")).toBe("true");
    }
    expect(name.getAttribute("aria-describedby")).toBe(nameBox.nextElementSibling!.id);
    type(page, "Mama Nkechi", "1951", "1951");
    expect(problems(page)).toEqual([]);
    expect(nameBox.className).toBe(years.className);
    expect(nameBox.className.split(" ")).not.toContain("border-out");
  });
});
