// The month's living where a life starts, as the page says it (prologue:front-door-three-screens, prologue:printed-page-hands-over; home.md
// home:living-by-hand, decision 0013): what is taken next month for it, or, where all of it is lived by hand, that it is bought
// as you go. The share lived by hand is content's, so the line follows the tuning.
import { content } from "@japacity/content";
import { int } from "@japacity/sim";

import { formatMoney } from "./format";
import { say } from "./text";

/**
 * The page's line under a home whose living is a naira charge a month of `amount` before what is lived by hand; a rent
 * by the month (the hostel's) is never lived by hand and is said whole.
 */
export function nextMonthWords(amount: number, rent = false): string {
  const charged = rent ? amount : amount - int.bp(amount, content.tuning.home.livingByHandBp);
  return charged > 0 ? say("ui.page.home.costs", { amount: formatMoney(charged, "NGN") }) : say("ui.page.home.by-hand");
}
