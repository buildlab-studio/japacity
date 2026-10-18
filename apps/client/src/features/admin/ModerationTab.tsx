// The moderation queue in the server's order, reason weight then age
// (moderation:one-queue-by-reason-weight, moderation:reports-decided-within-target), what each item shows (moderation:queue-item-shows-context),
// the actions it may be closed with (moderation:fixed-admin-actions), appeals (moderation:actioned-player-told-and-appeals),
// the dedication lights awaiting a look with Approve and Refuse (moderation:dedication-lights-await-approval)
// and the log, read by item or account (moderation:admin-actions-logged-append-only), which has no edit.
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
import { Tag } from "../../shared/ui/Panel";
import { duration, utcTime } from "./admin.format";
import { words } from "./admin.words";
import type { AdminApi } from "./api";
import { Choice, Confirm, Field, Loaded, ReloadButton, Section, Table, useLoad } from "./admin.ui";
import { RollbackAnswer } from "./ServerTabs";

const WHOLE = /^\d{1,4}$/;

const REASON_OPTIONS = REPORT_REASONS.map((reason) => ({ value: reason, label: reason }));
const ACTION_OPTIONS = REPORT_ACTIONS.map((action) => ({ value: action, label: action }));

function citeWords(cites: ReportCite): string {
  if ("messages" in cites) return words("admin.cite.messages", { count: cites.messages.length });
  if ("phrase" in cites) return words("admin.cite.place", { place: cites.place, phrase: cites.phrase, at: utcTime(cites.at) });
  if ("card" in cites) return words("admin.cite.card", { card: cites.card });
  if ("pair" in cites) return words("admin.cite.pair", { pair: cites.pair });
  return words("admin.cite.campaign", { campaign: cites.campaign, slot: cites.slot });
}

function actionWords(entry: ModerationLogEntry): string {
  return words("admin.account.action", { at: utcTime(entry.at), action: entry.action, admin: entry.admin, reason: entry.reason });
}

function Briefs({ title, list }: { title: string; list: AccountSummary["made"] }) {
  return (
    <div>
      <h5 className="font-medium">{title}</h5>
      {list.length === 0 ? (
        <p className="text-text-2">{words("admin.none")}</p>
      ) : (
        <ul className="list-disc pl-5">
          {list.map((report) => (
            <li key={report.id}>
              {report.outcome === undefined
                ? words("admin.account.brief", { id: report.id, reason: report.reason, at: utcTime(report.at), status: report.status })
                : words("admin.account.brief.outcome", { id: report.id, reason: report.reason, at: utcTime(report.at), status: report.status, outcome: report.outcome })}
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
    <div data-account={summary.account} className="flex flex-col gap-2 rounded-md border border-sheet-line p-3 text-sm">
      <h4 className="font-semibold">{words("admin.account.title", { role, account: summary.account })}</h4>
      <p>
        {summary.region === null ? words("admin.account.region.none") : words("admin.account.region", { region: summary.region })},{" "}
        {summary.accountAge === null ? words("admin.account.gone") : words("admin.account.age", { age: duration(summary.accountAge) })}
      </p>
      <Briefs title={words("admin.account.made")} list={summary.made} />
      <Briefs title={words("admin.account.received")} list={summary.received} />
      <div>
        <h5 className="font-medium">{words("admin.account.actions")}</h5>
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

function CloseReport({ api, item, onDone }: { api: AdminApi; item: string; onDone: (answer: ReactNode) => void }) {
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
          api.closeReport(item, {
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

function DecideAppeal({ api, item, onDone }: { api: AdminApi; item: string; onDone: (answer: ReactNode) => void }) {
  const [outcome, setOutcome] = useState<"upheld" | "overturned">("upheld");
  const [reason, setReason] = useState<ReportReason>("other");
  const [note, setNote] = useState("");
  return (
    <div className="flex flex-col gap-3 border-t border-sheet-line pt-3">
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
        send={() => api.decideAppeal(item, { outcome, reason, ...(note.trim() === "" ? {} : { note: note.trim() }) })}
        done={(reply) => <Decided reply={reply} />}
        onDone={(reply) => onDone(<Decided reply={reply} />)}
      />
    </div>
  );
}

function Item({ api, item, onDone }: { api: AdminApi; item: QueueItem; onDone: (answer: ReactNode) => void }) {
  const waited = words("admin.moderation.waited", { at: utcTime(item.at), age: duration(item.age) });
  if (item.kind === "appeal") {
    return (
      <li data-item={item.id} className="flex flex-col gap-3 rounded-md border border-sheet-line bg-sheet-2 p-4">
        <h3 className="font-semibold">{words("admin.moderation.appeal", { id: item.id })}</h3>
        <p className="text-sm text-text-2">{waited}</p>
        <p>
          {item.entry === null
            ? words("admin.moderation.against.missing")
            : words("admin.moderation.against", { action: item.entry.action, account: String(item.entry.params["account"] ?? ""), admin: item.entry.admin, at: utcTime(item.entry.at), reason: item.entry.reason })}
        </p>
        <Standing role={words("admin.moderation.appellant")} summary={item.appellant} />
        <DecideAppeal api={api} item={item.id} onDone={onDone} />
      </li>
    );
  }
  return (
    <li data-item={item.id} className="flex flex-col gap-3 rounded-md border border-sheet-line bg-sheet-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{words("admin.moderation.report", { id: item.id, reason: item.reason })}</h3>
        {item.unverified ? <Tag tone="bad">{words("admin.moderation.unverified")}</Tag> : null}
      </div>
      <p className="text-sm text-text-2">{waited}</p>
      <p>{"account" in item.subject ? words("admin.moderation.subject.account", { account: item.subject.account }) : words("admin.moderation.subject.campaign", { campaign: item.subject.campaign })}</p>
      <p>{words("admin.moderation.cites", { cites: citeWords(item.cites) })}</p>
      {item.hold === null ? null : <p>{words("admin.moderation.hold", { until: utcTime(item.hold.until) })}</p>}
      {item.messages.length === 0 ? null : (
        <div>
          <h4 className="font-medium">{words("admin.moderation.messages")}</h4>
          <ol className="list-decimal pl-5">
            {item.messages.map((message) => (
              <li key={message.id}>
                {message.fill === null
                  ? words("admin.moderation.message", { at: utcTime(message.sentAt), sender: message.sender, words: message.words })
                  : words("admin.moderation.message.fill", { at: utcTime(message.sentAt), sender: message.sender, words: message.words, fill: message.fill })}
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        <Standing role={words("admin.moderation.reporter")} summary={item.reporter} />
        {item.reported === null ? null : <Standing role={words("admin.moderation.reported")} summary={item.reported} />}
      </div>
      <CloseReport api={api} item={item.id} onDone={onDone} />
    </li>
  );
}

function LogView({ api }: { api: AdminApi }) {
  const [item, setItem] = useState("");
  const [account, setAccount] = useState("");
  const [asked, setAsked] = useState<{ item: string; account: string } | null>(null);
  const [reply, setReply] = useState<Awaited<ReturnType<AdminApi["log"]>> | null>(null);
  const named = item.trim() !== "" || account.trim() !== "";
  return (
    <Section title={words("admin.log.title")}>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const filter = { item: item.trim(), account: account.trim() };
          setAsked(filter);
          void api.log(filter).then(setReply);
        }}
      >
        <Field label={words("admin.log.item")} value={item} onChange={(event) => setItem(event.target.value)} />
        <Field label={words("admin.log.account")} value={account} onChange={(event) => setAccount(event.target.value)} />
        <Button small type="submit" disabled={!named}>
          {words("admin.log.show")}
        </Button>
      </form>
      {named ? null : <p className="text-sm text-text-2">{words("admin.log.need")}</p>}
      {asked === null ? null : (
        <Loaded reply={reply}>
          {({ entries }) => (
            <Table
              caption={words("admin.log.title")}
              head={[words("admin.log.when"), words("admin.log.admin"), words("admin.log.item"), words("admin.log.action"), words("admin.log.params"), words("admin.log.reason"), words("admin.log.note")]}
              rows={entries.map((entry) => [
                utcTime(entry.at),
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
    </Section>
  );
}

/** A light's years as the list shows them: both with "to" between, the one given, or none. */
function yearsWords({ from, to }: PendingLight["years"]): string {
  if (from !== null && to !== null) return words("admin.lights.years", { years: `${String(from)} to ${String(to)}` });
  if (from !== null || to !== null) return words("admin.lights.years", { years: String(from ?? to) });
  return words("admin.lights.no-years");
}

/** moderation:dedication-lights-await-approval: one light awaiting a look, its name, years and account, with Approve and Refuse. */
function LightItem({ api, light, onDone }: { api: AdminApi; light: PendingLight; onDone: (answer: ReactNode) => void }) {
  const at = utcTime(light.litAt);
  const done = (reply: { entry: string }) => <p>{words("admin.close.done", { entry: reply.entry })}</p>;
  return (
    <li data-light={light.account} className="flex flex-col gap-3 rounded-md border border-sheet-line bg-sheet-2 p-4">
      <h3 className="font-semibold">{light.name}</h3>
      <p className="text-sm">{yearsWords(light.years)}</p>
      <p className="text-sm text-text-2">
        {light.username === null ? words("admin.lights.who.gone", { account: light.account, at }) : words("admin.lights.who", { username: light.username, account: light.account, region: light.region ?? "", at })}
      </p>
      <div className="flex flex-wrap gap-3 border-t border-sheet-line pt-3">
        <Confirm
          label={words("admin.lights.approve")}
          variant="primary"
          summary={words("admin.lights.confirm.approve", { name: light.name, account: light.account })}
          send={() => api.decideLight(light.account, "approve")}
          done={done}
          onDone={(reply) => onDone(done(reply))}
        />
        <Confirm
          label={words("admin.lights.refuse")}
          summary={words("admin.lights.confirm.refuse", { name: light.name, account: light.account })}
          send={() => api.decideLight(light.account, "refuse")}
          done={done}
          onDone={(reply) => onDone(done(reply))}
        />
      </div>
    </li>
  );
}

/** moderation:dedication-lights-await-approval: the dedication lights whose names await a look, oldest first. */
function LightsView({ api }: { api: AdminApi }) {
  const pending = useLoad(() => api.pendingLights());
  const [answer, setAnswer] = useState<ReactNode>(null);
  const decided = (node: ReactNode) => {
    setAnswer(node);
    pending.reload();
  };
  return (
    <Section title={words("admin.lights.title")} action={<ReloadButton onClick={pending.reload} />}>
      {answer === null ? null : (
        <div role="status" aria-label={words("admin.moderation.answer")} className="rounded-md border border-sheet-line bg-sheet-muted p-3">
          {answer}
        </div>
      )}
      <Loaded reply={pending.reply}>
        {({ lights }) =>
          lights.length === 0 ? (
            <p className="text-text-2">{words("admin.lights.empty")}</p>
          ) : (
            <ol className="flex flex-col gap-4" aria-label={words("admin.lights.list")}>
              {lights.map((light) => (
                <LightItem key={light.account} api={api} light={light} onDone={decided} />
              ))}
            </ol>
          )
        }
      </Loaded>
    </Section>
  );
}

function FeedbackView({ api }: { api: AdminApi }) {
  const feedback = useLoad(() => api.feedback());
  return (
    <Section title={words("admin.feedback.title")} action={<ReloadButton onClick={feedback.reload} />}>
      <Loaded reply={feedback.reply}>
        {({ feedback: rows }) => (
          <Table
            caption={words("admin.feedback.title")}
            head={[words("admin.feedback.day"), words("admin.feedback.region"), words("admin.feedback.screen"), words("admin.feedback.build"), words("admin.feedback.text")]}
            rows={rows.map((row) => [row.day, row.region, row.screen, `${row.build} ${row.mode}`, row.text])}
          />
        )}
      </Loaded>
    </Section>
  );
}

export function ModerationTab({ api }: { api: AdminApi }) {
  const queue = useLoad(() => api.queue());
  // A decided item leaves the queue, so its answer is kept here.
  const [answer, setAnswer] = useState<ReactNode>(null);
  const decided = (node: ReactNode) => {
    setAnswer(node);
    queue.reload();
  };
  return (
    <div className="flex flex-col gap-8">
      <Section title={words("admin.moderation.queue")} action={<ReloadButton onClick={queue.reload} />}>
        {answer === null ? null : (
          <div role="status" aria-label={words("admin.moderation.answer")} className="rounded-md border border-sheet-line bg-sheet-muted p-3">
            {answer}
          </div>
        )}
        <Loaded reply={queue.reply}>
          {({ queue: view }) => (
            <>
              <p className={view.overdue > 0 ? "font-semibold text-bad" : ""}>
                {words("admin.moderation.summary", { count: view.items.length, oldest: duration(view.oldest), target: duration(view.target), overdue: view.overdue })}
              </p>
              {view.items.length === 0 ? (
                <p className="text-text-2">{words("admin.moderation.empty")}</p>
              ) : (
                <ol className="flex flex-col gap-4" aria-label={words("admin.moderation.queue")}>
                  {view.items.map((item) => (
                    <Item key={item.id} api={api} item={item} onDone={decided} />
                  ))}
                </ol>
              )}
            </>
          )}
        </Loaded>
      </Section>
      <LightsView api={api} />
      <LogView api={api} />
      <FeedbackView api={api} />
    </div>
  );
}
