import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { PODERES_BOLSA } from '../src/models/personajes';

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

describe('arquitectura', () => {
  const capas = ['models', 'services'].flatMap(archivos);

  it('el dominio y los servicios no usan los Dto: los monta la vista', () => {
    const fuera = capas.filter(usaVistas);
    expect(fuera, 'Estos archivos usan views/: el Dto se monta en la vista, no aquí').toEqual([]);
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

  it('los servicios y los controladores no conocen a ningún personaje: usan la lista de models/personajes', () => {
    const comunes = ['models/personajes', 'models/personajes/DeclaracionDia', 'models/personajes/idPersonaje'];
    const fuera = ['services', 'controllers'].flatMap(archivos).filter((f) =>
      importsDe(f).some((i) => i.startsWith('models/personajes') && !comunes.includes(i)),
    );
    expect(fuera, 'Estos archivos usan un personaje concreto: que lo traiga su archivo y vaya en la lista').toEqual([]);
  });

  it('los controladores no usan los repositorios ni la infraestructura: piden todo a su servicio', () => {
    const fuera = archivos('controllers').filter((f) => importsDe(f).some((i) => /^(repositories|infra)(\/|$)/.test(i)));
    expect(fuera, 'Estos controladores se saltan el servicio').toEqual([]);
  });

  it('la bolsa no conoce a ningún personaje: cada uno declara su poder en su archivo (PODERES_BOLSA)', () => {
    const texto = fs.readFileSync(path.join(SRC, 'models/partida/Bolsa.ts'), 'utf8');
    const nombrados = [...PODERES_BOLSA.keys()].filter((id) => new RegExp(`['"\`]${id}['"\`]`).test(texto));
    expect(nombrados).toEqual([]);
  });

  it('el dominio no usa los servicios, los controladores, los repositorios ni la infraestructura', () => {
    const fuera = archivos('models').filter((f) => importsDe(f).some((i) => /^(services|controllers|repositories|infra)(\/|$)/.test(i)));
    expect(fuera).toEqual([]);
  });
});
