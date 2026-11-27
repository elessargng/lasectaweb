import { fileURLToPath } from 'node:url'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'

// El cliente solo conoce del servidor el contrato de su API: lo que envía y recibe
// Clocktower online (views/botc/dto: tipos y constantes del protocolo, nada del dominio).
const views = fileURLToPath(new URL('../server/src/views/botc/dto', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@views': views },
  },
  envDir: '../',
  // Dos páginas: la web (index.html) y Clocktower online (botc.html), cada una con su bundle
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        botc: 'botc.html'
      }
    }
  },
  // Los workers como módulos (el de la voz neuronal carga sus librerías al usarlas)
  worker: { format: 'es' },
  server: {
    host: '0.0.0.0', // Esto permite conexiones externas
    port: 5173,
    allowedHosts: ['elessartinuviel.duckdns.org'],
    // Fuera de client/ solo se sirve el contrato con el servidor
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), views] }
  }
})
