import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],

  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        popup: path.resolve(__dirname, "popup.html"),
        dashboard: path.resolve(__dirname, "dashboard.html"),
        detail: path.resolve(__dirname, "detail.html"),
        settings: path.resolve(__dirname, "settings.html"),
        auth: path.resolve(__dirname, "auth.html"),
        cardButton: path.resolve(__dirname, "card-button.html")
      }
    }
  },

  server: {
    host: "0.0.0.0",
    port: 5173
  }
});