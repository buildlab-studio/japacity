// The admin page's parts (admin:sections-alarms-first, admin:titles-and-values, admin:actions-confirm-with-reason): a card, a
// stat card, a state pill, label and value rows, a table, a table of bars drawn to one scale, the period picker, a field,
// a choice, a reply shown as it came, an action confirmed before it is sent, and a dialog that takes a reason.
import type { AdminRefusal, CheckState } from "@japacity/api";
import { useCallback, useEffect, useId, useState, type ComponentProps, type ReactNode } from "react";

import { Button } from "../../shared/ui/Button";
import { Sheet } from "../../shared/ui/Sheet";
import { words } from "./admin.words";

export type Reply = { ok: true } | AdminRefusal;

/** A refusal as the server worded it, with its code and any checks it named as missing. */
export function Refusal({ reply }: { reply: AdminRefusal }) {
  return (
    <div role="alert" className="flex flex-col gap-1 rounded-md border border-bad bg-(--bad-fill) p-3 text-sm text-bad">
      <p>{reply.code === undefined ? words("admin.refused", { detail: reply.detail }) : words("admin.refused.code", { code: reply.code, detail: reply.detail })}</p>
      {reply.missing === undefined || reply.missing.length === 0 ? null : <p>{words("admin.missing", { missing: reply.missing.join(", ") })}</p>}
    </div>
  );
}

/** What a GET answered, and a way to ask again. Null until the first answer. */
export function useLoad<T extends Reply>(load: () => Promise<T>): { reply: T | null; reload: () => void } {
  const [reply, setReply] = useState<T | null>(null);
  const [asked, setAsked] = useState(0);
  useEffect(() => {
    let live = true;
    void load().then((answer) => {
      if (live) setReply(answer);
    });
    return () => {
      live = false;
    };
    // `load` is made fresh on every render; only `asked` asks again.
  }, [asked]);
  const reload = useCallback(() => setAsked((count) => count + 1), []);
  return { reply, reload };
}

export type Load<T extends Reply> = ReturnType<typeof useLoad<T>>;

/** The answer of a load: loading, the refusal, or the page made from it. */
export function Loaded<T extends Reply>({ reply, children }: { reply: T | null; children: (ok: Extract<T, { ok: true }>) => ReactNode }) {
  if (reply === null) return <p className="text-sm text-text-2">{words("admin.loading")}</p>;
  if (!reply.ok) return <Refusal reply={reply} />;
  return <>{children(reply as Extract<T, { ok: true }>)}</>;
}

/** A card: a white ground, a hairline, a title in the corner, an action beside it. */
export function Card({ title, subtitle, action, children, className = "", span = false, ...rest }: { title?: string; subtitle?: string | undefined; action?: ReactNode; children: ReactNode; className?: string; span?: boolean } & Record<`data-${string}`, string>) {
  const id = useId();
  const inner = (
    <>
      {title === undefined ? null : (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <h2 id={id} className="text-sm font-semibold">
              {title}
            </h2>
            {subtitle === undefined ? null : <span className="text-sm text-text-2">{subtitle}</span>}
          </span>
          {action}
        </div>
      )}
      {children}
    </>
  );
  const classes = `flex min-w-0 flex-col gap-3 rounded-xl border border-sheet-line bg-sheet-2 p-4 ${span ? "lg:col-span-2" : ""} ${className}`;
  return title === undefined ? (
    <div className={classes} {...rest}>
      {inner}
    </div>
  ) : (
    <section aria-labelledby={id} className={classes} {...rest}>
      {inner}
    </section>
  );
}

/** A stat card: a small label over a large figure, a note under it. */
export function Stat({ label, value, note, tone = "plain" }: { label: string; value: string; note?: ReactNode; tone?: "plain" | "good" | "bad" }) {
  const id = useId();
  const colour = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "";
  return (
    <div role="group" aria-labelledby={id} className="flex min-w-0 flex-col gap-1 rounded-xl border border-sheet-line bg-sheet-2 px-4 py-3">
      <span id={id} className="text-[11px] font-semibold tracking-wider text-text-2 uppercase">
        {label}
      </span>
      <span className={`text-[1.75rem] leading-none font-semibold tabular-nums ${colour}`}>{value}</span>
      {note === undefined ? null : <span className="text-xs text-text-2">{note}</span>}
    </div>
  );
}

/** A row of stat cards that fills the width it has. */
export function Stats({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{children}</div>;
}

export type Tone = CheckState | "wait" | "plain";

const PILLS: Record<Tone, string> = {
  ok: "bg-(--good-fill) text-good before:bg-good",
  alarm: "bg-(--bad-fill) text-bad before:bg-bad",
  "no-data": "bg-sheet-muted text-text-2 before:bg-text-2",
  wait: "bg-(--wait-fill) text-(--wait) before:bg-(--wait)",
  plain: "bg-sheet-muted text-text-2 before:bg-text-2",
};

/** A state as a soft pill with a dot. */
export function Pill({ tone, children, ...rest }: { tone: Tone; children: ReactNode } & Record<`data-${string}`, string>) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2 pl-1.5 text-xs font-semibold whitespace-nowrap before:size-1.5 before:rounded-full before:content-[''] ${PILLS[tone]}`} {...rest}>
      {children}
    </span>
  );
}

export function stateWords(state: CheckState): string {
  return words(state === "ok" ? "admin.state.ok" : state === "alarm" ? "admin.state.alarm" : "admin.state.no-data");
}

/** A count on the rail: in alarm in red, waiting for a person in orange; nothing at zero. */
export function Badge({ count, tone }: { count: number; tone: "alarm" | "wait" }) {
  if (count === 0) return null;
  const colour = tone === "alarm" ? "bg-(--bad-fill) text-bad" : "bg-(--wait-fill) text-(--wait)";
  return <span className={`ml-auto inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${colour}`}>{count}</span>;
}

export interface Row {
  label: string;
  value: ReactNode;
  note?: string;
}

/** Label on the left, value on the right, a note under the label. */
export function Rows({ rows, label }: { rows: readonly Row[]; label?: string }) {
  return (
    <ul aria-label={label} className="flex flex-col divide-y divide-sheet-line">
      {rows.length === 0 ? (
        <li className="py-2 text-sm text-text-2">{words("admin.none")}</li>
      ) : (
        rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-4 py-2 text-sm">
            <span className="min-w-0">
              <span className="block">{row.label}</span>
              {row.note === undefined ? null : <span className="block text-xs text-text-2">{row.note}</span>}
            </span>
            <span className="shrink-0 font-medium tabular-nums">{row.value}</span>
          </li>
        ))
      )}
    </ul>
  );
}

export function Table({ caption, head, rows, hideCaption = false }: { caption: string; head: readonly string[]; rows: readonly (readonly ReactNode[])[]; hideCaption?: boolean }) {
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm tabular-nums">
        <caption className={hideCaption ? "sr-only" : "pb-2 text-left text-sm font-semibold"}>{caption}</caption>
        <thead>
          <tr className="border-b border-sheet-line">
            {head.map((name, at) => (
              <th key={`${name}-${String(at)}`} scope="col" className="py-1.5 pr-3 text-[11px] font-semibold tracking-wider whitespace-nowrap text-text-2 uppercase">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={head.length} className="py-2 text-text-2">
                {words("admin.none")}
              </td>
            </tr>
          ) : (
            rows.map((cells, row) => (
              <tr key={row} className="border-b border-sheet-line align-top last:border-b-0">
                {cells.map((cell, column) => (
                  <td key={column} className="py-2 pr-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export interface Bar {
  label: string;
  /** The bar's size; null draws no bar. */
  size: number | null;
  /** The figure beside it. */
  text: string;
}

/** Labels, bars drawn to one scale and figures, as a table: the bar's cell has no words, so the row reads as its label and figure. */
export function BarTable({ caption, head, bars, hideCaption = false }: { caption: string; head: readonly [string, string]; bars: readonly Bar[]; hideCaption?: boolean }) {
  const largest = Math.max(1, ...bars.map((bar) => bar.size ?? 0));
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm tabular-nums">
        <caption className={hideCaption ? "sr-only" : "pb-2 text-left text-sm font-semibold"}>{caption}</caption>
        <thead>
          <tr className="border-b border-sheet-line">
            <th scope="col" className="py-1.5 pr-3 text-[11px] font-semibold tracking-wider text-text-2 uppercase">
              {head[0]}
            </th>
            <th scope="col" aria-label={words("admin.bar")} className="w-full py-1.5" />
            <th scope="col" className="py-1.5 pl-3 text-right text-[11px] font-semibold tracking-wider text-text-2 uppercase">
              {head[1]}
            </th>
          </tr>
        </thead>
        <tbody>
          {bars.length === 0 ? (
            <tr>
              <td colSpan={3} className="py-2 text-text-2">
                {words("admin.none")}
              </td>
            </tr>
          ) : (
            bars.map((bar) => (
              <tr key={bar.label}>
                <td className="py-1.5 pr-3 whitespace-nowrap">{bar.label}</td>
                <td className="py-1.5">
                  {bar.size === null ? null : <span aria-hidden="true" className="block h-2.5 rounded-full bg-(--bar) opacity-80" style={{ width: `${String(Math.max(2, (bar.size / largest) * 100))}%` }} />}
                </td>
                <td className="py-1.5 pl-3 text-right whitespace-nowrap text-text-2">{bar.text}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export const PERIODS = ["today", "last7", "last30"] as const;

export type Period = (typeof PERIODS)[number];

/** admin:period-is-today-7-or-30: today, the last 7 whole days, the last 30 whole days. */
export function PeriodPicker({ value, onChange }: { value: Period; onChange: (period: Period) => void }) {
  return (
    <div role="group" aria-label={words("admin.period")} className="inline-flex gap-0.5 rounded-lg bg-sheet-muted p-0.5">
      {PERIODS.map((period) => (
        <button
          key={period}
          type="button"
          aria-pressed={period === value}
          onClick={() => onChange(period)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${period === value ? "bg-sheet-2 text-(--accent-text) shadow-xs" : "text-text hover:bg-sheet-2/60"}`}
        >
          {words(`admin.period.${period}`)}
        </button>
      ))}
    </div>
  );
}

const INPUT = "min-h-10 rounded-md border border-sheet-line bg-sheet-2 px-3 text-sm text-ink placeholder:text-text-2/70";

export function Field({ label, hint, ...rest }: { label: string; hint?: string } & ComponentProps<"input">) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input id={id} className={INPUT} placeholder={hint} {...rest} />
    </label>
  );
}

export function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <select id={id} className={INPUT} value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export interface ConfirmProps<T extends Reply> {
  label: string;
  /** What will be sent, in words, shown before it goes. */
  summary: string;
  send: () => Promise<T>;
  /** Why the action cannot be sent yet; the button stays off and says so. */
  blocked?: string | null;
  /** The answer's own words, when it says more than done. */
  done?: (reply: Extract<T, { ok: true }>) => ReactNode;
  onDone?: (reply: Extract<T, { ok: true }>) => void;
  variant?: "primary" | "secondary" | "warning";
}

/** An action: confirmed in a dialog, then sent once, with the answer shown beside the button. */
export function Confirm<T extends Reply>({ label, summary, send, blocked = null, done, onDone, variant = "secondary" }: ConfirmProps<T>) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [answer, setAnswer] = useState<T | null>(null);
  const go = async () => {
    setSending(true);
    const reply = await send();
    setSending(false);
    setOpen(false);
    setAnswer(reply);
    if (reply.ok) onDone?.(reply as Extract<T, { ok: true }>);
  };
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button small variant={variant} disabled={blocked !== null} onClick={() => setOpen(true)}>
          {label}
        </Button>
      </div>
      {blocked === null ? null : <p className="text-xs text-text-2">{blocked}</p>}
      {answer === null ? null : answer.ok ? (
        <div role="status" className="text-sm">
          {done === undefined ? words("admin.done") : done(answer as Extract<T, { ok: true }>)}
        </div>
      ) : (
        <Refusal reply={answer} />
      )}
      <Sheet open={open} onOpenChange={setOpen} title={words("admin.confirm.title")} description={summary}>
        <div className="flex gap-3">
          <Button variant="primary" disabled={sending} onClick={() => void go()}>
            {words("admin.confirm.send")}
          </Button>
          <Button onClick={() => setOpen(false)}>{words("admin.confirm.cancel")}</Button>
        </div>
      </Sheet>
    </div>
  );
}

export interface ReasonDialogProps<T extends Reply> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The act, which names the button too ("Turn off adverts"). */
  act: string;
  /** What will happen, said in the dialog. */
  summary: string;
  reasonLabel: string;
  /** The field's accessible name, naming what is changed. */
  reasonFor: string;
  example: string;
  /** Why the act cannot be sent beside a missing reason; the button stays off and says so. */
  blocked?: string | null;
  /** The dialog's own fields, above the reason. */
  children?: ReactNode;
  send: (reason: string) => Promise<T>;
  onDone: (reply: Extract<T, { ok: true }>) => void;
  danger?: boolean;
}

/** admin:actions-confirm-with-reason: a dialog that says what will happen, takes "Reason for the change" and names the act on its button. */
export function ReasonDialog<T extends Reply>({ open, onOpenChange, act, summary, reasonLabel, reasonFor, example, blocked = null, children, send, onDone, danger = false }: ReasonDialogProps<T>) {
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [refusal, setRefusal] = useState<AdminRefusal | null>(null);
  const why = reason.trim();
  const close = (next: boolean) => {
    if (!next) {
      setReason("");
      setRefusal(null);
    }
    onOpenChange(next);
  };
  const go = async () => {
    setSending(true);
    const reply = await send(why);
    setSending(false);
    if (reply.ok) {
      close(false);
      onDone(reply as Extract<T, { ok: true }>);
    } else {
      setRefusal(reply);
    }
  };
  return (
    <Sheet open={open} onOpenChange={close} title={act} description={summary}>
      {children}
      <Field label={reasonLabel} aria-label={reasonFor} hint={example} value={reason} onChange={(event) => setReason(event.target.value)} />
      {blocked === null ? null : <p className="text-xs text-text-2">{blocked}</p>}
      {refusal === null ? null : <Refusal reply={refusal} />}
      <div className="flex gap-3">
        <Button variant={danger ? "warning" : "primary"} disabled={sending || why === "" || blocked !== null} onClick={() => void go()}>
          {act}
        </Button>
        <Button onClick={() => close(false)}>{words("admin.confirm.cancel")}</Button>
      </div>
    </Sheet>
  );
}

/** A toggle as a button that names the act it opens. */
export function Toggle({ on, act, onClick }: { on: boolean; act: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={act} title={act} onClick={onClick} className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-text-2/40"}`}>
      <span aria-hidden="true" className={`absolute top-0.5 size-5 rounded-full bg-white shadow-xs transition-transform ${on ? "translate-x-[1.125rem]" : "translate-x-0.5"}`} />
    </button>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ReloadButton({ onClick }: { onClick: () => void }) {
  return (
    <Button small variant="quiet" onClick={onClick}>
      {words("admin.reload")}
    </Button>
  );
}

/** A small footnote under a card's figures. */
export function Note({ children }: { children: ReactNode }) {
  return <p className="text-xs text-text-2">{children}</p>;
}
