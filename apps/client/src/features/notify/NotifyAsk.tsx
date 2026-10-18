// The ask for the bank-full notice (docs/rules/clock.md R-CLOCK-031): one sheet,
// once after a good moment has been seen and its report closed, on a device
// that has neither agreed nor refused. "Not now" is kept on the device and
// waits `reaskDays`; the browser's own refusal is never asked past.
import { useEffect, useMemo, useRef, useState } from "react";

import { useGame } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Sheet } from "../../shared/ui/Sheet";
import { useEarlyWin } from "../../shared/ui/stage";
import { say } from "../../shared/words/text";
import type { CountAsk } from "./ask";
import { countAsk, isGoodMoment, mayAsk } from "./ask";
import type { NotifyApi, NotifyDevice, NotifyStatus } from "./notify.api";
import { browserDevice, defaultNotifyApi } from "./notify.api";

export interface NotifyAskProps {
  /** Seams for tests. `api` null: no server, no ask. */
  api?: NotifyApi | null;
  device?: NotifyDevice;
  /** R-GUIDE-015: true once the early win has been shown. The store's flag unless a test hands in its own. */
  earlyWin?: () => boolean;
  count?: CountAsk;
}

export function NotifyAsk({ api, device, earlyWin: given, count = countAsk }: NotifyAskProps) {
  const [seams] = useState(() => ({ api: api === undefined ? defaultNotifyApi() : api, device: device ?? browserDevice() }));
  const won = useEarlyWin();
  const earlyWin = useMemo(() => given ?? (() => won), [given, won]);
  const lines = useGame((state) => state.lines);
  const moments = useGame((state) => state.moments.length);
  const reportOpen = useGame((state) => state.reportOpen);
  const seen = useRef(lines);
  const live = useRef(true);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<NotifyStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  // The lines held when the screen mounts are never a moment: nothing is asked on load.
  useEffect(() => {
    if (lines === seen.current) return;
    seen.current = lines;
    if (isGoodMoment(lines) && earlyWin()) setPending(true);
  }, [lines, earlyWin]);

  useEffect(() => {
    const { api: server, device: browser } = seams;
    if (!pending || moments > 0 || reportOpen || server === null) return;
    setPending(false);
    if (browser.permission() !== "default") return;
    void server.status().then((found) => {
      if (!live.current || found === null) return;
      if (!mayAsk({ permission: browser.permission(), key: found.key, dismissedAt: browser.dismissedAt(), now: browser.now(), reaskDays: found.reaskDays })) return;
      setStatus(found);
      setOpen(true);
      count("ask/shown", "notify", "after");
    });
  }, [pending, moments, reportOpen, seams, count]);

  function dismiss() {
    seams.device.dismiss(seams.device.now());
    setOpen(false);
  }

  async function accept() {
    const { api: server, device: browser } = seams;
    const key = status?.key ?? null;
    if (server === null || key === null) return;
    setBusy(true);
    setProblem(null);
    try {
      const answer = await browser.requestPermission();
      if (answer === "default") return dismiss();
      if (answer !== "granted") return setOpen(false);
      const subscription = await browser.subscribe(key);
      if (subscription !== null && (await server.subscribe(subscription))) {
        count("ask/accepted", "notify", "after");
        setOpen(false);
        return;
      }
      setProblem(say("ui.notify.failed"));
    } finally {
      if (live.current) setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : dismiss())} title={say("ui.notify.ask.title")}>
      <p>{say("ui.notify.ask.body")}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={busy} onClick={() => void accept()}>
          {say("ui.notify.ask.yes")}
        </Button>
        <Button disabled={busy} onClick={dismiss}>
          {say("ui.notify.ask.no")}
        </Button>
      </div>
      {problem === null ? null : (
        <p role="alert" className="text-bad">
          {problem}
        </p>
      )}
    </Sheet>
  );
}
