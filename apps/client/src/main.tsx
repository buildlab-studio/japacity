import "./index.css";

import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import { tilesAsked } from "./shared/tiles/asked";
import { sayBuild } from "./shared/build-stamp/stamp";
import { installSoundWake } from "./shared/sound/sound";
import { lookAsked } from "./shared/ui/look/preview";

/** The preview of the game's look, development only: its own chunk, and none at all in a build for players. */
const LookPreview = import.meta.env.DEV ? lazy(() => import("./shared/ui/look/LookPreview").then((page) => ({ default: page.LookPreview }))) : null;

const container = document.getElementById("root");
if (container === null) {
  throw new Error("Missing #root element in index.html");
}

// The build this page is, once in the console, so a page a cache kept can be told from a new one (server:production-and-staging).
sayBuild(document);
// The first tap anywhere wakes sound silently, so a scene that speaks never waits on the browser (docs/design/05-audio.md, section 7).
installSoundWake(document);

// `?tiles` in development only: the contact sheet of every picture tile. A player's build drops it with its chunk.
const TileSheet = import.meta.env.DEV ? lazy(() => import("./shared/tiles/TileSheet")) : null;

createRoot(container).render(
  <StrictMode>
    {TileSheet !== null && tilesAsked(location.search) ? (
      <Suspense fallback={null}>
        <TileSheet />
      </Suspense>
    ) : LookPreview !== null && lookAsked(location.search) ? (
      <Suspense fallback={null}>
        <LookPreview />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
