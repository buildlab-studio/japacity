// The four off switches and the dials of the private settings (R-SERVER-030,
// R-SERVER-031): each change carries a reason and is logged with who made it.
import { content } from "@japacity/content";
import { useState } from "react";

import { Tag } from "../../shared/ui/Panel";
import { SWITCH_NAMES, type DialChange, type Dials, type SettingChange, type SwitchName } from "./admin.contract";
import { utcTime } from "./admin.format";
import { words, type AdminKey } from "./admin.words";
import type { AdminApi } from "./api";
import { Choice, Confirm, Field, Loaded, ReloadButton, Section, Table, useLoad } from "./admin.ui";

const WHOLE = /^\d{1,10}$/;
const MAX_DIAL = 2_147_483_647;

type DialName = DialChange["dial"];

const DIAL_WORDS: Record<DialName, AdminKey> = {
  placeTarget: "admin.dial.placeTarget",
  computerAfterMonths: "admin.dial.computerAfterMonths",
};

const PLACES = Object.keys(content.place).sort();

function switchName(name: SwitchName): string {
  return words(`admin.switch.${name}`);
}

function valueOf(typed: string): number | null {
  return WHOLE.test(typed) && Number(typed) <= MAX_DIAL ? Number(typed) : null;
}

function SwitchRow({ api, name, on, onDone }: { api: AdminApi; name: SwitchName; on: boolean; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const why = reason.trim();
  return (
    <li data-switch={name} className="flex flex-col gap-3 rounded-md border border-sheet-line p-3">
      <div className="flex items-center gap-2">
        <span className="font-semibold">{switchName(name)}</span>
        <Tag tone={on ? "good" : "bad"}>{words(on ? "admin.switch.on" : "admin.switch.off")}</Tag>
      </div>
      <Field label={words("admin.switch.reason", { name: switchName(name) })} value={reason} onChange={(event) => setReason(event.target.value)} />
      <Confirm
        label={words(on ? "admin.switch.turn-off" : "admin.switch.turn-on", { name: switchName(name) })}
        summary={words(on ? "admin.switch.confirm.off" : "admin.switch.confirm.on", { name: switchName(name), reason: why })}
        blocked={why === "" ? words("admin.reason.needed") : null}
        send={() => api.setSwitch(name, !on, why)}
        onDone={() => {
          setReason("");
          onDone();
        }}
      />
    </li>
  );
}

function DialRow({ api, dial, now, onDone }: { api: AdminApi; dial: DialName; now: Dials; onDone: () => void }) {
  const [typed, setTyped] = useState("");
  const [place, setPlace] = useState(PLACES[0] ?? "");
  const [reason, setReason] = useState("");
  const why = reason.trim();
  const value = valueOf(typed);
  const name = words(DIAL_WORDS[dial]);
  const change = (to: number | null): DialChange => (dial === "placeTarget" ? { dial, place, value: to } : { dial, value: to });
  const summary = (to: number | null) => {
    if (dial === "placeTarget") return to === null ? words("admin.dial.confirm.place.unset", { dial: name, place, reason: why }) : words("admin.dial.confirm.place", { dial: name, place, value: to, reason: why });
    return to === null ? words("admin.dial.confirm.unset", { dial: name, reason: why }) : words("admin.dial.confirm", { dial: name, value: to, reason: why });
  };
  const held = dial === "placeTarget" ? (now.placeTargets[place] ?? null) : now[dial];
  const reasonBlock = why === "" ? words("admin.reason.needed") : null;
  return (
    <li data-dial={dial} className="flex flex-col gap-3 rounded-md border border-sheet-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{name}</span>
        <Tag>{held === null ? words("admin.dial.unset") : String(held)}</Tag>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {dial === "placeTarget" ? <Choice label={words("admin.dial.place")} value={place} options={PLACES.map((id) => ({ value: id, label: id }))} onChange={setPlace} /> : null}
        <Field label={`${words("admin.dial.value")}: ${name}`} inputMode="numeric" value={typed} onChange={(event) => setTyped(event.target.value)} />
        <Field label={`${words("admin.dial.reason")}: ${name}`} value={reason} onChange={(event) => setReason(event.target.value)} />
      </div>
      <div className="flex flex-wrap gap-4">
        <Confirm label={words("admin.dial.set")} summary={summary(value)} blocked={value === null ? words("admin.dial.bad") : reasonBlock} send={() => api.setDial(change(value), why)} onDone={onDone} />
        <Confirm label={words("admin.dial.clear")} summary={summary(null)} blocked={reasonBlock} send={() => api.setDial(change(null), why)} onDone={onDone} />
      </div>
    </li>
  );
}

function changeWords(change: SettingChange): string {
  if ("switch" in change) return `${change.switch} ${change.on ? "on" : "off"}`;
  const to = change.value === null ? "unset" : String(change.value);
  return change.dial === "placeTarget" ? `${change.dial} ${change.place} ${to}` : `${change.dial} ${to}`;
}

export function SwitchesTab({ api }: { api: AdminApi }) {
  const row = useLoad(() => api.switches());
  const log = useLoad(() => api.switchLog());
  const changed = () => {
    row.reload();
    log.reload();
  };
  return (
    <div className="flex flex-col gap-8">
      <Loaded reply={row.reply}>
        {({ switches, dials }) => (
          <>
            <Section title={words("admin.switches.title")} action={<ReloadButton onClick={row.reload} />}>
              <ul className="grid gap-3 lg:grid-cols-2">
                {SWITCH_NAMES.map((name) => (
                  <SwitchRow key={name} api={api} name={name} on={switches[name]} onDone={changed} />
                ))}
              </ul>
            </Section>
            <Section title={words("admin.dials.title")}>
              <ul className="flex flex-col gap-3">
                {(["computerAfterMonths", "placeTarget"] as const).map((dial) => (
                  <DialRow key={dial} api={api} dial={dial} now={dials} onDone={changed} />
                ))}
              </ul>
            </Section>
          </>
        )}
      </Loaded>
      <Section title={words("admin.switch.log")} action={<ReloadButton onClick={log.reload} />}>
        <Loaded reply={log.reply}>
          {({ log: rows }) => (
            <Table
              caption={words("admin.switch.log")}
              head={[words("admin.switch.log.when"), words("admin.switch.log.admin"), words("admin.switch.log.change"), words("admin.switch.log.reason")]}
              rows={rows.map((entry) => [utcTime(entry.at), entry.admin, changeWords(entry.change), entry.reason])}
            />
          )}
        </Loaded>
      </Section>
    </div>
  );
}
