import { CircleAlert } from "lucide-react";

import { useGame } from "../../authority/GameProvider";
import { say } from "../words/text";

/** The last rejection's words, from content. Shown where the player acted. */
export function Rejection() {
  const rejection = useGame((state) => state.rejection);
  const dismiss = useGame((state) => state.dismissRejection);
  if (rejection === null) return null;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-md border border-bad bg-sheet-2 p-3 text-bad">
      <CircleAlert size={20} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <p>{rejection.words}</p>
        {rejection.detail === undefined ? null : <p className="mt-1 text-sm">{rejection.detail}</p>}
      </div>
      <button type="button" className="text-sm underline underline-offset-4" onClick={dismiss}>
        {say("ui.dismiss")}
      </button>
    </div>
  );
}
