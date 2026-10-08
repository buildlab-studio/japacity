import "./index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { installSoundWake } from "./shared/sound/sound";
import { restoreTheme } from "./shared/world/theme";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("Missing #root element in index.html");
}

// The first tap anywhere wakes sound silently, so a scene that speaks never waits on the browser (audio page, section 7).
installSoundWake(document);
// The look this device chose last time, before the first frame (world.md R-WORLD-021).
restoreTheme();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
