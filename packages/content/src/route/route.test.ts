import { describe, expect, test } from "vitest";

import { content } from "../index";

describe("route checklists", () => {
  test("[R-JAPACITY-004] given every route in content, when its checklist weights are added, then they come to exactly 100", () => {
    const routes = Object.values(content.route);
    expect(routes.length).toBeGreaterThan(0);
    const totals = Object.fromEntries(
      routes.map((route) => [route.id, route.checklist.reduce((sum, item) => sum + item.weight, 0)]),
    );
    expect(totals).toEqual(Object.fromEntries(routes.map((route) => [route.id, 100])));
  });

  test("[R-JAPACITY-004] given every route in content, when its checklist is read, then no item id appears twice", () => {
    const repeated = Object.values(content.route).filter((route) => {
      const ids = route.checklist.map((item) => item.id);
      return new Set(ids).size !== ids.length;
    });
    expect(repeated).toEqual([]);
  });
});
