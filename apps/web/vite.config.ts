import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))
const dataDir = fileURLToPath(new URL('../../data', import.meta.url))
// Solo para tests que leen el contrato con `?raw` (patrones que no se generan).
const docsDir = fileURLToPath(new URL('../../docs', import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@data': dataDir,
    },
  },
  server: {
    fs: {
      allow: [projectRoot, dataDir, docsDir],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
