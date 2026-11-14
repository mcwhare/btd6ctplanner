import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Proxy avoids any CORS trouble with the Open Data API during development.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/nk": {
        target: "https://data.ninjakiwi.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/nk/, ""),
      },
    },
  },
});