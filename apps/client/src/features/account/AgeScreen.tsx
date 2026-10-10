// The age screen (R-ACCOUNT-012): three fields, the day, the month and the year, none filled in and none
// hinting at the age needed. The server decides and keeps no date of birth; this screen only sends what was
// picked, with the bot check's token, which the server reads here, the one step every new account takes
// (R-ACCOUNT-013, apps/server/src/routes/age.ts). The check runs unseen (R-ACCOUNT-029): Continue waits for
// its token a moment rather than asking the player to.
import { ArrowLeft } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import type { AccountApi, AgeStanding, Full } from "../../shared/net/auth";
import { say } from "../../shared/words/text";
import { Turnstile, type LoadTurnstile } from "./Turnstile";

/** How far back the year list runs: every adult's year, with no line drawn at any age. */
export const YEARS_LISTED = 100;
/** How long Continue waits for the unseen check's token before it sends without one. */
export const BOT_WAIT_MS = 8_000;

const MONTHS = 12;
const DAYS = 31;

/** The three fields as the server reads them, `YYYY-MM-DD`; empty until all three are picked. */
export function birthOf(day: string, month: string, year: string): string {
  if (day === "" || month === "" || year === "") return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export interface AgeScreenProps {
  account: AccountApi;
  sitekey: string | null;
  load: LoadTurnstile;
  onStanding: (standing: AgeStanding | Full) => void;
  /** Back to the start screen; none inside the invite page. */
  onBack?: (() => void) | null;
  /** A seam for tests: the year the list starts at. */
  thisYear?: number;
  botWaitMs?: number;
}

const FIELD = "h-12 w-full min-w-0 appearance-none rounded-[6px] border-2 border-sheet-line bg-sheet-muted px-3 text-[16px] font-bold text-text outline-none focus:border-action";

export function AgeScreen({ account, sitekey, load, onStanding, onBack = null, thisYear = new Date().getFullYear(), botWaitMs = BOT_WAIT_MS }: AgeScreenProps) {
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [bot, setBot] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const waiting = useRef<((token: string | null) => void) | null>(null);
  // Only a widget that is up has a token on its way; without one, Continue sends at once.
  const shownUp = useRef(false);

  const took = (token: string | null): void => {
    setBot(token);
    if (token !== null) waiting.current?.(token);
  };

  /** The token in hand, or the one the unseen check gives within the wait, or none. */
  function token(): Promise<string | null> {
    if (bot !== null || sitekey === null || !shownUp.current) return Promise.resolve(bot);
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        waiting.current = null;
        resolve(null);
      }, botWaitMs);
      waiting.current = (given) => {
        window.clearTimeout(timer);
        waiting.current = null;
        resolve(given);
      };
    });
  }

  async function answer(event: FormEvent) {
    event.preventDefault();
    const birth = birthOf(day, month, year);
    if (birth === "") {
      setProblem(say("ui.account.age.empty"));
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const sent = await token();
      const answer = await account.declareAge(birth, sent);
      // A token is good once, whatever the server answered.
      if (sent !== null) {
        setBot(null);
        setRound((count) => count + 1);
      }
      if (answer === "bad-date") setProblem(say("ui.account.age.bad-date"));
      else if (answer === "bot-check") setProblem(say("ui.account.bot.failed"));
      else onStanding(answer);
    } catch {
      setProblem(say("ui.account.fail.unreachable"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={(event) => void answer(event)} noValidate data-age-screen>
      <div className="flex items-center gap-2">
        {onBack === null ? null : (
          <button type="button" aria-label={say("ui.account.back")} className="press flex size-9 shrink-0 items-center justify-center rounded-[6px] bg-sheet-muted" onClick={onBack}>
            <ArrowLeft size={18} />
          </button>
        )}
        <h1 className="title text-[22px] leading-tight">{say("ui.account.age.title")}</h1>
      </div>
      <p className="text-[14px] leading-snug text-text-2">{say("ui.account.age.intro")}</p>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="label mb-1.5 text-text-2">{say("ui.account.age.label")}</legend>
        <div className="grid grid-cols-[1fr_1.6fr_1.2fr] gap-1.5">
          <select className={FIELD} aria-label={say("ui.account.age.day")} value={day} onChange={(event) => setDay(event.target.value)}>
            <option value="" disabled>
              {say("ui.account.age.day")}
            </option>
            {Array.from({ length: DAYS }, (_, index) => (
              <option key={index} value={String(index + 1)}>
                {index + 1}
              </option>
            ))}
          </select>
          <select className={FIELD} aria-label={say("ui.account.age.month")} value={month} onChange={(event) => setMonth(event.target.value)}>
            <option value="" disabled>
              {say("ui.account.age.month")}
            </option>
            {Array.from({ length: MONTHS }, (_, index) => (
              <option key={index} value={String(index + 1)}>
                {say(`ui.account.age.month.${String(index + 1)}`)}
              </option>
            ))}
          </select>
          <select className={FIELD} aria-label={say("ui.account.age.year")} value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="" disabled>
              {say("ui.account.age.year")}
            </option>
            {Array.from({ length: YEARS_LISTED }, (_, index) => (
              <option key={index} value={String(thisYear - index)}>
                {thisYear - index}
              </option>
            ))}
          </select>
        </div>
      </fieldset>
      <button type="submit" className="btn-main mt-1" disabled={busy}>
        <span>{say("ui.account.age.go")}</span>
      </button>
      {problem === null ? null : (
        <p role="alert" className="text-[14px] font-bold text-bad">
          {problem}
        </p>
      )}
      {/* Unseen unless Cloudflare needs a tap (R-ACCOUNT-029). */}
      {sitekey === null ? null : <Turnstile sitekey={sitekey} load={load} round={round} onToken={took} onShown={() => (shownUp.current = true)} />}
    </form>
  );
}
