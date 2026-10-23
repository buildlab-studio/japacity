// server:unknown-address-becomes-root with world:back-closes-topmost: the replace-only address writes keep working over the game's
// entries: an unknown address turned to `/` while a step is open stays `/` when Back closes the step.
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";

import { type BackStack, createBack, useBackLayer } from "../shared/back/back";
import { showRoot } from "./address";
// Registers Testing Library's cleanup for this file.
import "../shared/testing/render";

let stack: BackStack;

beforeEach(() => {
  history.replaceState(null, "", "/somewhere-unknown?from=link");
  stack = createBack(window);
});

afterEach(() => stack.dispose());

function Step({ open, onClose }: { open: boolean; onClose: () => void }) {
  useBackLayer(open, onClose);
  return null;
}

test("[world:back-closes-topmost] given a step open on an unknown address, when the address becomes / and Back closes the step, then the address bar still shows /", async () => {
  let open = true;
  const { rerender } = render(<Step open onClose={() => (open = false)} />);
  await waitFor(() => expect((history.state as Record<string, unknown> | null)?.japacityBack).toBe(1));
  showRoot();
  expect(`${location.pathname}${location.search}`).toBe("/?from=link");
  act(() => history.back());
  await waitFor(() => expect(open).toBe(false));
  rerender(<Step open={false} onClose={() => undefined} />);
  await waitFor(() => expect(`${location.pathname}${location.search}`).toBe("/?from=link"));
});
