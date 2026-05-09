import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'

export default defineConfig(({ mode }) => {
  const isIOSBuild = mode === 'ios' || process.env.PASSGEN_TARGET === 'ios'
  const env = loadEnv(mode, process.cwd(), '')

  const desktopSellerSecret =
    process.env.VITE_SELLER_SECRET ||
    env.VITE_SELLER_SECRET ||
    process.env.SELLER_SECRET ||
    env.SELLER_SECRET ||
    ''

  if (isIOSBuild && desktopSellerSecret) {
    throw new Error(
      'Refusing iOS build: desktop seller/activation secret is present. ' +
      'Remove VITE_SELLER_SECRET and SELLER_SECRET from Appflow/iOS env.'
    )
  }

  const defineConstants: Record<string, string> = {
    __PASSGEN_TARGET__: JSON.stringify(isIOSBuild ? 'ios' : 'desktop'),
  }

  if (!isIOSBuild) {
    defineConstants['import.meta.env.VITE_SELLER_SECRET'] =
      JSON.stringify(desktopSellerSecret)
  }

  return {
    define: defineConstants,
    envPrefix: isIOSBuild
      ? ['VITE_SUPABASE_', 'VITE_REVENUECAT_', 'VITE_GOOGLE_', 'VITE_APPLE_']
      : 'VITE_',
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
      sourcemap: isIOSBuild ? false : undefined,
      rollupOptions: {
        input: isIOSBuild ? 'index.ios.html' : 'index.html',
        output: {
          manualChunks: undefined
        }
      }
    }
  }
})
