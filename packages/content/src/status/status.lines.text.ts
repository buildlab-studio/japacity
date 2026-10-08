// First drafts: the report lines of the status kind (docs/rules/status.md). Kept apart from
// the entries' words, which the content check keeps free of report lines.
export const statusLinesText: Record<string, string> = {
  "line.status.granted": "You hold {status} now.",
  "line.status.moved-on": "Your status moves on: you hold {status} now.",
  "line.status.settled": "Settled. You hold {status} now. The fee: {fee}.",
  "line.status.citizen": "You take the oath. You hold {status} now. The fee: {fee}.",
  "line.status.lapsed-expired": "{status} has run out. You have no right to be here now.",
  "line.status.lapsed-clock": "The clock ran out on {status}. You have no right to be here now.",
  "line.status.lapsed-lost": "{status} is gone. You have no right to be here now.",
  "line.status.lapsed-job": "The job is gone and {status} went with it. You have no right to be here now.",
  "line.status.clock-started": "The job is gone. You have {months} months to find another sponsor.",
  "line.status.clock-ran": "{months} months left on the clock.",
  "line.status.clock-cleared": "You are working again. The clock stops.",
  "line.status.renewed": "Renewed for {months} months. The fee: {fee}. The surcharge: {surcharge}.",
  "line.status.removed": "They found you. You are put on a plane to Lagos, and {country} is closed to you for {months} months.",
  "line.status.closed": "You no longer hold {status}.",
};
