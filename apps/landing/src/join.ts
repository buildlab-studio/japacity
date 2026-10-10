// What a join may do: one insert, after the address is cleaned. Kept out of the
// entry module because the Workers runtime allows that module only handler exports.

/** The one statement the page may run. Insert only; a repeat address changes nothing. */
export const INSERT = "INSERT OR IGNORE INTO waitlist (email, joined_at) VALUES (?1, ?2)";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;

/** A clean address or null: trimmed, lower-cased, one @, a dot after it, not too long. */
export function cleanEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > MAX_EMAIL || !EMAIL.test(email)) return null;
  return email;
}
