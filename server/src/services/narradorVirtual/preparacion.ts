import { NO_VAN_EN_BOLSA } from '../../contrato/bolsaAleatoria';
import { repartoAjustado } from '../../contrato/reparto';
import type { GuionNarradorVirtual, SalaDistribucion } from '../../contrato/sala';
import type { PersonajeDeGuion } from '../../types/guiones';
import {
  categoriasDeHuecos,
  CATEGORIAS_ALDEANOS,
  CATEGORIAS_INFORMACION,
  CONCEPTOS_BIEN,
  CONCEPTOS_MAL,
  NOMBRE_CATEGORIA,
  ofrecer,
  otraCategoria,
  PESO_PREFERIDO,
  sortearConceptos,
  type CategoriaAldeano,
  type Conceptos,
} from './bolsa/conceptos';
import type { Decision } from './estrategias/EstrategiaNarrador';
import { instruccionesBolsa } from './estrategias/instruccionesJarvis';
import type { SalaService } from '../SalaService';
import type { Azar, MesaNarrador } from './puertos';

/** Lo que ha salido pero no va en la bolsa (el Borracho) y el aldeano que cree ser (su ficha sí va). */
export interface FueraDeLaBolsa {
  personaje: string;
  creeSer: string | null;
}

/**
 * Prepara la partida como lo haría un narrador al llegar: grimorio limpio, tantos
 * asientos como jugadores (sin echar a nadie: los sentados de los que sobran se
 * mueven a uno libre), el guion pedido, el grimorio de los jugadores puesto y la
 * bolsa que elige su estrategia (qué partida quiere narrar). Devuelve el error o, si sale bien, la bolsa y los que han salido
 * pero no van en ella (el Borracho: lo pone el narrador la primera noche).
 */
export async function prepararPartida(
  sala: SalaService,
  mesa: MesaNarrador,
  decidir: <T>(decision: Decision<T>) => Promise<T>,
  { guion, jugadores, azar, recientes }: { guion: GuionNarradorVirtual; jugadores: number; azar: Azar; recientes: readonly (readonly string[])[] },
): Promise<{ error: string } | { personajes: string[]; fuera: FueraDeLaBolsa[] }> {
  const paso = async (accion: string, datos?: unknown) => {
    const r = await mesa.accion(accion, datos);
    if (!r.ok) throw new Error(r.error);
  };
  try {
    await paso('narrador:limpiarGrimorio');
    while (sala.asientos().length < jugadores) await paso('narrador:asientos', { cambio: 'añadir' });
    while (sala.asientos().length > jugadores) {
      const asientos = sala.asientos();
      const ultimo = asientos[asientos.length - 1];
      const libre = asientos.slice(0, -1).find((a) => !a.ocupante);
      if (ultimo.ocupante && libre) await paso('narrador:asientos', { cambio: 'mover', desde: ultimo.id, hasta: libre.id });
      await paso('narrador:asientos', { cambio: 'quitar' });
    }
    await paso('narrador:cambiarGuion', { predeterminado: guion });
    await paso('narrador:configurarPartida', { grimorioJugadores: true });
    const personajes = sala.guion()?.personajes ?? [];
    const bolsa = await elegirBolsa(personajes, sala.distribucion(), decidir, { azar, recientes });
    if (!bolsa) return { error: 'No hay reparto para tantos jugadores.' };
    await paso('narrador:llenarBolsa', { personajes: bolsa.personajes });
    return { personajes: bolsa.personajes, fuera: bolsa.fuera };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se ha podido preparar la partida.' };
  }
}

export interface BolsaElegida {
  personajes: string[];
  fuera: FueraDeLaBolsa[];
  /** Los conceptos sorteados y la categoría de cada hueco de aldeano (en orden). */
  conceptos: Conceptos;
  categorias: CategoriaAldeano[];
}

/**
 * La bolsa que elige el narrador, hueco a hueco y como se hace a mano, con un
 * concepto del bien y uno del mal sorteados (ver bolsa/conceptos): primero el
 * demonio y los esbirros (el primero, el del concepto del mal); con ellos ya
 * elegidos, los forasteros que tocan (el Barón suma dos, ver repartoAjustado), con
 * los del concepto por delante; luego los aldeanos, cada hueco con su categoría.
 * Cada hueco es una decisión con unas pocas opciones barajadas y lo ya elegido. No
 * hay grimorio todavía: a la estrategia se le cuentan los personajes del guion y
 * las decisiones anteriores de la bolsa. El Borracho, si sale, no va: en su lugar,
 * el aldeano que cree ser (mejor de información; va en `fuera`). `recientes`: las
 * bolsas de las últimas partidas, para no repetirlas. Sin reparto (menos de 5 jugadores), null.
 */
export async function elegirBolsa(
  personajes: readonly PersonajeDeGuion[],
  distribucion: SalaDistribucion,
  decidir: <T>(decision: Decision<T>) => Promise<T>,
  { azar = Math.random, recientes = [] }: { azar?: Azar; recientes?: readonly (readonly string[])[] } = {},
): Promise<BolsaElegida | null> {
  const { aldeanos, forasteros, esbirros, demonios } = distribucion;
  if (aldeanos === null || forasteros === null || esbirros === null || demonios === null) return null;
  const conceptos = sortearConceptos(azar);
  const favorecida = CONCEPTOS_BIEN[conceptos.bien].categoria;
  const mal = CONCEPTOS_MAL[conceptos.mal];
  const instrucciones = instruccionesBolsa(conceptos, usadosRecientes(recientes, personajes));
  const elegidos: PersonajeDeGuion[] = [];
  // Para Jarvis, en lugar del grimorio (aún no hay): los personajes del guion y lo ya elegido
  const guion = personajes.map(({ id, nombre, tipo, habilidad }) => ({ id, nombre, tipo, habilidad }));
  const anteriores: { pregunta: string; elegido: { id: string; nombre: string; tipo: string } }[] = [];
  const libres = (cumple: (p: PersonajeDeGuion) => boolean) => personajes.filter((p) => cumple(p) && !elegidos.includes(p));
  const deTipo = (tipo: string) => (p: PersonajeDeGuion) => p.tipo === tipo;

  /** Un hueco: `cual`, en palabras; los `preferidos` (los del concepto) pesan más y se marcan. */
  const elegir = async (cual: string, hueco: { tipo: string; categoria?: string }, candidatos: PersonajeDeGuion[], preferidos: readonly string[] = []) => {
    if (!candidatos.length) return null;
    const ya = elegidos.map((p) => p.nombre).join(', ') || 'nada';
    const pregunta = `La partida que vas a narrar, de ${distribucion.jugadores} jugadores: ${cual}. Ya en la bolsa: ${ya}.`;
    const elegido = await decidir({
      motivo: 'bolsa',
      pregunta,
      instrucciones,
      opciones: ofrecer(candidatos, azar, preferidos).map((p) => ({
        clave: p.id,
        descripcion: `${p.nombre} (${p.tipo}): ${p.habilidad}`,
        valor: p,
        ...(preferidos.includes(p.id) ? { rasgos: ['concepto' as const], peso: PESO_PREFERIDO } : {}),
      })),
      sinGrimorio: { guion, hueco, decisionesAnteriores: [...anteriores] },
    });
    elegidos.push(elegido);
    anteriores.push({ pregunta, elegido: { id: elegido.id, nombre: elegido.nombre, tipo: elegido.tipo } });
    return elegido;
  };

  for (let i = 0; i < demonios; i++) await elegir(`el demonio (${i + 1} de ${demonios})`, { tipo: 'demon' }, libres(deTipo('demon')));
  for (let i = 0; i < esbirros; i++) {
    // El primero, el del concepto del mal (si lo tiene el guion)
    const delConcepto = i === 0 ? libres((p) => p.id === mal.esbirro) : [];
    await elegir(`un esbirro (${i + 1} de ${esbirros})`, { tipo: 'minion' }, delConcepto.length ? delConcepto : libres(deTipo('minion')));
  }
  const ajustado = repartoAjustado(distribucion, elegidos.map((p) => p.id));
  const nForasteros = ajustado.forasteros ?? 0;
  for (let i = 0; i < nForasteros; i++) {
    await elegir(`un forastero (${i + 1} de ${nForasteros})`, { tipo: 'outsider' }, libres(deTipo('outsider')), mal.forasteros);
  }
  const fuera = elegidos.filter((p) => p.id in NO_VAN_EN_BOLSA);

  // Los aldeanos, cada uno de su categoría; si ya no queda ninguno de ella, de otra que tenga
  const nAldeanos = ajustado.aldeanos ?? 0;
  const categorias = categoriasDeHuecos(nAldeanos, favorecida, azar);
  const deCategoria = (c: CategoriaAldeano) => (p: PersonajeDeGuion) => p.tipo === 'townsfolk' && CATEGORIAS_ALDEANOS[c].includes(p.id);
  for (let i = 0; i < nAldeanos; i++) {
    if (!libres(deCategoria(categorias[i])).length) {
      const conHueco = (Object.keys(CATEGORIAS_ALDEANOS) as CategoriaAldeano[]).filter((c) => libres(deCategoria(c)).length);
      if (conHueco.length) categorias[i] = otraCategoria(conHueco, favorecida, azar);
    }
    const candidatos = libres(deCategoria(categorias[i]));
    const nombre = NOMBRE_CATEGORIA[categorias[i]];
    await elegir(
      `un aldeano de ${nombre} (${i + 1} de ${nAldeanos})`,
      { tipo: 'townsfolk', categoria: nombre },
      candidatos.length ? candidatos : libres(deTipo('townsfolk')),
    );
  }

  // Lo que cree ser el Borracho: un aldeano más (su ficha va en la bolsa; el de verdad, no), mejor de información
  const creeSer = new Map<string, string>();
  for (const f of fuera) {
    const deInformacion = libres((p) => CATEGORIAS_INFORMACION.some((c) => deCategoria(c)(p)));
    const aldeano = await elegir(
      `lo que cree ser el ${f.nombre}: un aldeano que no está en juego`,
      { tipo: 'townsfolk', categoria: 'lo que cree ser' },
      deInformacion.length ? deInformacion : libres(deTipo('townsfolk')),
    );
    if (aldeano) creeSer.set(f.id, aldeano.id);
  }

  return {
    personajes: elegidos.filter((p) => !(p.id in NO_VAN_EN_BOLSA)).map((p) => p.id),
    fuera: fuera.map((p) => ({ personaje: p.id, creeSer: creeSer.get(p.id) ?? null })),
    conceptos,
    categorias,
  };
}

/** Los personajes de las bolsas recientes (sin el demonio, que es siempre el mismo), los más usados antes. */
function usadosRecientes(recientes: readonly (readonly string[])[], personajes: readonly PersonajeDeGuion[]): string {
  const veces = new Map<string, number>();
  for (const bolsa of recientes) for (const id of new Set(bolsa)) veces.set(id, (veces.get(id) ?? 0) + 1);
  return [...veces]
    .map(([id, n]) => ({ p: personajes.find((x) => x.id === id), n }))
    .filter(({ p }) => p && p.tipo !== 'demon')
    .sort((a, b) => b.n - a.n)
    .map(({ p, n }) => (n > 1 ? `${p!.nombre} (${n} veces)` : p!.nombre))
    .join(', ');
}
