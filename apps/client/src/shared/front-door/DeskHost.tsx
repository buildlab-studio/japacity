// The desk's host (prologue:front-door-three-screens, prologue:printed-page-hands-over): the desk stands above the door and the life, so
// its band, its stage and its panel stay mounted from the first screen to Go while the door and then the years take their turn
// to fill it. A screen fills it through `DeskSlot`: the band's and the stage's parts as data, the panel's body and foot drawn in
// place by portals, so they keep the screen's own context. A slot that hands the desk on (the door at Begin of a life from
// sixteen) leaves it standing until the next fills it; a fault takes it down.
import { createContext, type ReactNode, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useGame } from "../../authority/GameProvider";
import { type DeskStep, DoorDesk } from "./DoorDesk";

/** What a screen puts on the desk besides its panel's body and foot. */
export interface DeskFill {
  mark: string;
  look: string;
  steps: readonly DeskStep[];
  onBack?: (() => void) | null;
  onShuffle?: (() => void) | null;
  onSkip?: (() => void) | null;
  /** What stands on the stage; null keeps what stands there already (the years' wait keeps the door's page). */
  stage: ReactNode;
  title: string;
  line?: ReactNode;
  keys?: ReactNode;
}

interface Held {
  by: number;
  fill: DeskFill;
  /** True where the screen hands the desk on: it stands when the screen goes, until the next fills it. */
  hands: boolean;
}

interface Host {
  fill: (held: Held) => void;
  /** A slot mounted; `leave` once it is gone. */
  enter: (by: number) => void;
  leave: (by: number) => void;
  body: HTMLElement | null;
  foot: HTMLElement | null;
}

const HostContext = createContext<Host | null>(null);
let slots = 0;

export function DeskHost({ children }: { children: ReactNode }) {
  const [held, setHeld] = useState<Held | null>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [foot, setFoot] = useState<HTMLElement | null>(null);
  const failed = useGame((state) => state.failed !== null);
  const shown = held !== null && !failed;
  // The slots mounted now. A slot that goes is let go a moment later, so one drawn again at once (React's strict check
  // mounts every effect twice in development) keeps the desk standing.
  const live = useRef(new Set<number>());
  // The slots read the host only for where to draw: filling it draws the desk again, never the slots.
  const host = useMemo<Host>(
    () => ({
      fill: (next) => setHeld((now) => (next.fill.stage === null && now !== null ? { ...next, fill: { ...next.fill, stage: now.fill.stage } } : next)),
      enter: (by) => live.current.add(by),
      leave: (by) => {
        live.current.delete(by);
        window.setTimeout(() => {
          if (!live.current.has(by)) setHeld((now) => (now === null || now.by !== by || now.hands ? now : null));
        }, 0);
      },
      body: shown ? body : null,
      foot: shown ? foot : null,
    }),
    [shown, body, foot],
  );
  return (
    <HostContext.Provider value={host}>
      {shown ? (
        <DoorDesk {...held.fill} foot={<div ref={setFoot} />}>
          <div ref={setBody} />
        </DoorDesk>
      ) : null}
      {children}
    </HostContext.Provider>
  );
}

/** Fills the desk while mounted: its band and stage from `fill`, its panel's body with the children and its foot with `foot`. */
export function DeskSlot({ fill, foot, hands = false, children }: { fill: DeskFill; foot: ReactNode; hands?: boolean; children: ReactNode }) {
  const host = useContext(HostContext);
  const [by] = useState(() => (slots += 1));
  const leave = useRef(host?.leave);
  leave.current = host?.leave;
  useLayoutEffect(() => {
    host?.fill({ by, fill, hands });
  });
  useLayoutEffect(() => {
    host?.enter(by);
    return () => leave.current?.(by);
  }, [by]);
  return (
    <>
      {host?.body ? createPortal(children, host.body) : null}
      {host?.foot ? createPortal(foot, host.foot) : null}
    </>
  );
}

/** The line of keys under the action, on a fine pointer: each key as a cap with what it does. */
export function DeskKeys({ keys }: { keys: readonly { caps: readonly string[]; does: string }[] }) {
  return (
    <p className="desk-keys" data-door-keys>
      {keys.map((one) => (
        <span key={one.does}>
          {one.caps.map((cap) => (
            <kbd key={cap} className="desk-key">
              {cap}
            </kbd>
          ))}
          <span>{one.does}</span>
        </span>
      ))}
    </p>
  );
}
