import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";

const FIsGitHubActions = process.env.GITHUB_ACTIONS === "true";
const FRepositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];

// GitHub Pages 需要以 /<repo>/ 作为静态资源前缀，本地开发保持根路径。
const FGitHubPagesBase = FIsGitHubActions && FRepositoryName ? `/${FRepositoryName}/` : "/";

export default defineConfig({
  base: FGitHubPagesBase,
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
