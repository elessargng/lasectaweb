import type { Bolsa } from '../../models/partida/Bolsa';
import type { Participante } from '../../models/sala/Participantes';
import type { SalaDeJuego } from '../../models/SalaDeJuego';
import { UsosSala, type Permiso, type ResultadoUso } from './UsosSala';

/** Llenada al azar: lo que ha salido y no va (con el tipo que falta) y los tipos de los que el guion no tiene bastantes. */
export type ResultadoBolsaAlAzar =
  | { ok: true; fuera: { personaje: string; falta: string }[]; escasos: string[] }
  | { ok: false; error: string };

/** Lo que se puede hacer con la bolsa (son también los nombres que recibe el cliente para pintar sus botones). */
export const USOS_BOLSA = ['bolsa:meter', 'bolsa:cantidad', 'bolsa:vaciar', 'bolsa:llenarAlAzar', 'bolsa:aceptarReparto'] as const;
type UsoBolsa = (typeof USOS_BOLSA)[number] | 'bolsa:llenar';

const SOLO_NARRADOR = 'Solo un narrador puede preparar la bolsa.';

/** Un narrador, con un guion elegido. */
const conGuion: Permiso = ({ partida }, yo) => {
  if (yo.rol !== 'narrador') return SOLO_NARRADOR;
  return partida.guion.actual() ? null : 'Antes hay que elegir un guion.';
};

/** Quién puede hacer cada cosa con la bolsa y, si no, por qué. */
const PERMISOS: Record<UsoBolsa, Permiso> = {
  'bolsa:meter': conGuion,
  'bolsa:cantidad': conGuion,
  'bolsa:vaciar': (_juego, yo) => (yo.rol === 'narrador' ? null : SOLO_NARRADOR),
  'bolsa:llenarAlAzar': conGuion,
  'bolsa:llenar': conGuion,
  'bolsa:aceptarReparto': (_juego, yo) => (yo.rol === 'narrador' ? null : 'Solo un narrador da por bueno el reparto.'),
};

/**
 * Los casos de uso de la bolsa de la sala: quién puede hacer qué, se lo pide a la
 * bolsa de la partida (models/partida/Bolsa, donde están las reglas) y, si cambia,
 * avisa para que la sala se mande a todos.
 */
export class BolsaService {
  private readonly usos: UsosSala<UsoBolsa>;

  constructor(
    private readonly juego: SalaDeJuego,
    /** La sala ha cambiado: se manda a todos. */
    alCambiar: () => void,
  ) {
    this.usos = new UsosSala(juego, PERMISOS, alCambiar);
  }

  /** El participante de una sesión (su id), o null si ya no está en la sala. */
  quienEs(clave: string): string | null {
    return this.usos.quienEs(clave);
  }

  /** Lo que puede hacer ahora con la bolsa (para que el cliente pinte sus botones). */
  permitidas(yo: Participante): string[] {
    return this.usos.permitidos(yo, USOS_BOLSA);
  }

  /** Mete en la bolsa un personaje del guion, o lo saca si ya estaba. */
  meter(yoId: string, personajeId: string): ResultadoUso {
    return this.hacer(yoId, 'bolsa:meter', (bolsa) => bolsa.meterOSacar(personajeId));
  }

  /** Cuántas fichas de un personaje hay en la bolsa (0 lo saca). */
  cantidad(yoId: string, personajeId: string, cantidad: number): ResultadoUso {
    return this.hacer(yoId, 'bolsa:cantidad', (bolsa) => bolsa.ponerEnBolsa(personajeId, cantidad));
  }

  /** Vacía la bolsa (también los viajeros). */
  vaciar(yoId: string): ResultadoUso {
    return this.hacer(yoId, 'bolsa:vaciar', (bolsa) => {
      bolsa.vaciar();
      return null;
    });
  }

  /** Llena la bolsa con estos personajes (el narrador virtual, con los que ha elegido). */
  llenar(yoId: string, personajes: readonly string[]): ResultadoUso {
    return this.hacer(yoId, 'bolsa:llenar', (bolsa) => bolsa.llenar(personajes));
  }

  /** Llena la bolsa al azar con los personajes del guion. */
  llenarAlAzar(yoId: string): ResultadoBolsaAlAzar {
    let sorteo: { fuera: { personaje: string; falta: string }[]; escasos: string[] } = { fuera: [], escasos: [] };
    const hecho = this.hacer(yoId, 'bolsa:llenarAlAzar', (bolsa) => {
      const r = bolsa.llenarAlAzar();
      if ('error' in r) return r.error;
      sorteo = { fuera: r.fuera.map(({ personaje, falta }) => ({ personaje: personaje.id, falta })), escasos: r.escasos };
      return null;
    });
    return hecho.ok ? { ok: true, ...sorteo } : hecho;
  }

  /** Da por bueno el reparto aunque no cuadre (su firma), o deja de darlo (null). */
  aceptarReparto(yoId: string, firma: string | null): ResultadoUso {
    return this.hacer(yoId, 'bolsa:aceptarReparto', (bolsa) => {
      bolsa.aceptarSetup(firma);
      return null;
    });
  }

  /** Con la bolsa de la partida. */
  private hacer(yoId: string, uso: UsoBolsa, accion: (bolsa: Bolsa) => string | null): ResultadoUso {
    return this.usos.hacer(yoId, uso, () => accion(this.juego.partida.bolsa));
  }
}
