import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const nodeEmpty = path.resolve(__dirname, './src/shims/node-empty.ts')

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  base: command === 'serve' ? '/' : '/molroo-hyori/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Stub Node built-ins imported by SDK/adapter code (never called in browser)
      'node:crypto': path.resolve(__dirname, './src/shims/node-crypto.ts'),
      'node:fs': path.resolve(__dirname, './src/shims/node-fs.ts'),
      'node:path': path.resolve(__dirname, './src/shims/node-path.ts'),
      'node:os': nodeEmpty,
      'node:util': nodeEmpty,
      'node:stream': nodeEmpty,
      'node:events': nodeEmpty,
      'node:child_process': nodeEmpty,
      'node:buffer': nodeEmpty,
      'node:querystring': nodeEmpty,
    },
    dedupe: ['@molroo-ai/sdk', '@molroo-ai/adapter-llm'],
  },
  optimizeDeps: {
    include: ['@molroo-ai/sdk', '@molroo-ai/adapter-llm'],
  },
  build: {
    commonjsOptions: {
      include: [/molroo-ai/, /node_modules/],
    },
  },
}))
