import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "fs";
import { execSync } from "child_process";

// The version number can't be computed from `git rev-list --count` at build
// time: the Docker build deliberately has no git/`.git` available (see the
// comment in docker/Dockerfile), since that's what breaks Portainer's
// git-stack deploys. So frontend/package.json's "version" is the source of
// truth instead -- a plain file Docker can always copy. Convention: it's
// "1.<total commit count as of this commit>.0", bumped by hand as part of
// every commit (see PROJECT_STATUS.md).
const { version } = JSON.parse(readFileSync("./package.json", "utf-8"));

function getCommitHash() {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __COMMIT_HASH__: JSON.stringify(getCommitHash())
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: "dist",
    sourcemap: false
  }
});
