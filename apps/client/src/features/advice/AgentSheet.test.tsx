import { content, text, uiAdviceText } from "@japacity/content";
import type { Authority, Command, OfferView as Offer, PlayerView, Reply, ReportLine } from "@japacity/sim";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { inMonths, say, words } from "../../shared/words/text";
import { AgentSheets } from "./AgentSheet";

const STOP = "offer.agent-stop";
const PAPERS = "offer.agent-papers";
const PROMISE = "offer.agent-promise";
const ROUTE = "route.uk-masters";
const FEE = 1_500_000;
const AGENT = `${STOP}.who.2`;

const allowed = (...ids: string[]): Offer["choices"] => ids.map((id) => ({ id, allowed: true, pick: null }));

/** The route's checklist less its heaviest item: an understating agent's version (advice:agent-kind-drawn-on-offer). */
function understated(): string[] {
  const checklist = content.route[ROUTE]?.checklist ?? [];
  const heaviest = checklist.reduce((best, item) => (item.weight > best.weight ? item : best));
  return checklist.map((item) => item.id).filter((id) => id !== heaviest.id);
}

function stopOffer(signs: string[], choices: Offer["choices"] = allowed("take", "look-office", "look-licence", "look-name", "decline")): Offer {
  return {
    id: "offer-1",
    entry: STOP,
    openedMonth: 3,
    expiresMonth: 4,
    terms: { who: 2, agent: AGENT, fee: FEE, route: ROUTE, says: understated().join(",") },
    signs,
    choices,
  };
}

function withOffers(...offers: Offer[]): PlayerView {
  return { ...engineView("scenario.banker"), offers };
}

const sheet = (ids: string[] = [STOP]) => <AgentSheets ids={ids} others={() => <p data-others />} />;

/** An authority that answers the first command with a second view and these lines, then keeps that view. */
function stepping(first: PlayerView, after: PlayerView, lines: ReportLine[]): Authority & { sent: Command[] } {
  let view = first;
  const sent: Command[] = [];
  return {
    sent,
    view: () => Promise.resolve(view),
    send(command): Promise<Reply> {
      sent.push(command);
      const answered = sent.length === 1 ? lines : [];
      view = after;
      return Promise.resolve({ ok: true, view, lines: answered });
    },
  };
}

async function renderStepping(first: PlayerView, after: PlayerView, lines: ReportLine[], ids: string[] = [STOP]) {
  const authority = stepping(first, after, lines);
  const store = createGameStore(authority);
  await store.getState().refresh();
  render(<GameProvider store={store}>{sheet(ids)}</GameProvider>);
  return authority;
}

const line = (key: string, params: ReportLine["params"], tone: ReportLine["tone"] = "plain"): ReportLine => ({ key, params, tone, attention: false, counts: [] });

describe("the agent's sheet", () => {
  test("[advice:scams-show-their-tells] [text:show-then-tell] given an agent at the stop with one tell shown, when his sheet opens, then that one tell shows in a few words with the warning mark and no other, with the three looks still to make", async () => {
    await renderWithView(sheet(), withOffers(stopOffer(["cash-only"])));
    const tells = document.querySelectorAll("[data-tell]");
    expect(tells).toHaveLength(1);
    expect(tells[0]?.textContent).toBe(say("advice.tell.cash-only.short"));
    expect(tells[0]?.querySelector("[data-mark='setback']")?.getAttribute("aria-label")).toBe(say("advice.tell.mark"));
    expect(screen.getByText(say("advice.notice"))).toBeTruthy();
    for (const look of ["look-office", "look-licence", "look-name"]) {
      const button = screen.getByRole<HTMLButtonElement>("button", { name: text[`${STOP}.choice.${look}`]! });
      expect(button.disabled).toBe(false);
    }
    expect(document.querySelectorAll("[data-look-done]")).toHaveLength(0);
  });

  test("[advice:scams-show-their-tells] given his sheet, when a look is made, then it sends its choice for free and shows every tell it found in words, and the look shows as done", async () => {
    const before = withOffers(stopOffer(["cash-only"]));
    const after = withOffers(stopOffer(["cash-only", "no-office", "look-office"]));
    const found = [line("line.offer.look-office-found", { offer: STOP, tell: "advice.tell.no-office" })];
    const authority = await renderStepping(before, after, found);
    fireEvent.click(screen.getByRole("button", { name: text[`${STOP}.choice.look-office`]! }));
    await waitFor(() => expect(document.querySelector("[data-look-done]")).not.toBeNull());
    expect(authority.sent).toEqual([expect.objectContaining({ type: "offer/choose", offer: "offer-1", choice: "look-office" })]);
    expect(authority.sent.some((command) => command.type === "offer/choose" && command.choice === "take")).toBe(false);
    expect([...document.querySelectorAll("[data-tell]")].map((node) => node.getAttribute("data-tell"))).toEqual(["cash-only", "no-office"]);
    expect(screen.getByText(say("advice.tell.no-office.short"))).toBeTruthy();
    expect([...document.querySelectorAll("[data-fresh]")].map((node) => node.getAttribute("data-tell"))).toEqual(["no-office"]);
    expect(document.querySelector("[data-look-done]")?.textContent).toContain(text[`${STOP}.sign.look-office`]);
  });

  test("[text:show-then-tell] given every tell an agent can carry, when each shows, then it is an icon, two to four words with no full stop and the warning mark with its word, never his sentence", async () => {
    const all = ["cash-only", "guarantee", "no-office", "no-licence", "holds-passport", "no-passport", "pay-today", "price-low"];
    await renderWithView(sheet(), withOffers(stopOffer(all)));
    const tells = [...document.querySelectorAll<HTMLElement>("[data-tell]")];
    expect(tells.map((node) => node.getAttribute("data-tell"))).toEqual(all);
    for (const node of tells) {
      const tell = node.getAttribute("data-tell")!;
      const said = node.textContent ?? "";
      expect(said).toBe(say(`advice.tell.${tell}.short`));
      expect(said).not.toBe(text[`${STOP}.sign.${tell}`]);
      expect(said.split(" ").length).toBeGreaterThanOrEqual(2);
      expect(said.split(" ").length).toBeLessThanOrEqual(4);
      expect(said).not.toMatch(/\./);
      expect(node.querySelector("svg[aria-hidden='true']")).not.toBeNull();
      expect(node.querySelector("[data-mark='setback']")?.getAttribute("aria-label")).toBe(say("advice.tell.mark"));
    }
  });

  test("[advice:scams-show-their-tells] given his sheet, when a look finds nothing, then the reply's words say so and no tell is added", async () => {
    const before = withOffers(stopOffer(["cash-only"]));
    const after = withOffers(stopOffer(["cash-only", "look-licence"]));
    const nothing = [line("line.offer.look-licence-nothing", { offer: STOP })];
    await renderStepping(before, after, nothing);
    fireEvent.click(screen.getByRole("button", { name: text[`${STOP}.choice.look-licence`]! }));
    await waitFor(() => expect(document.querySelector("[data-lines='look-licence']")).not.toBeNull());
    expect(screen.getByText(words("line.offer.look-licence-nothing", nothing[0]!.params))).toBeTruthy();
    expect(document.querySelectorAll("[data-tell]")).toHaveLength(1);
    expect(document.querySelectorAll("[data-fresh]")).toHaveLength(0);
  });

  test("[advice:scams-show-their-tells] given a tell already shown, when a look finds only that one again, then the reply's words say so and nothing is marked as just found", async () => {
    const before = withOffers(stopOffer(["cash-only"]));
    const after = withOffers(stopOffer(["cash-only", "look-name"]));
    const again = [line("line.offer.look-name-found", { offer: STOP, tell: "advice.tell.cash-only" })];
    await renderStepping(before, after, again);
    fireEvent.click(screen.getByRole("button", { name: text[`${STOP}.choice.look-name`]! }));
    await waitFor(() => expect(document.querySelector("[data-lines='look-name']")).not.toBeNull());
    expect(screen.getByText(words("line.offer.look-name-found", again[0]!.params))).toBeTruthy();
    expect(document.querySelectorAll("[data-fresh]")).toHaveLength(0);
  });

  test("[advice:scams-show-their-tells] given nobody to check his name with, when his sheet opens, then that look cannot be made and the sheet says why", async () => {
    await renderWithView(sheet(), withOffers(stopOffer(["cash-only"], [...allowed("take", "look-office", "look-licence"), { id: "look-name", allowed: false, pick: null }, ...allowed("decline")])));
    expect(screen.getByRole<HTMLButtonElement>("button", { name: text[`${STOP}.choice.look-name`]! }).disabled).toBe(true);
    expect(screen.getByText(say("advice.look.nobody"))).toBeTruthy();
  });

  test("[advice:agent-kind-drawn-on-offer] given an agent whose kind rides hidden, when his sheet shows his fee, then nothing on it names a kind or counts his tells", async () => {
    // Even a kind that leaked into the terms is never read by the sheet.
    const offer = { ...stopOffer(["cash-only", "guarantee", "no-office"]), terms: { ...stopOffer([]).terms, kind: "scammer" } };
    await renderWithView(sheet(), withOffers(offer));
    const shown = document.body.textContent ?? "";
    expect(shown).toContain(formatMoney(FEE, "NGN"));
    expect(shown).toContain(words(`${STOP}.body`, { fee: { currency: "NGN", amount: FEE } }));
    expect(shown).not.toMatch(/scam|fixer|overpromis|honest|fraud/i);
    expect(shown).not.toMatch(/\d+\s*(tells?|signs?|of \d+|out of \d+)/i);
  });

  test("[advice:agent-kind-drawn-on-offer] given his fee and the cash in hand, when the sheet shows Pay him, then the button says what is left after and sends the take", async () => {
    const view = withOffers(stopOffer(["cash-only"]));
    const { authority } = await renderWithView(sheet(), view);
    const take = document.querySelector<HTMLButtonElement>("[data-agent-choice='take']")!;
    expect(take.textContent).toContain(text[`${STOP}.choice.take`]);
    expect(take.textContent).toContain(say("ui.world.left", { amount: formatMoney(view.pockets.NGN.cash + view.pockets.NGN.bank - FEE, "NGN") }));
    expect(screen.getByText(text[`${STOP}.choice.decline`]!)).toBeTruthy();
    fireEvent.click(take);
    await waitFor(() => expect(authority.sent.at(-1)).toMatchObject({ type: "offer/choose", offer: "offer-1", choice: "take" }));
  });

  test("[advice:agent-kind-drawn-on-offer] given an agent's version of the checklist, when his sheet opens, then it lists the items he says by name and says only the official page is sure", async () => {
    await renderWithView(sheet(), withOffers(stopOffer(["cash-only"])));
    const says = document.querySelector<HTMLElement>("[data-agent-says]")!;
    expect(within(says).getByText(say("advice.says"))).toBeTruthy();
    for (const item of understated()) expect(within(says).getByText(words(`${ROUTE}.item.${item}.name`))).toBeTruthy();
    expect(within(says).getAllByRole("listitem")).toHaveLength(understated().length);
    expect(within(says).getByText(say("advice.says.sure"))).toBeTruthy();
  });

  test("[advice:bad-news-told-straight] given he was paid, when the reply comes, then the report's words stay on the sheet after he has gone", async () => {
    const scam = [line("line.offer.agent-scam", { agent: AGENT, amount: { currency: "NGN", amount: FEE } }, "bad"), line("line.offer.agent-scam-tell", { tell: "advice.tell.cash-only" }, "bad")];
    await renderStepping(withOffers(stopOffer(["cash-only"])), withOffers(), scam);
    fireEvent.click(document.querySelector<HTMLButtonElement>("[data-agent-choice='take']")!);
    await waitFor(() => expect(document.querySelector("[data-lines='outcome']")).not.toBeNull());
    expect(screen.getByText(words("line.offer.agent-scam", scam[0]!.params))).toBeTruthy();
    expect(document.querySelector("[data-agent-sheet]")).toBeNull();
  });
});

describe("what he leaves behind", () => {
  const papers: Offer = {
    id: "offer-2",
    entry: PAPERS,
    openedMonth: 3,
    expiresMonth: 4,
    terms: { fee: content.tuning.advice.fakePapersFee, fake: 1, agent: AGENT, route: ROUTE },
    signs: [],
    choices: allowed("transcript", "tb-certificate", "medical", "decline"),
  };

  test("[advice:agent-loss-is-the-fee] given his papers on offer, when the card opens at his stop, then it says what he offers in the entry's words, each paper with what is left after, and nothing more", async () => {
    const view = withOffers(papers);
    const { authority } = await renderWithView(sheet([STOP]), view);
    const card = document.querySelector<HTMLElement>(`[data-agent-sheet='${PAPERS}']`)!;
    expect(within(card).getByText(words(`${PAPERS}.body`, { fee: { currency: "NGN", amount: papers.terms.fee as number } }))).toBeTruthy();
    const left = say("ui.world.left", { amount: formatMoney(view.pockets.NGN.cash + view.pockets.NGN.bank - (papers.terms.fee as number), "NGN") });
    for (const paper of ["transcript", "tb-certificate", "medical"]) {
      const button = card.querySelector<HTMLButtonElement>(`[data-agent-choice='${paper}']`)!;
      expect(button.textContent).toBe(`${text[`${PAPERS}.choice.${paper}`]!}${left}`);
    }
    expect(card.querySelectorAll("[data-tell], [data-look], [data-agent-says]")).toHaveLength(0);
    fireEvent.click(within(card).getByRole("button", { name: text[`${PAPERS}.choice.decline`]! }));
    await waitFor(() => expect(authority.sent.at(-1)).toMatchObject({ type: "offer/choose", offer: "offer-2", choice: "decline" }));
  });

  test("[advice:agent-kind-drawn-on-offer] given his promise, when its card opens, then it shows the month he named as months away (world:top-band-is-lively-pill) and sends nothing", async () => {
    const promise: Offer = { id: "offer-3", entry: PROMISE, openedMonth: 3, expiresMonth: 5, terms: { agent: AGENT }, signs: [], choices: allowed("wait") };
    const view = withOffers(promise);
    const { authority } = await renderWithView(sheet([PROMISE]), view);
    expect(screen.getByText(text[`${PROMISE}.body`]!)).toBeTruthy();
    expect(document.querySelector("[data-agent-month]")?.textContent).toBe(say("advice.promise.month", { when: inMonths(5, view.month) }));
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(authority.sent).toHaveLength(0);
  });
});

describe("the sheet a thing's act opens", () => {
  test("[world:things-are-tappable-models] given a desk that stages an agent and another offer, when its sheet opens, then the agent gets his own card and the other offer goes to the plain card", async () => {
    const other: Offer = { id: "offer-9", entry: "offer.held-funds-agent", openedMonth: 3, expiresMonth: 5, terms: { min: 1, max: 2 }, signs: [], choices: allowed("walk-away") };
    const office: Offer = { ...stopOffer([]), id: "offer-8", entry: "offer.agent-office", terms: { who: 1, agent: "offer.agent-office.who.1", fee: FEE } };
    let handed: Offer[] = [];
    await renderWithView(
      <AgentSheets
        ids={["offer.held-funds-agent", "offer.agent-office"]}
        others={(only) => {
          handed = [other, office].filter(only);
          return <p data-others />;
        }}
      />,
      withOffers(other, office),
    );
    expect(handed.map((offer) => offer.entry)).toEqual(["offer.held-funds-agent"]);
    expect(document.querySelector("[data-others]")).not.toBeNull();
    expect(document.querySelector("[data-agent-sheet='offer.agent-office'] [data-agent-who]")?.textContent).toBe(text["offer.agent-office.who.1.name"]);
  });
});

describe("the sheet's words", () => {
  test("[advice:bad-news-told-straight] given the sheet's own words and a sheet on screen, then no em-dash or en-dash appears anywhere", async () => {
    for (const value of Object.values(uiAdviceText)) expect(value).not.toMatch(/[–—]/);
    await renderWithView(sheet(), withOffers(stopOffer(["cash-only", "no-office", "look-office"])));
    expect(document.body.textContent).not.toMatch(/[–—]/);
  });
});

describe("what he says he does", () => {
  const TRANSCRIPT = "document.transcript";
  const POLICE = "document.police-certificate";
  const CHASER = "offer.agent-chaser";

  test("[advice:chaser-runs-around-cheaper] given an agent who says he knows someone inside, when his sheet opens, then it says so in plain words, names the paper and the office it comes from, and how many months sooner, and never names his kind", async () => {
    const offer = stopOffer(["cash-only"]);
    await renderWithView(sheet(), withOffers({ ...offer, terms: { ...offer.terms, pitch: "insider", paper: TRANSCRIPT, months: 2 } }));
    const pitch = document.querySelector("[data-agent-pitch]");
    expect(pitch?.querySelector("[data-agent-says-he]")?.textContent).toBe(text[`${STOP}.pitch.insider`]);
    expect(pitch?.querySelector("[data-agent-moves]")?.textContent).toBe(
      say("advice.moves", { document: "degree transcript", desk: text["advice.desk.document.transcript"]!, count: 2 }),
    );
    expect(pitch?.textContent).toContain("2 months sooner");
    expect(document.body.textContent).not.toMatch(/fixer|chaser|scam|overpromis/i);
  });

  test("[advice:chaser-runs-around-cheaper] given the chaser a friend puts you onto, when her sheet opens, then it says she will chase it for you and that the police certificate comes a month sooner, with her fee", async () => {
    const offer: Offer = {
      id: "offer-2",
      entry: CHASER,
      openedMonth: 3,
      expiresMonth: 4,
      terms: { who: 1, agent: `${CHASER}.who.1`, fee: 800_000, pitch: "chaser", paper: POLICE, months: 1 },
      signs: [],
      choices: allowed("take", "look-office", "look-licence", "look-name", "decline"),
    };
    await renderWithView(sheet([CHASER]), withOffers(offer));
    expect(document.querySelector("[data-agent-who]")?.textContent).toBe("Hadiza");
    expect(document.querySelector("[data-agent-says-he]")?.textContent).toBe(text[`${CHASER}.pitch.chaser`]);
    expect(document.querySelector("[data-agent-moves]")?.textContent).toBe(
      say("advice.moves.one", { document: "police character certificate", desk: text["advice.desk.document.police-certificate"]!, count: 1 }),
    );
    expect(document.querySelector("[data-agent-moves]")?.textContent).toContain("a month sooner");
    expect(document.querySelector("[data-agent-fee]")?.textContent).toContain(formatMoney(800_000, "NGN"));
  });

  test("[advice:chaser-runs-around-cheaper] given an agent with no paper of yours being made, when his sheet opens, then it says there is nothing to bring forward yet", async () => {
    const offer = stopOffer([]);
    await renderWithView(sheet(), withOffers({ ...offer, terms: { ...offer.terms, pitch: "chaser", paper: "", months: 1 } }));
    expect(document.querySelector("[data-agent-says-he]")?.textContent).toBe(text[`${STOP}.pitch.chaser`]);
    expect(document.querySelector("[data-agent-moves]")?.textContent).toBe(say("advice.moves.none"));
  });
});
