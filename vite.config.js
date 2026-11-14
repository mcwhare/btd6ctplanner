import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/btd6ctplanner/",
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/nk": {
        target: "https://data.ninjakiwi.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nk/, ""),
      },
    },
  },
});