// moderation:admin-view-for-admin-list: the admin page's address, kept apart from the page so the game's own chunk can ask whether
// the address is /admin without carrying the page, its tabs and its words (App.tsx loads them only there).
export const ADMIN_PATH = "/admin";

/** True when `pathname`, with any trailing slash dropped, is the admin page's address. */
export function adminAsked(pathname: string): boolean {
  return pathname.replace(/\/+$/, "") === ADMIN_PATH;
}
