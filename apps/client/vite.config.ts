import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { guidePages } from "./src/features/guides/prerender";

export default defineConfig({
  plugins: [react(), tailwindcss(), guidePages()],
});
