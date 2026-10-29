// The answer where a way back in finds no life after the player proved who they are (account:sign-in-without-secret): a
// passkey this site does not know, or a trip to Google that found none and proved nothing for a new life (an address Google
// has not verified). Proving with either tells only the person who holds it, so the answer may say there is no life: what
// was found, in its own words, with "Start a new life" under it as the main button. The emailed code never answers this
// way: its send answers every address alike; Google with a verified address goes on to a new life's steps as the code does.
import { Button } from "../../shared/ui/Button";

export interface NoAccountProps {
  /** What the way in found, in its own words. */
  said: string;
  /** The way on: the main button. */
  label: string;
  onGo: () => void;
  /** In the warning colour: a refusal rather than an answer. */
  bad?: boolean;
}

export function NoAccount({ said, label, onGo, bad = false }: NoAccountProps) {
  return (
    <div className="flex flex-col gap-3" data-no-account>
      <p role="alert" className={`font-bold ${bad ? "text-bad" : ""}`}>
        {said}
      </p>
      <div>
        <Button variant="primary" onClick={onGo}>
          {label}
        </Button>
      </div>
    </div>
  );
}
