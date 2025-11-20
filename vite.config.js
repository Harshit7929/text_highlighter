import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repoName = 'cloudmotiv-app'

export default defineConfig({
  plugins: [react()],
  // Use root ('/') for dev, repo base for production builds (GitHub Pages)
  base: process.env.NODE_ENV === 'production' ? `/${repoName}/` : '/',
  // keep pdfjs legacy build pre-bundled to avoid runtime import issues
  optimizeDeps: {
    include: ['pdfjs-dist/legacy/build/pdf']
  }
})

