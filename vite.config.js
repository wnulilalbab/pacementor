import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/pacementor/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'PaceMentor',
        short_name: 'PaceMentor',
        description: 'Advanced running analytics from your GPX files',
        theme_color: '#4AAEE0',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/pacementor/',
        start_url: '/pacementor/',
        icons: [
          {
            src: '/pacementor/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pacementor/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pacementor/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Cache map tiles from OpenStreetMap
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/www\.strava\.com\/api\/.*/i,
            handler: 'NetworkOnly', // always fresh for Strava
          },
        ],
      },
    }),
  ],
})
