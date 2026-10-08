// R-ACCOUNT-026: `pnpm tsx tools/guests/clean.ts --idle-days <n> [--apply]`.
// The work lives with the server (apps/server/src/account/clean.ts), whose
// types are the Worker's; this entry only starts it, so the tools' types never
// reach into the server's.
const entry = new URL("../../apps/server/src/account/clean.main.ts", import.meta.url).href;
await import(entry);
