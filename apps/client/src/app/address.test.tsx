import type { AccountReply } from "@japacity/api";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

// Registers Testing Library's cleanup for this file.
import "../shared/testing/render";
import { addressOf } from "./address";
import type { Address } from "./address";
import { AddressGate } from "./App";

const chunk = vi.hoisted(() => ({ fetched: 0 }));

// The admin chunk: counted each time it is fetched, and standing in for the page.
vi.mock("../features/admin/AdminRoute", () => {
  chunk.fetched += 1;
  return { AdminRoute: () => <p>the admin chunk</p> };
});

const ROW = { id: "account-1", country: "NG", age: { passed: true, method: "declared" }, createdAt: 1, character: null, sendUsageCounts: true, state: "secured", username: "ada_lagos", renameFrom: 0, ways: { google: null, email: "ada@example.com", passkeys: 1 } } as const;

const SIGNED_OUT: AccountReply = { ok: false, code: "signed-out", detail: "Sign in first." };
const GUEST: AccountReply = { ok: true, account: { ...ROW, admin: false, state: "guest", ways: { google: null, email: null, passkeys: 0 } } };
const PLAYER: AccountReply = { ok: true, account: { ...ROW, admin: false } };
const ADMIN: AccountReply = { ok: true, account: { ...ROW, admin: true, adminNeedsPasskey: false } };
const ADMIN_NEEDS_PASSKEY: AccountReply = { ok: true, account: { ...ROW, admin: false, adminNeedsPasskey: true } };

/** Opens the game at `path` with the game's account read answering `reply`; what was asked and where the address ended. */
async function openAt(path: string, reply: AccountReply | null): Promise<{ asked: Address[]; at: string; admin: boolean }> {
  window.history.replaceState({}, "", `${path}?from=link#top`);
  const asked: Address[] = [];
  const read = (address: Address) => {
    asked.push(address);
    return Promise.resolve(reply);
  };
  const { unmount } = render(
    <AddressGate read={read}>
      <p>the game</p>
    </AddressGate>,
  );
  if (addressOf(path) === "admin" && reply !== null && reply.ok && (reply.account.admin || reply.account.adminNeedsPasskey === true)) await screen.findByText("the admin chunk");
  else await waitFor(() => expect(window.location.pathname).toBe(path === "/admin" || addressOf(path) === "unknown" ? "/" : path));
  const seen = { asked, at: `${window.location.pathname}${window.location.search}${window.location.hash}`, admin: screen.queryByText("the admin chunk") !== null };
  expect(screen.queryByText("the game") !== null).toBe(!seen.admin);
  unmount();
  return seen;
}

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

describe("the address the game is opened at", () => {
  test("[server:unknown-address-becomes-root] given an address the game does not know, when the game has settled, then the game shows and the address is /, its query and fragment kept", async () => {
    for (const path of ["/anything", "/admins", "/invite", "/index.html", "/a/b/c"]) {
      expect(await openAt(path, PLAYER)).toEqual({ asked: ["unknown"], at: "/?from=link#top", admin: false });
    }
  });

  test("[server:unknown-address-becomes-root] [pair:invite-link-single-use] given / or an invite address, then the address stays and nothing is asked", async () => {
    for (const path of ["/", "/invite/abc123"]) {
      window.history.replaceState({}, "", path);
      const read = vi.fn(() => Promise.resolve(PLAYER));
      const { unmount } = render(
        <AddressGate read={read}>
          <p>the game</p>
        </AddressGate>,
      );
      await Promise.resolve();
      expect(screen.getByText("the game")).toBeTruthy();
      expect(window.location.pathname).toBe(path);
      expect(read).not.toHaveBeenCalled();
      unmount();
    }
  });

  test("[moderation:admin-view-for-admin-list] [server:unknown-address-becomes-root] given a signed-out browser, a guest, or a kept account off the admin list, when /admin opens, then all is as at an unknown address: the same game, the same one account read, / in the address bar, and the admin chunk never fetched", async () => {
    const fetchedBefore = chunk.fetched;
    for (const reply of [SIGNED_OUT, GUEST, PLAYER, null]) {
      const unknown = await openAt("/somewhere", reply);
      const admin = await openAt("/admin", reply);
      expect(admin).toEqual({ ...unknown, asked: ["admin"] });
      expect(admin).toEqual({ asked: ["admin"], at: "/?from=link#top", admin: false });
    }
    expect(chunk.fetched).toBe(fetchedBefore);
  });

  test("[moderation:admin-view-for-admin-list] given an account the server names as listed, with a passkey shown or not, when /admin opens, then the admin chunk is fetched and the address stays /admin", async () => {
    for (const reply of [ADMIN, ADMIN_NEEDS_PASSKEY]) {
      const seen = await openAt("/admin", reply);
      expect(seen).toEqual({ asked: ["admin"], at: "/admin?from=link#top", admin: true });
    }
    expect(chunk.fetched).toBe(1);
  });
});
