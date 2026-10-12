import "./index.css";

import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { tilesAsked } from "./shared/tiles/asked";
import { sayBuild } from "./shared/stamp/stamp";
import { installSoundWake } from "./shared/sound/sound";
import { restoreTheme } from "./shared/world/theme";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("Missing #root element in index.html");
}

// The build this page is, once in the console, so a page a cache kept can be told from a new one (R-SERVER-038).
sayBuild(document);
// The first tap anywhere wakes sound silently, so a scene that speaks never waits on the browser (audio page, section 7).
installSoundWake(document);
// The look this device chose last time, before the first frame (world.md R-WORLD-021).
restoreTheme();

// `?tiles` in development only: the contact sheet of every picture tile. A player's build drops it with its chunk.
const TileSheet = import.meta.env.DEV ? lazy(() => import("./shared/tiles/TileSheet")) : null;

createRoot(container).render(
  <StrictMode>
    {TileSheet !== null && tilesAsked(location.search) ? (
      <Suspense fallback={null}>
        <TileSheet />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
