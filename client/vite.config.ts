import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: '../',
  // Dos páginas: la web (index.html) y la sala de juego (sala.html), cada una con su bundle
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        sala: 'sala.html'
      }
    }
  },
  server: {
    host: '0.0.0.0', // Esto permite conexiones externas
    port: 5173,
    allowedHosts: ['elessartinuviel.duckdns.org']
  }
})
