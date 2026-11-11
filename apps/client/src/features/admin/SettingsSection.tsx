// Settings (admin:sections-alarms-first, admin:actions-confirm-with-reason): the four off switches and the board switches
// (server:four-off-switches) as rows with a toggle, the dials (server:private-settings-and-dials) as rows with a value, each
// change made in a dialog that says what will happen, takes "Reason for the change" and names the act on its button; and
// the change log, which has who and why.
import { type DialChange, type Dials, MAX_DIAL, type SettingChange, SWITCH_NAMES, type SwitchName } from "@japacity/api";
import { content } from "@japacity/content";
import { useState } from "react";

import { Button } from "../../shared/ui/Button";
import { whenWords } from "./admin.format";
import { words, type AdminKey } from "./admin.words";
import type { Shared } from "./AdminPage";
import { Card, Choice, Field, Loaded, Pill, ReasonDialog, ReloadButton, Table, Toggle, useLoad } from "./admin.ui";

const WHOLE = /^\d{1,10}$/;

type DialName = DialChange["dial"];

const DIAL_WORDS: Record<DialName, AdminKey> = {
  placeTarget: "admin.dial.placeTarget",
  computerAfterMonths: "admin.dial.computerAfterMonths",
};

const DIAL_WHAT: Record<DialName, AdminKey> = {
  placeTarget: "admin.dial.placeTarget.what",
  computerAfterMonths: "admin.dial.computerAfterMonths.what",
};

const PLACES = Object.keys(content.place).sort();

function switchName(name: SwitchName): string {
  return words(`admin.switch.${name}`);
}

function switchWhat(name: SwitchName): string {
  return words(`admin.switch.${name}.what` as AdminKey);
}

function reasonExample(name: SwitchName, on: boolean) {
  const way = on ? "off" : "on";
  switch (name) {
    case "signups":
    case "lottery":
    case "adverts":
    case "partnerPlay":
      return `admin.switch.reason.example.${way}.${name}` as const;
    case "boards.this-week.everyone":
    case "boards.this-week.friends":
    case "boards.all-time.everyone":
    case "boards.all-time.friends":
    case "boards.joined-week":
      return `admin.switch.reason.example.${way}.board` as const;
  }
}

function valueOf(typed: string): number | null {
  return WHOLE.test(typed) && Number(typed) <= MAX_DIAL ? Number(typed) : null;
}

function SwitchRow({ shared, name, on, onDone }: { shared: Shared; name: SwitchName; on: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const act = words(on ? "admin.switch.turn-off" : "admin.switch.turn-on", { name: switchName(name) });
  return (
    <li data-switch={name} className="flex items-center gap-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{switchName(name)}</span>
        <span className="block text-xs text-text-2">{switchWhat(name)}</span>
      </span>
      <Pill tone={on ? "ok" : "plain"}>{words(on ? "admin.switch.on" : "admin.switch.off")}</Pill>
      <Toggle on={on} act={act} onClick={() => setOpen(true)} />
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        act={act}
        summary={words(on ? "admin.switch.confirm.off" : "admin.switch.confirm.on", { name: switchName(name), what: switchWhat(name) })}
        reasonLabel={words("admin.switch.reason")}
        reasonFor={words("admin.switch.reason.for", { name: switchName(name) })}
        example={words(reasonExample(name, on))}
        danger={on}
        send={(reason) => shared.api.setSwitch(name, !on, reason)}
        onDone={onDone}
      />
    </li>
  );
}

function DialRow({ shared, dial, now, onDone }: { shared: Shared; dial: DialName; now: Dials; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [place, setPlace] = useState(PLACES[0] ?? "");
  const [unset, setUnset] = useState(false);
  const value = valueOf(typed);
  const name = words(DIAL_WORDS[dial]);
  const change = (to: number | null): DialChange => (dial === "placeTarget" ? { dial, place, value: to } : { dial, value: to });
  const summary = (to: number | null) => {
    if (dial === "placeTarget") return to === null ? words("admin.dial.confirm.place.unset", { dial: name, place }) : words("admin.dial.confirm.place", { dial: name, place, value: to });
    return to === null ? words("admin.dial.confirm.unset", { dial: name }) : words("admin.dial.confirm", { dial: name, value: to });
  };
  const held = dial === "placeTarget" ? (now.placeTargets[place] ?? null) : now[dial];
  const to = unset ? null : value;
  return (
    <li data-dial={dial} className="flex items-center gap-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{name}</span>
        <span className="block text-xs text-text-2">{words(DIAL_WHAT[dial])}</span>
      </span>
      <span className="text-sm font-medium tabular-nums">{held === null ? words("admin.dial.unset") : String(held)}</span>
      <Button small onClick={() => setOpen(true)} aria-label={words("admin.dial.set.for", { name })}>
        {words("admin.dial.set")}
      </Button>
      <ReasonDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setTyped("");
            setUnset(false);
          }
        }}
        act={unset ? words("admin.dial.clear.act", { name }) : words("admin.dial.set.act", { name })}
        summary={summary(to)}
        reasonLabel={words("admin.switch.reason")}
        reasonFor={words("admin.dial.reason.for", { name })}
        example={words("admin.dial.reason.example")}
        blocked={!unset && value === null ? words("admin.dial.bad") : null}
        send={(reason) => shared.api.setDial(change(to), reason)}
        onDone={onDone}
      >
        {dial === "placeTarget" ? <Choice label={words("admin.dial.place")} value={place} options={PLACES.map((id) => ({ value: id, label: id }))} onChange={setPlace} /> : null}
        <p className="text-sm text-text-2">{words("admin.dial.held", { value: held === null ? words("admin.dial.unset") : String(held) })}</p>
        <Field label={`${words("admin.dial.value")}: ${name}`} inputMode="numeric" value={typed} disabled={unset} onChange={(event) => setTyped(event.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={unset} onChange={(event) => setUnset(event.target.checked)} />
          {words("admin.dial.clear")}
        </label>
      </ReasonDialog>
    </li>
  );
}

function changeWords(change: SettingChange): string {
  if ("switch" in change) return `${change.switch} ${change.on ? "on" : "off"}`;
  const to = change.value === null ? "unset" : String(change.value);
  return change.dial === "placeTarget" ? `${change.dial} ${change.place} ${to}` : `${change.dial} ${to}`;
}

export function SettingsSection({ shared }: { shared: Shared }) {
  const row = useLoad(() => shared.api.switches());
  const log = useLoad(() => shared.api.switchLog());
  const changed = () => {
    row.reload();
    log.reload();
  };
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{words("admin.section.settings")}</h2>
        <ReloadButton onClick={changed} />
      </div>
      <Loaded reply={row.reply}>
        {({ switches, dials }) => (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title={words("admin.switches.title")} subtitle={words("admin.switches.note")}>
              <ul className="flex flex-col divide-y divide-sheet-line">
                {SWITCH_NAMES.map((name) => (
                  <SwitchRow key={name} shared={shared} name={name} on={switches[name]} onDone={changed} />
                ))}
              </ul>
            </Card>
            <Card title={words("admin.dials.title")} subtitle={words("admin.dials.note")}>
              <ul className="flex flex-col divide-y divide-sheet-line">
                {(["computerAfterMonths", "placeTarget"] as const).map((dial) => (
                  <DialRow key={dial} shared={shared} dial={dial} now={dials} onDone={changed} />
                ))}
              </ul>
            </Card>
          </div>
        )}
      </Loaded>
      <Card title={words("admin.switch.log")} action={<ReloadButton onClick={log.reload} />}>
        <Loaded reply={log.reply}>
          {({ log: rows }) => (
            <Table caption={words("admin.switch.log")} hideCaption head={[words("admin.switch.log.when"), words("admin.switch.log.admin"), words("admin.switch.log.change"), words("admin.switch.log.reason")]} rows={rows.map((entry) => [whenWords(entry.at), entry.admin, changeWords(entry.change), entry.reason])} />
          )}
        </Loaded>
      </Card>
    </>
  );
}
