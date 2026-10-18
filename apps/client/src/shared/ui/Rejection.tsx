import { CircleAlert, RotateCw } from "lucide-react";
import { useState } from "react";

import { useGame } from "../../authority/GameProvider";
import { say } from "../words/text";

/**
 * The last rejection's words, from content. Shown where the player acted. A life the server must check
 * (`diverged`, server:log-rows-hash-state) gets its own words and Retry, which asks for the life again, in place of Close.
 */
export function Rejection() {
  const rejection = useGame((state) => state.rejection);
  const dismiss = useGame((state) => state.dismissRejection);
  const recheck = useGame((state) => state.recheck);
  const [checking, setChecking] = useState(false);
  if (rejection === null) return null;
  const diverged = rejection.code === "diverged";
  const retry = (): void => {
    setChecking(true);
    void recheck().finally(() => setChecking(false));
  };
  return (
    <div role="alert" data-rejection={rejection.code} className="flex items-start gap-3 rounded-md border border-bad bg-sheet-2 p-3 text-bad">
      <CircleAlert size={20} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <p>{rejection.words}</p>
        {diverged || rejection.detail === undefined ? null : <p className="mt-1 text-sm">{rejection.detail}</p>}
      </div>
      {diverged ? (
        <button type="button" className="inline-flex items-center gap-1 text-sm underline underline-offset-4" onClick={retry} disabled={checking}>
          {say("ui.trouble.retry")}
          <RotateCw size={14} aria-hidden />
        </button>
      ) : (
        <button type="button" className="text-sm underline underline-offset-4" onClick={dismiss}>
          {say("ui.dismiss")}
        </button>
      )}
    </div>
  );
}
