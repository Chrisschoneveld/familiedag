import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' zorgt dat de app werkt op https://<gebruiker>.github.io/<repo>/
export default defineConfig({
  plugins: [react()],
  base: './',
})
