// The one answer wherever a way back in finds no account (account:sign-in-without-secret): what was found, said plainly, and
// the way on under it as the main button. A code's address that no account uses is offered a new life kept with that
// email, with a quiet way to another address; a passkey or a trip to Google that found none keeps its own words, with
// "Start a new life" under them.
import { Button } from "../../shared/ui/Button";

export interface NoAccountProps {
  /** What the way in found, in its own words. */
  said: string;
  /** The way on: the main button. */
  label: string;
  onGo: () => void;
  /** A quiet second way, where there is one. */
  other?: { label: string; onClick: () => void } | null;
  busy?: boolean;
  /** What the way on answered when it did not go through. */
  problem?: string | null;
  /** In the warning colour: a refusal rather than an answer. */
  bad?: boolean;
}

export function NoAccount({ said, label, onGo, other = null, busy = false, problem = null, bad = false }: NoAccountProps) {
  return (
    <div className="flex flex-col gap-3" data-no-account>
      <p role="alert" className={`font-bold ${bad ? "text-bad" : ""}`}>
        {said}
      </p>
      <div>
        <Button variant="primary" disabled={busy} onClick={onGo}>
          {label}
        </Button>
      </div>
      {other === null ? null : (
        <div>
          <Button variant="quiet" disabled={busy} onClick={other.onClick}>
            {other.label}
          </Button>
        </div>
      )}
      <p role="status" className="text-[14px] leading-snug text-bad">
        {problem ?? ""}
      </p>
    </div>
  );
}
