// Block and report, one tap from wherever another player appears (R-PAIR-014).
// A block ends everything between the two and costs the blocker nothing
// (R-PAIR-015); a report offers a block in the same step, ticked (R-MODERATION-006).
import { Ban, Flag } from "lucide-react";
import { useId, useState } from "react";

import type { ModerationReply, ReportReason } from "../../shared/net/contract";
import { Button } from "../../shared/ui/Button";
import { rejectionWords } from "../../authority/store";
import { say } from "../../shared/words/text";
import type { PairApi } from "./pairApi";

const REASONS: readonly ReportReason[] = ["scam", "harassment", "impersonation", "underage", "sexual", "hate", "self-harm", "illegal", "cheating", "other"];

type Open = "none" | "block" | "report";

function outcome(reply: ModerationReply, done: string): string {
  return reply.ok ? say(done) : say("ui.pair.failed", { why: rejectionWords(reply.code) });
}

/** `messages`: the conversation's rows from the other side, cited by a report made there. */
export function Safety({ api, pair, messages = [], onBlocked }: { api: PairApi; pair: string; messages?: readonly string[]; onBlocked?: () => void }) {
  const id = useId();
  const [open, setOpen] = useState<Open>("none");
  const [reason, setReason] = useState<ReportReason>("harassment");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  const run = async (work: () => Promise<ModerationReply>, done: string, blocks: boolean) => {
    setBusy(true);
    try {
      const reply = await work();
      setSaid(outcome(reply, done));
      if (reply.ok) {
        setOpen("none");
        if (blocks) onBlocked?.();
      }
    } catch (error) {
      setSaid(say("ui.pair.failed", { why: error instanceof Error ? error.message : String(error) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2" data-safety>
      <div className="flex flex-wrap gap-2">
        <Button small variant="quiet" aria-expanded={open === "block"} onClick={() => setOpen(open === "block" ? "none" : "block")}>
          <Ban size={14} />
          {say("ui.pair.block")}
        </Button>
        <Button small variant="quiet" aria-expanded={open === "report"} onClick={() => setOpen(open === "report" ? "none" : "report")}>
          <Flag size={14} />
          {say("ui.pair.report")}
        </Button>
      </div>
      {open === "block" ? (
        <div role="group" aria-label={say("ui.pair.block.title")} className="flex flex-col gap-2 rounded-lg bg-sunk p-3 text-sm">
          <p className="font-semibold">{say("ui.pair.block.title")}</p>
          <p>{say("ui.pair.block.help")}</p>
          <div>
            <Button small disabled={busy} onClick={() => void run(() => api.block(pair), "ui.pair.blocked", true)}>
              {say("ui.pair.block.confirm")}
            </Button>
          </div>
        </div>
      ) : null}
      {open === "report" ? (
        <form
          aria-label={say("ui.pair.report.title")}
          className="flex flex-col gap-2 rounded-lg bg-sunk p-3 text-sm"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => api.report(pair, reason, [...messages], alsoBlock), "ui.pair.reported", alsoBlock);
          }}
        >
          <p className="font-semibold">{say("ui.pair.report.title")}</p>
          <p>{say("ui.pair.report.help")}</p>
          <label htmlFor={`${id}-reason`} className="font-medium">
            {say("ui.pair.report.reason")}
          </label>
          <select id={`${id}-reason`} value={reason} onChange={(event) => setReason(event.target.value as ReportReason)} className="min-h-11 rounded-lg border border-line bg-paper px-3">
            {REASONS.map((value) => (
              <option key={value} value={value}>
                {say(`ui.pair.reason.${value}`)}
              </option>
            ))}
          </select>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={alsoBlock} onChange={(event) => setAlsoBlock(event.target.checked)} className="size-5" />
            {say("ui.pair.report.also-block")}
          </label>
          <div>
            <Button small type="submit" disabled={busy}>
              {say("ui.pair.report.send")}
            </Button>
          </div>
        </form>
      ) : null}
      {said === null ? null : (
        <p role="status" className="text-sm">
          {said}
        </p>
      )}
    </div>
  );
}
