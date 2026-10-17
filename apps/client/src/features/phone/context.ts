// The context pill beside an app's name in its head (docs/rules/world.md R-WORLD-018): a few words
// of what is there now, read from the view, "5 open", "Draw on Friday", "Rent in 3 months", "Next stamp ₦1m". Jobs, Lotto,
// Bills and Bank fill it; every other app has none. Nothing counts days: a bill is months away, the draw is a weekday.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";

import { inMonths } from "../../shared/words/text";
import { nextTakenAhead } from "./apps/Bills";
import { shortNaira } from "./apps/passbook.words";
import { phoneWords } from "./phone.words";
import { jobOffers } from "./seen";

type View = Pick<PlayerView, "activities" | "offers" | "lottery" | "obligations" | "month" | "passbook" | "place" | "ended">;

const HUNT = "activity.job-hunt";

/** The jobs up on the board that the hunt can ask for now; Jobs' screen counts the same where no offer waits. */
export function openJobs(view: Pick<PlayerView, "activities">): number {
  const hunt = view.activities.find((option) => option.id === HUNT);
  return hunt?.allowed === true ? (hunt.params?.length ?? 0) : 0;
}

/** Jobs: the offers waiting first, else the jobs the hunt can ask for now. */
function jobsContext(view: View): string | null {
  const offers = jobOffers(view).length;
  if (offers > 0) return phoneWords(offers === 1 ? "phone.context.jobs.offer" : "phone.context.jobs.offers", { count: offers });
  const open = openJobs(view);
  return open === 0 ? null : phoneWords("phone.context.jobs.open", { count: open });
}

/** Lotto: the Friday draw, online or at the kiosk in Lagos (R-LUCK-005, R-LOTTERY-001); abroad the kiosk is far away. */
function lottoContext(view: View): string | null {
  if (view.lottery === null && view.place.where !== "home") return null;
  return phoneWords("phone.context.lotto");
}

/** Bills: what is due now, else the next bill taken every few months, said in months. */
function billsContext(view: View): string | null {
  const due = view.obligations.filter((owed) => owed.due > 0 || owed.missed > 0).length;
  if (due > 0) return phoneWords(due === 1 ? "phone.context.bills.due.one" : "phone.context.bills.due", { count: due });
  const next = view.obligations
    .flatMap((owed) => {
      const ahead = nextTakenAhead(owed, view.month);
      return ahead === null ? [] : [{ owed, ahead }];
    })
    .sort((a, b) => a.ahead - b.ahead)[0];
  if (next === undefined) return null;
  const type = content.obligation[next.owed.entry]?.type;
  const when = inMonths(view.month + next.ahead, view.month + 1);
  return phoneWords(type === "rent" ? "phone.context.bills.rent" : type === "tuition" ? "phone.context.bills.fees" : "phone.context.bills.next", { when });
}

/** Bank: the next stamp of the passbook to reach, or all in once the target is held (R-WALLET-021). */
function bankContext(view: View): string | null {
  const book = view.passbook;
  if (book === null || book.stamps.length === 0) return null;
  const next = book.stamps.find((stamp) => stamp.month === null);
  if (next === undefined) return phoneWords("phone.context.bank.ready");
  return phoneWords(next.target ? "phone.context.bank.target" : "phone.context.bank.stamp", { amount: shortNaira(next.at) });
}

/** The pill's words for an app, or null for an app with none or nothing to say now. */
export function appContext(id: string, view: View): string | null {
  if (view.ended) return null;
  switch (id) {
    case "jobs":
      return jobsContext(view);
    case "lotto":
      return lottoContext(view);
    case "bills":
      return billsContext(view);
    case "bank":
      return bankContext(view);
    default:
      return null;
  }
}
