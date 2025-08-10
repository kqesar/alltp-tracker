import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import viteCompression from "vite-plugin-compression";
// https://vite.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === "production" ? "/alltp-tracker/" : "/",
  plugins: [
    react(),
    tailwindcss(),
    viteCompression({
      algorithm: "brotliCompress",
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
