// R-MODERATION-012: the admin page mounts at /admin only once the server says
// the signed-in account is on its admin list. Until then, and for everyone
// else, the address shows the ordinary app.
import { useEffect, useState, type ReactNode } from "react";

import { ADMIN_PATH, AdminPage } from "./AdminPage";
import { buildAdminApi, type AdminApi } from "./api";

function atAdminPath(): boolean {
  return globalThis.location?.pathname.replace(/\/+$/, "") === ADMIN_PATH;
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
