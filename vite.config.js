import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, "index.html"),      // ⭐ REQUIRED
        card: path.resolve(__dirname, "card-button.html"),
        popup: path.resolve(__dirname, "popup.html"),
        dashboard: path.resolve(__dirname, "dashboard.html"),
        settings: path.resolve(__dirname, "settings.html"),
        testConnector: path.resolve(__dirname,"settings-connector-test.html"),
      }
    }
  }
});
