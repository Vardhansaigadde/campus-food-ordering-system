import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// The React app talks ONLY to the API Gateway (port 8080).
// In development Vite forwards /api/* to the gateway, so the browser sees a single origin.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Campus Food – Pre-Order',
        short_name: 'Campus Food',
        description: 'Order from campus canteens and collect with your Order ID + OTP',
        theme_color: '#c2410c',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Never cache API calls – orders and menus must always be live
        navigateFallbackDenylist: [/^\/api/],
        // Push alerts that work with the phone locked (public/push-sw.js)
        importScripts: ['/push-sw.js'],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true, // also reachable from phones on the same Wi-Fi
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
})
