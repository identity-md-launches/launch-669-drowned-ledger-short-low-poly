import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          sea: ["three", "@react-three/fiber", "@react-three/drei"],
          chain: ["viem"],
        },
      },
    },
  },
});
