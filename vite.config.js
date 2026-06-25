import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/revolution-simulator/',
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/.vs/**']
    }
  }
})