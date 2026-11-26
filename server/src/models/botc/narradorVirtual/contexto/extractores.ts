import type { MotivoDecision } from '../estrategias/EstrategiaNarrador';
import type { FotoPartida } from './FotoPartida';

/**
 * Lo que se le cuenta a la estrategia (al modelo de Jarvis) para cada decisión:
 * no la partida entera, sino lo que sirve para esa decisión, sacado de la foto de
 * la partida (patrón Extractor). Cada motivo dice qué piezas lleva; cada pieza
 * sabe sacarse de la foto. Solo datos.
 */

/** Las piezas que se pueden contar de la partida. */
type Pieza = 'plaza' | 'sujeto' | 'noches' | 'despertares' | 'muertes' | 'votaciones' | 'faroles' | 'personajes' | 'ventaja';

/** Cada asiento en corto: quién es, su bando, si vive y cómo está. */
const plaza = (foto: FotoPartida) =>
  foto.grimorio.asientos.map(({ numero, nombre, ocupado, personaje, tipo, ficha, alineamiento, vivo, droison, votoGastado, recordatorios }) => ({
    numero,
    nombre,
    ...(ocupado ? {} : { libre: true }),
    personaje,
    tipo,
    ...(ficha ? { ficha } : {}),
    alineamiento,
    vivo,
    ...(droison ? { droison } : {}),
    ...(!vivo && votoGastado ? { votoGastado } : {}),
    ...(recordatorios.length ? { recordatorios: recordatorios.map((r) => r.texto) } : {}),
  }));

/** Cómo se saca cada pieza de la foto (`sujeto`: el número del asiento del que trata la decisión). */
const PIEZAS: Record<Pieza, (foto: FotoPartida, sujeto: number | null) => unknown> = {
  plaza,
  // Todo lo de ese asiento: cómo está, lo hablado esta noche y su historia
  sujeto: (foto, sujeto) => {
    if (sujeto === null) return undefined;
    const asiento = foto.grimorio.asientos.find((a) => a.numero === sujeto);
    if (!asiento) return undefined;
    return {
      ...asiento,
      noches: foto.noches[sujeto] ?? [],
      ...(foto.personajesAntes[sujeto] ? { personajes: foto.personajesAntes[sujeto] } : {}),
      muerte: foto.muertes.find((m) => m.asiento === sujeto) ?? null,
    };
  },
  noches: (foto) => foto.noches,
  despertares: (foto) =>
    Object.fromEntries(foto.grimorio.asientos.filter((a) => a.despertar.length).map((a) => [a.numero, a.despertar])),
  muertes: (foto) => foto.muertes,
  votaciones: (foto) => foto.grimorio.votaciones,
  faroles: (foto) => ({
    demonio: foto.grimorio.farolesDemonio,
    malvados: foto.grimorio.asientos.filter((a) => a.faroles).map((a) => ({ numero: a.numero, faroles: a.faroles, farolEnUso: a.farolEnUso ?? null })),
  }),
  personajes: (foto) => foto.grimorio.personajes,
  ventaja: (foto) => foto.ventajaDelMal,
};

/** Lo que lleva cada decisión (además de la fase y lo que traiga la propia decisión en sus datos). */
const POR_MOTIVO: Record<MotivoDecision, Pieza[]> = {
  bolsa: [],
  creeSerOtro: ['plaza', 'sujeto', 'personajes', 'faroles'],
  asientoLibre: ['plaza', 'sujeto', 'despertares', 'muertes'],
  nuevoImp: ['plaza', 'muertes', 'votaciones', 'ventaja'],
  farol: ['plaza', 'personajes', 'faroles'],
  redHerring: ['plaza', 'ventaja'],
  correcto: ['plaza', 'sujeto'],
  incorrecto: ['plaza', 'sujeto', 'faroles', 'ventaja'],
  revision: ['plaza', 'sujeto', 'despertares', 'ventaja'],
  droisonVerdad: ['plaza', 'sujeto', 'faroles', 'ventaja'],
  informacionFalsa: ['plaza', 'sujeto', 'faroles', 'ventaja'],
  desenlace: ['plaza', 'muertes', 'ventaja'],
  registraComoAldeano: ['plaza', 'muertes', 'ventaja'],
  registraComoDemonio: ['plaza', 'muertes', 'ventaja'],
  violinistaBueno: ['plaza', 'votaciones', 'muertes'],
  artista: ['plaza', 'sujeto', 'noches', 'muertes', 'votaciones', 'personajes'],
  artistaSinHabilidad: ['plaza', 'sujeto', 'ventaja'],
  patoso: ['plaza', 'sujeto', 'votaciones', 'muertes'],
};

/**
 * Lo que se le cuenta a la estrategia para una decisión: la fase y las piezas de su
 * motivo (las que salen vacías no van), y los datos que traiga la decisión. `sujeto`:
 * el id del asiento del que trata.
 */
export function contextoPara(
  motivo: MotivoDecision,
  foto: FotoPartida,
  { sujeto, datos }: { sujeto?: string; datos?: Record<string, unknown> } = {},
): Record<string, unknown> {
  const numero = sujeto ? (foto.numeros[sujeto] ?? null) : null;
  const piezas = POR_MOTIVO[motivo].flatMap((p) => {
    const valor = PIEZAS[p](foto, numero);
    return valor === undefined ? [] : [[p, valor] as const];
  });
  return { ...(motivo === 'bolsa' ? {} : { fase: foto.grimorio.fase }), ...Object.fromEntries(piezas), ...datos };
}
