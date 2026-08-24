import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "fs";
import { execSync } from "child_process";

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
