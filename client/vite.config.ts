import { fileURLToPath } from 'node:url'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'

// Lo que Clocktower online comparte con el servidor vive en el servidor: los valores del dominio
// (models/compartido) y lo que el servidor envía (views/botc/dto). Solo tipos y valores puros.
const models = fileURLToPath(new URL('../server/src/models/compartido', import.meta.url))
const views = fileURLToPath(new URL('../server/src/views/botc/dto', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@models': models, '@views': views },
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
    // Fuera de client/ solo se sirve lo compartido con el servidor
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), models, views] }
  }
})
