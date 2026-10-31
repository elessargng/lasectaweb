import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

/**
 * Las capas del servidor y quién puede usar a quién. El dominio (models) y los casos
 * de uso (services) no saben cómo se envían las cosas: los Dto (views/dto) solo los
 * montan las vistas (VistaPartida) y los usan los controladores.
 */

const SRC = path.resolve(__dirname, '../src');

/** Los archivos .ts de una carpeta de src, con su ruta relativa a src. */
function archivos(carpeta: string): string[] {
  const dir = path.join(SRC, carpeta);
  return fs.readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts'))
    .map((f) => path.posix.join(carpeta, f.split(path.sep).join('/')));
}

/** Lo que importa un archivo (las rutas, ya resueltas y relativas a src). */
function importsDe(archivo: string): string[] {
  const texto = fs.readFileSync(path.join(SRC, archivo), 'utf8');
  return [...texto.matchAll(/(?:from|import)\s*\(?\s*'(\.{1,2}\/[^']+)'/g)].map((m) =>
    path.posix.normalize(path.posix.join(path.posix.dirname(archivo), m[1])),
  );
}

/** Los que importan algo de views: lo que hay que corregir. */
const usaVistas = (archivo: string) => importsDe(archivo).some((i) => i === 'views' || i.startsWith('views/'));

/**
 * Los que aún usan un Dto (se van quitando servicio a servicio). Esta lista solo
 * puede menguar: si se arregla uno, el test pide quitarlo de aquí.
 */
const PENDIENTES = [
  'models/narradorVirtual/NarradorVirtual.ts',
  'models/narradorVirtual/etapas/Noche.ts',
  'models/narradorVirtual/noche/requisitos.ts',
  'models/narradorVirtual/noche/revisiones.ts',
  'models/narradorVirtual/puertos.ts',
  'models/partida/Configuracion.ts',
  'models/partida/DespertarGuiado.ts',
  'models/partida/Despertares.ts',
  'models/partida/Entregas.ts',
  'models/partida/Fases.ts',
  'models/partida/Nominaciones.ts',
  'models/partida/Partida.ts',
  'models/partida/RelojSala.ts',
  'models/partida/Revelacion.ts',
  'models/partida/Senalamientos.ts',
  'models/partida/reglas/lilMonsta.ts',
  'models/sala/Participantes.ts',
  'services/chat/ChatService.ts',
  'services/conversaciones/ConversacionService.ts',
];

/**
 * El narrador virtual guarda su estado (un Dto) en un «repositorio» que solo existe en
 * memoria: es estado del dominio, no persistencia. Se arregla con el resto del narrador.
 */
const PENDIENTES_DOMINIO = ['models/SalaDeJuego.ts', 'models/narradorVirtual/NarradorVirtual.ts'];

describe('arquitectura', () => {
  const capas = ['models', 'services'].flatMap(archivos);

  it('el dominio y los servicios no usan los Dto (salvo los pendientes de arreglar)', () => {
    const nuevos = capas.filter((f) => usaVistas(f) && !PENDIENTES.includes(f));
    expect(nuevos, 'Estos archivos usan views/: el Dto se monta en la vista, no en el dominio').toEqual([]);
  });

  it('la lista de pendientes solo mengua: los ya arreglados salen de ella', () => {
    const arreglados = PENDIENTES.filter((f) => !usaVistas(f));
    expect(arreglados, 'Ya no usan views/: quítalos de PENDIENTES').toEqual([]);
  });

  it('lo que comparte el dominio con el cliente (models/compartido) solo usa models/compartido', () => {
    const fuera = archivos('models/compartido').filter((f) =>
      importsDe(f).some((i) => !i.startsWith('models/compartido/')),
    );
    expect(fuera).toEqual([]);
  });

  it('los Dto (views/dto) solo usan otros Dto y models/compartido', () => {
    const fuera = archivos('views/dto').filter((f) =>
      importsDe(f).some((i) => !i.startsWith('views/dto/') && !i.startsWith('models/compartido/')),
    );
    expect(fuera).toEqual([]);
  });

  it('el dominio no usa los servicios, los controladores ni los repositorios (salvo los pendientes)', () => {
    const usaCapasDeFuera = (f: string) => importsDe(f).some((i) => /^(services|controllers|repositories)(\/|$)/.test(i));
    const fuera = archivos('models').filter((f) => usaCapasDeFuera(f) && !PENDIENTES_DOMINIO.includes(f));
    expect(fuera).toEqual([]);
    expect(PENDIENTES_DOMINIO.filter((f) => !usaCapasDeFuera(f)), 'Ya están bien: quítalos de PENDIENTES_DOMINIO').toEqual([]);
  });
});
