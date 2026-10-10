// The age screen's three fields, picked as a person picks them, for the screens' tests (R-ACCOUNT-012).
import { fireEvent, screen } from "@testing-library/react";

import { say } from "../../shared/words/text";

/** Picks the day, the month and the year of an ISO date, `YYYY-MM-DD`; an empty date picks nothing. */
export async function pickBirth(birth: string): Promise<void> {
  const day = await screen.findByRole("combobox", { name: say("ui.account.age.day") });
  if (birth === "") return;
  const [year, month, date] = birth.split("-").map(Number) as [number, number, number];
  fireEvent.change(day, { target: { value: String(date) } });
  fireEvent.change(screen.getByRole("combobox", { name: say("ui.account.age.month") }), { target: { value: String(month) } });
  fireEvent.change(screen.getByRole("combobox", { name: say("ui.account.age.year") }), { target: { value: String(year) } });
}

/** Picks the date and presses Continue. */
export async function answerAge(birth: string): Promise<void> {
  await pickBirth(birth);
  fireEvent.click(screen.getByRole("button", { name: say("ui.account.age.go") }));
}
