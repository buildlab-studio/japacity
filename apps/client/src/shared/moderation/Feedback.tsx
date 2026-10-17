// The team's corner of the game (moderation.md): the feedback box (R-MODERATION-020), and, when the team has acted on
// this account or decided one of its reports, the notice with its one appeal per action (R-MODERATION-007,
// R-MODERATION-016). In the world they are two rows in the phone's Settings, the game's menu now; the broken screen's
// Tell us opens the same box (analytics.md R-ANALYTICS-002).
import { BellDot, MessageSquareText } from "lucide-react";
import { useEffect, useState } from "react";

import { useGame } from "../../authority/GameProvider";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { graphicsMode } from "../graphics/mode";
import { buildNumber, type ModerationApi, type Standing } from "./api";
import { useModeration } from "./ModerationProvider";
import { anyReasonWords, words } from "./moderation.words";

/** The screen feedback is sent from, as the game's own state names it. */
function useScreenName(): string {
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

/** `initial`: words already in the box, as the broken screen's Tell us writes them in (R-ANALYTICS-002). */
export function FeedbackForm({ moderation, screen, max, initial = "" }: { moderation: ModerationApi; screen: string; max: number; initial?: string }) {
  const [text, setText] = useState(initial);
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
        <textarea value={text} rows={5} onChange={(event) => setText(event.target.value)} className="rounded-md border border-sheet-line bg-sheet-2 p-3 text-ink" />
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

/** `config.feedback.maxChars` lives on the server, which does not send it, so the box mirrors its 500. */
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
            <li key={action.entry} className="lively-card flex flex-col gap-2 p-3.5">
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
          <h3 className="text-[15px] font-semibold text-text-2">{words("ui.notice.reports")}</h3>
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

/**
 * The team's two rows in the phone's Settings: Feedback always, and the team's notice once the team has decided
 * something. Nothing when the game runs without a server.
 */
export function ModerationRows() {
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
    <div className="mt-3 flex flex-col gap-2" data-moderation-rows>
      {decided ? (
        <button type="button" className="phone-ghost w-full" onClick={() => setOpen("notice")}>
          <BellDot size={18} aria-hidden />
          {words("ui.notice")}
        </button>
      ) : null}
      <button type="button" className="phone-ghost w-full" onClick={() => setOpen("feedback")}>
        <MessageSquareText size={18} aria-hidden />
        {words("ui.feedback")}
      </button>
      <Sheet open={open === "feedback"} onOpenChange={(next) => setOpen(next ? "feedback" : null)} title={words("ui.feedback.title")} description={words("ui.feedback.intro")}>
        <FeedbackForm moderation={moderation} screen={screen} max={FEEDBACK_MAX_CHARS} />
      </Sheet>
      {standing === null ? null : (
        <Sheet open={open === "notice"} onOpenChange={(next) => setOpen(next ? "notice" : null)} title={words("ui.notice.title")}>
          <NoticeView moderation={moderation} standing={standing} onChange={() => setAsked((count) => count + 1)} />
        </Sheet>
      )}
    </div>
  );
}
