import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => {
  if (command === 'serve' && process.env.PASSGEN_ALLOW_DEV_SERVER !== '1') {
    throw new Error(
      'Dev server is disabled for this iOS/Appflow repo. ' +
      'Set PASSGEN_ALLOW_DEV_SERVER=1 only when you intentionally need local Vite preview.'
    )
  }

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
