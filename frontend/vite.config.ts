import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // expose on all interfaces for Docker
  },
  optimizeDeps: {
    include: ['monaco-editor'],
  },
})
