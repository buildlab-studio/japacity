import { text } from "@japacity/content";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { SetpieceView } from "./SetpieceView";

const ENTRY = "setpiece.credibility-interview";

describe("the interview", () => {
  test("given no interview open, then nothing shows", async () => {
    await renderWithView(<SetpieceView />, engineView());
    expect(screen.queryByText(text[`${ENTRY}.name`]!)).toBeNull();
  });

  test("given a question, then it and its answers are content's words and the weak answer is marked", async () => {
    await renderWithView(<SetpieceView />, richView());
    expect(screen.getByText(say("ui.setpiece.question", { n: 2, total: 3 }))).toBeDefined();
    expect(screen.getByText(text[`${ENTRY}.q.who-pays`]!)).toBeDefined();
    const weak = screen.getByRole("button", { name: new RegExp(text[`${ENTRY}.a.who-pays.sponsor`]!) });
    expect(within(weak).getByText(say("ui.setpiece.weak"))).toBeDefined();
    const strong = screen.getByRole("button", { name: new RegExp(text[`${ENTRY}.a.who-pays.own`]!) });
    expect(within(strong).queryByText(say("ui.setpiece.weak"))).toBeNull();
  });

  test("given an answer is clicked, then setpiece/answer names the question and the answer", async () => {
    const view = richView();
    const { authority } = await renderWithView(<SetpieceView />, view);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(text[`${ENTRY}.a.who-pays.lender`]!) }));
    await waitFor(() => expect(authority.sent).toEqual([{ type: "setpiece/answer", question: "who-pays", answer: "lender", basedOn: view.v }]));
  });
});
