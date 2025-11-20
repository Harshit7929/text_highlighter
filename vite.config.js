import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repoName = 'text_highliter'

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? `/${repoName}/` : '/',
  optimizeDeps: {
    include: ['pdfjs-dist/legacy/build/pdf']
  }
})
