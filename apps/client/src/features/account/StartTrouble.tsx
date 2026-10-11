// A new visitor online while the server cannot answer (engine.md R-ENGINE-015, server.md R-SERVER-043, amended 11 Oct
// 2026). The start screen's frame still stands: the sheet with the hook and the three steps
// over the scene's ground (the city need not draw), and the trouble card in the sheet, naming the game. Retry asks
// again; while it asks, the frame stays, and once the server answers the start screen itself takes the frame's place.
import { StartHook } from "../../shared/frontdoor/Hook";
import { Gate, GateSheet } from "../../shared/frontdoor/Gate";
import type { Trouble } from "../../authority/store";
import { LegalLinks } from "../../shared/ui/LegalLinks";
import { TroubleFace } from "../../shared/ui/Trouble";
import { say } from "../../shared/words/text";

export function StartTrouble({ trouble }: { trouble: Trouble | null }) {
  return (
    <Gate mark="start" scene={null}>
      <GateSheet mark="start-trouble" label={say("ui.game")}>
        <div className="flex flex-col" data-start-trouble={trouble?.kind ?? "asking"}>
          <StartHook />
          {trouble === null ? (
            <p role="status" className="mt-4 text-[14px] text-text-2">
              {say("ui.account.loading")}
            </p>
          ) : (
            <div className="-mx-4 mt-2">
              <TroubleFace trouble={trouble} inline named />
            </div>
          )}
        </div>
        <LegalLinks />
      </GateSheet>
    </Gate>
  );
}
