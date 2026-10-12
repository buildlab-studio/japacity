import "./index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { sayBuild } from "./shared/stamp/stamp";
import { installSoundWake } from "./shared/sound/sound";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("Missing #root element in index.html");
}

// The build this page is, once in the console, so a page a cache kept can be told from a new one (R-SERVER-038).
sayBuild(document);
// The first tap anywhere wakes sound silently, so a scene that speaks never waits on the browser (audio page, section 7).
installSoundWake(document);

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
