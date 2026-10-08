// R-MODERATION-001 to 007, R-PAIR-014: the block and report control, one per
// place another player or an advert appears. One tap blocks. Two report: one
// opens the reasons, one picks a reason and sends, with a block ticked beside
// it. The control sends what the surface knows as the cites; no typed text.
import { Ban, Flag } from "lucide-react";
import { useState } from "react";

import { Button } from "../../shared/ui/Button";
import { Sheet } from "../../shared/ui/Sheet";
import { REPORT_REASONS, type ReportCite, type ReportReason } from "./contract";
import { useModeration } from "./ModerationProvider";
import { reasonWords, words } from "./moderation.words";

/** Who the control is about: another player by account, or an advert by its campaign. */
export type Someone = { account: string; name: string } | { campaign: string; name: string };

export interface BlockReportProps {
  who: Someone;
  cites: ReportCite;
  /** Names the surface for the test that walks every one (R-MODERATION-003). */
  surface: string;
}

type Note = { tone: "ok" | "bad"; text: string } | null;

export function BlockReport({ who, cites, surface }: BlockReportProps) {
  const moderation = useModeration();
  const [blocked, setBlocked] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  if (moderation === null) return null;
  const account = "account" in who ? who.account : null;

  async function toggleBlock(target: string) {
    setBusy(true);
    const done = blocked ? await moderation?.unblock(target) : await moderation?.block(target);
    setBusy(false);
    if (done?.ok !== true) return setNote({ tone: "bad", text: words("ui.report.failed") });
    setNote({ tone: "ok", text: words(blocked ? "ui.block.undone" : "ui.block.done") });
    setBlocked(!blocked);
  }

  async function report(reason: ReportReason, alsoBlock: boolean) {
    if (moderation === null) return;
    setBusy(true);
    const subject = "account" in who ? { account: who.account } : { campaign: who.campaign };
    const sent = await moderation.report({ subject, reason, cites });
    if (sent.ok && alsoBlock && account !== null && !blocked) {
      const done = await moderation.block(account);
      if (done.ok) setBlocked(true);
    }
    setBusy(false);
    setOpen(false);
    setNote(sent.ok ? { tone: "ok", text: words("ui.report.sent") } : { tone: "bad", text: words("ui.report.failed") });
  }

  return (
    <div data-moderation={surface} className="flex flex-wrap items-center gap-2">
      {account === null ? null : (
        <Button small variant="quiet" disabled={busy} aria-pressed={blocked} onClick={() => void toggleBlock(account)}>
          <Ban size={16} aria-hidden />
          {blocked ? words("ui.block.undo") : words("ui.block")}
        </Button>
      )}
      <Button small variant="quiet" disabled={busy} onClick={() => setOpen(true)}>
        <Flag size={16} aria-hidden />
        {words("ui.report")}
      </Button>
      {note === null ? null : (
        <p role="status" className={`text-sm ${note.tone === "bad" ? "text-bad" : "text-muted"}`}>
          {note.text}
        </p>
      )}
      <ReportSheet open={open} onOpenChange={setOpen} name={who.name} canBlock={account !== null && !blocked} busy={busy} onSend={(reason, alsoBlock) => void report(reason, alsoBlock)} />
    </div>
  );
}

function ReportSheet({
  open,
  onOpenChange,
  name,
  canBlock,
  busy,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  canBlock: boolean;
  busy: boolean;
  onSend: (reason: ReportReason, alsoBlock: boolean) => void;
}) {
  // R-MODERATION-006: offered in the same step, ticked by default.
  const [alsoBlock, setAlsoBlock] = useState(true);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={words("ui.report.title", { name })} description={words("ui.report.intro")}>
      {canBlock ? (
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="size-5 accent-ink" checked={alsoBlock} onChange={(event) => setAlsoBlock(event.target.checked)} />
          {words("ui.report.also-block")}
        </label>
      ) : null}
      <ul className="flex flex-col gap-2">
        {REPORT_REASONS.map((reason) => (
          <li key={reason}>
            <Button className="w-full justify-start" disabled={busy} onClick={() => onSend(reason, canBlock && alsoBlock)}>
              {reasonWords(reason)}
            </Button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
