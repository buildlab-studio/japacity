// The report lines of the status kind (docs/rules/status.md). Kept apart from
// the entries' words, which the content check keeps free of report lines.
export const statusLinesText: Record<string, string> = {
  "line.status.granted": "Your papers now read: {status}.",
  "line.status.moved-on": "Your status moved on. Your papers now read: {status}.",
  "line.status.settled": "Settled. Your papers now read: {status}. The fee: {fee}.",
  "line.status.citizen": "You took the oath. Your papers now read: {status}. The fee: {fee}.",
  "line.status.lapsed-expired": "{status} has run out. You have no right to be here now.",
  "line.status.lapsed-clock": "The clock ran out on {status}. You have no right to be here now.",
  "line.status.lapsed-lost": "{status} is gone. You have no right to be here now.",
  "line.status.lapsed-job": "The job went and {status} went with it. You have no right to be here now.",
  "line.status.clock-started": "The job is gone. You have {months} months to find another sponsor.",
  "line.status.clock-ran": "{months} months left on the clock.",
  "line.status.clock-cleared": "You are working again. The clock stopped.",
  "line.status.renewed": "Renewed for {months} months. The fee: {fee}. The surcharge: {surcharge}.",
  "line.status.employer-renewed": "The employer kept you on. {status} runs {months} months more, at their cost.",
  "line.status.removed": "They found you. You were put on a plane to Lagos, and {country} is closed to you for {months} months.",
  "line.status.noticed": "You have been found. A notice says you must leave {country} or put your papers right within {months} months.",
  // status:course-passed-or-withdrawn: the withdrawal cuts the permission; paying everything owed restores it.
  "line.status.withdrawn": "The Home Office cut your student visa to end {month}. Pay what you owe the university, take a new course or find a sponsor's job before then.",
  "line.status.reinstated": "The university has reinstated you. Your student visa runs to its own end again.",
  "line.status.rent-checked": "The landlord checked your papers and ended your room. The room you found asks no papers, and it costs more.",
  "line.status.closed": "You no longer hold {status}.",
};
