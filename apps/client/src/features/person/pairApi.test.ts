import { describe, expect, test } from "vitest";

import { api } from "../../shared/net/http";
import { pairApi } from "./pairApi";

describe("the invite link's address", () => {
  test("[pair:invite-link-single-use] given the game served at japacity.app, when an invite's code becomes a link, then it is https://japacity.app/invite/<code> on the page's own host", () => {
    const server = api({ baseUrl: "https://japacity.app" });
    expect(pairApi(server, "https://japacity.app").inviteLink("K7Q2")).toBe("https://japacity.app/invite/K7Q2");
    expect(pairApi(server, "https://japacity.app/").inviteLink("a b")).toBe("https://japacity.app/invite/a%20b");
    expect(pairApi(api({ baseUrl: "https://staging.japacity.app" }), "https://staging.japacity.app").inviteLink("K7Q2")).toBe("https://staging.japacity.app/invite/K7Q2");
  });
});
