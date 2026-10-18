/// <reference types="node" />
// `pnpm snapshot:all` (server:snapshot-before-deploy), run by Node through tsx and never part
// of the Worker, on the database at DATABASE_URL_UNPOOLED.
import { databaseFrom } from "./database";
import { snapshotCli } from "./snapshot";

const result = await snapshotCli(process.argv.slice(2), databaseFrom(process.env), (line) => console.log(line));
if (result.exit === 2) for (const line of result.lines) console.log(line);
process.exitCode = result.exit;
