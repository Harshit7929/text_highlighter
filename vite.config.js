// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/text_highlighter/",   // <--- important for GitHub Pages repo URL
  plugins: [react()],
  optimizeDeps: {
    include: ["pdfjs-dist/legacy/build/pdf"]
  }
});

