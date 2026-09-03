import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind dual-stack so both localhost (::1) and 127.0.0.1 work.
    // Default Vite can end up IPv6-only or IPv4-only and browsers pick the other.
    host: '::',
    port: 5173,
    strictPort: true,
  },
})
