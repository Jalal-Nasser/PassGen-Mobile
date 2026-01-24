import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'

export default defineConfig({
  define: {
    // Expose VITE_SELLER_SECRET to renderer at build time
    'import.meta.env.VITE_SELLER_SECRET': JSON.stringify(process.env.VITE_SELLER_SECRET || '')
  },
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart(options) {
          options.startup()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            emptyOutDir: true,
            rollupOptions: {
              external: ['electron', 'libsodium-wrappers', 'argon2']
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron', 'libsodium-wrappers', 'argon2']
            }
          }
        }
      }
    ])
    // Removed renderer plugin - it causes Node.js module import issues
  ],
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
