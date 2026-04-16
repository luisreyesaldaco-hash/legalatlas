import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './react-src'),
    },
  },
  root: '.',
  base: '/dist-react/',
  build: {
    outDir: 'dist-react',
    rollupOptions: {
      input: {
        main: './react-src/index.html',
      },
    },
  },
  server: {
    port: 5173,
  },
})
