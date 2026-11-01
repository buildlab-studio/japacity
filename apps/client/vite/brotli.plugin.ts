// engine:first-download-has-budget: the edge compresses scripts at a low level, so a build for players writes a brotli copy at the
// best level beside every script and style the bundler made under assets/, and the Worker serves that copy to a browser that takes
// brotli (apps/server/src/files/brotli.ts). Node's own zlib, no other library. Runs in Node, from vite.config.ts, after the files are
// written; it reads and writes only the build's own folder.
import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { promisify } from "node:util";
import { brotliCompress, constants } from "node:zlib";

import type { Plugin } from "vite";

import { forPlayers } from "./shipping.plugin";

/** The files the bundler made that are served compressed: its scripts and styles under assets/, whose names carry their hash. */
export const COMPRESSED = /^assets\/[\w.-]+\.(?:js|css)$/;

/** The ending of a file's brotli copy. */
export const BROTLI_ENDING = ".br";

const compress = promisify(brotliCompress);

/** A file's bytes at brotli's best level, told the size so the encoder's window fits the file. */
export function atBestLevel(bytes: Buffer): Promise<Buffer> {
  return compress(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY, [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length } });
}

/** Writes `<file>.br` beside each script and style of the bundle. Only in a build for players. */
export function brotliCopies(): Plugin {
  let outDir = "";
  return {
    name: "japacity-brotli-copies",
    apply: (_config, { command, mode }) => forPlayers(command, mode),
    configResolved(config) {
      outDir = isAbsolute(config.build.outDir) ? config.build.outDir : join(config.root, config.build.outDir);
    },
    writeBundle: {
      order: "post",
      sequential: true,
      async handler(_options, bundle) {
        const files = Object.keys(bundle).filter((file) => COMPRESSED.test(file));
        await Promise.all(
          files.map(async (file) => {
            const path = join(outDir, file);
            await writeFile(`${path}${BROTLI_ENDING}`, await atBestLevel(await readFile(path)));
          }),
        );
      },
    },
  };
}
