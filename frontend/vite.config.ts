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


