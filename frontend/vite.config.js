import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173 // Default Vite port (binds to 0.0.0.0 when `host: true`)
  }
})
