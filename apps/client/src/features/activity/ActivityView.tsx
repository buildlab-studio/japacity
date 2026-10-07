// The month plan: the job, the free slots, and every free-slot activity as a
// card. What is allowed, what is missing and what may be picked all come from
// the view; this screen only arranges them.
import type { ActivityOption, SlotPick } from "@japacity/sim";
import { Briefcase, Plus, X } from "lucide-react";
import { useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Card, Panel, Tag } from "../../shared/ui/Panel";
import { formatMoney } from "../../shared/words/format";
import { requirementSentence } from "../../shared/words/requirement";
import { blurbOf, nameOf, say } from "../../shared/words/text";

function Job() {
  const view = useView();
  const busy = useGame((state) => state.busy);
  const send = useGame((state) => state.send);
  const [confirming, setConfirming] = useState(false);
  const job = view.job.id;

  return (
    <Card>
      <div className="flex items-start gap-3">
        <Briefcase size={20} className="mt-0.5 shrink-0 text-muted" />
        <div className="flex flex-1 flex-col gap-1">
          {job === null ? (
            <p>{say("ui.job.none")}</p>
          ) : (
            <>
              <p className="font-semibold">{nameOf(job)}</p>
              <p className="text-sm text-muted">{say("ui.job.months", { months: view.job.months })}</p>
            </>
          )}
        </div>
        {job === null || confirming ? null : (
          <Button small onClick={() => setConfirming(true)} disabled={busy || view.ended}>
            {say("ui.job.quit")}
          </Button>
        )}
      </div>
      {confirming ? (
        <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          <p>{say("ui.job.quit-sure")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              small
              variant="primary"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                void send({ type: "activity/quit" });
              }}
            >
              {say("ui.job.quit-yes")}
            </Button>
            <Button small onClick={() => setConfirming(false)}>
              {say("ui.job.quit-no")}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function pickWords(pick: SlotPick): string {
  return pick.param === null ? nameOf(pick.activity) : `${nameOf(pick.activity)}: ${nameOf(pick.param)}`;
}

function Slots() {
  const view = useView();
  const plan = useGame((state) => state.plan);
  const setSlot = useGame((state) => state.setSlot);
  if (view.freeSlots === 0) return <p className="text-muted">{say("ui.month.no-slots")}</p>;
  return (
    <ol className="grid gap-2 @md:grid-cols-3" aria-label={say("ui.month.plan")}>
      {plan.map((pick, index) => (
        <li
          key={index}
          className={`flex min-h-14 items-center gap-2 rounded-xl border px-3 py-2 ${pick === null ? "border-dashed border-line text-muted" : "border-ink/60 bg-surface"}`}
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sunk text-xs font-semibold text-ink">
            {index + 1}
          </span>
          <span className="flex-1">{pick === null ? say("ui.month.slot-empty") : pickWords(pick)}</span>
          {pick === null ? null : (
            <button
              type="button"
              aria-label={`${say("ui.month.slot-remove")}: ${pickWords(pick)}`}
              className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-sunk"
              onClick={() => setSlot(index, null)}
            >
              <X size={16} />
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}

function ActivityCard({ option }: { option: ActivityOption }) {
  const plan = useGame((state) => state.plan);
  const addToPlan = useGame((state) => state.addToPlan);
  const ended = useView().ended;
  const [param, setParam] = useState<string>("");
  const name = nameOf(option.id);
  const blurb = blurbOf(option.id);
  const full = !plan.includes(null);
  const needsParam = option.params !== null;
  const chosenParam = needsParam ? (option.params?.includes(param) === true ? param : (option.params?.[0] ?? "")) : "";
  const canAdd = option.allowed && option.affordable && !full && !ended && (!needsParam || chosenParam !== "");
  const selectId = `param-${option.id}`;

  return (
    <li>
      <Card tone={option.allowed ? "plain" : "muted"} className="flex h-full flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold">{name}</h3>
          {option.cost.length === 0 ? (
            <Tag>{say("ui.activity.free")}</Tag>
          ) : (
            <Tag tone={option.affordable ? "plain" : "bad"}>
              {say("ui.activity.cost", {
                amount: option.cost.map((cost) => formatMoney(cost.amount, cost.currency)).join(" + "),
              })}
            </Tag>
          )}
        </div>
        {blurb === null ? null : <p className="text-sm text-muted">{blurb}</p>}

        {option.missing.length > 0 ? (
          <div className="text-sm">
            <p className="font-medium">{say("ui.activity.why-not")}</p>
            <ul className="list-disc pl-5">
              {option.missing.map((requirement, index) => (
                <li key={index}>{requirementSentence(requirement)}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {option.allowed && !option.affordable ? <p className="text-sm text-bad">{say("ui.activity.cannot-pay")}</p> : null}

        {needsParam && option.allowed ? (
          option.params?.length === 0 ? (
            <p className="text-sm text-muted">{say("ui.activity.nothing-to-pick")}</p>
          ) : (
            <label htmlFor={selectId} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{say("ui.activity.pick")}</span>
              <select
                id={selectId}
                value={chosenParam}
                onChange={(event) => setParam(event.target.value)}
                className="min-h-11 rounded-lg border border-line bg-paper px-3"
              >
                {option.params?.map((value) => (
                  <option key={value} value={value}>
                    {nameOf(value)}
                  </option>
                ))}
              </select>
            </label>
          )
        ) : null}

        <div className="mt-auto pt-1">
          <Button
            small
            disabled={!canAdd}
            aria-label={`${say("ui.activity.add")}: ${name}`}
            onClick={() => addToPlan({ activity: option.id, param: needsParam ? chosenParam : null })}
          >
            <Plus size={16} />
            {full && option.allowed ? say("ui.activity.full") : say("ui.activity.add")}
          </Button>
        </div>
      </Card>
    </li>
  );
}

export function ActivityView() {
  const view = useView();
  // Allowed first, so the cards a player can use now are the ones they see first.
  const options = [...view.activities].sort((a, b) => Number(b.allowed) - Number(a.allowed));
  return (
    <div className="flex flex-col gap-6">
      <Panel title={say("ui.job.title")}>
        <Job />
      </Panel>
      <Panel title={say("ui.month.plan")}>
        <Slots />
      </Panel>
      <Panel title={say("ui.activity.title")}>
        <ul className="grid gap-3 @lg:grid-cols-2">
          {options.map((option) => (
            <ActivityCard key={option.id} option={option} />
          ))}
        </ul>
      </Panel>
    </div>
  );
}
