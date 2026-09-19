/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // The app runs in CloudMosa's up-to-date Chromium (docs/05 §2).
  build: { target: 'es2020' },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // Dev only: the page is reached through Caddy (and possibly a tunnel), not directly.
    allowedHosts: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/api/schema.d.ts'],
      reporter: ['text-summary'],
    },
  },
})
