import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' zorgt dat de app onder elk pad werkt (Vercel, GitHub Pages)
export default defineConfig({
  plugins: [react()],
  base: './',
  // de WebP-encoder laadt een WASM-bestand dat Vite niet mag voorbundelen
  optimizeDeps: { exclude: ['@jsquash/webp'] },
})
