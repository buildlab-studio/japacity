// Moderation (admin:sections-alarms-first): the queue in the server's order, reason weight then age
// (moderation:one-queue-by-reason-weight, moderation:reports-decided-within-target), as rows with a state pill and the
// chosen item's context and actions in a panel beside them (moderation:queue-item-shows-context,
// moderation:fixed-admin-actions, moderation:actioned-player-told-and-appeals); the dedication lights awaiting a look
// with Approve and Refuse (moderation:dedication-lights-await-approval); the log, read by item or account, which has no
// edit (moderation:admin-actions-logged-append-only); and the feedback.
import {
  ACTION_MAX_DAYS,
  type AccountSummary,
  type DecidedReply,
  type ModerationLogEntry,
  type PendingLight,
  type QueueItem,
  REPORT_ACTIONS,
  REPORT_REASONS,
  type ReportAction,
  type ReportCite,
  type ReportReason,
} from "@japacity/api";
import { useState, type ReactNode } from "react";

import { Button } from "../../shared/ui/Button";
import { dayWords, duration, whenWords } from "./admin.format";
import { words } from "./admin.words";
import type { Shared } from "./AdminPage";
import { Card, Choice, Confirm, Field, Loaded, Pill, ReloadButton, Stat, Stats, Table, useLoad } from "./admin.ui";
import { RollbackAnswer } from "./MoneySection";

const WHOLE = /^\d{1,4}$/;

const REASON_OPTIONS = REPORT_REASONS.map((reason) => ({ value: reason, label: reason }));
const ACTION_OPTIONS = REPORT_ACTIONS.map((action) => ({ value: action, label: action }));

function citeWords(cites: ReportCite): string {
  if ("messages" in cites) return words("admin.cite.messages", { count: cites.messages.length });
  if ("phrase" in cites) return words("admin.cite.place", { place: cites.place, phrase: cites.phrase, at: whenWords(cites.at) });
  if ("card" in cites) return words("admin.cite.card", { card: cites.card });
  if ("pair" in cites) return words("admin.cite.pair", { pair: cites.pair });
  return words("admin.cite.campaign", { campaign: cites.campaign, slot: cites.slot });
}

function actionWords(entry: ModerationLogEntry): string {
  return words("admin.account.action", { at: whenWords(entry.at), action: entry.action, admin: entry.admin, reason: entry.reason });
}

function Briefs({ title, list }: { title: string; list: AccountSummary["made"] }) {
  return (
    <div>
      <h5 className="text-xs font-semibold tracking-wider text-text-2 uppercase">{title}</h5>
      {list.length === 0 ? (
        <p className="text-sm text-text-2">{words("admin.none")}</p>
      ) : (
        <ul className="list-disc pl-5 text-sm">
          {list.map((report) => (
            <li key={report.id}>
              {report.outcome === undefined
                ? words("admin.account.brief", { id: report.id, reason: report.reason, at: whenWords(report.at), status: report.status })
                : words("admin.account.brief.outcome", { id: report.id, reason: report.reason, at: whenWords(report.at), status: report.status, outcome: report.outcome })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** moderation:queue-item-shows-context: one account's standing. Never an email, a seed or a character's state. */
function Standing({ role, summary }: { role: string; summary: AccountSummary }) {
  return (
    <div data-account={summary.account} className="flex flex-col gap-2 rounded-lg border border-sheet-line p-3 text-sm">
      <h4 className="font-semibold">{words("admin.account.title", { role, account: summary.account })}</h4>
      <p className="text-text-2">
        {summary.region === null ? words("admin.account.region.none") : words("admin.account.region", { region: summary.region })},{" "}
        {summary.accountAge === null ? words("admin.account.gone") : words("admin.account.age", { age: duration(summary.accountAge) })}
      </p>
      <Briefs title={words("admin.account.made")} list={summary.made} />
      <Briefs title={words("admin.account.received")} list={summary.received} />
      <div>
        <h5 className="text-xs font-semibold tracking-wider text-text-2 uppercase">{words("admin.account.actions")}</h5>
        {summary.actions.length === 0 ? (
          <p className="text-text-2">{words("admin.none")}</p>
        ) : (
          <ul className="list-disc pl-5">
            {summary.actions.map((entry) => (
              <li key={entry.id}>{actionWords(entry)}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function closeSummary(item: string, action: ReportAction, reason: ReportReason, days: string, body: string): string {
  if (action === "mute" || action === "suspend") return words("admin.close.confirm.days", { item, action, days, reason });
  if (action === "refer") return words("admin.close.confirm.body", { item, action, body, reason });
  if (action === "rollback") return words("admin.close.confirm.rollback", { item, action, reason });
  return words("admin.close.confirm", { item, action, reason });
}

function Decided({ reply }: { reply: Extract<DecidedReply, { ok: true }> }) {
  return (
    <div className="flex flex-col gap-2">
      <p>{words("admin.close.done", { entry: reply.entry.id })}</p>
      {reply.rollback === undefined ? null : <RollbackAnswer check={reply.rollback} />}
    </div>
  );
}

function CloseReport({ shared, item, onDone }: { shared: Shared; item: string; onDone: (answer: ReactNode) => void }) {
  const [action, setAction] = useState<ReportAction>("dismiss");
  const [reason, setReason] = useState<ReportReason>("other");
  const [days, setDays] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const needsDays = action === "mute" || action === "suspend";
  const daysOk = WHOLE.test(days) && Number(days) >= 1 && Number(days) <= ACTION_MAX_DAYS;
  const blocked = needsDays && !daysOk ? words("admin.close.days") : action === "refer" && body.trim() === "" ? words("admin.close.body") : null;
  return (
    <div className="flex flex-col gap-3 border-t border-sheet-line pt-3">
      <h4 className="text-xs font-semibold tracking-wider text-text-2 uppercase">{words("admin.close.title")}</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <Choice label={words("admin.close.action")} value={action} options={ACTION_OPTIONS} onChange={setAction} />
        <Choice label={words("admin.close.reason")} value={reason} options={REASON_OPTIONS} onChange={setReason} />
        {needsDays ? <Field label={words("admin.close.days")} inputMode="numeric" value={days} onChange={(event) => setDays(event.target.value)} /> : null}
        {action === "refer" ? <Field label={words("admin.close.body")} value={body} onChange={(event) => setBody(event.target.value)} /> : null}
        <Field label={words("admin.close.note")} value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      <Confirm
        label={words("admin.close.send")}
        variant="primary"
        summary={closeSummary(item, action, reason, days, body.trim())}
        blocked={blocked}
        send={() =>
          shared.api.closeReport(item, {
            action,
            reason,
            ...(needsDays ? { days: Number(days) } : {}),
            ...(action === "refer" ? { body: body.trim() } : {}),
            ...(note.trim() === "" ? {} : { note: note.trim() }),
          })
        }
        done={(reply) => <Decided reply={reply} />}
        onDone={(reply) => onDone(<Decided reply={reply} />)}
      />
    </div>
  );
}

function DecideAppeal({ shared, item, onDone }: { shared: Shared; item: string; onDone: (answer: ReactNode) => void }) {
  const [outcome, setOutcome] = useState<"upheld" | "overturned">("upheld");
  const [reason, setReason] = useState<ReportReason>("other");
  const [note, setNote] = useState("");
  return (
    <div className="flex flex-col gap-3 border-t border-sheet-line pt-3">
      <h4 className="text-xs font-semibold tracking-wider text-text-2 uppercase">{words("admin.decide.title")}</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <Choice
          label={words("admin.decide.outcome")}
          value={outcome}
          options={[
            { value: "upheld", label: words("admin.decide.upheld") },
            { value: "overturned", label: words("admin.decide.overturned") },
          ]}
          onChange={setOutcome}
        />
        <Choice label={words("admin.close.reason")} value={reason} options={REASON_OPTIONS} onChange={setReason} />
        <Field label={words("admin.close.note")} value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      <Confirm
        label={words("admin.decide.send")}
        variant="primary"
        summary={words("admin.decide.confirm", { item, outcome, reason })}
        send={() => shared.api.decideAppeal(item, { outcome, reason, ...(note.trim() === "" ? {} : { note: note.trim() }) })}
        done={(reply) => <Decided reply={reply} />}
        onDone={(reply) => onDone(<Decided reply={reply} />)}
      />
    </div>
  );
}

function itemTitle(item: QueueItem): string {
  return item.kind === "appeal" ? words("admin.moderation.appeal", { id: item.id }) : words("admin.moderation.report", { id: item.id, reason: item.reason });
}

/** moderation:queue-item-shows-context: the chosen item's context and its actions. */
function Detail({ shared, item, onDone }: { shared: Shared; item: QueueItem; onDone: (answer: ReactNode) => void }) {
  const waited = words("admin.moderation.waited", { at: whenWords(item.at), age: duration(item.age) });
  if (item.kind === "appeal") {
    return (
      <div className="admin-reveal flex flex-col gap-3">
        <h3 className="font-semibold">{itemTitle(item)}</h3>
        <p className="text-xs text-text-2">{waited}</p>
        <p className="text-sm">
          {item.entry === null
            ? words("admin.moderation.against.missing")
            : words("admin.moderation.against", { action: item.entry.action, account: String(item.entry.params["account"] ?? ""), admin: item.entry.admin, at: whenWords(item.entry.at), reason: item.entry.reason })}
        </p>
        <Standing role={words("admin.moderation.appellant")} summary={item.appellant} />
        <DecideAppeal shared={shared} item={item.id} onDone={onDone} />
      </div>
    );
  }
  return (
    <div className="admin-reveal flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{itemTitle(item)}</h3>
        {item.unverified ? <Pill tone="wait">{words("admin.moderation.unverified")}</Pill> : null}
      </div>
      <p className="text-xs text-text-2">{waited}</p>
      <p className="text-sm">{"account" in item.subject ? words("admin.moderation.subject.account", { account: item.subject.account }) : words("admin.moderation.subject.campaign", { campaign: item.subject.campaign })}</p>
      <p className="text-sm">{words("admin.moderation.cites", { cites: citeWords(item.cites) })}</p>
      {item.hold === null ? null : <p className="text-sm">{words("admin.moderation.hold", { until: whenWords(item.hold.until) })}</p>}
      {item.messages.length === 0 ? null : (
        <div>
          <h4 className="text-xs font-semibold tracking-wider text-text-2 uppercase">{words("admin.moderation.messages")}</h4>
          <ol className="list-decimal pl-5 text-sm">
            {item.messages.map((message) => (
              <li key={message.id}>
                {message.fill === null
                  ? words("admin.moderation.message", { at: whenWords(message.sentAt), sender: message.sender, words: message.words })
                  : words("admin.moderation.message.fill", { at: whenWords(message.sentAt), sender: message.sender, words: message.words, fill: message.fill })}
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="grid gap-3 xl:grid-cols-2">
        <Standing role={words("admin.moderation.reporter")} summary={item.reporter} />
        {item.reported === null ? null : <Standing role={words("admin.moderation.reported")} summary={item.reported} />}
      </div>
      <CloseReport shared={shared} item={item.id} onDone={onDone} />
    </div>
  );
}

function Queue({ shared }: { shared: Shared }) {
  // A decided item leaves the queue, so its answer is kept here.
  const [answer, setAnswer] = useState<ReactNode>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const decided = (node: ReactNode) => {
    setAnswer(node);
    shared.queue.reload();
  };
  return (
    <Loaded reply={shared.queue.reply}>
      {({ queue: view }) => {
        const target = view.target;
        const current = view.items.find((item) => item.id === chosen) ?? view.items[0] ?? null;
        return (
          <>
            <Stats>
              <Stat label={words("admin.queue.open")} value={String(view.items.length)} />
              <Stat label={words("admin.queue.oldest")} value={view.items.length === 0 ? "0" : duration(view.oldest)} note={words("admin.queue.target", { target: duration(target) })} tone={view.oldest > target ? "bad" : "plain"} />
              <Stat label={words("admin.queue.overdue")} value={String(view.overdue)} tone={view.overdue > 0 ? "bad" : "plain"} />
            </Stats>
            {answer === null ? null : (
              <div role="status" aria-label={words("admin.moderation.answer")} className="rounded-lg border border-sheet-line bg-sheet-2 p-3 text-sm">
                {answer}
              </div>
            )}
            <Card title={words("admin.moderation.queue")} action={<ReloadButton onClick={shared.queue.reload} />}>
              {view.items.length === 0 ? (
                <p className="text-sm text-text-2">{words("admin.moderation.empty")}</p>
              ) : (
                <div className="lg:grid lg:grid-cols-[minmax(16rem,2fr)_3fr] lg:gap-x-4" style={{ gridTemplateRows: `repeat(${String(view.items.length)}, min-content) minmax(0, 1fr)` }}>
                  {/* On a desktop the list and each row show through (display: contents), so the rows fill the left column and the chosen row's detail the right one. */}
                  <ol aria-label={words("admin.moderation.queue")} className="flex flex-col divide-y divide-sheet-line lg:contents">
                    {view.items.map((item) => {
                      const open = current?.id === item.id;
                      return (
                        <li key={item.id} data-item={item.id} data-open={open ? "true" : "false"} className="flex flex-col lg:contents">
                          <button type="button" aria-pressed={open} onClick={() => setChosen(item.id)} className={`flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors lg:col-start-1 lg:self-start lg:border-b lg:border-sheet-line ${open ? "bg-(--accent-fill)" : "hover:bg-sheet-muted"}`}>
                            <Pill tone={item.age > target ? "alarm" : "wait"}>{item.age > target ? words("admin.queue.past") : words("admin.queue.waiting")}</Pill>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{itemTitle(item)}</span>
                              <span className="block text-xs text-text-2">{item.kind === "appeal" ? words("admin.moderation.appellant") : "account" in item.subject ? item.subject.account : item.subject.campaign}</span>
                            </span>
                            <span className="shrink-0 text-xs text-text-2 tabular-nums">{duration(item.age)}</span>
                          </button>
                          {open ? (
                            <div className="mt-2 rounded-lg border border-sheet-line bg-sheet p-3 lg:col-start-2 lg:row-start-1 lg:mt-0 lg:self-start lg:p-4" style={{ gridRow: `1 / span ${String(view.items.length + 1)}` }} data-panel={item.id}>
                              <Detail shared={shared} item={item} onDone={decided} />
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </Card>
          </>
        );
      }}
    </Loaded>
  );
}

function LogView({ shared }: { shared: Shared }) {
  const [item, setItem] = useState("");
  const [account, setAccount] = useState("");
  const [asked, setAsked] = useState<{ item: string; account: string } | null>(null);
  const [reply, setReply] = useState<Awaited<ReturnType<Shared["api"]["log"]>> | null>(null);
  const named = item.trim() !== "" || account.trim() !== "";
  return (
    <Card title={words("admin.log.title")} subtitle={words("admin.log.need")}>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const filter = { item: item.trim(), account: account.trim() };
          setAsked(filter);
          void shared.api.log(filter).then(setReply);
        }}
      >
        <Field label={words("admin.log.item")} value={item} onChange={(event) => setItem(event.target.value)} />
        <Field label={words("admin.log.account")} value={account} onChange={(event) => setAccount(event.target.value)} />
        <Button small type="submit" disabled={!named}>
          {words("admin.log.show")}
        </Button>
      </form>
      {asked === null ? null : (
        <Loaded reply={reply}>
          {({ entries }) => (
            <Table
              caption={words("admin.log.title")}
              hideCaption
              head={[words("admin.log.when"), words("admin.log.admin"), words("admin.log.item"), words("admin.log.action"), words("admin.log.params"), words("admin.log.reason"), words("admin.log.note")]}
              rows={entries.map((entry) => [
                whenWords(entry.at),
                entry.admin,
                entry.item,
                entry.action,
                Object.entries(entry.params)
                  .map(([name, value]) => `${name} ${String(value)}`)
                  .join(", "),
                entry.reason,
                entry.note ?? "",
              ])}
            />
          )}
        </Loaded>
      )}
    </Card>
  );
}

/** A light's years as the list shows them: both with "to" between, the one given, or none. */
function yearsWords({ from, to }: PendingLight["years"]): string {
  if (from !== null && to !== null) return words("admin.lights.years", { years: `${String(from)} to ${String(to)}` });
  if (from !== null || to !== null) return words("admin.lights.years", { years: String(from ?? to) });
  return words("admin.lights.no-years");
}

/** moderation:dedication-lights-await-approval: one light awaiting a look, its name, years and account, with Approve and Refuse. */
function LightItem({ shared, light, onDone }: { shared: Shared; light: PendingLight; onDone: (answer: ReactNode) => void }) {
  const at = whenWords(light.litAt);
  const done = (reply: { entry: string }) => <p>{words("admin.close.done", { entry: reply.entry })}</p>;
  return (
    <li data-light={light.account} className="flex flex-col gap-3 py-3 md:flex-row md:items-start md:gap-6">
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold">{light.name}</h3>
        <p className="text-sm">{yearsWords(light.years)}</p>
        <p className="text-xs text-text-2">
          {light.username === null ? words("admin.lights.who.gone", { account: light.account, at }) : words("admin.lights.who", { username: light.username, account: light.account, region: light.region ?? "", at })}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Confirm label={words("admin.lights.approve")} variant="primary" summary={words("admin.lights.confirm.approve", { name: light.name, account: light.account })} send={() => shared.api.decideLight(light.account, "approve")} done={done} onDone={(reply) => onDone(done(reply))} />
        <Confirm label={words("admin.lights.refuse")} summary={words("admin.lights.confirm.refuse", { name: light.name, account: light.account })} send={() => shared.api.decideLight(light.account, "refuse")} done={done} onDone={(reply) => onDone(done(reply))} />
      </div>
    </li>
  );
}

/** moderation:dedication-lights-await-approval: the dedication lights whose names await a look, oldest first. */
function LightsView({ shared }: { shared: Shared }) {
  const pending = useLoad(() => shared.api.pendingLights());
  const [answer, setAnswer] = useState<ReactNode>(null);
  const decided = (node: ReactNode) => {
    setAnswer(node);
    pending.reload();
  };
  return (
    <Card title={words("admin.lights.title")} action={<ReloadButton onClick={pending.reload} />}>
      {answer === null ? null : (
        <div role="status" aria-label={words("admin.moderation.answer")} className="rounded-lg border border-sheet-line bg-sheet p-3 text-sm">
          {answer}
        </div>
      )}
      <Loaded reply={pending.reply}>
        {({ lights }) =>
          lights.length === 0 ? (
            <p className="text-sm text-text-2">{words("admin.lights.empty")}</p>
          ) : (
            <ol className="flex flex-col divide-y divide-sheet-line" aria-label={words("admin.lights.list")}>
              {lights.map((light) => (
                <LightItem key={light.account} shared={shared} light={light} onDone={decided} />
              ))}
            </ol>
          )
        }
      </Loaded>
    </Card>
  );
}

function FeedbackView({ shared }: { shared: Shared }) {
  const feedback = useLoad(() => shared.api.feedback());
  return (
    <Card title={words("admin.feedback.title")} action={<ReloadButton onClick={feedback.reload} />}>
      <Loaded reply={feedback.reply}>
        {({ feedback: rows }) => (
          <Table caption={words("admin.feedback.title")} hideCaption head={[words("admin.feedback.day"), words("admin.feedback.region"), words("admin.feedback.screen"), words("admin.feedback.build"), words("admin.feedback.text")]} rows={rows.map((row) => [dayWords(row.day), row.region, row.screen, `${row.build} ${row.mode}`, row.text])} />
        )}
      </Loaded>
    </Card>
  );
}

export function ModerationSection({ shared }: { shared: Shared }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{words("admin.section.moderation")}</h2>
      </div>
      <Queue shared={shared} />
      <LightsView shared={shared} />
      <div className="grid gap-4 lg:grid-cols-2">
        <LogView shared={shared} />
        <FeedbackView shared={shared} />
      </div>
    </>
  );
}
