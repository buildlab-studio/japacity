// moderation:admin-view-for-admin-list: what /admin shows an account the server has already named as listed (App.tsx
// fetches this chunk for no one else). The admin page once the session has shown a passkey; until then the game, with a
// sheet that asks for the passkey in place. An admin route refused on the way (the passkey's window closed) asks again.
// Anyone the server does not name as an admin sees the game, with `/` in the address bar (server:unknown-address-becomes-root).
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { showRoot } from "../../app/address";
import { Button } from "../../shared/ui/Button";
import { Sheet } from "../../shared/ui/Sheet";
import { AdminPage } from "./AdminPage";
import { words, type AdminKey } from "./admin.words";
import { buildAdminApi, type AdminApi, type AdminStanding } from "./api";
import type { StepUp } from "./stepUp";

type Stage = "asking" | "admin" | "passkey" | "no-passkey" | "game";

function stageOf(standing: AdminStanding): Stage {
  switch (standing) {
    case "admin":
      return "admin";
    case "needs-passkey":
      return "passkey";
    case "add-passkey":
      return "no-passkey";
    case "not-admin":
      return "game";
    default: {
      const never: never = standing;
      throw new Error(`Unknown standing ${String(never)}.`);
    }
  }
}

const FAILED: Record<Exclude<StepUp, { ok: true }>["why"], AdminKey | null> = {
  cancelled: null,
  "other-account": "admin.passkey.other",
  unreachable: "admin.passkey.unreachable",
  failed: "admin.passkey.failed",
};

/** The page's calls, each refusal of which has the account's standing read again: a refused admin route may be a passkey window that closed. */
function watched(api: AdminApi, refused: () => void): AdminApi {
  const out: Record<string, unknown> = {};
  for (const [name, call] of Object.entries(api) as [string, unknown][]) {
    if (typeof call !== "function" || name === "standing" || name === "stepUp" || name === "imageUrl") {
      out[name] = call;
      continue;
    }
    out[name] = async (...args: unknown[]) => {
      const reply: unknown = await (call as (...given: unknown[]) => Promise<unknown>)(...args);
      if (typeof reply === "object" && reply !== null && (reply as { ok?: unknown }).ok === false && (reply as { code?: unknown }).code === "not-legal") refused();
      return reply;
    };
  }
  return out as unknown as AdminApi;
}

export function AdminRoute({ api, children }: { api?: AdminApi; children: ReactNode }) {
  const admin = useMemo(() => api ?? buildAdminApi(), [api]);
  const [stage, setStage] = useState<Stage>("asking");
  const [said, setSaid] = useState<AdminKey | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void admin.standing().then((standing) => {
      if (live) setStage(stageOf(standing));
    });
    return () => {
      live = false;
    };
  }, [admin]);

  useEffect(() => {
    if (stage === "game") showRoot();
  }, [stage]);

  const page = useMemo(
    () =>
      watched(admin, () => {
        void admin.standing().then((standing) => {
          if (standing === "admin") return;
          setSaid(standing === "needs-passkey" ? "admin.passkey.again" : null);
          setStage(stageOf(standing));
        });
      }),
    [admin],
  );

  const showPasskey = async () => {
    setBusy(true);
    setSaid(null);
    const result = await admin.stepUp();
    if (result.ok) {
      const standing = await admin.standing();
      // A passkey that verified no one opens a session that does not count.
      if (standing === "needs-passkey") setSaid("admin.passkey.unverified");
      else setStage(stageOf(standing));
    } else {
      setSaid(FAILED[result.why]);
    }
    setBusy(false);
  };

  if (stage === "admin") return <AdminPage api={page} />;
  const asking = stage === "passkey" || stage === "no-passkey";
  const description: AdminKey = stage === "no-passkey" ? "admin.passkey.none" : said === "admin.passkey.again" ? "admin.passkey.again" : "admin.passkey.ask";
  return (
    <>
      {children}
      <Sheet
        open={asking}
        onOpenChange={(open) => {
          if (!open) setStage("game");
        }}
        title={words("admin.passkey.title")}
        description={words(description)}
      >
        {said === null || said === "admin.passkey.again" ? null : (
          <p role="alert" className="text-sm">
            {words(said)}
          </p>
        )}
        <div className="flex flex-col gap-2">
          {stage === "passkey" ? (
            <Button variant="primary" disabled={busy} onClick={() => void showPasskey()}>
              {words("admin.passkey.use")}
            </Button>
          ) : null}
          <Button variant={stage === "passkey" ? "quiet" : "secondary"} onClick={() => setStage("game")}>
            {words("admin.back")}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
