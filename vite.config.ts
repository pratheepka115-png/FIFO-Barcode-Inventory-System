
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    // Fix asset paths when Electron loads dist/index.html locally.
    base: "./",

    plugins: [react(), tailwindcss()],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },

    server: {
      host: "127.0.0.1",
      port: 3000,

      // Preserve your existing HMR configuration.
      hmr: process.env.DISABLE_HMR !== "true",

      // Preserve your existing file-watching configuration.
      watch:
        process.env.DISABLE_HMR === "true"
          ? null
          : {},
    },

    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
