import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { guidePages } from "./src/features/guides/prerender";
import { buildStamp } from "./src/shared/stamp/stamp.plugin";
import { legalPagesPlugin } from "./src/features/legal/plugin";

export default defineConfig({
  plugins: [react(), tailwindcss(), guidePages(), legalPagesPlugin(), buildStamp()],
});
