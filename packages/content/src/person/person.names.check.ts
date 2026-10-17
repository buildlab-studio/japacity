// The checks on the name pool and on who is named in the game's words (names
// rules 2, 4, 5 and 7). Each returns a list of problems, empty
// when the content holds; the tests run them on the real content and on
// copies made to fail.
import type { NamedPerson, NamePeople, PoolName } from "./person.names.data";
import { peopleRegion, takingRoles } from "./person.names.data";

/** R-PEOPLE-053: one to three words of letters, each starting with a capital. */
const NAME_SHAPE = /^[A-Z][a-z]+( [A-Z][a-z]+){0,2}$/;

/** True when a name has the shape no player's handle can take (R-PEOPLE-053). */
export function nameShaped(name: string): boolean {
  return NAME_SHAPE.test(name);
}

/** Names rule 2: the named people span enough peoples, and the two largest do not take over. */
export function namedMixProblems(people: readonly NamedPerson[], limits: { minPeoples: number; topTwoMaxBp: number }): string[] {
  const counts = new Map<NamePeople, number>();
  for (const person of people) counts.set(person.people, (counts.get(person.people) ?? 0) + 1);
  const sorted = [...counts.values()].sort((left, right) => right - left);
  const topTwo = (sorted[0] ?? 0) + (sorted[1] ?? 0);
  const problems: string[] = [];
  if (counts.size < limits.minPeoples) problems.push(`the named people come from ${String(counts.size)} peoples, fewer than ${String(limits.minPeoples)}`);
  if (topTwo * 10000 > limits.topTwoMaxBp * people.length) {
    problems.push(`the two largest peoples hold ${String(topTwo)} of ${String(people.length)} named people, over ${String(limits.topTwoMaxBp)} basis points`);
  }
  return problems;
}

/** Names rule 5: no people holds two of the roles that take money, and a role held twice is held by two peoples. */
export function roleProblems(people: readonly NamedPerson[]): string[] {
  const problems: string[] = [];
  const taking = new Map<NamePeople, string[]>();
  const byRole = new Map<string, Set<NamePeople>>();
  const held = new Map<string, number>();
  for (const person of people) {
    if (takingRoles.includes(person.role)) taking.set(person.people, [...(taking.get(person.people) ?? []), `${person.name} (${person.role})`]);
    if (person.role === "life" || person.role === "relative") continue;
    byRole.set(person.role, (byRole.get(person.role) ?? new Set()).add(person.people));
    held.set(person.role, (held.get(person.role) ?? 0) + 1);
  }
  for (const [people, names] of taking) if (names.length > 1) problems.push(`${people} holds ${names.join(" and ")}`);
  for (const [role, peoples] of byRole) if ((held.get(role) ?? 0) > 1 && peoples.size < 2) problems.push(`every ${role} is ${[...peoples].join("")}`);
  return problems;
}

/** Names rule 4: names mostly carried by Christians and by Muslims both appear in the north and in the south. */
export function faithProblems(pool: readonly PoolName[]): string[] {
  const problems: string[] = [];
  for (const region of ["north", "south"] as const) {
    for (const faith of ["christian", "muslim"] as const) {
      if (!pool.some((entry) => peopleRegion[entry.people] === region && entry.faith === faith)) problems.push(`no ${faith} name in the ${region}`);
    }
  }
  return problems;
}

const INSTITUTION = /\b(masquerades?|egungun|eyo|chieftaincy|chiefs?|obas?|emirs?|igwe|palaces?|church(es)?|mosques?|imams?|pastors?|shrines?|cathedrals?|parish)\b/i;
const WRONGDOING = /\b(fraud\w*|scam\w*|419|yahoo|crim\w*|steal\w*|stole\w*|theft|thie(f|ves)|rob\w*|smuggl\w*|traffick\w*|launder\w*|kidnap\w*|ransom|cults?|forg\w*|fake\w*|bribe\w*)\b/i;

/** Names rule 7: no words put a cultural or religious institution beside a crime or a fraud. */
export function institutionProblems(text: Readonly<Record<string, string>>): string[] {
  return Object.entries(text)
    .filter(([, words]) => INSTITUTION.test(words) && WRONGDOING.test(words))
    .map(([key]) => key);
}

/** Every whole-word use of one of `names` in the words, as `key name`. */
export function namesUsed(text: Readonly<Record<string, string>>, names: readonly string[]): string[] {
  const found: string[] = [];
  for (const [key, words] of Object.entries(text)) {
    for (const name of names) if (new RegExp(`\\b${name}\\b`).test(words)) found.push(`${key} ${name}`);
  }
  return found;
}
