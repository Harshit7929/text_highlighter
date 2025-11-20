import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repoName = 'cloudmotiv-app'

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? `/${repoName}/` : '/',
  optimizeDeps: {
    include: ['pdfjs-dist/legacy/build/pdf']
  }
})

