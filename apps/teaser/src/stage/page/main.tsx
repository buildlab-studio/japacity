// The stage page: one scene of the stageshow teaser at a time, `?scene=door&shape=wide`, filling the window. The
// compositions open it in an iframe with `&drive=frames`; the dev server (`pnpm --filter @japacity/teaser stage -- --serve 7062`)
// serves it for film.mjs and a look in a browser.
import "./drive";
import "./page.css";

import { createRoot } from "react-dom/client";

import { SCENES, type SceneName, type Shape } from "../scenes";
import { offerDriver } from "./drive";

const params = new URLSearchParams(window.location.search);
const name = params.get("scene") ?? "door";
const shape: Shape = params.get("shape") === "tall" ? "tall" : "wide";
const root = document.getElementById("root");
if (root === null) throw new Error("The stage page has no #root.");
const Scene = name in SCENES ? SCENES[name as SceneName] : null;
if (Scene === null) {
  root.textContent = `No scene named ${name}. The scenes: ${Object.keys(SCENES).join(", ")}.`;
} else {
  createRoot(root).render(<Scene shape={shape} />);
  offerDriver(root);
}
