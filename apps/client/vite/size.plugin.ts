// engine:first-download-has-budget: the size check (tools/check/size.ts) needs to know which chunks a first visit downloads and what
// each holds. With JAPACITY_SIZE_REPORT naming a file, the build writes there every chunk's file, whether it is
// the entry, what it imports and the modules inside it. Without it the plugin does nothing. Runs in Node, from
// vite.config.ts; it writes only that local file and sends nothing anywhere.
import { writeFileSync } from "node:fs";

import type { Plugin } from "vite";

/** One chunk as the size check reads it. */
interface SizeChunk {
  file: string;
  isEntry: boolean;
  /** The chunks it imports statically: loaded with it, as the page's modulepreload links say. */
  imports: string[];
  /** The module ids inside it, as the bundler names them (absolute paths). */
  modules: string[];
}

export function sizeReport(path: string | undefined = process.env.JAPACITY_SIZE_REPORT): Plugin {
  return {
    name: "japacity-size-report",
    apply: "build",
    generateBundle(_options, bundle) {
      if (path === undefined || path === "") return;
      const chunks: SizeChunk[] = [];
      for (const item of Object.values(bundle)) {
        if (item.type !== "chunk") continue;
        chunks.push({ file: item.fileName, isEntry: item.isEntry, imports: [...item.imports], modules: Object.keys(item.modules).sort() });
      }
      writeFileSync(path, JSON.stringify({ chunks }, null, 2));
    },
  };
}
