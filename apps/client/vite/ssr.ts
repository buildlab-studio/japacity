// A Vite server in SSR mode with no config, no watcher and no socket, through which a plugin loads the
// TypeScript modules its pages are made from. The caller closes it.
import { createServer, type ViteDevServer } from "vite";

export function ssrServer(root: string): Promise<ViteDevServer> {
  return createServer({
    root,
    configFile: false,
    logLevel: "error",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
}
