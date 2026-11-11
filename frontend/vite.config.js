
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],

  define: {
    CESIUM_BASE_URL: JSON.stringify("/cesium/")
  },

  server: {
    host: "0.0.0.0",

    allowedHosts: [
      "76kdktfr-5173.inc1.devtunnels.ms"
    ],

    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true
      }
    }
  }
});
