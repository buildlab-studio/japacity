// The guide pages' prerender step (R-GUIDE-005), inside Vite's build. In `generateBundle` it
// loads site.entry.ts through a Vite server in SSR mode, renders every page to plain HTML that
// links the build's stylesheet, and emits each as `guides/.../index.html` beside the game. The
// dev server renders the same pages on request. Runs in Node, from vite.config.ts.
import { createServer, type Plugin, type ViteDevServer } from "vite";

import type { buildSite as BuildSite } from "../src/features/guides/site.entry";
import { siteFiles } from "../src/features/guides/site.files";

const ENTRY = "/src/features/guides/site.entry.ts";
const DEV_STYLES = "/src/features/guides/devStyles.ts";

/** Today in the build's time, or GUIDES_TODAY when a build must be repeatable. */
function buildDay(): string {
  return process.env.GUIDES_TODAY ?? new Date().toISOString().slice(0, 10);
}

async function loadSite(server: ViteDevServer): Promise<typeof BuildSite> {
  const module = (await server.ssrLoadModule(ENTRY)) as { buildSite: typeof BuildSite };
  return module.buildSite;
}

export function guidePages(): Plugin {
  let root = "";
  return {
    name: "japacity-guide-pages",
    configResolved(config) {
      root = config.root;
    },
    async generateBundle(_options, bundle) {
      const styles = Object.values(bundle)
        .filter((output) => output.type === "asset" && output.fileName.endsWith(".css"))
        .map((output) => `/${output.fileName}`);
      const server = await createServer({
        root,
        configFile: false,
        logLevel: "error",
        appType: "custom",
        server: { middlewareMode: true, hmr: false, ws: false },
        optimizeDeps: { noDiscovery: true, include: [] },
      });
      try {
        const buildSite = await loadSite(server);
        for (const page of buildSite(siteFiles(root), buildDay(), styles)) {
          this.emitFile({ type: "asset", fileName: page.file, source: page.html });
        }
      } finally {
        await server.close();
      }
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = (request.url ?? "").split("?")[0] ?? "";
        if (!path.startsWith("/guides")) {
          next();
          return;
        }
        const wanted = path.endsWith("/") ? path : `${path}/`;
        loadSite(server)
          .then((buildSite) => {
            const found = buildSite(siteFiles(root), buildDay(), [], ["/@vite/client", DEV_STYLES]).find((page) => page.path === wanted);
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
