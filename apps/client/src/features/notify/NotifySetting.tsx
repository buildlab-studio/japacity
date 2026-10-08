// The bank-full notice's switch in the account settings (docs/rules/clock.md
// R-CLOCK-031). On asks the browser and keeps this device; off forgets every
// device of the account (account.md R-ACCOUNT-020).
import { useEffect, useState } from "react";

import { say } from "../../shared/words/text";
import type { NotifyApi, NotifyDevice, NotifyStatus, Permission } from "./notify.api";
import { browserDevice, defaultNotifyApi } from "./notify.api";

export interface NotifySettingProps {
  /** Seams for tests. `api` null: no server, no setting. */
  api?: NotifyApi | null;
  device?: NotifyDevice;
}

function noteFor(permission: Permission): string | null {
  switch (permission) {
    case "unsupported":
      return say("ui.notify.unsupported");
    case "denied":
      return say("ui.notify.blocked");
    case "default":
    case "granted":
      return null;
    default: {
      const never: never = permission;
      throw new Error(`Unknown permission ${String(never)}`);
    }
  }
}

export function NotifySetting({ api, device }: NotifySettingProps) {
  const [seams] = useState(() => ({ api: api === undefined ? defaultNotifyApi() : api, device: device ?? browserDevice() }));
  const [status, setStatus] = useState<NotifyStatus | null>(null);
  const [permission, setPermission] = useState<Permission>(() => seams.device.permission());
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let gone = false;
    void seams.api?.status().then((found) => {
      if (!gone) setStatus(found);
    });
    return () => {
      gone = true;
    };
  }, [seams]);

  if (seams.api === null || status === null || status.key === null) return null;
  const server = seams.api;
  const key = status.key;
  const shown = { ...status, key };

  async function turnOn() {
    const answer = await seams.device.requestPermission();
    setPermission(answer);
    if (answer !== "granted") return;
    const subscription = await seams.device.subscribe(key);
    if (subscription !== null && (await server.subscribe(subscription))) setStatus({ ...shown, on: true });
    else setProblem(say("ui.notify.failed"));
  }

  async function turnOff() {
    await seams.device.unsubscribe();
    if (await server.turnOff()) setStatus({ ...shown, on: false });
    else setProblem(say("ui.notify.failed"));
  }

  async function change(on: boolean) {
    setBusy(true);
    setProblem(null);
    try {
      await (on ? turnOn() : turnOff());
    } finally {
      setBusy(false);
    }
  }

  const note = status.on ? null : noteFor(permission);
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      <label className="flex min-h-11 items-center justify-between gap-3">
        <span>{say("ui.notify.setting")}</span>
        <input
          type="checkbox"
          role="switch"
          className="size-5 accent-accent"
          checked={status.on}
          disabled={busy || (!status.on && (permission === "denied" || permission === "unsupported"))}
          onChange={(event) => void change(event.currentTarget.checked)}
        />
      </label>
      {note === null ? null : <p className="text-sm text-muted">{note}</p>}
      {problem === null ? null : (
        <p role="alert" className="text-bad">
          {problem}
        </p>
      )}
    </div>
  );
}
