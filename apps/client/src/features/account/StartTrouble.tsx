// A new visitor online while the server cannot answer (engine:browser-authority-for-dev-only, server:no-platform-error-page): never a blank
// page, and never "Opening your life..." to someone with no life. The start screen's frame still stands: the sheet with the hook and the three steps
// over the scene's ground (the city need not draw), and the trouble card in the sheet, naming the game. Retry asks
// again; while it asks, the frame stays, and once the server answers the start screen itself takes the frame's place.
import { StartHook } from "../../shared/front-door/Hook";
import { Gate, GateSheet } from "../../shared/front-door/Gate";
import type { Trouble } from "../../authority/store";
import { SheetDock } from "../../shared/ui/look/SheetColumn";
import { LegalLinks } from "../../shared/ui/LegalLinks";
import { Loader } from "../../shared/ui/Loader";
import { TroubleFace } from "../../shared/ui/Trouble";
import { say } from "../../shared/words/text";

export function StartTrouble({ trouble }: { trouble: Trouble | null }) {
  return (
    <Gate mark="start" scene={null}>
      {/* In the start screen's column on a wide screen, as the start screen's own sheet stands (AccountGate.tsx). */}
      <SheetDock>
        <GateSheet mark="start-trouble" label={say("ui.game")}>
          <div className="flex flex-col" data-start-trouble={trouble?.kind ?? "asking"}>
            <StartHook />
            {trouble === null ? (
              <p role="status" className="mt-4 flex flex-col gap-2 text-[14px] text-text-2">
                {say("ui.account.loading")}
                <Loader label={say("ui.account.loading")} />
              </p>
            ) : (
              <div className="-mx-4 mt-2">
                <TroubleFace trouble={trouble} inline named />
              </div>
            )}
          </div>
          <LegalLinks />
        </GateSheet>
      </SheetDock>
    </Gate>
  );
}
