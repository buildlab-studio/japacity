// R-MODERATION-001 to 007, R-PAIR-014 to 016: the block and report control,
// one per place another player or an advert appears, shared by every screen
// that shows one (R-MODERATION-003). One tap blocks. Two report: one opens the
// reasons, one picks a reason and sends, with a block ticked beside it. The
// control sends what the surface knows as the cites; no typed text.
import { type BlockRequest, REPORT_REASONS, type ReportCite, type ReportReason } from "@japacity/api";
import { Ban, Flag } from "lucide-react";
import { useState } from "react";

import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import type { ReportRequest } from "./api";
import { useModeration } from "./ModerationProvider";
import { reasonWords, words } from "./moderation.words";

/**
 * Who the control is about: a player the reader shares a pair with, an
 * advert by its campaign, or someone the server can be told about but not
 * blocked from here (a card before sign-up, a phrase heard in a place).
 */
export type Someone = { pair: string; name: string } | { campaign: string; name: string } | { name: string };

/** R-MODERATION-003: every surface the interface shows the control on, for the test that walks them. */
export const MODERATION_SURFACES = ["pair", "conversation", "invite-card", "advert"] as const;

/**
 * No screen shows a phrase said in a place (R-PAIR-012 has no client) or a
 * player seen in one (presence carries no id and R-MODERATION-004 names no cite
 * for it); the control takes the place cite all the same.
 */
export type Surface = (typeof MODERATION_SURFACES)[number] | "place-phrase";

export interface BlockReportProps {
  who: Someone;
  cites: ReportCite;
  surface: Surface;
  /** Called once the other side is blocked, so the screen can say it is over. */
  onBlocked?: () => void;
}

type Note = { tone: "ok" | "bad"; text: string } | null;

/** The body the server reads: the pair form where a pair is cited, the cite form for everything else. */
export function reportBody(who: Someone, cites: ReportCite, reason: ReportReason, alsoBlock: boolean): ReportRequest {
  if ("pair" in who && ("pair" in cites || "messages" in cites)) {
    return { pair: who.pair, reason, ...("messages" in cites ? { messages: cites.messages } : {}), block: alsoBlock };
  }
  return { ...("campaign" in who ? { subject: { campaign: who.campaign } } : {}), reason, cites };
}

export function BlockReport({ who, cites, surface, onBlocked }: BlockReportProps) {
  const moderation = useModeration();
  const [blocked, setBlocked] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  if (moderation === null) return null;
  const target: BlockRequest | null = "pair" in who ? { pair: who.pair } : null;

  async function toggleBlock(on: BlockRequest) {
    setBusy(true);
    const done = blocked ? await moderation?.unblock(on) : await moderation?.block(on);
    setBusy(false);
    if (done?.ok !== true) return setNote({ tone: "bad", text: words("ui.report.failed") });
    setNote({ tone: "ok", text: words(blocked ? "ui.block.undone" : "ui.block.done") });
    if (!blocked) onBlocked?.();
    setBlocked(!blocked);
  }

  async function report(reason: ReportReason, alsoBlock: boolean) {
    if (moderation === null) return;
    setBusy(true);
    const sent = await moderation.report(reportBody(who, cites, reason, alsoBlock));
    setBusy(false);
    setOpen(false);
    if (sent.ok && alsoBlock) {
      setBlocked(true);
      onBlocked?.();
    }
    setNote(sent.ok ? { tone: "ok", text: words("ui.report.sent") } : { tone: "bad", text: words("ui.report.failed") });
  }

  return (
    <div data-moderation={surface} className="flex flex-wrap items-center gap-2">
      {target === null ? null : (
        <Button small variant="quiet" disabled={busy} aria-pressed={blocked} onClick={() => void toggleBlock(target)}>
          <Ban size={16} aria-hidden />
          {blocked ? words("ui.block.undo") : words("ui.block")}
        </Button>
      )}
      <Button small variant="quiet" disabled={busy} onClick={() => setOpen(true)}>
        <Flag size={16} aria-hidden />
        {words("ui.report")}
      </Button>
      {note === null ? null : (
        <p role="status" className={`text-sm ${note.tone === "bad" ? "text-bad" : "text-text-2"}`}>
          {note.text}
        </p>
      )}
      <ReportSheet
        open={open}
        onOpenChange={setOpen}
        name={who.name}
        canBlock={target !== null && !blocked}
        advert={"campaign" in who}
        busy={busy}
        onSend={(reason, alsoBlock) => void report(reason, alsoBlock)}
      />
    </div>
  );
}

function ReportSheet({
  open,
  onOpenChange,
  name,
  canBlock,
  advert,
  busy,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  canBlock: boolean;
  /** R-MODERATION-004: `advert` is a reason for adverts only. */
  advert: boolean;
  busy: boolean;
  onSend: (reason: ReportReason, alsoBlock: boolean) => void;
}) {
  const reasons = REPORT_REASONS.filter((reason) => advert || reason !== "advert");
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
        {reasons.map((reason) => (
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
