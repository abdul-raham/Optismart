import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      includeAssets: ['fav.svg', 'fav.png'],
      manifest: {
        name: 'OptiSmart Portal',
        short_name: 'OptiSmart',
        description: 'OptiSmart Enterprise Operations Portal',
        theme_color: '#f8fafc',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'fav.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'fav.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'fav.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
})
