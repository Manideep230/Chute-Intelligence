import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-transition-group/TransitionGroupContext': 'react-transition-group/cjs/TransitionGroupContext.js',
      '@csstools/css-calc': path.resolve(__dirname, 'src/mock-css-calc.js'),
      '@asamuzakjp/css-color': path.resolve(__dirname, 'src/mock-css-color.js'),
    },
  },
  build: {
    // Raise the warning threshold — after splitting, individual chunks may still
    // be large (e.g., Three.js). Suppress noise; the split itself reduces TTI.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Heavy 3D/rendering layer — lazy-loaded only when digital twin opens
          if (id.includes('three') || id.includes('@react-three')) {
            return 'vendor-three';
          }
          // MUI core — large but shared across all pages; cache-stable
          if (id.includes('@mui/material') || id.includes('@mui/system') || id.includes('@mui/base') || id.includes('@emotion')) {
            return 'vendor-mui';
          }
          // Icon library — medium size, rarely changes between deploys
          if (id.includes('lucide-react')) {
            return 'vendor-lucide';
          }
          // MQTT client — only needed on Dashboard; separate chunk improves Login TTI
          if (id.includes('mqtt')) {
            return 'vendor-mqtt';
          }
          // QR code library — only used in onboarding modal
          if (id.includes('qrcode')) {
            return 'vendor-qrcode';
          }
          // Remaining node_modules into a shared vendor chunk
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    proxy: {
      '/_/backend': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/_\/backend/, ''),
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    alias: {
      '@csstools/css-calc': path.resolve(__dirname, 'src/mock-css-calc.js'),
      '@asamuzakjp/css-color': path.resolve(__dirname, 'src/mock-css-color.js'),
    },
    server: {
      deps: {
        inline: [
          '@csstools/css-calc',
          '@asamuzakjp/css-color',
          /node_modules/
        ],
      },
    },
  },
})


