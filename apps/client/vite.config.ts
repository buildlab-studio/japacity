import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { beaconPlugin } from "./vite/analytics.plugin";
import { guidePages } from "./vite/guide.plugin";
import { previewHeaders } from "./vite/headers.plugin";
import { legalPagesPlugin } from "./vite/legal.plugin";
import { forPlayers, shippedBuild, styleLicences } from "./vite/shipping.plugin";
import { sizeReport } from "./vite/size.plugin";
import { inlineStyleHashes } from "./vite/style-hashes.plugin";
import { buildStamp } from "./vite/build-stamp.plugin";

export default defineConfig(({ command, mode }) => ({
  plugins: [react(), tailwindcss(), guidePages(), legalPagesPlugin(), beaconPlugin(), buildStamp(), sizeReport(), styleLicences(), previewHeaders(), inlineStyleHashes()],
  ...(forPlayers(command, mode) ? { build: shippedBuild() } : {}),
}));
