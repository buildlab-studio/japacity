// moderation:admin-view-for-admin-list: the admin page mounts at /admin only once the server says
// the signed-in account is on its admin list. Until then, and for everyone
// else, the address shows the ordinary app.
import { useEffect, useState, type ReactNode } from "react";

import { AdminPage } from "./AdminPage";
import { adminAsked } from "./adminPath";
import { buildAdminApi, type AdminApi } from "./api";

function atAdminPath(): boolean {
  return adminAsked(globalThis.location?.pathname ?? "/");
}

export function AdminRoute({ api, children }: { api?: AdminApi; children: ReactNode }) {
  const [asking] = useState(atAdminPath);
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    if (!asking) return undefined;
    let live = true;
    void (api ?? buildAdminApi()).isAdmin().then((yes) => {
      if (live) setAdmin(yes);
    });
    return () => {
      live = false;
    };
  }, [api, asking]);
  if (asking && admin) return <AdminPage api={api ?? buildAdminApi()} />;
  return <>{children}</>;
}
