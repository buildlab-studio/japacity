// The legal pages inside Vite: emitted as terms.html and privacy.html at the top
// of the build, and served at /terms and /privacy by the dev server, which sends
// /terms.html and /privacy.html on to the clean paths as the platform does.
// pages.ts reads content's operator constant, which is TypeScript, so it is
// loaded through a Vite server in SSR mode, as the guide pages are. Runs in
// Node, from vite.config.ts.
import { createServer, type Plugin, type ViteDevServer } from "vite";

import { legalRoute } from "../src/features/legal/addresses";
import type { legalPages as LegalPages } from "../src/features/legal/pages";

const ENTRY = "/src/features/legal/pages.ts";

async function loadPages(server: ViteDevServer): Promise<typeof LegalPages> {
  const module = (await server.ssrLoadModule(ENTRY)) as { legalPages: typeof LegalPages };
  return module.legalPages;
}

export function legalPagesPlugin(): Plugin {
  let root = "";
  return {
    name: "japacity-legal-pages",
    configResolved(config) {
      root = config.root;
    },
    async generateBundle() {
      const server = await createServer({
        root,
        configFile: false,
        logLevel: "error",
        appType: "custom",
        server: { middlewareMode: true, hmr: false, ws: false },
        optimizeDeps: { noDiscovery: true, include: [] },
      });
      try {
        const legalPages = await loadPages(server);
        for (const page of legalPages(root)) this.emitFile({ type: "asset", fileName: page.file, source: page.html });
      } finally {
        await server.close();
      }
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const [path = "", query] = (request.url ?? "").split("?", 2);
        const route = legalRoute(path);
        if (route === null) {
          next();
          return;
        }
        if ("redirect" in route) {
          response.statusCode = 307;
          response.setHeader("Location", query === undefined ? route.redirect : `${route.redirect}?${query}`);
          response.end();
          return;
        }
        loadPages(server)
          .then((legalPages) => {
            const found = legalPages(root).find((page) => page.path === route.serve);
            if (found === undefined) {
              next();
              return;
            }
            response.setHeader("Content-Type", "text/html; charset=utf-8");
            response.end(found.html);
          })
          .catch(next);
      });
    },
  };
}
