import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Backend runs on :8000 per backend/app/main.py — see README for run instructions.
      // API routes get an /api prefix as they're added in Phase 1+; /health is
      // the one exception since it's a Phase 0 infra check, not a domain route.
      "/health": "http://localhost:8000",
      "/api": { target: "http://localhost:8000", rewrite: (path) => path.replace(/^\/api/, "") },
    },
  },
});
