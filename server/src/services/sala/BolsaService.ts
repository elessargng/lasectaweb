import type { Bolsa } from '../../models/partida/Bolsa';
import type { Participante } from '../../models/sala/Participantes';
import type { SalaDeJuego } from '../../models/SalaDeJuego';

/** Lo que contesta la bolsa: hecho o no, y por qué. */
export type ResultadoBolsa = { ok: true } | { ok: false; error: string };

/** Llenada al azar: lo que ha salido y no va (con el tipo que falta) y los tipos de los que el guion no tiene bastantes. */
export type ResultadoBolsaAlAzar =
  | { ok: true; fuera: { personaje: string; falta: string }[]; escasos: string[] }
  | { ok: false; error: string };

/** Lo que se puede hacer con la bolsa (son también los nombres que recibe el cliente para pintar sus botones). */
export const USOS_BOLSA = ['bolsa:meter', 'bolsa:cantidad', 'bolsa:vaciar', 'bolsa:llenarAlAzar', 'bolsa:aceptarReparto'] as const;
type UsoBolsa = (typeof USOS_BOLSA)[number] | 'bolsa:llenar';

const SOLO_NARRADOR = 'Solo un narrador puede preparar la bolsa.';

/** Quién puede hacer cada cosa con la bolsa y, si no, por qué. */
const PERMISOS: Record<UsoBolsa, (juego: SalaDeJuego, yo: Participante) => string | null> = {
  'bolsa:meter': (juego, yo) => conGuion(juego, yo),
  'bolsa:cantidad': (juego, yo) => conGuion(juego, yo),
  'bolsa:vaciar': (_juego, yo) => (yo.rol === 'narrador' ? null : SOLO_NARRADOR),
  'bolsa:llenarAlAzar': (juego, yo) => conGuion(juego, yo),
  'bolsa:llenar': (juego, yo) => conGuion(juego, yo),
  'bolsa:aceptarReparto': (_juego, yo) => (yo.rol === 'narrador' ? null : 'Solo un narrador da por bueno el reparto.'),
};

/** Un narrador, con un guion elegido. */
function conGuion({ partida }: SalaDeJuego, yo: Participante): string | null {
  if (yo.rol !== 'narrador') return SOLO_NARRADOR;
  return partida.guion.actual() ? null : 'Antes hay que elegir un guion.';
}

/**
 * Los casos de uso de la bolsa de la sala: quién puede hacer qué, se lo pide a la
 * bolsa de la partida (models/partida/Bolsa, donde están las reglas) y, si cambia,
 * avisa para que la sala se mande a todos.
 */
export class BolsaService {
  constructor(
    private readonly juego: SalaDeJuego,
    /** La sala ha cambiado: se manda a todos. */
    private readonly alCambiar: () => void,
    private readonly azar: () => number = Math.random,
  ) {}

  /** El participante de una sesión (su id), o null si ya no está en la sala. */
  quienEs(clave: string): string | null {
    return this.juego.sala.participantes.participanteDe(clave)?.id ?? null;
  }

  /** Lo que puede hacer ahora con la bolsa (para que el cliente pinte sus botones). */
  permitidas(yo: Participante): string[] {
    return USOS_BOLSA.filter((uso) => PERMISOS[uso](this.juego, yo) === null);
  }

  /** Mete en la bolsa un personaje del guion, o lo saca si ya estaba. */
  meter(yoId: string, personajeId: string): ResultadoBolsa {
    return this.hacer(yoId, 'bolsa:meter', (bolsa) => bolsa.meterOSacar(personajeId));
  }

  /** Cuántas fichas de un personaje hay en la bolsa (0 lo saca). */
  cantidad(yoId: string, personajeId: string, cantidad: number): ResultadoBolsa {
    return this.hacer(yoId, 'bolsa:cantidad', (bolsa) => bolsa.ponerEnBolsa(personajeId, cantidad));
  }

  /** Vacía la bolsa (también los viajeros). */
  vaciar(yoId: string): ResultadoBolsa {
    return this.hacer(yoId, 'bolsa:vaciar', (bolsa) => {
      bolsa.vaciar();
      return null;
    });
  }

  /** Llena la bolsa con estos personajes (el narrador virtual, con los que ha elegido). */
  llenar(yoId: string, personajes: readonly string[]): ResultadoBolsa {
    return this.hacer(yoId, 'bolsa:llenar', (bolsa) => bolsa.llenar(personajes));
  }

  /** Llena la bolsa al azar con los personajes del guion. */
  llenarAlAzar(yoId: string): ResultadoBolsaAlAzar {
    let sorteo: { fuera: { personaje: string; falta: string }[]; escasos: string[] } = { fuera: [], escasos: [] };
    const hecho = this.hacer(yoId, 'bolsa:llenarAlAzar', (bolsa) => {
      const r = bolsa.llenarAlAzar(this.azar);
      if ('error' in r) return r.error;
      sorteo = { fuera: r.fuera.map(({ personaje, falta }) => ({ personaje: personaje.id, falta })), escasos: r.escasos };
      return null;
    });
    return hecho.ok ? { ok: true, ...sorteo } : hecho;
  }

  /** Da por bueno el reparto aunque no cuadre (su firma), o deja de darlo (null). */
  aceptarReparto(yoId: string, firma: string | null): ResultadoBolsa {
    return this.hacer(yoId, 'bolsa:aceptarReparto', (bolsa) => {
      bolsa.aceptarSetup(firma);
      return null;
    });
  }

  /** Si puede, lo hace con la bolsa de la partida; si sale bien, avisa del cambio. */
  private hacer(yoId: string, uso: UsoBolsa, accion: (bolsa: Bolsa) => string | null): ResultadoBolsa {
    const yo = this.juego.sala.participantes.buscar(yoId);
    if (!yo) return { ok: false, error: 'No estás en la sala.' };
    const noPuede = PERMISOS[uso](this.juego, yo);
    if (noPuede) return { ok: false, error: noPuede };
    const error = accion(this.juego.partida.bolsa);
    if (error) return { ok: false, error };
    this.alCambiar();
    return { ok: true };
  }
}
