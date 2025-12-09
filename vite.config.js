import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import mkcert from 'vite-plugin-mkcert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  base: './',
  plugins: [
    react(), 
    mkcert()
  ],
  build: {
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, "index.html"),
        card: path.resolve(__dirname, "card-button.html"),
        popup: path.resolve(__dirname, "popup.html"),
        dashboard: path.resolve(__dirname, "dashboard.html"),
        settings: path.resolve(__dirname, "settings.html"),
        testConnector: path.resolve(__dirname,"settings-connector-test.html"),
      }
    }
  },
  server: {
    https: true 
  }
});