import fs from 'fs';
import path from 'path';
import { format } from 'util';

/**
 * Lo que el servidor escribe por consola (log, info, warn, error, debug) se
 * copia también en server/logs/server-AAAA-MM-DD.log, un fichero por día, con
 * la hora y el nivel delante. La consola sigue igual. Se activa al importarlo
 * (lo primero de index.ts, para no perder nada del arranque).
 */

// En desarrollo (src/utils) y compilado (dist/utils), la misma carpeta: server/logs
const CARPETA = path.resolve(__dirname, '../../logs');

let dia = '';
let fichero: fs.WriteStream | null = null;

/** El fichero de hoy (al cambiar de día, abre otro). */
function ficheroDeHoy(): fs.WriteStream | null {
  const hoy = new Date().toISOString().slice(0, 10);
  if (hoy !== dia) {
    fichero?.end();
    dia = hoy;
    try {
      fs.mkdirSync(CARPETA, { recursive: true });
      fichero = fs.createWriteStream(path.join(CARPETA, `server-${hoy}.log`), { flags: 'a' });
      // Si no se puede escribir, se sigue solo por consola
      fichero.on('error', () => (fichero = null));
    } catch {
      fichero = null;
    }
  }
  return fichero;
}

const NIVELES = ['log', 'info', 'warn', 'error', 'debug'] as const;

for (const nivel of NIVELES) {
  const original = console[nivel].bind(console);
  console[nivel] = (...args: unknown[]) => {
    original(...args);
    ficheroDeHoy()?.write(`${new Date().toISOString()} ${nivel.toUpperCase().padEnd(5)} ${format(...args)}\n`);
  };
}
