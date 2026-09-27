import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative Pfade: die gebaute App läuft in jedem Unterordner,
  // auf GitHub Pages und als claude.ai-Artifact.
  base: "./",
  plugins: [react()],
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 2500,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
