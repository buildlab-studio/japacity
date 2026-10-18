// server:unknown-address-becomes-root, moderation:admin-view-for-admin-list: the addresses the game knows, and the one
// that takes any other address back to `/` once the game has settled. Kept apart from the admin page so the game's own
// chunk carries none of it.
import type { AccountReply } from "@japacity/api";

import { inviteCodeOf } from "../features/account/InvitePage";
import { adminAsked } from "../features/admin/adminPath";

export type Address = "root" | "admin" | "invite" | "unknown";

export function addressOf(pathname: string): Address {
  if (pathname === "/" || pathname === "") return "root";
  if (adminAsked(pathname)) return "admin";
  return inviteCodeOf(pathname) === null ? "unknown" : "invite";
}

/** The address bar shows `/`, with the query and the fragment it had, and nothing reloads. */
export function showRoot(): void {
  if (typeof history === "undefined" || typeof location === "undefined") return;
  history.replaceState(history.state, "", `/${location.search}${location.hash}`);
}

/** The server says the account is on the admin list: the admin view opens, or asks this account for its passkey. Nobody else is told anything. */
export function listedAsAdmin(reply: AccountReply | null): boolean {
  return reply !== null && reply.ok && (reply.account.admin || reply.account.adminNeedsPasskey === true);
}
