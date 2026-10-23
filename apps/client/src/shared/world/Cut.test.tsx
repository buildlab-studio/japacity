// world:back-closes-topmost: the cut into a place is not closed by Back; Back waits until it ends.
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";

import { type BackStack, createBack } from "../back/back";
import { Cut } from "./Cut";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

let stack: BackStack;

beforeEach(() => {
  history.replaceState(null, "", "/");
  stack = createBack(window);
});

afterEach(() => stack.dispose());

const depth = () => (history.state as Record<string, unknown> | null)?.japacityBack ?? 0;

test("[world:back-closes-topmost] given a cut running, when Back is pressed, then the entry stands again, and once the cut ends it is taken off", async () => {
  const { rerender } = render(<Cut cutting />);
  await waitFor(() => expect(depth()).toBe(1));
  act(() => history.back());
  await waitFor(() => expect(depth()).toBe(1));
  rerender(<Cut cutting={false} />);
  await waitFor(() => expect(depth()).toBe(0));
});
