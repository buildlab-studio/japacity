// pnpm db:migrate:local: the committed migrations, applied to the local stack's Postgres only
// (LOCAL_DATABASE_URL, which must be on this machine). It never reads the Neon link's strings.
import { readLocalStack } from "./env";
import { migrate } from "./stack";
import { REPO_ROOT } from "../repo";

process.exitCode = migrate(REPO_ROOT, readLocalStack(REPO_ROOT)) ? 0 : 1;
