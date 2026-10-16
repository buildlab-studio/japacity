/// <reference types="node" />
// The command line's entry, run by Node through tsx and never part of the Worker.
// With no flag it opens the database at DATABASE_URL_UNPOOLED (R-SERVER-047).
import { readFile } from "node:fs/promises";

import { rollbackCli } from "./cli";
import { databaseFrom } from "./database";

const result = await rollbackCli(process.argv.slice(2), (path) => readFile(path, "utf8"), databaseFrom(process.env));
for (const line of result.lines) console.log(line);
process.exitCode = result.exit;
