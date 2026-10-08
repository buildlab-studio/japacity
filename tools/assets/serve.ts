// A static server for the stage page, rooted at the repository. TypeScript modules are
// transpiled on the way out with the compiler the repository already pins, so the stage,
// the loader and the palette are the same code the client uses, with no bundler.
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize, sep } from "node:path";

import ts from "typescript";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".ts": "text/javascript",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** Finds the file a module specifier means: as written, then with `.ts`, then its `index.ts`. */
async function resolveFile(path: string): Promise<string | null> {
  for (const candidate of [path, `${path}.ts`, join(path, "index.ts")]) if (await isFile(candidate)) return candidate;
  return null;
}

export interface Server {
  url: string;
  close: () => Promise<void>;
}

export async function startServer(root: string): Promise<Server> {
  const server = createServer((request, response) => {
    void (async () => {
      const path = decodeURIComponent((request.url ?? "/").split("?")[0] ?? "/");
      const wanted = normalize(join(root, path));
      if (!wanted.startsWith(root + sep)) {
        response.writeHead(403).end();
        return;
      }
      const file = await resolveFile(wanted);
      if (file === null) {
        response.writeHead(404).end();
        return;
      }
      const type = TYPES[extname(file)] ?? "application/octet-stream";
      let body: Buffer | string = await readFile(file);
      if (file.endsWith(".ts")) {
        body = ts.transpileModule(body.toString("utf8"), {
          compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: true },
          fileName: file,
        }).outputText;
      }
      // Isolated, so the place check's page times its script to a few microseconds rather than a tenth of a millisecond.
      response.writeHead(200, { "content-type": type, "cache-control": "no-store", "cross-origin-opener-policy": "same-origin", "cross-origin-embedder-policy": "require-corp" }).end(body);
    })().catch((error: unknown) => {
      response.writeHead(500).end(String(error));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
