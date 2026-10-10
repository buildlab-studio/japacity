// The legal pages inside Vite: emitted as legal/terms.html and legal/privacy.html
// beside the game in a build, and served at the same paths by the dev server.
// pages.ts reads content's operator constant, which is TypeScript, so it is
// loaded through a Vite server in SSR mode, as the guide pages are. Runs in
// Node, from vite.config.ts.
import { createServer, type Plugin, type ViteDevServer } from "vite";

import type { legalPages as LegalPages } from "./pages";

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
        for (const page of legalPages(root)) this.emitFile({ type: "asset", fileName: page.path.slice(1), source: page.html });
      } finally {
        await server.close();
      }
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = (request.url ?? "").split("?")[0] ?? "";
        loadPages(server)
          .then((legalPages) => {
            const found = legalPages(root).find((page) => page.path === path);
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
