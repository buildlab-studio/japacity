import "./index.css";

import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { tilesAsked } from "./shared/tiles/asked";
import { sayBuild } from "./shared/stamp/stamp";
import { installSoundWake } from "./shared/sound/sound";
import { livelyAsked } from "./shared/ui/lively/preview";

/** The lively layer's preview, development only: its own chunk, and none at all in a build for players. */
const LivelyPreview = import.meta.env.DEV ? lazy(() => import("./shared/ui/lively/LivelyPreview").then((page) => ({ default: page.LivelyPreview }))) : null;

const container = document.getElementById("root");
if (container === null) {
  throw new Error("Missing #root element in index.html");
}

// The build this page is, once in the console, so a page a cache kept can be told from a new one (R-SERVER-038).
sayBuild(document);
// The first tap anywhere wakes sound silently, so a scene that speaks never waits on the browser (audio page, section 7).
installSoundWake(document);

// `?tiles` in development only: the contact sheet of every picture tile. A player's build drops it with its chunk.
const TileSheet = import.meta.env.DEV ? lazy(() => import("./shared/tiles/TileSheet")) : null;

createRoot(container).render(
  <StrictMode>
    {TileSheet !== null && tilesAsked(location.search) ? (
      <Suspense fallback={null}>
        <TileSheet />
      </Suspense>
    ) : LivelyPreview !== null && livelyAsked(location.search) ? (
      <Suspense fallback={null}>
        <LivelyPreview />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
