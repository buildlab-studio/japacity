// The invite link's page, `/invite/<code>` (pair.md R-PAIR-007, R-PAIR-008):
// the card the link carries, read before sign-up; then sign-up and the age
// screen; then the card taken for the slot it was made for. A partner link
// needs a grown-up life, the friend's own or a new one; a sibling link always
// starts a new life (R-PEOPLE-011). No advert shows here (R-ADVERT-003).
import { content, text } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { createContext, createElement, use, useEffect, useMemo, useState, type ReactNode } from "react";

import { useGame } from "../../authority/GameProvider";
import { authorityMode } from "../../authority/mode";
import { rejectionWords } from "../../authority/store";
import { BlockReport } from "../../shared/moderation/BlockReport";
import type { AcceptReply, AcceptRequest, InviteShown, InviteShownReply, ServerRejection } from "../../shared/net/contract";
import { api, type Api } from "../../shared/net/http";
import { Button } from "../../shared/ui/Button";
import { nameOf, runningName, say, words } from "../../shared/words/text";
import { AccountGate, type AccountGateProps } from "./AccountGate";

/** The code in `/invite/<code>`, or null on any other path. */
export function inviteCodeOf(path: string): string | null {
  const found = /^\/invite\/([^/]+)\/?$/.exec(path);
  return found?.[1] === undefined ? null : decodeURIComponent(found[1]);
}

/** A partner's new life starts grown up: the prologue's life starts at sixteen (R-PEOPLE-008). */
const PROLOGUE = "scenario.prologue";
const GROWN_UP = (Object.keys(content.scenario) as Id<"scenario">[]).filter((id) => id !== PROLOGUE);

type Stage = { kind: "loading" } | { kind: "refused"; why: string } | { kind: "card"; shown: InviteShown } | { kind: "taken"; shown: InviteShown };

function buildServer(): Api | null {
  const mode = authorityMode();
  return mode.authority === "remote" ? api({ baseUrl: mode.baseUrl }) : null;
}

/** Undefined: decide from the build. Null: offline. Tests hand in a faked server. */
const InviteServerContext = createContext<Api | null | undefined>(undefined);

export function InviteServerProvider({ value, children }: { value: Api | null; children: ReactNode }) {
  return createElement(InviteServerContext, { value }, children);
}

function refusedWords(rejection: ServerRejection): string {
  return rejectionWords(rejection.code);
}

/** The card as the link shows it: the character's name and japacity, what they look for, and that it is a game. */
function CardFace({ shown }: { shown: InviteShown }) {
  const { card } = shown;
  const slot = text[card.looking.slotKey] ?? card.looking.slot;
  const fill = card.looking.fillKey === null ? "" : (text[card.looking.fillKey] ?? "");
  return (
    <figure className="flex flex-col gap-1 rounded-md border-2 border-ink bg-sheet p-4" data-invite-card>
      <p className="font-display text-2xl">{text[card.name] ?? say("ui.invite.someone")}</p>
      <p className="text-sm">
        {card.japacity.percent === null ? say("ui.people.invite.japacity-none") : say("ui.people.invite.japacity", { percent: `${String(card.japacity.percent)}%` })}
        {card.japacity.route === null ? null : <span className="text-text-2">, {runningName(card.japacity.route)}</span>}
      </p>
      <p className="font-semibold">{words(card.looking.key, { slot, fill }).trim()}</p>
      <p className="text-xs text-text-2">{text[card.game] ?? ""}</p>
    </figure>
  );
}

function Accept({ server, code, shown, onTaken }: { server: Api; code: string; shown: InviteShown; onTaken: () => void }) {
  const choosingLife = useGame((state) => state.choosingLife);
  const view = useGame((state) => state.view);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // A sibling link is always a new life; a partner link asks for one only when the account has none.
  const needsLife = shown.looking === "partner" && (choosingLife || view === null);

  async function take(scenario: Id<"scenario"> | null) {
    setBusy(true);
    setProblem(null);
    const request: AcceptRequest = scenario === null ? { slot: shown.slot } : { slot: shown.slot, scenario };
    try {
      const reply = await server.post<AcceptReply>(`/api/invite/${encodeURIComponent(code)}/accept`, request);
      if (reply.ok) onTaken();
      else setProblem(refusedWords(reply));
    } catch {
      setProblem(say("ui.account.fail.unreachable"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-label={say("ui.invite.take")}>
      {needsLife ? (
        <>
          <p>{say("ui.invite.new-life")}</p>
          <ul className="flex flex-col gap-2">
            {GROWN_UP.map((id) => (
              <li key={id}>
                <Button className="w-full justify-start" disabled={busy} aria-label={`${say("ui.invite.take")}: ${nameOf(id)}`} onClick={() => void take(id)}>
                  {nameOf(id)}
                </Button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p>{say(shown.looking === "sibling" ? "ui.invite.sibling" : "ui.invite.partner")}</p>
          <div>
            <Button variant="primary" disabled={busy} onClick={() => void take(null)}>
              {say("ui.invite.take")}
            </Button>
          </div>
        </>
      )}
      {problem === null ? null : (
        <p role="alert" className="text-bad">
          {problem}
        </p>
      )}
    </section>
  );
}

export interface InvitePageProps extends AccountGateProps {
  code: string;
  /** The server to read the card from; the build's own unless a test hands one in. Null offline. */
  server?: Api | null;
  /** Leaves the page for the game once the card is taken. */
  onDone?: () => void;
}

export function InvitePage({ code, server: given, onDone, ...gate }: InvitePageProps) {
  const provided = use(InviteServerContext);
  const server = useMemo(() => given ?? provided ?? (given === null || provided === null ? null : buildServer()), [given, provided]);
  const signedOut = useGame((state) => state.signedOut);
  // Signed in once the server has answered with a life, or said there is none yet.
  const signedIn = useGame((state) => !state.signedOut && (state.view !== null || state.choosingLife));
  const refresh = useGame((state) => state.refresh);
  const closeLifeChooser = useGame((state) => state.closeLifeChooser);
  const [stage, setStage] = useState<Stage>({ kind: "loading" });

  useEffect(() => {
    if (server === null) return;
    let live = true;
    server
      .get<InviteShownReply>(`/api/invite/${encodeURIComponent(code)}`)
      .then((reply) => {
        if (live) setStage(reply.ok ? { kind: "card", shown: reply } : { kind: "refused", why: refusedWords(reply) });
      })
      .catch(() => {
        if (live) setStage({ kind: "refused", why: say("ui.account.fail.unreachable") });
      });
    return () => {
      live = false;
    };
  }, [server, code]);

  if (server === null) return <Page>{say("ui.invite.offline")}</Page>;
  if (stage.kind === "loading") return <Page>{say("ui.account.loading")}</Page>;
  if (stage.kind === "refused") return <Page alert>{stage.why}</Page>;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8" data-invite-page>
      <p className="text-xl font-bold">{say("ui.game")}</p>
      <h1 className="text-2xl font-bold">{say("ui.invite.title")}</h1>
      <CardFace shown={stage.shown} />
      <p className="text-sm text-text-2">{say("ui.invite.days", { days: content.tuning.pair.inviteDays })}</p>
      {/* R-MODERATION-003: a card is something the game did not write. */}
      <BlockReport who={{ name: text[stage.shown.card.name] ?? say("ui.invite.someone") }} cites={{ card: code }} surface="invite-card" />
      {stage.kind === "taken" ? (
        <section className="flex flex-col gap-3">
          <p role="status">{say("ui.invite.taken")}</p>
          <div>
            <Button
              variant="primary"
              onClick={() => {
                // The life the card made is the account's now: no chooser, straight to it.
                closeLifeChooser();
                void refresh();
                onDone?.();
              }}
            >
              {say("ui.invite.play")}
            </Button>
          </div>
        </section>
      ) : signedOut ? (
        <section className="flex flex-col gap-3">
          <p>{say("ui.invite.come-in")}</p>
          <AccountGate {...gate} embedded />
        </section>
      ) : signedIn ? (
        <Accept server={server} code={code} shown={stage.shown} onTaken={() => setStage({ kind: "taken", shown: stage.shown })} />
      ) : (
        <p className="text-text-2">{say("ui.account.loading")}</p>
      )}
    </main>
  );
}

function Page({ children, alert = false }: { children: string; alert?: boolean }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8" data-invite-page>
      <p className="text-xl font-bold">{say("ui.game")}</p>
      <p role={alert ? "alert" : undefined}>{children}</p>
    </main>
  );
}
