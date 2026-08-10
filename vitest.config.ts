import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react({
      // Bypass tsconfig jsx:preserve — force transform
      babel: {
        plugins: []
      }
    })
  ],
  // Disable oxc to use esbuild for JSX transform
  // vitest 4 defaults to oxc which conflicts with @vitejs/plugin-react
  oxc: false as any,
  esbuild: {
    jsx: 'automatic',
    include: /\.tsx?$/
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts']
  },
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  }
})
