// What makes a line bad news: a refusal, a
// robbery, an illness, a loss, anything on the road route, anything about
// being poor. A line that is any of these is written straight and has only its
// plain version, and a month whose report carries one is shown all plain.

/** Lines of the road route, which never joke. */
const ROAD_KEY = /^line\.(route\.road-|place\.on-road|place\.returned-road|road\.)/;

/** Words that mark the plain line as bad news, in the present and in the past the results are told in. */
const BAD_WORDS =
  /\b(refus\w*|reject\w*|turn(?:s|ed)? you down|(?:says|said) no|rob\w*|stole\w*|stolen|ill|illness|sick|run down|lost|loss|gone|missed|could not|cannot|no longer|died|death|burial|evict\w*|default\w*|seiz\w*|taken|took|withdrawn|removed|lapsed|ran out|run out|ends?|ended|broke|short|owe\w*|debt|arrears|court|fraud\w*|nothing yet|nothing (?:comes|came)|no right|(?:does|did) not (?:come|win)|did not happen|ransom|deport\w*|banned|went wrong|never arrive[sd])\b/i;

/** Bad news the words alone do not show: a doubt, a parting, a loss of face, being poor. */
const ALSO_BAD: readonly string[] = [
  "line.interview.doubted",
  "line.interview.failed",
  "line.interview.caught",
  "line.people.declined",
  "line.people.answered-no",
  "line.people.drifted",
  "line.people.ended-block",
  "line.people.gossip",
  "line.people.gossip-spread",
  "line.people.proposal-withdrawn",
  "line.people.stand-in-on",
  "line.place.returned-broke",
  "line.place.returned-assisted",
  "line.place.returned-removed",
  "line.status.removed",
  "line.status.noticed",
  "line.status.clock-ran",
  "line.route.banned",
  "line.route.funds-short",
  "line.setpiece.dropped",
  "line.wallet.mishap",
  "line.wallet.remit-lost",
  "line.wallet.ransom",
  "line.wallet.flagged",
  "line.wallet.assistance",
  "line.obligation.group-visit",
  "line.quality.loss",
  "line.quality.worn",
  "line.credit.reopened",
];

/** True when a line is bad news by its key or its plain words. */
export function badNews(key: string, plain: string): boolean {
  return ROAD_KEY.test(key) || ALSO_BAD.includes(key) || BAD_WORDS.test(plain);
}

/** True when a month's report carries bad news, so every line in it is shown plain. */
export function reportPlain(keys: readonly string[], words: Readonly<Record<string, string>>): boolean {
  return keys.some((key) => badNews(key, words[key] ?? ""));
}
