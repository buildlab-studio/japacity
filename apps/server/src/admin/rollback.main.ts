/// <reference types="node" />
// The command line's entry, run by Node through tsx and never part of the Worker.
import { readFile } from "node:fs/promises";

import { rollbackCli } from "./cli";

const result = await rollbackCli(process.argv.slice(2), (path) => readFile(path, "utf8"));
for (const line of result.lines) console.log(line);
process.exitCode = result.exit;
