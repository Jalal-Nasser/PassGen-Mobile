import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'

export default defineConfig(({ mode }) => {
  const isIOSBuild = mode === 'ios' || process.env.PASSGEN_TARGET === 'ios'

  return {
    define: {
      'import.meta.env.VITE_SELLER_SECRET': JSON.stringify(process.env.VITE_SELLER_SECRET || ''),
      __PASSGEN_TARGET__: JSON.stringify(isIOSBuild ? 'ios' : 'desktop')
    },
    plugins: [
      react(),
      ...(!isIOSBuild
        ? [
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
          ]
        : [])
    ],
    publicDir: isIOSBuild ? false : 'public',
    base: './',
    build: {
      outDir: isIOSBuild ? 'dist-ios' : 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: isIOSBuild ? 'index.ios.html' : 'index.html',
        output: {
          manualChunks: undefined
        }
      }
    }
  }
})
