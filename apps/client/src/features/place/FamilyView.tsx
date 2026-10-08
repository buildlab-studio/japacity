// The family, seen from abroad: the naira at home that requests are paid from
// (R-ABROAD-006 and 007), what is sent home each month, and the way to send
// more. Money must be sent before a request from home can be met.
import { content } from "@japacity/content";
import { Users } from "lucide-react";

import { useView } from "../../authority/GameProvider";
import { Card, Panel } from "../../shared/ui/Panel";
import { formatMoney } from "../../shared/words/format";
import { nameOf, say } from "../../shared/words/text";
import { RemitButton } from "../../shared/ui/RemitSheet";

export function FamilyView() {
  const view = useView();
  if (view.place.where !== "abroad") return null;
  const naira = view.pockets.NGN;
  const support = view.obligations.filter((owed) => content.obligation[owed.entry]?.type === "support");
  return (
    <Panel title={say("ui.family.title")}>
      <Card className="flex flex-col gap-3" data-family>
        <div className="flex items-start gap-3">
          <Users size={20} className="mt-0.5 shrink-0 text-muted" />
          <div className="flex flex-col gap-1">
            <p className="font-medium tabular-nums">{say("ui.family.naira", { bank: formatMoney(naira.bank, "NGN"), cash: formatMoney(naira.cash, "NGN") })}</p>
            <p className="text-sm text-muted">{say("ui.family.why")}</p>
          </div>
        </div>
        {support.length === 0 ? null : (
          <ul className="flex flex-col gap-1 text-sm">
            {support.map((owed) => (
              <li key={owed.id} className="tabular-nums">
                {say("ui.family.support", { name: nameOf(owed.entry), amount: formatMoney(owed.due, content.obligation[owed.entry]?.currency ?? "NGN") })}
              </li>
            ))}
          </ul>
        )}
        <div>
          <RemitButton />
        </div>
      </Card>
    </Panel>
  );
}
