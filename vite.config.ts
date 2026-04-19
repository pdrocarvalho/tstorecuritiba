import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: "client",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
    },
  },
  server: {
    port: 5173,
    // 👇 A NOSSA CORREÇÃO DE SEGURANÇA PARA O GOOGLE ENTRA AQUI 👇
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
    // O seu proxy continua intacto
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});