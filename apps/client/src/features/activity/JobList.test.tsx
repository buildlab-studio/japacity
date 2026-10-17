import { content, text } from "@japacity/content";
import type { ActivityEntry, PlayerView } from "@japacity/sim";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { requirementSentence } from "../../shared/words/requirement";
import { ActivityPicker } from "./ActivityView";
import { chanceBand, firstJob, huntOrder, jobCardLine, jobChanceBp, jobsOutOfReach } from "./JobList";
import { jobsWords } from "./jobs.words";

const HUNT = "activity.job-hunt";
const NETWORK = "quality.network";

function huntOf(view: PlayerView): string[] {
  const hunt = view.activities.find((option) => option.id === HUNT);
  if (hunt?.allowed !== true || hunt.params === null || hunt.params.length < 2) throw new Error("The hunt cannot ask for two jobs here.");
  return hunt.params;
}

function entryOf(id: string): ActivityEntry {
  const entry = content.activity[id as ActivityEntry["id"]];
  if (entry === undefined) throw new Error(`No entry ${id}`);
  return entry;
}

function networkOf(view: PlayerView): number {
  return view.qualities.find((quality) => quality.id === NETWORK)?.value ?? 0;
}

function payWords(id: string): string {
  const pay = entryOf(id).pay;
  if (pay === null || typeof pay.amount !== "number") throw new Error(`${id} has no figure for its pay`);
  return jobsWords("jobs.pay", { amount: formatMoney(pay.amount, pay.currency) });
}

describe("the chance in words", () => {
  const { likelyBp, fairBp } = { likelyBp: 6000, fairBp: 3000 };

  test("[R-WORLD-006] given a hiring chance at each edge of a band, when it is put in words, then likely starts at 60%, a fair chance at 30%, and below that it is a long shot", () => {
    expect(chanceBand(likelyBp)).toBe("likely");
    expect(chanceBand(likelyBp - 1)).toBe("fair");
    expect(chanceBand(fairBp)).toBe("fair");
    expect(chanceBand(fairBp - 1)).toBe("long");
    expect(chanceBand(0)).toBe("long");
  });

  test("[R-ACTIVITY-005] given a job and the character's network, when its chance is read, then it is the job's own chance plus the network's share, never over the cap, as the hunt rolls it", () => {
    const { networkHireBp, hireMaxBp } = content.tuning.quality;
    const teacher = entryOf("activity.job-teacher");
    const bank = entryOf("activity.job-bank-officer");
    expect(jobChanceBp(bank, 0)).toBe(bank.hireBp);
    expect(jobChanceBp(bank, 10)).toBe((bank.hireBp ?? 0) + 10 * networkHireBp);
    expect(jobChanceBp(teacher, 100)).toBe(Math.min(hireMaxBp, (teacher.hireBp ?? 0) + 100 * networkHireBp));
    expect(jobChanceBp({ hireBp: hireMaxBp }, 10)).toBe(hireMaxBp);
  });
});

describe("the jobs list on the hunt's card", () => {
  test("[R-WORLD-006] given Ada's first month, when the hunt's card shows, then every job the hunt can ask for is a row with its name, its pay a month and its chance in words, with no bare select", async () => {
    const view = engineView();
    const jobs = huntOf(view);
    await renderWithView(<ActivityPicker only={[HUNT]} />, view);
    expect(document.querySelector(`select[id="param-${HUNT}"]`)).toBeNull();
    const list = screen.getByRole("radiogroup", { name: jobsWords("jobs.pick") });
    const rows = within(list).getAllByRole("radio");
    expect(rows).toHaveLength(jobs.length);
    for (const job of jobs) {
      const row = within(list).getByRole("radio", { name: new RegExp(`^${text[`${job}.name`] ?? job}`) });
      const band = chanceBand(jobChanceBp(entryOf(job), networkOf(view)));
      expect(within(row).getByText(payWords(job))).toBeDefined();
      expect(within(row).getByText(jobsWords(`jobs.chance.${band}`))).toBeDefined();
    }
  });

  // R-ACTIVITY-005: the list keeps its order, and the row chosen is the life's own trade, Ada's code, not the first row.
  test("[R-WORLD-006] [R-ACTIVITY-005] given the teacher's pay under Ada's living costs, when the list is ordered, then the likely jobs come first, the best paid of them on top, and the row chosen is her own trade's, the junior developer's", async () => {
    const view = engineView();
    const ordered = huntOrder(view, huntOf(view));
    const bands = ordered.map((job) => chanceBand(jobChanceBp(entryOf(job), networkOf(view))));
    const rank = { likely: 0, fair: 1, long: 2 } as const;
    expect(bands.map((band) => rank[band])).toEqual([...bands.map((band) => rank[band])].sort((a, b) => a - b));
    expect(ordered[0]).not.toBe("activity.job-teacher");
    expect(firstJob(view, ordered)).toBe("activity.job-junior-dev");
    await renderWithView(<ActivityPicker only={[HUNT]} />, view);
    const checked = screen.getAllByRole("radio").filter((row) => row.getAttribute("aria-checked") === "true");
    expect(checked).toHaveLength(1);
    expect(checked[0]?.getAttribute("data-job")).toBe("activity.job-junior-dev");
  });

  test("[R-WORLD-006] given a row tapped, when the hunt is added to the month, then the slot carries that job", async () => {
    const view = engineView();
    const jobs = huntOf(view);
    const { store, authority } = await renderWithView(<ActivityPicker only={[HUNT]} />, view);
    const last = huntOrder(view, jobs).at(-1) ?? "";
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(`^${text[`${last}.name`] ?? last}`) }));
    expect(screen.getByRole("radio", { name: new RegExp(`^${text[`${last}.name`] ?? last}`) }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: `${text[`${HUNT}.name`] ?? HUNT}` }));
    // R-ACTIVITY-015: the hunt is applied for at once, so the job tapped goes with the command sent now and
    // no slot is planned.
    await waitFor(() => expect(authority.sent.at(-1)).toMatchObject({ type: "activity/now", activity: HUNT, param: last }));
    expect(store.getState().plan.some((pick) => pick?.activity === HUNT)).toBe(false);
  });

  test("[R-WORLD-006] given jobs at home the hunt cannot ask for yet, when the card shows, then each is listed apart with its pay and what it still needs, and cannot be picked", async () => {
    const view = engineView();
    const out = jobsOutOfReach(view, huntOf(view));
    expect(out.map((job) => job.id)).toContain("activity.job-bank-senior");
    // The staff nurse is hunted (R-PROLOGUE-010), so a life without the care lists it apart with that need.
    expect(out.find((job) => job.id === "activity.job-nurse")?.needs).toEqual([requirementSentence({ type: "quality/min", quality: "quality.care", value: 60 }, { routes: view.routes })]);
    await renderWithView(<ActivityPicker only={[HUNT]} />, view);
    const apart = screen.getByRole("list", { name: jobsWords("jobs.out-of-reach") });
    for (const job of out) {
      const row = within(apart).getByText(text[`${job.id}.name`] ?? job.id).closest("li");
      if (row === null) throw new Error(`${job.id} has no row`);
      expect(within(row).getByText(payWords(job.id))).toBeDefined();
      // The needs fold behind the row: a count until the row is tapped, then each need.
      const fold = within(row).getByRole("button");
      expect(fold.getAttribute("aria-expanded")).toBe("false");
      expect(within(row).getByText(jobsWords(job.needs.length === 1 ? "jobs.needs-count.one" : "jobs.needs-count", { count: job.needs.length }))).toBeDefined();
      for (const need of job.needs) expect(within(row).queryByText(need, { exact: false })).toBeNull();
      fireEvent.click(fold);
      expect(fold.getAttribute("aria-expanded")).toBe("true");
      for (const need of job.needs) expect(within(row).getByText(need, { exact: false })).toBeDefined();
      expect(within(row).queryByRole("radio")).toBeNull();
    }
    const senior = out.find((job) => job.id === "activity.job-bank-senior");
    expect(senior?.needs).toEqual(entryOf("activity.job-bank-senior").requires.map((requirement) => requirementSentence(requirement)));
  });

  test("[R-WORLD-006] given a need the character already meets, when an out-of-reach job's needs are read, then only what is still missing is named", () => {
    const view = engineView();
    const mid = jobsOutOfReach(view, huntOf(view)).find((job) => job.id === "activity.job-mid-dev");
    const tech = view.qualities.find((quality) => quality.id === "quality.tech")?.value ?? 0;
    expect(tech).toBeLessThan(60);
    expect(mid?.needs).toContain(requirementSentence({ type: "quality/min", quality: "quality.tech", value: 60 }));
    const skilled: PlayerView = { ...view, qualities: view.qualities.map((quality) => (quality.id === "quality.tech" ? { ...quality, value: 90 } : quality)) };
    const later = jobsOutOfReach(skilled, huntOf(view)).find((job) => job.id === "activity.job-mid-dev");
    expect(later?.needs).not.toContain(requirementSentence({ type: "quality/min", quality: "quality.tech", value: 60 }));
    expect(later?.needs.length).toBeGreaterThan(0);
  });
});

describe("the jobs list as picture cards", () => {
  const nameOfJob = (id: string) => text[`${id}.name`] ?? id;
  const applyButton = () => screen.getByRole("button", { name: `${nameOfJob(HUNT)}` });

  test("[R-WORLD-021] given the hunt's card, when the list shows, then each job is a card with its picture and no radio circle, and only the chosen card is ringed", async () => {
    const view = engineView();
    await renderWithView(<ActivityPicker only={[HUNT]} />, view);
    const rows = within(screen.getByRole("radiogroup", { name: jobsWords("jobs.pick") })).getAllByRole("radio");
    for (const row of rows) {
      // No radio circle: the drawn marks in a card are the job's picture and the chance gauge (a card each, ringed when
      // chosen, as the after set's phone-jobs draws the list).
      expect(row.querySelector("input")).toBeNull();
      expect(row.querySelector("[data-tile]")?.getAttribute("data-tile")).toBe(row.getAttribute("data-job"));
      const card = row.querySelector("[data-picked], .lively-card");
      expect(card?.className.includes("phone-picked")).toBe(row.getAttribute("aria-checked") === "true");
    }
    expect(rows.filter((row) => row.querySelector(".phone-picked") !== null)).toHaveLength(1);
  });

  test("[R-WORLD-006] given each job's chance, when its row shows, then a three-step gauge stands beside the word: one step for a long shot, two for a fair chance, three for likely", async () => {
    const view = engineView();
    const steps = { long: "1", fair: "2", likely: "3" } as const;
    await renderWithView(<ActivityPicker only={[HUNT]} />, view);
    for (const job of huntOf(view)) {
      const row = document.querySelector(`[data-jobs] [data-job='${job}']`);
      const band = chanceBand(jobChanceBp(entryOf(job), networkOf(view)));
      expect(row?.querySelector("[data-gauge]")?.getAttribute("data-gauge")).toBe(steps[band]);
      expect(row?.querySelector("[data-gauge]")?.children).toHaveLength(3);
      expect(row?.querySelector(`[data-chance='${band}']`)?.textContent).toBe(jobsWords(`jobs.chance.${band}`));
    }
  });

  test("[R-ACTIVITY-017] given a life living in Makoko, when the board is ordered, then the fish racks lead it; at the family house they take their place by chance and pay", () => {
    const base = engineView();
    const jobs = [...huntOf(base), "activity.job-fish-racks"];
    const makoko = { ...base, home: { ...base.home, place: "place.makoko" as const } };
    expect(huntOrder(makoko, jobs)[0]).toBe("activity.job-fish-racks");
    expect(huntOrder(base, jobs)[0]).not.toBe("activity.job-fish-racks");
    expect([...huntOrder(makoko, jobs)].sort()).toEqual([...jobs].sort());
  });

  test("[R-WORLD-006] given a row tapped, when the card's one main button shows, then it repeats the pick: Apply and the job's name", async () => {
    const view = engineView();
    const ordered = huntOrder(view, huntOf(view));
    await renderWithView(<ActivityPicker only={[HUNT]} />, view);
    // R-ACTIVITY-005: the pick the card opens on is the life's own trade.
    expect(applyButton().textContent).toBe(`${jobsWords("jobs.apply")}${nameOfJob(firstJob(view, ordered) ?? "")}`);
    const last = ordered.at(-1) ?? "";
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(`^${nameOfJob(last)}`) }));
    expect(applyButton().textContent).toBe(`${jobsWords("jobs.apply")}${nameOfJob(last)}`);
    expect(applyButton().querySelector(`[data-apply-for='${last}']`)).not.toBeNull();
    // The rows out of reach fold their needs behind a button of their own (aria-expanded); the card's one main button is the rest.
    expect(document.querySelectorAll("[data-activity-picker] button:not([role='radio']):not([aria-expanded])")).toHaveLength(1);
  });

  test("[R-GUIDE-014] given a starting life's first hunt (the view's hunt marked sure), when a job's card line is read, then it says the hunt lands a job for sure, and without the mark it does not", () => {
    const view = engineView();
    const job = huntOf(view)[0]!;
    expect(view.activities.find((option) => option.id === HUNT)?.sure).toBe(true);
    expect(jobCardLine(view, HUNT, job)).toContain(jobsWords("jobs.sure-first"));
    const plain: PlayerView = {
      ...view,
      activities: view.activities.map((option) => {
        if (option.id !== HUNT) return option;
        const rest = { ...option };
        delete rest.sure;
        return rest;
      }),
    };
    expect(jobCardLine(plain, HUNT, job)).not.toContain(jobsWords("jobs.sure-first"));
  });
});
