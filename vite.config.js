import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { HEADERS } from './security-headers.js';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // Older and low-cost phones: Android Chrome/WebView 80+, iPhone iOS 14+.
  build: { target: ['es2019', 'chrome80', 'safari14', 'firefox78', 'edge88'] },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'legal.html'],
      manifest: {
        name: 'Hours Log for WV Medicaid (unofficial)',
        short_name: 'Hours Log',
        description: 'Free, unofficial record keeping for the West Virginia Medicaid work rule: hours, income and monthly reports. Your records stay on your device. For more information, check out wvmedicaidhelp.org.',
        theme_color: '#1f5f8b',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        id: '/',
        related_applications: [{ platform: 'webapp', url: 'https://hours.mikesheridandigital.com/manifest.webmanifest' }],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,pdf}'],
        // jsPDF's optional HTML/SVG renderers are never used; keep them out of the offline cache.
        globIgnores: ['**/html2canvas-*.js', '**/purify.es-*.js', '**/index.es-*.js', 'og-*.png', 'flyer.pdf'],
        navigateFallback: '/index.html',
        // Static pages are served as-is, never replaced by the app shell.
        navigateFallbackDenylist: [/^\/legal/, /^\/start/],
      },
    }),
  ],
  preview: { headers: HEADERS },
  test: { environment: 'node' },
});
