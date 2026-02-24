import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  base: command === 'serve' ? '/' : '/molroo-hyori/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
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
    rollupOptions: {
      // Node-only modules from SDK/adapter deps — not used in browser paths
      external: [/^node:/, 'events', 'stream', 'fs', 'path', 'os', 'util', 'child_process', 'querystring', 'buffer'],
    },
  },
}))
