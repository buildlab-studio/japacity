// The age screen (account:age-screen-refuses-minors): three fields, the day, the month and the year, none filled in and none
// hinting at the age needed, before the username and the guest life. The server decides and keeps no date of
// birth; this screen only sends what was picked. The bot check runs where the account is made, at Begin on the
// page (account:bot-check-on-guest-creation, account:start-screen-over-live-city). One quiet line under the fields turns a
// returning player who tapped Play by habit back to the ways back in, before any life is made (account:age-screen-refuses-minors).
// A life that came by the code on the ways back in meets the same screen under a line that says why it is here, and without
// that quiet line, since the player has just tried the ways back in (account:sign-in-without-secret).
import { ArrowLeft } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";

import type { AccountApi, AgeStanding, Full } from "../../shared/net/auth";
import { FieldNote } from "../../shared/ui/FieldNote";
import { say } from "../../shared/words/text";

/** How far back the year list runs: every adult's year, with no line drawn at any age. */
export const YEARS_LISTED = 100;

const MONTHS = 12;
const DAYS = 31;

/** The three fields as the server reads them, `YYYY-MM-DD`; empty until all three are picked. */
function birthOf(day: string, month: string, year: string): string {
  if (day === "" || month === "" || year === "") return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export interface AgeScreenProps {
  account: AccountApi;
  onStanding: (standing: AgeStanding | Full) => void;
  /** Back to the start screen; none inside the invite page. */
  onBack?: (() => void) | null;
  /** To the ways back in, for a player who has a life already. */
  onReturning?: (() => void) | null;
  /** What the gate says as the screen opens: why it is asked again. */
  said?: string | null;
  /** The line over the screen that says why the player is here: a life that came by the code (account:sign-in-without-secret). */
  lead?: ReactNode;
  /** The line under the heading, in place of the screen's own. */
  intro?: string;
  /** A seam for tests: the year the list starts at. */
  thisYear?: number;
}

const FIELD = "h-12 w-full min-w-0 appearance-none rounded-[6px] border-2 border-sheet-line bg-sheet-muted px-3 text-[16px] font-bold text-text focus:border-action";

export function AgeScreen({ account, onStanding, onBack = null, onReturning = null, said = null, lead = null, intro, thisYear = new Date().getFullYear() }: AgeScreenProps) {
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(said);
  // The answer itself is what is wrong (none picked, or a date that is no date): the three fields are marked (world:field-says-its-state).
  const [invalid, setInvalid] = useState(false);
  const noteId = useId();

  async function answer(event: FormEvent) {
    event.preventDefault();
    const birth = birthOf(day, month, year);
    if (birth === "") {
      setProblem(say("ui.account.age.empty"));
      setInvalid(true);
      return;
    }
    setBusy(true);
    setProblem(null);
    setInvalid(false);
    try {
      const answer = await account.declareAge(birth);
      setInvalid(answer === "bad-date");
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
      {lead}
      <div className="flex items-center gap-2">
        {onBack === null ? null : (
          <button type="button" aria-label={say("ui.account.back")} className="press flex size-11 shrink-0 items-center justify-center rounded-[6px] bg-sheet-muted" onClick={onBack}>
            <ArrowLeft size={18} />
          </button>
        )}
        <h1 className="title text-[22px] leading-tight" tabIndex={-1}>
          {say("ui.account.age.title")}
        </h1>
      </div>
      <p className="text-[14px] leading-snug text-text-2">{intro ?? say("ui.account.age.intro")}</p>
      <fieldset className="flex flex-col">
        <legend className="label mb-1.5 text-text-2">{say("ui.account.age.label")}</legend>
        <div className="grid grid-cols-[1fr_1.6fr_1.2fr] gap-1.5" data-age-fields>
          <select className={FIELD} aria-label={say("ui.account.age.day")} aria-invalid={invalid} aria-describedby={problem === null ? undefined : noteId} value={day} onChange={(event) => setDay(event.target.value)}>
            <option value="" disabled>
              {say("ui.account.age.day")}
            </option>
            {Array.from({ length: DAYS }, (_, index) => (
              <option key={index} value={String(index + 1)}>
                {index + 1}
              </option>
            ))}
          </select>
          <select className={FIELD} aria-label={say("ui.account.age.month")} aria-invalid={invalid} aria-describedby={problem === null ? undefined : noteId} value={month} onChange={(event) => setMonth(event.target.value)}>
            <option value="" disabled>
              {say("ui.account.age.month")}
            </option>
            {Array.from({ length: MONTHS }, (_, index) => (
              <option key={index} value={String(index + 1)}>
                {say(`ui.account.age.month.${String(index + 1)}`)}
              </option>
            ))}
          </select>
          <select className={FIELD} aria-label={say("ui.account.age.year")} aria-invalid={invalid} aria-describedby={problem === null ? undefined : noteId} value={year} onChange={(event) => setYear(event.target.value)}>
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
        {/* Directly under the fields it speaks for; an alert, so it is heard when Continue is refused. */}
        {problem === null ? null : (
          <FieldNote id={noteId} role="alert" state="problem" className="mt-1.5" data-age-said>
            {problem}
          </FieldNote>
        )}
      </fieldset>
      <button type="submit" className="btn-main mt-1" disabled={busy}>
        <span>{say("ui.account.age.go")}</span>
      </button>
      {onReturning === null ? null : (
        <button type="button" className="press min-h-11 self-start text-[14px] font-bold text-text-2 underline underline-offset-4" onClick={onReturning} data-age-returning>
          {say("ui.account.age.returning")}
        </button>
      )}
    </form>
  );
}
