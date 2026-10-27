import { fileURLToPath } from 'node:url'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'

// El contrato de la sala (tipos y constantes que comparte con el servidor) vive en el servidor
const contrato = fileURLToPath(new URL('../server/src/contrato', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@contrato': contrato },
  },
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
    allowedHosts: ['elessartinuviel.duckdns.org'],
    // Fuera de client/ solo se sirve el contrato
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), contrato] }
  }
})
