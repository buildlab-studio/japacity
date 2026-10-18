// tsx tools/local/switch.ts <signups|lottery|adverts|partnerPlay> <on|off>: sets one switch on the local
// stack's database (server.md R-SERVER-031), logged as the store logs any change, with "local" as the admin.
// The Worker reads the row again within `switches.cacheMs`. It refuses a database not on this machine.
import { connect, pgSwitchStore } from "../../packages/db/src/index";
import { readLocalStack } from "./env";
import { REPO_ROOT } from "../repo";

const NAMES = ["signups", "lottery", "adverts", "partnerPlay"] as const;

const [name, value] = process.argv.slice(2);
const known = NAMES.find((one) => one === name);
if (known === undefined || (value !== "on" && value !== "off")) {
  console.error(`Usage: tsx tools/local/switch.ts <${NAMES.join("|")}> <on|off>`);
  process.exit(2);
}
const { handle, close } = await connect(readLocalStack(REPO_ROOT).databaseUrl);
try {
  await pgSwitchStore(handle).set(known, value === "on", "local", "the local stack", Date.now());
  console.log(`${known} is ${value} on the local database.`);
} finally {
  await close();
}
