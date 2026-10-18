// The admin page's parts: plain tables, labelled fields, a reply shown as it
// came, and an action that is confirmed before it is sent.
import type { AdminRefusal } from "@japacity/api";
import { useCallback, useEffect, useId, useState, type ComponentProps, type ReactNode } from "react";

import { Button } from "../../shared/ui/Button";
import { Sheet } from "../../shared/ui/Sheet";
import { words } from "./admin.words";

export type Reply = { ok: true } | AdminRefusal;

/** A refusal as the server worded it, with its code and any checks it named as missing. */
export function Refusal({ reply }: { reply: AdminRefusal }) {
  return (
    <div role="alert" className="flex flex-col gap-1 rounded-md border border-bad p-3 text-bad">
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

/** The answer of a load: loading, the refusal, or the page made from it. */
export function Loaded<T extends Reply>({ reply, children }: { reply: T | null; children: (ok: Extract<T, { ok: true }>) => ReactNode }) {
  if (reply === null) return <p className="text-text-2">{words("admin.loading")}</p>;
  if (!reply.ok) return <Refusal reply={reply} />;
  return <>{children(reply as Extract<T, { ok: true }>)}</>;
}

export function Table({ caption, head, rows }: { caption: string; head: readonly string[]; rows: readonly (readonly ReactNode[])[] }) {
  return (
    <div className="max-w-full overflow-x-auto rounded-md border border-sheet-line">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="px-3 py-2 text-left font-semibold">{caption}</caption>
        <thead>
          <tr className="border-y border-sheet-line bg-sheet-muted">
            {head.map((name) => (
              <th key={name} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={head.length} className="px-3 py-2 text-text-2">
                {words("admin.none")}
              </td>
            </tr>
          ) : (
            rows.map((cells, row) => (
              <tr key={row} className="border-t border-sheet-line align-top">
                {cells.map((cell, column) => (
                  <td key={column} className="px-3 py-2">
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

const INPUT = "min-h-11 rounded-md border border-sheet-line bg-sheet-2 px-3 text-ink";

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
  variant?: "primary" | "secondary";
}

/** An action: confirmed in a sheet, then sent once, with the answer shown beside the button. */
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
      {blocked === null ? null : <p className="text-sm text-text-2">{blocked}</p>}
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
