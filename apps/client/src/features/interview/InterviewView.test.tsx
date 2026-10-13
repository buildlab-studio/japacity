import { text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { optionWords } from "../../shared/sim/people";
import { renderWithView } from "../../shared/testing/render";
import { interviewGame, QUESTIONS, renderWithGame } from "../../shared/testing/people";
import { nameOf, say } from "../../shared/words/text";
import { INTERVIEW_DESK, InterviewView } from "./InterviewView";

const ENTRY = "interview.genuineness";

describe("the interview", () => {
  test("[R-INTERVIEW-004] given an interview open, then one question shows with its options in words, and each answer goes to the engine in order", async () => {
    const game = interviewGame();
    const { authority } = await renderWithGame(<InterviewView />, game);
    const section = screen.getByRole("region", { name: nameOf(ENTRY) });
    expect(within(section).getByText(say("ui.interview.question", { n: 1, total: QUESTIONS.length }))).toBeDefined();
    expect(within(section).getByText(text[`${ENTRY}.q.times-met`]!)).toBeDefined();
    for (const option of QUESTIONS[0]!.options) expect(within(section).getByRole("button", { name: optionWords("times-met", option) })).toBeDefined();

    fireEvent.click(within(section).getByRole("button", { name: optionWords("times-met", "one-to-three") }));
    await screen.findByText(text[`${ENTRY}.q.partner-home`]!);
    expect(authority.sent.at(-1)).toMatchObject({ type: "interview/answer", question: "times-met", option: "one-to-three" });
    fireEvent.click(screen.getByRole("button", { name: optionWords("partner-home", "town") }));
    await waitFor(() => expect(authority.sent.at(-1)).toMatchObject({ type: "interview/answer", question: "partner-home", option: "town" }));
  });

  test("[R-INTERVIEW-004] given an interview open, then it wears the ask's dress: the officer's pill and the desk's tile at the head, the question as the title, content's own line under it, the options as the ask's replies, and no rule name on screen", async () => {
    const game = interviewGame();
    await renderWithGame(<InterviewView />, game);
    const section = screen.getByRole("region", { name: nameOf(ENTRY) });
    expect(section.querySelector("[data-interview-head] [data-face]")?.getAttribute("data-face")).toBe(say("ui.interview.in.who"));
    expect(section.querySelector(`[data-interview-head] [data-tile="${INTERVIEW_DESK}"]`)).not.toBeNull();
    expect(section.querySelector("[data-interview-title]")?.textContent).toBe(text[`${ENTRY}.q.times-met`]);
    expect(section.querySelector("[data-interview-line]")?.textContent).toBe(text[`${ENTRY}.blurb`]);
    const replies = Array.from(section.querySelectorAll<HTMLElement>("[data-interview-option]"));
    expect(replies.map((reply) => reply.getAttribute("data-interview-option"))).toEqual([...QUESTIONS[0]!.options]);
    for (const reply of replies) expect(reply.className).toContain("ask-reply");
    // One question at a time: the next question's words are not on screen yet.
    expect(section.textContent).not.toContain(text[`${ENTRY}.q.partner-home`]!);
    // The interview's name is the region's, for a screen reader; nothing on screen reads as the rule's name.
    expect(section.textContent).not.toContain(nameOf(ENTRY));
  });

  test("[R-INTERVIEW-011] given every answer in and the partner not yet done, then the interview says it waits for them and asks nothing more", async () => {
    const game = interviewGame();
    game.accept({ type: "interview/answer", question: "times-met", option: "not-yet" });
    game.accept({ type: "interview/answer", question: "partner-home", option: "city" });
    await renderWithGame(<InterviewView />, game);
    expect(screen.getByText(say("ui.interview.waiting"))).toBeDefined();
    expect(screen.queryByRole("button", { name: optionWords("times-met", "not-yet") })).toBeNull();
  });

  test("[R-INTERVIEW-005] given the interview scored, then the result and the count that agreed show, never which answers or a score", async () => {
    const game = interviewGame();
    game.accept({ type: "interview/answer", question: "times-met", option: "not-yet" });
    game.accept({ type: "interview/answer", question: "partner-home", option: "city" });
    game.accept({ type: "interview/scored", pair: "pair-1", theirs: ["not-yet", "town"] }, "authority");
    const view = game.view();
    expect(view.interview?.result).not.toBeNull();
    // The result shows while the application it is for waits on its decision.
    const routes = view.routes.map((route) => (route.id === "route.uk-partner" ? { ...route, state: "applying" as const } : route));
    await renderWithView(<InterviewView />, { ...view, routes });
    const result = view.interview!.result!;
    expect(screen.getByText(say(`ui.interview.result.${result}`))).toBeDefined();
    expect(screen.getByText(say("ui.interview.matched", { matched: view.interview!.matched!, asked: view.interview!.total }))).toBeDefined();
    expect(document.body.textContent).not.toMatch(/%|town|city|not-yet/i);
  });

  test("[R-INTERVIEW-008] given a stand-in answering for the partner, then the interview says so", async () => {
    const game = interviewGame();
    const view: PlayerView = { ...game.view(), interview: { ...game.view().interview!, question: null, waiting: true, standIn: true } };
    await renderWithView(<InterviewView />, view);
    expect(screen.getByText(say("ui.interview.stand-in"))).toBeDefined();
  });

  test("[R-INTERVIEW-005] given no interview, or one whose application is decided, then nothing shows in the month plan", async () => {
    const game = interviewGame();
    const view = game.view();
    await renderWithView(<InterviewView />, { ...view, interview: null });
    expect(screen.queryByRole("region")).toBeNull();
    await renderWithView(<InterviewView />, { ...view, interview: { ...view.interview!, question: null, result: "pass", matched: 2 } });
    expect(screen.queryByRole("region")).toBeNull();
  });
});
