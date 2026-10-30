import { randomUUID } from 'crypto';
import { RECORDATORIO_TEXTO, type SalaAlineamiento, type SalaAsiento, type SalaRecordatorio } from '../../contrato/sala';
import type { AsientoDiario, HechoDiario } from '../../contrato/diario';
import type { PersonajeDeGuion } from '../../types/guiones';
import type { Asiento } from '../sala/Sala';

/**
 * La ficha de un asiento de la mesa: lo que es de la partida (personaje, muerte,
 * calavera, recordatorios…). Cada asiento tiene la suya, haya alguien sentado o no.
 */
export type Ficha = Pick<
  SalaAsiento,
  'muerto' | 'muertePendiente' | 'votoGastado' | 'marcado' | 'votosMarca' | 'personaje' | 'alineamiento' | 'recordatorios' | 'nota'
>;

/** Una ficha como al principio: viva, sin personaje, sin calavera y sin recordatorios. */
const fichaNueva = (): Ficha => ({
  muerto: false,
  muertePendiente: false,
  votoGastado: false,
  marcado: false,
  votosMarca: null,
  personaje: null,
  alineamiento: null,
  recordatorios: [],
  nota: null,
});

/**
 * Un recordatorio «Is The …» (el del Borracho, el Alquimista, el Filósofo, la
 * Marioneta o el Aprendiz): dice quién es de verdad el de esa ficha, aunque
 * lleve otro personaje (el que cree ser, o la habilidad que tiene).
 */
export const esRecordatorioDeIdentidad = (texto: string) => /^is the\b/i.test(texto.trim());
/** Lo mismo con un recordatorio puesto: uno con texto propio nunca lo es (lo escribe el narrador). */
const esIdentidad = (r: SalaRecordatorio) => r.personaje !== RECORDATORIO_TEXTO && esRecordatorioDeIdentidad(r.texto);

/**
 * Quién es de verdad el de una ficha: el personaje de su recordatorio «Is The …»
 * (el último, si hay varios) o, sin él, el de su ficha. Es lo que cuenta para el
 * reparto; la ficha, para su habilidad (el orden de noche).
 */
export function identidadDe(ficha: Pick<Ficha, 'personaje' | 'recordatorios'>): string | null {
  const r = [...ficha.recordatorios].reverse().find(esIdentidad);
  return r?.personaje ?? ficha.personaje;
}

/**
 * Al anunciar una muerte de noche, el «Dead» con el que la marcó quien lo mató (el
 * demonio, el Asesino…) ya no hace falta: se quita (no los de texto propio).
 */
function quitarMarcaDeMuerte(ficha: Ficha): void {
  ficha.recordatorios = ficha.recordatorios.filter((r) => r.personaje === RECORDATORIO_TEXTO || !/^dead$/i.test(r.texto.trim()));
}

/** Lo que el grimorio necesita saber de la sala y de la partida. */
export interface EntornoGrimorio {
  /** Los asientos de la mesa, en orden. */
  asientos(): Asiento[];
  /** Un personaje del guion (o del catálogo). */
  personaje(id: string): PersonajeDeGuion | undefined;
  /** Es de noche: las muertes quedan pendientes. */
  noche(): boolean;
  /** Para el diario de la partida. */
  anotar(hecho: HechoDiario): void;
  asientoDiario(asientoId: string): AsientoDiario;
}

/**
 * El grimorio: la ficha de cada asiento de la mesa y lo que el narrador (o las
 * reglas) hacen con ellas. No comprueba permisos ni que el personaje esté en el guion.
 */
export class Grimorio {
  private porAsiento = new Map<string, Ficha>();

  constructor(private readonly entorno: EntornoGrimorio) {}

  /** La ficha de un asiento, para leerla (la de un asiento nuevo, como al principio). */
  ficha(asientoId: string): Readonly<Ficha> {
    return this.de(asientoId);
  }

  private de(asientoId: string): Ficha {
    let ficha = this.porAsiento.get(asientoId);
    if (!ficha) this.porAsiento.set(asientoId, (ficha = fichaNueva()));
    return ficha;
  }

  /** La ficha de un asiento que existe, para cambiarla; null si el asiento no existe. */
  private existente(asientoId: string): Ficha | null {
    return this.entorno.asientos().some((a) => a.id === asientoId) ? this.de(asientoId) : null;
  }

  /** Las fichas de la mesa, en orden. */
  private todas(): Ficha[] {
    return this.entorno.asientos().map((a) => this.de(a.id));
  }

  /**
   * El alineamiento de una ficha: el que haya puesto el narrador o, si no, el del
   * tipo de quien es de verdad (aldeanos y forasteros, buenos; esbirros y
   * demonios, malvados). Un viajero sin alineamiento puesto: null.
   */
  alineamiento(ficha: Pick<Ficha, 'alineamiento' | 'personaje' | 'recordatorios'>): SalaAlineamiento | null {
    if (ficha.alineamiento) return ficha.alineamiento;
    const id = identidadDe(ficha);
    const tipo = id ? this.entorno.personaje(id)?.tipo : undefined;
    if (tipo === 'townsfolk' || tipo === 'outsider') return 'bueno';
    if (tipo === 'minion' || tipo === 'demon') return 'malvado';
    return null;
  }

  /**
   * Pone un personaje en la ficha de un asiento (o se lo quita, con null). El
   * alineamiento vuelve a ser el de su tipo.
   */
  cambiarPersonaje(asientoId: string, personaje: string | null): void {
    const ficha = this.existente(asientoId);
    if (!ficha) return;
    ficha.personaje = personaje;
    ficha.alineamiento = null;
    this.identidadAutomatica(ficha);
    this.entorno.anotar({ tipo: 'personaje', asiento: this.entorno.asientoDiario(asientoId), personaje });
  }

  /**
   * Un reparto nuevo: el personaje que le toca, con el alineamiento de su tipo. Quién
   * era cada uno (los «Is The …» del reparto anterior) ya no vale.
   */
  repartir(asientoId: string, personaje: string | null): void {
    const ficha = this.de(asientoId);
    ficha.personaje = personaje;
    ficha.alineamiento = null;
    ficha.recordatorios = ficha.recordatorios.filter((r) => !esIdentidad(r));
    this.identidadAutomatica(ficha);
  }

  /**
   * Al poner un viajero que lleva su propio «Is The …» (el Aprendiz), se le pone
   * solo: luego el narrador le cambia la ficha por la habilidad que gana y sigue
   * sabiéndose quién es.
   */
  private identidadAutomatica(ficha: Ficha): void {
    const p = ficha.personaje ? this.entorno.personaje(ficha.personaje) : undefined;
    if (!p || p.tipo !== 'traveller') return;
    const indice = p.recordatorios.findIndex(esRecordatorioDeIdentidad);
    if (indice < 0) return;
    if (ficha.recordatorios.some((r) => r.personaje === p.id && r.indice === indice)) return;
    ficha.recordatorios.push({ id: randomUUID(), personaje: p.id, indice, texto: p.recordatorios[indice] });
  }

  /**
   * Intercambia el personaje y el alineamiento de dos fichas (con el Gardener, el
   * narrador decide quién tiene qué). Lo demás (muerte, calavera, recordatorios)
   * es del asiento y se queda.
   */
  intercambiarFichas(desdeId: string, hastaId: string): void {
    if (desdeId === hastaId) return;
    const desde = this.existente(desdeId);
    const hasta = this.existente(hastaId);
    if (!desde || !hasta) return;
    [desde.personaje, hasta.personaje] = [hasta.personaje, desde.personaje];
    [desde.alineamiento, hasta.alineamiento] = [hasta.alineamiento, desde.alineamiento];
  }

  /** Pone una ficha recordatorio junto a la de un asiento (y lo apunta en el diario, si `anotar`). */
  ponerRecordatorio(asientoId: string, recordatorio: Omit<SalaRecordatorio, 'id'>, { anotar = true }: { anotar?: boolean } = {}): void {
    const ficha = this.existente(asientoId);
    if (!ficha) return;
    ficha.recordatorios.push({ id: randomUUID(), ...recordatorio });
    if (!anotar) return;
    const { personaje, texto } = recordatorio;
    this.entorno.anotar({ tipo: 'recordatorio', asiento: this.entorno.asientoDiario(asientoId), personaje, texto, quitado: false });
  }

  /** Quita una ficha recordatorio. */
  quitarRecordatorio(asientoId: string, recordatorioId: string): void {
    const ficha = this.existente(asientoId);
    const quitado = ficha?.recordatorios.find((r) => r.id === recordatorioId);
    if (!ficha || !quitado) return;
    ficha.recordatorios = ficha.recordatorios.filter((r) => r !== quitado);
    const { personaje, texto } = quitado;
    this.entorno.anotar({ tipo: 'recordatorio', asiento: this.entorno.asientoDiario(asientoId), personaje, texto, quitado: true });
  }

  /** Quita de todas las fichas los recordatorios de ese personaje con ese índice (sin apuntarlo en el diario). */
  quitarDeTodas(personaje: string, indice: number): void {
    for (const ficha of this.todas()) {
      ficha.recordatorios = ficha.recordatorios.filter((r) => !(r.personaje === personaje && r.indice === indice));
    }
  }

  /**
   * Cada recordatorio de un personaje es único: el que hay que quitar al poner
   * otro igual en un asiento. Si el personaje tiene varios con el mismo texto,
   * solo cuando ya están todos en la mesa. Antes uno de otro asiento que uno de
   * este. null: no hay que quitar ninguno.
   */
  recordatorioQueSobra(asientoId: string, personajeId: string, indice: number): { asientoId: string; recordatorioId: string } | null {
    const textos = this.entorno.personaje(personajeId)?.recordatorios ?? [];
    const texto = textos[indice];
    if (texto === undefined) return null;
    const iguales = new Set(textos.flatMap((t, i) => (t === texto ? [i] : [])));
    const puestos = this.entorno.asientos().flatMap((a) =>
      this.de(a.id)
        .recordatorios.filter((r) => r.personaje === personajeId && iguales.has(r.indice))
        .map((r) => ({ asientoId: a.id, recordatorioId: r.id })),
    );
    if (puestos.length < iguales.size) return null;
    return puestos.find((p) => p.asientoId !== asientoId) ?? puestos[0];
  }

  /**
   * Escribe la nota de un asiento (sustituye la que hubiera); con null, la borra.
   * Devuelve false si el asiento no existe.
   */
  escribirNota(asientoId: string, texto: string | null): boolean {
    const ficha = this.existente(asientoId);
    if (!ficha) return false;
    ficha.nota = texto;
    return true;
  }

  /** Cambia el alineamiento de la ficha de un asiento. */
  cambiarAlineamiento(asientoId: string, alineamiento: SalaAlineamiento): void {
    const ficha = this.existente(asientoId);
    if (!ficha) return;
    ficha.alineamiento = alineamiento;
    this.entorno.anotar({ tipo: 'alineamiento', asiento: this.entorno.asientoDiario(asientoId), alineamiento });
  }

  /**
   * Mata o revive la ficha de un asiento; al morir pierde la calavera. De noche,
   * la muerte queda pendiente (solo la ven quienes ven el grimorio) hasta que el
   * narrador la hace efectiva (confirmarMuerte). Revivir quita también la pendiente.
   */
  cambiarVida(asientoId: string, muerto: boolean, { anotar = true }: { anotar?: boolean } = {}): void {
    const ficha = this.existente(asientoId);
    if (!ficha) return;
    // Para el diario, muere cuando se le pone la muerte (de noche, aunque se anuncie después)
    const estabaMuerto = ficha.muerto || ficha.muertePendiente;
    if (anotar && estabaMuerto !== muerto) {
      this.entorno.anotar({ tipo: muerto ? 'muere' : 'revive', asiento: this.entorno.asientoDiario(asientoId) });
    }
    if (muerto && this.entorno.noche() && !ficha.muerto) {
      ficha.muertePendiente = true;
      return;
    }
    if (muerto && ficha.muertePendiente) quitarMarcaDeMuerte(ficha);
    // Al morir (o revivir) tiene su voto
    if (ficha.muerto !== muerto) ficha.votoGastado = false;
    ficha.muerto = muerto;
    ficha.muertePendiente = false;
    if (muerto) {
      ficha.marcado = false;
      ficha.votosMarca = null;
    }
  }

  /**
   * Hace efectiva una muerte pendiente (el narrador la anuncia): ya la ven todos, y
   * se le quita el «Dead» de quien lo mató (ya no hace falta).
   */
  confirmarMuerte(asientoId: string): boolean {
    const ficha = this.existente(asientoId);
    if (!ficha?.muertePendiente) return false;
    quitarMarcaDeMuerte(ficha);
    ficha.muertePendiente = false;
    ficha.muerto = true;
    ficha.votoGastado = false;
    ficha.marcado = false;
    ficha.votosMarca = null;
    return true;
  }

  /** Quita o devuelve el voto a la ficha de un muerto. Devuelve false si no está muerta. */
  cambiarVoto(asientoId: string, gastado: boolean): boolean {
    const ficha = this.existente(asientoId);
    if (!ficha?.muerto) return false;
    ficha.votoGastado = gastado;
    return true;
  }

  /** El Barquero: todos los muertos recuperan su voto. Devuelve cuántos lo recuperan. */
  devolverVotos(): number {
    const sinVoto = this.todas().filter((f) => f.muerto && f.votoGastado);
    for (const ficha of sinVoto) ficha.votoGastado = false;
    return sinVoto.length;
  }

  /** Pone o quita la calavera a la ficha de un asiento. Solo puede llevarla una: ponérsela se la quita a las demás. */
  marcar(asientoId: string, marcado: boolean, votos: number | null = null): void {
    if (marcado) this.desmarcar();
    const ficha = this.existente(asientoId);
    if (!ficha) return;
    ficha.marcado = marcado;
    ficha.votosMarca = marcado ? votos : null;
  }

  /** Quita la calavera a quien la lleve. */
  desmarcar(): void {
    for (const ficha of this.todas()) {
      ficha.marcado = false;
      ficha.votosMarca = null;
    }
  }

  /** Si alguna ficha lleva la calavera. */
  hayMarca(): boolean {
    return this.todas().some((f) => f.marcado);
  }

  /** Se ha quitado el asiento: su ficha, con él. */
  olvidar(asientoId: string): void {
    this.porAsiento.delete(asientoId);
  }

  /** Otra partida: todas las fichas como al principio. */
  limpiar(): void {
    this.porAsiento.clear();
  }

  /** Los asientos han cambiado de sitio (ver Sala.alMover): cada ficha va con su jugador. */
  remapear(a: (asientoId: string) => string): void {
    this.porAsiento = new Map([...this.porAsiento].map(([k, v]) => [a(k), v] as const));
  }
}
