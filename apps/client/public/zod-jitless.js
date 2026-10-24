// server:csp-holds-every-page: Zod builds faster checkers from strings with `Function` when it may, and finds out
// whether it may by trying once as each object shape is built. The page's policy never lets a string run as script,
// so the try is refused and reported on every load. Zod reads its settings from this global, made by the first to
// come, so set here before any of the game's modules run, Zod never tries. The page runs this before its entry.
globalThis.__zod_globalConfig = Object.assign(globalThis.__zod_globalConfig ?? {}, { jitless: true });
