// Japa (docs/rules/world.md R-WORLD-018, 019): the plan as steps with a percent: the japacity
// figure, the route's steps, the papers as a step with their state, and what is coming up (the visa
// decision, a paper's ready month). The Papers screen inside shows what is in the box under the
// bed; the papers themselves are a thing at home.
import type { PlayerView, RouteView } from "@japacity/sim";
import { Check, ChevronLeft, ChevronRight, Circle, FileCheck, FileClock, FileX } from "lucide-react";
import { useState } from "react";

import { useGame, useView } from "../../../authority/GameProvider";
import { monthsLeft, SOON } from "../../../shared/words/expiry";
import { formatBand } from "../../../shared/words/format";
import { inMonths, nameOf, runningName, say, sayCount, words } from "../../../shared/words/text";
import { Head } from "../act";
import { phoneWords } from "../phone.words";

const ENGLISH_RESULT = "document.english-test";

/** The route the plan follows: the japacity figure's route, else the furthest one heard of. */
export function planRoute(view: PlayerView): RouteView | null {
  const lead = view.routes.find((route) => route.id === view.japacity.route);
  if (lead !== undefined) return lead;
  return view.routes.find((route) => route.state !== "unknown" && route.state !== "heard" && route.gate?.gate !== "road") ?? null;
}

/** What is coming up: the visa decision, and each paper on its way. */
export function remindersOf(view: PlayerView): string[] {
  const out: string[] = [];
  for (const route of view.routes) {
    if (route.visa !== null && (route.state === "applying" || route.state === "known")) out.push(phoneWords("phone.japa.visa", { when: inMonths(route.visa.decisionMonth, view.month) }));
  }
  for (const paper of view.documents) {
    if (paper.state === "pending" && paper.readyMonth !== null) out.push(phoneWords("phone.japa.paper-ready", { paper: nameOf(paper.id), when: inMonths(paper.readyMonth, view.month) }));
  }
  return out;
}

function Papers({ onBack }: { onBack: () => void }) {
  const { documents, month } = useView();
  return (
    <div data-papers>
      <button type="button" onClick={onBack} className="press mb-2 flex items-center gap-1 text-[14px] font-bold text-text-2" data-papers-back>
        <ChevronLeft size={16} aria-hidden />
        {phoneWords("phone.app.japa")}
      </button>
      <h3 className="title text-[18px]">{phoneWords("phone.japa.papers.title")}</h3>
      <p className="mt-1 mb-3 text-[13px] text-text-2">{phoneWords("phone.japa.papers.hint")}</p>
      {documents.length === 0 ? (
        <p className="text-[14px] text-text-2">{phoneWords("phone.japa.papers.none")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((paper) => {
            const left = monthsLeft(paper, month);
            const soon = left !== null && left <= SOON;
            const Icon = paper.state === "held" ? FileCheck : paper.state === "pending" ? FileClock : FileX;
            return (
              <li key={paper.id} data-paper={paper.id} data-state={paper.state} className="flex items-start gap-3 rounded-[6px] p-3" style={{ background: "var(--paper-bill)" }}>
                <Icon size={20} aria-hidden className={`mt-0.5 shrink-0 ${paper.state === "held" ? "text-in" : paper.state === "expired" ? "text-out" : "text-text-2"}`} />
                <div className="min-w-0">
                  <p className={`text-[15px] font-bold ${paper.state === "expired" ? "line-through" : ""}`}>{nameOf(paper.id)}</p>
                  <p className="text-[13px] text-text-2">
                    {paper.state === "pending" && paper.readyMonth !== null
                      ? phoneWords("phone.japa.paper-pending", { when: inMonths(paper.readyMonth, month) })
                      : paper.state === "expired"
                        ? say("ui.document.expired")
                        : paper.expiresMonth === null
                          ? say("ui.document.held")
                          : phoneWords("phone.japa.paper-valid", { when: inMonths(paper.expiresMonth, month) })}
                  </p>
                  {soon && left !== null ? <p className="text-[13px] font-bold text-out">{sayCount("ui.document.expires-soon", left, { months: left })}</p> : null}
                  {paper.id === ENGLISH_RESULT && paper.value !== null ? <p className="text-[13px] font-bold">{say("ui.document.band", { band: formatBand(paper.value) })}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Step({ met, children }: { met: boolean; children: string }) {
  return (
    <li className="flex items-start gap-2.5 py-1.5" data-met={met ? "true" : "false"}>
      {met ? <Check size={18} className="mt-0.5 shrink-0 text-in" aria-hidden /> : <Circle size={18} className="mt-0.5 shrink-0 text-text-2" aria-hidden />}
      <span className={`text-[14px] ${met ? "text-text-2 line-through" : ""}`}>{children}</span>
    </li>
  );
}

export function Japa() {
  const view = useView();
  const [papers, setPapers] = useState(false);
  // R-ADVICE-002: the official page can be read from the phone: it goes into the month like the hub's desk would put it.
  const addToPlan = useGame((state) => state.addToPlan);
  if (papers) {
    return (
      <div data-phone-app="japa">
        <Papers onBack={() => setPapers(false)} />
      </div>
    );
  }
  const route = planRoute(view);
  const official = view.activities.find((option) => option.id === "activity.look-into-route");
  const lookInto = route !== null && route.state === "heard" && official?.allowed === true && official.params?.includes(route.id) === true ? route.id : null;
  const percent = view.japacity.percent;
  const held = view.documents.filter((paper) => paper.state === "held").length;
  const coming = remindersOf(view);
  return (
    <div data-phone-app="japa">
      <div className="band flex items-end justify-between gap-3 rounded-[6px] px-4 py-3">
        <div className="min-w-0">
          <div className="label label-strong">{phoneWords("phone.japa.label")}</div>
          <div className="title truncate text-[15px]">{route === null ? phoneWords("phone.japa.none") : nameOf(route.id)}</div>
        </div>
        {percent === null ? null : (
          <div className="num text-[44px] leading-none" data-japa-percent={percent}>
            {percent}
            <span className="text-[24px]">%</span>
          </div>
        )}
      </div>
      {view.japacity.route === null ? null : <p className="mt-1 text-[12px] text-text-2">{say("ui.japacity.of", { route: runningName(view.japacity.route) })}</p>}

      {coming.length === 0 ? null : (
        <>
          <Head>{phoneWords("phone.japa.reminders")}</Head>
          <ul className="flex flex-col gap-1.5" data-reminders>
            {coming.map((line) => (
              <li key={line} className="rounded-[6px] border-l-4 border-signal bg-sheet-2 px-3 py-2 text-[14px]">
                {line}
              </li>
            ))}
          </ul>
        </>
      )}

      {lookInto === null ? null : (
        <button type="button" onClick={() => addToPlan({ activity: "activity.look-into-route", param: lookInto })} className="press mt-1 flex w-full items-center gap-2.5 rounded-[6px] border border-sheet-line bg-sheet-2 px-3 py-2.5 text-left" data-official-page>
          <FileCheck size={18} className="shrink-0 text-text-2" aria-hidden />
          <span className="flex-1">
            <span className="block text-[14px] font-bold">{nameOf("activity.look-into-route")}</span>
            <span className="block text-[13px] text-text-2">{phoneWords("phone.japa.official")}</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-text-2" aria-hidden />
        </button>
      )}
      <Head>{phoneWords("phone.japa.steps")}</Head>
      <ul className="flex flex-col" data-steps>
        {route === null || route.state === "heard" ? null : route.checklist.map((item) => <Step key={item.id} met={item.met}>{words(`${route.id}.item.${item.id}`)}</Step>)}
      </ul>
      <button type="button" onClick={() => setPapers(true)} className="press mt-1 flex w-full items-center gap-2.5 rounded-[6px] border border-sheet-line bg-sheet-2 px-3 py-2.5 text-left" data-open-papers>
        {view.documents.length > 0 && held === view.documents.length ? <Check size={18} className="shrink-0 text-in" aria-hidden /> : <Circle size={18} className="shrink-0 text-text-2" aria-hidden />}
        <span className="flex-1">
          <span className="block text-[14px] font-bold">{phoneWords("phone.japa.papers")}</span>
          <span className="block text-[13px] text-text-2">{view.documents.length === 0 ? phoneWords("phone.japa.papers.none") : phoneWords("phone.japa.papers.line", { held, count: view.documents.length })}</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-text-2" aria-hidden />
      </button>
    </div>
  );
}
