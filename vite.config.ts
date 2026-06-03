import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base: './' → relative asset paths, works on GitHub Pages project sites with hash router
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
})
