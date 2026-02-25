import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  define: {
    // Expose VITE_SELLER_SECRET to renderer at build time
    'import.meta.env.VITE_SELLER_SECRET': JSON.stringify(process.env.VITE_SELLER_SECRET || '')
  },
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
})
