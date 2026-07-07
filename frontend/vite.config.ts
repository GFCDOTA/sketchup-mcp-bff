import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// O frontend NUNCA fala com modelos locais direto — só com o BFF via /api.
// Em dev, o Vite faz proxy de /api (e imagens) para o BFF (:8782).
const BFF = process.env.VITE_BFF_URL || "http://localhost:8782";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: BFF, changeOrigin: true },
      "/img": { target: BFF, changeOrigin: true },
      "/inbox-img": { target: BFF, changeOrigin: true },
      "/variant-img": { target: BFF, changeOrigin: true },
    },
  },
});
