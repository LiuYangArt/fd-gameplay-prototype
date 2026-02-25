import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@fd/gameplay-core": fileURLToPath(new URL("../gameplay-core/src/index.ts", import.meta.url))
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
