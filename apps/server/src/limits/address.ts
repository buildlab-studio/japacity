// server:anonymous-limit-by-address: the one key every limit kept by address counts under, and
// account:guest-floods-are-capped's connection. One phone or one home is given a whole IPv6 /64
// (RFC 6177), so a limit keyed on the full address could be stepped round by changing the last 64 bits.

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const GROUP = /^[0-9a-f]{1,4}$/;

/** The four numbers of a dotted IPv4 address, or null. */
function octetsOf(text: string): number[] | null {
  const parts = IPV4.exec(text);
  if (parts === null) return null;
  const octets = parts.slice(1).map(Number);
  return octets.every((octet) => octet <= 255) ? octets : null;
}

/** The groups one side of a `::` stands for, an IPv4 tail counted as the two groups it is; null if a part is no group. */
function groupsOf(side: string, last: boolean): number[] | null {
  if (side === "") return [];
  const parts = side.split(":");
  const groups: number[] = [];
  for (const [at, part] of parts.entries()) {
    const octets = last && at === parts.length - 1 ? octetsOf(part) : null;
    if (octets !== null) {
      const [a = 0, b = 0, c = 0, d = 0] = octets;
      groups.push(a * 256 + b, c * 256 + d);
    } else if (GROUP.test(part)) groups.push(Number.parseInt(part, 16));
    else return null;
  }
  return groups;
}

/** The eight groups of an IPv6 address in lower case, or null when it is none. */
function ipv6Of(text: string): number[] | null {
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const [head = "", tail] = halves;
  const left = groupsOf(head, tail === undefined);
  const right = tail === undefined ? [] : groupsOf(tail, true);
  if (left === null || right === null) return null;
  if (tail === undefined) return left.length === 8 ? left : null;
  const missing = 8 - left.length - right.length;
  return missing < 1 ? null : [...left, ...new Array<number>(missing).fill(0), ...right];
}

/**
 * server:anonymous-limit-by-address: the key an address is limited by. An IPv4 address is itself; an IPv6 address is
 * its /64, `a:b:c:d::/64` in lower case without leading zeros, however it was written; an IPv4 address carried in IPv6
 * (`::ffff:a.b.c.d`, in any form) is the IPv4 address. Anything else is kept as it came, so it never shares a key
 * with a real address.
 */
export function addressKey(address: string): string {
  if (octetsOf(address) !== null) return address;
  const groups = ipv6Of(address.toLowerCase());
  if (groups === null) return address;
  const [g0, g1, g2, g3, g4, g5, g6 = 0, g7 = 0] = groups;
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) return [g6 >> 8, g6 & 0xff, g7 >> 8, g7 & 0xff].join(".");
  return `${groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(":")}::/64`;
}
