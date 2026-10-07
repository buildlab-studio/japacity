import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { App } from "./App";

test("the placeholder page renders the game name and links the simulation", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Japacity" })).toBeDefined();
  expect(screen.getByTestId("sim-link").textContent).toMatch(/^Simulation linked/);
});
