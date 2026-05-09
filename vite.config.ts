import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(() => {
  return {
    define: {
      __PASSGEN_TARGET__: JSON.stringify('ios'),
    },
    envPrefix: ['VITE_SUPABASE_', 'VITE_REVENUECAT_', 'VITE_GOOGLE_', 'VITE_APPLE_'],
    plugins: [
      react()
    ],
    publicDir: false,
    base: './',
    build: {
      outDir: 'dist-ios',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        input: 'index.ios.html',
        output: {
          manualChunks: undefined
        }
      }
    }
  }
})
