// The morning (clock:envelopes-show-real-waits): a result real life makes you wait for, the English test's band or the
// endorsing body's answer, is sealed by the authority until the world's next morning. While it is sealed the view
// keeps the paper pending in the month it was due, which no paper does otherwise: a paper due this month lands as the
// month turns. That is the sign the places that would name the result read, to say the morning instead.
import { REAL_WAIT_DOCUMENTS, type PlayerView } from "@japacity/sim";

/** True while the paper's result is sealed until the morning: one real life waits for, pending in the month it was due. */
export function sealedTillMorning(view: Partial<Pick<PlayerView, "month" | "documents">>, document: string): boolean {
  if (!(REAL_WAIT_DOCUMENTS as readonly string[]).includes(document)) return false;
  const paper = view.documents?.find((held) => held.id === document);
  return paper !== undefined && paper.state === "pending" && view.month !== undefined && paper.readyMonth === view.month;
}
