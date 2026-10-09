// The menu's moderation corner: the feedback button on every screen that has
// the menu (R-MODERATION-020), and, when the team has acted on this account
// or decided one of its reports, the notice with its one appeal per action
// (R-MODERATION-007, R-MODERATION-016).
import { BellDot, MessageSquareText } from "lucide-react";
import { useEffect, useState } from "react";

import { useGame } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Sheet } from "../../shared/ui/Sheet";
import { graphicsMode } from "../../shared/graphics/mode";
import { buildNumber, type ModerationApi, type Standing } from "../../shared/moderation/api";
import { useModeration } from "../../shared/moderation/ModerationProvider";
import { anyReasonWords, words } from "../../shared/moderation/moderation.words";

/** The screen feedback is sent from, as the game's own state names it. */
export function useScreenName(): string {
  return useGame((state) => {
    const view = state.view;
    if (state.signedOut) return "account";
    if (state.choosingLife) return "life-chooser";
    if (view === null) return "loading";
    if (view.prologue !== null) return "prologue";
    if (view.ended) return "ending";
    return view.place.where;
  });
}

export function FeedbackForm({ moderation, screen, max }: { moderation: ModerationApi; screen: string; max: number }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const used = [...text.trim()].length;

  async function send() {
    setBusy(true);
    const sent = await moderation.feedback({ text: text.trim(), build: buildNumber(), screen, mode: graphicsMode() });
    setBusy(false);
    if (sent.ok) {
      setText("");
      setNote({ tone: "ok", text: words("ui.feedback.sent") });
      return;
    }
    setNote({ tone: "bad", text: words(sent.code === "rate-limited" ? "ui.feedback.too-many" : "ui.feedback.failed") });
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="font-medium">{words("ui.feedback.label")}</span>
        <textarea value={text} rows={5} onChange={(event) => setText(event.target.value)} className="rounded-lg border border-sheet-line bg-sheet-2 p-3 text-ink" />
      </label>
      <p className={`text-sm ${used > max ? "text-bad" : "text-text-2"}`}>{words("ui.feedback.count", { used, max })}</p>
      <div>
        <Button type="submit" variant="primary" disabled={busy || used === 0 || used > max}>
          {words("ui.feedback.send")}
        </Button>
      </div>
      {note === null ? null : (
        <p role="status" className={note.tone === "bad" ? "text-bad" : "text-text-2"}>
          {note.text}
        </p>
      )}
    </form>
  );
}

/** `config.feedback.maxChars` lives on the server; the box mirrors its 500 until the server sends it. */
export const FEEDBACK_MAX_CHARS = 500;

const DAY_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function actionWords(action: Standing["actions"][number]): string {
  const params = { reason: anyReasonWords(action.reason), until: action.until === null ? "" : DAY_FORMAT.format(action.until) };
  switch (action.action) {
    case "warn":
      return words("ui.notice.warn", params);
    case "mute":
      return words("ui.notice.mute", params);
    case "suspend":
      return words("ui.notice.suspend", params);
    case "ban":
      return words("ui.notice.ban", params);
    default: {
      const never: never = action.action;
      return never;
    }
  }
}

function appealWords(appeal: NonNullable<Standing["actions"][number]["appeal"]>): string {
  if (appeal.status === "open") return words("ui.notice.appeal.open");
  return words(appeal.outcome === "overturned" ? "ui.notice.appeal.overturned" : "ui.notice.appeal.upheld");
}

/** R-MODERATION-007, R-MODERATION-016: what the team did about this account and its reports, and the appeal. */
export function NoticeView({ moderation, standing, onChange }: { moderation: ModerationApi; standing: Standing; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function appeal(entry: string) {
    setBusy(true);
    setProblem(null);
    const done = await moderation.appeal(entry);
    setBusy(false);
    if (done.ok) onChange();
    else setProblem(words("ui.notice.appeal.failed"));
  }

  return (
    <div className="flex flex-col gap-4">
      {standing.actions.length === 0 ? null : (
        <ul className="flex flex-col gap-3">
          {standing.actions.map((action) => (
            <li key={action.entry} className="flex flex-col gap-2 rounded-xl border border-sheet-line bg-sheet-2 p-4">
              <p>{actionWords(action)}</p>
              {action.appeal === null ? (
                <>
                  <p className="text-sm text-text-2">{words("ui.notice.appeal.intro")}</p>
                  <div>
                    <Button disabled={busy} onClick={() => void appeal(action.entry)}>
                      {words("ui.notice.appeal")}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-text-2">{appealWords(action.appeal)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {standing.reports.length === 0 ? null : (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold tracking-wide text-text-2 uppercase">{words("ui.notice.reports")}</h3>
          <ul className="flex flex-col gap-1">
            {standing.reports.map((report) => (
              <li key={report.id} className="flex justify-between gap-3">
                <span className="text-text-2">{DAY_FORMAT.format(report.at)}</span>
                <span>{words(report.status === "open" ? "ui.notice.report.open" : report.outcome === "acted" ? "ui.notice.report.acted" : "ui.notice.report.no-action")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {problem === null ? null : (
        <p role="alert" className="text-bad">
          {problem}
        </p>
      )}
    </div>
  );
}

/** The menu's two buttons. Nothing when the game runs without a server. */
export function ModerationMenu() {
  const moderation = useModeration();
  const screen = useScreenName();
  const [open, setOpen] = useState<"feedback" | "notice" | null>(null);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [asked, setAsked] = useState(0);

  useEffect(() => {
    if (moderation === null) return undefined;
    let live = true;
    void moderation.standing().then((reply) => {
      if (live && reply.ok) setStanding(reply.standing);
    });
    return () => {
      live = false;
    };
  }, [moderation, asked]);

  if (moderation === null) return null;
  const decided = standing !== null && (standing.actions.length > 0 || standing.reports.some((report) => report.status === "decided"));

  return (
    <>
      {decided ? (
        <Button small variant="quiet" aria-label={words("ui.notice")} onClick={() => setOpen("notice")}>
          <BellDot size={18} />
        </Button>
      ) : null}
      <Button small variant="quiet" aria-label={words("ui.feedback")} onClick={() => setOpen("feedback")}>
        <MessageSquareText size={18} />
      </Button>
      <Sheet open={open === "feedback"} onOpenChange={(next) => setOpen(next ? "feedback" : null)} title={words("ui.feedback.title")} description={words("ui.feedback.intro")}>
        <FeedbackForm moderation={moderation} screen={screen} max={FEEDBACK_MAX_CHARS} />
      </Sheet>
      {standing === null ? null : (
        <Sheet open={open === "notice"} onOpenChange={(next) => setOpen(next ? "notice" : null)} title={words("ui.notice.title")}>
          <NoticeView moderation={moderation} standing={standing} onChange={() => setAsked((count) => count + 1)} />
        </Sheet>
      )}
    </>
  );
}
