// The genuineness interview's questions: docs/rules/interview.md "Entry".
import type { Id, InterviewEntry } from "@japacity/sim";

export const interviewTable: Record<Id<"interview">, InterviewEntry> = {
  "interview.genuineness": {
    id: "interview.genuineness",
    ask: 5,
    questions: [
      { id: "first-spot", about: "couple", truth: "first-spot", needs: { met: 1 }, options: "spots" },
      { id: "first-what", about: "couple", truth: "first-what", needs: { met: 1 }, options: "whats" },
      { id: "last-spot", about: "couple", truth: "last-spot", needs: { met: 2 }, options: "spots" },
      { id: "times-met", about: "couple", truth: "times-met", needs: {}, options: ["not-yet", "one-to-three", "four-to-eight", "nine-to-fifteen", "sixteen-or-more"] },
      // The wedding spots of person.md R-PEOPLE-017 are listed here, as content has no list of them elsewhere.
      { id: "wedding-spot", about: "couple", truth: "wedding-spot", needs: { married: true }, options: ["family-compound", "church", "mosque", "registry", "event-hall"] },
      { id: "calls", about: "couple", truth: "calls", needs: { calls: 3 }, options: "calls" },
      { id: "partner-job", about: "other", truth: "job", needs: {}, options: "jobs" },
      { id: "partner-home", about: "other", truth: "home", needs: {}, options: ["city", "town", "not-sure"] },
      { id: "last-said", about: "other", truth: "last-said", needs: { saidEach: 1 }, options: "phrases" },
      { id: "plans", about: "couple", truth: null, needs: {}, options: ["uk", "canada", "with-you-abroad", "home", "not-decided"] },
    ],
  },
};
