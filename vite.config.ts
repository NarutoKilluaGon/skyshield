import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Point VITE_API_BASE_URL at /api and the mock transport can be switched
// off with VITE_USE_MOCK=false during backend integration. Shared by `dev`
// and `preview` so the production build can be flow-tested against Django.
const apiProxy = {
  '/api': {
    target: process.env.VITE_PROXY_TARGET ?? 'http://127.0.0.1:8000',
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: apiProxy,
  },
  preview: {
    port: 4173,
    proxy: apiProxy,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    modulePreload: {
      resolveDependencies(_filename, deps) {
        return deps.filter((dep) => !dep.includes('radix-') && !dep.includes('charts-'))
      },
    },
    rollupOptions: {
      output: {
        // Split the heavy, rarely-changing libraries so app chunks stay small
        // and a dependency bump does not invalidate the whole bundle. Radix
        // and floating-ui come along with the primitives that need them.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|cookie|cookiejar)[\\/]/.test(id))
            return 'react'
          if (/[\\/]node_modules[\\/](clsx|tailwind-merge|class-variance-authority)[\\/]/.test(id))
            return 'ui-utils'
          if (id.includes('recharts') || /[\\/]node_modules[\\/](@reduxjs|es-toolkit|immer|d3-|victory-|decimal\.js|react-is)[\\/]/.test(id))
            return 'charts'
          if (/[\\/]node_modules[\\/](@radix-ui|@floating-ui|react-remove-scroll|aria-hidden|tslib)[\\/]/.test(id))
            return 'radix'
        },
      },
    },
  },
})
