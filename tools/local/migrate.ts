// pnpm db:migrate:local: the committed migrations, applied to the local stack's Postgres only
// (LOCAL_DATABASE_URL, which must be on this machine). It never reads the Neon link's strings.
import { fileURLToPath } from "node:url";

import { readLocalStack } from "./env";
import { migrate } from "./stack";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

process.exitCode = migrate(ROOT, readLocalStack(ROOT)) ? 0 : 1;
