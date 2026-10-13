// Rubik, the interface's one face, from the same package the client ships, at its two weights; the render waits for it.
import { continueRender, delayRender } from "remotion";

import rubik500 from "@fontsource/rubik/files/rubik-latin-500-normal.woff2";
import rubik700 from "@fontsource/rubik/files/rubik-latin-700-normal.woff2";

let asked = false;

export function loadRubik(): void {
  // Outside a browser (a test in jsdom) there is no FontFace to load; the fallback face stands in.
  if (asked || typeof document === "undefined" || typeof FontFace === "undefined") return;
  asked = true;
  const handle = delayRender("Rubik");
  const faces = [new FontFace("Rubik", `url(${rubik500})`, { weight: "500" }), new FontFace("Rubik", `url(${rubik700})`, { weight: "700" })];
  Promise.all(faces.map((face) => face.load()))
    .then((loaded) => {
      for (const face of loaded) document.fonts.add(face);
      continueRender(handle);
    })
    .catch((error: unknown) => {
      console.error(error);
      continueRender(handle);
    });
}
