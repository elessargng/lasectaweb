import { randomUUID } from 'crypto';
import { RECORDATORIO_TEXTO, type SalaAlineamiento, type SalaRecordatorio } from '../../contrato/sala';
import type { AsientoDiario, HechoDiario } from '../../contrato/diario';
import type { PersonajeDeGuion } from '../../types/guiones';
import type { Jugador } from './Jugador';

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
export function identidadDe(ficha: Pick<Jugador, 'personaje' | 'recordatorios'>): string | null {
  const r = [...ficha.recordatorios].reverse().find(esIdentidad);
  return r?.personaje ?? ficha.personaje;
}

/**
 * Al anunciar una muerte de noche, el «Dead» con el que la marcó quien lo mató (el
 * demonio, el Asesino…) ya no hace falta: se quita (no los de texto propio).
 */
function quitarMarcaDeMuerte(jugador: Jugador): void {
  jugador.recordatorios = jugador.recordatorios.filter((r) => r.personaje === RECORDATORIO_TEXTO || !/^dead$/i.test(r.texto.trim()));
}

/** Lo que el grimorio necesita saber de la sala y de la partida. */
export interface EntornoGrimorio {
  /** Los jugadores de la plaza, en orden. */
  jugadores(): Jugador[];
  /** Un personaje del guion (o del catálogo). */
  personaje(id: string): PersonajeDeGuion | undefined;
  /** Es de noche: las muertes quedan pendientes. */
  noche(): boolean;
  /** Para el diario de la partida. */
  anotar(hecho: HechoDiario): void;
  asientoDiario(jugadorId: string): AsientoDiario;
}

/**
 * El grimorio: lo que el narrador (o las reglas) hacen con los jugadores de la
 * plaza (darles personaje, recordatorios, matarlos…), la nota del narrador sobre
 * cada uno y la calavera.
 * No comprueba permisos ni que el personaje esté en el guion.
 */
export class Grimorio {
  /** La nota del narrador sobre cada jugador (por su id). */
  private notas = new Map<string, string>();
  /** Quién lleva la calavera (solo uno en la plaza) y con cuántos votos se le puso. */
  private conCalavera: { jugador: string; votos: number | null } | null = null;

  constructor(private readonly entorno: EntornoGrimorio) {}

  /** La nota del narrador sobre un jugador, o null. */
  nota(jugadorId: string): string | null {
    return this.notas.get(jugadorId) ?? null;
  }

  /** Un jugador de la plaza, o null si ya no está. */
  private jugador(jugadorId: string): Jugador | null {
    return this.entorno.jugadores().find((j) => j.id === jugadorId) ?? null;
  }

  /**
   * El alineamiento de una ficha: el que haya puesto el narrador o, si no, el del
   * tipo de quien es de verdad (aldeanos y forasteros, buenos; esbirros y
   * demonios, malvados). Un viajero sin alineamiento puesto: null.
   */
  alineamiento(ficha: Pick<Jugador, 'alineamiento' | 'personaje' | 'recordatorios'>): SalaAlineamiento | null {
    if (ficha.alineamiento) return ficha.alineamiento;
    const id = identidadDe(ficha);
    const tipo = id ? this.entorno.personaje(id)?.tipo : undefined;
    if (tipo === 'townsfolk' || tipo === 'outsider') return 'bueno';
    if (tipo === 'minion' || tipo === 'demon') return 'malvado';
    return null;
  }

  /**
   * Pone un personaje al jugador de un asiento (o se lo quita, con null). El
   * alineamiento vuelve a ser el de su tipo.
   */
  cambiarPersonaje(jugadorId: string, personaje: string | null): void {
    const jugador = this.jugador(jugadorId);
    if (!jugador) return;
    jugador.personaje = personaje;
    jugador.alineamiento = null;
    this.identidadAutomatica(jugador);
    this.entorno.anotar({ tipo: 'personaje', asiento: this.entorno.asientoDiario(jugadorId), personaje });
  }

  /**
   * Un reparto nuevo: el personaje que le toca, con el alineamiento de su tipo. Quién
   * era cada uno (los «Is The …» del reparto anterior) ya no vale.
   */
  repartir(jugadorId: string, personaje: string | null): void {
    const jugador = this.jugador(jugadorId);
    if (!jugador) return;
    jugador.personaje = personaje;
    jugador.alineamiento = null;
    jugador.recordatorios = jugador.recordatorios.filter((r) => !esIdentidad(r));
    this.identidadAutomatica(jugador);
  }

  /**
   * Al poner un viajero que lleva su propio «Is The …» (el Aprendiz), se le pone
   * solo: luego el narrador le cambia la ficha por la habilidad que gana y sigue
   * sabiéndose quién es.
   */
  private identidadAutomatica(jugador: Jugador): void {
    const p = jugador.personaje ? this.entorno.personaje(jugador.personaje) : undefined;
    if (!p || p.tipo !== 'traveller') return;
    const indice = p.recordatorios.findIndex(esRecordatorioDeIdentidad);
    if (indice < 0) return;
    const { recordatorios } = jugador;
    if (recordatorios.some((r) => r.personaje === p.id && r.indice === indice)) return;
    recordatorios.push({ id: randomUUID(), personaje: p.id, indice, texto: p.recordatorios[indice] });
  }

  /**
   * Intercambia el personaje y el alineamiento de dos jugadores (con el Gardener, el
   * narrador decide quién tiene qué). Lo demás (muerte, calavera, recordatorios) se queda.
   */
  intercambiarFichas(desdeId: string, hastaId: string): void {
    if (desdeId === hastaId) return;
    const desde = this.jugador(desdeId);
    const hasta = this.jugador(hastaId);
    if (!desde || !hasta) return;
    [desde.personaje, hasta.personaje] = [hasta.personaje, desde.personaje];
    [desde.alineamiento, hasta.alineamiento] = [hasta.alineamiento, desde.alineamiento];
  }

  /** Pone una ficha recordatorio junto al jugador de un asiento (y lo apunta en el diario, si `anotar`). */
  ponerRecordatorio(jugadorId: string, recordatorio: Omit<SalaRecordatorio, 'id'>, { anotar = true }: { anotar?: boolean } = {}): void {
    const jugador = this.jugador(jugadorId);
    if (!jugador) return;
    jugador.recordatorios.push({ id: randomUUID(), ...recordatorio });
    if (!anotar) return;
    const { personaje, texto } = recordatorio;
    this.entorno.anotar({ tipo: 'recordatorio', asiento: this.entorno.asientoDiario(jugadorId), personaje, texto, quitado: false });
  }

  /** Quita una ficha recordatorio. */
  quitarRecordatorio(jugadorId: string, recordatorioId: string): void {
    const jugador = this.jugador(jugadorId);
    const quitado = jugador?.recordatorios.find((r) => r.id === recordatorioId);
    if (!jugador || !quitado) return;
    jugador.recordatorios = jugador.recordatorios.filter((r) => r !== quitado);
    const { personaje, texto } = quitado;
    this.entorno.anotar({ tipo: 'recordatorio', asiento: this.entorno.asientoDiario(jugadorId), personaje, texto, quitado: true });
  }

  /** Quita de toda la plaza los recordatorios de ese personaje con ese índice (sin apuntarlo en el diario). */
  quitarDeTodas(personaje: string, indice: number): void {
    for (const jugador of this.entorno.jugadores()) {
      jugador.recordatorios = jugador.recordatorios.filter((r) => !(r.personaje === personaje && r.indice === indice));
    }
  }

  /**
   * Cada recordatorio de un personaje es único: el que hay que quitar al poner
   * otro igual en un asiento. Si el personaje tiene varios con el mismo texto,
   * solo cuando ya están todos en la plaza. Antes uno de otro asiento que uno de
   * este. null: no hay que quitar ninguno.
   */
  recordatorioQueSobra(jugadorId: string, personajeId: string, indice: number): { jugadorId: string; recordatorioId: string } | null {
    const textos = this.entorno.personaje(personajeId)?.recordatorios ?? [];
    const texto = textos[indice];
    if (texto === undefined) return null;
    const iguales = new Set(textos.flatMap((t, i) => (t === texto ? [i] : [])));
    const puestos = this.entorno.jugadores().flatMap((j) =>
      j.recordatorios.filter((r) => r.personaje === personajeId && iguales.has(r.indice))
        .map((r) => ({ jugadorId: j.id, recordatorioId: r.id })),
    );
    if (puestos.length < iguales.size) return null;
    return puestos.find((p) => p.jugadorId !== jugadorId) ?? puestos[0];
  }

  /**
   * Escribe la nota del jugador de un asiento (sustituye la que hubiera); con null, la borra.
   * Devuelve false si el asiento no existe.
   */
  escribirNota(jugadorId: string, texto: string | null): boolean {
    const jugador = this.jugador(jugadorId);
    if (!jugador) return false;
    if (texto === null) this.notas.delete(jugador.id);
    else this.notas.set(jugador.id, texto);
    return true;
  }

  /** Cambia el alineamiento del jugador de un asiento. */
  cambiarAlineamiento(jugadorId: string, alineamiento: SalaAlineamiento): void {
    const jugador = this.jugador(jugadorId);
    if (!jugador) return;
    jugador.alineamiento = alineamiento;
    this.entorno.anotar({ tipo: 'alineamiento', asiento: this.entorno.asientoDiario(jugadorId), alineamiento });
  }

  /**
   * Mata o revive al jugador de un asiento; al morir pierde la calavera. De noche,
   * la muerte queda pendiente (solo la ven quienes ven el grimorio) hasta que el
   * narrador la hace efectiva (confirmarMuerte). Revivir quita también la pendiente.
   */
  cambiarVida(jugadorId: string, muerto: boolean, { anotar = true }: { anotar?: boolean } = {}): void {
    const jugador = this.jugador(jugadorId);
    if (!jugador) return;
    // Para el diario, muere cuando se le pone la muerte (de noche, aunque se anuncie después)
    const estabaMuerto = jugador.muerto || jugador.muertePendiente;
    if (anotar && estabaMuerto !== muerto) {
      this.entorno.anotar({ tipo: muerto ? 'muere' : 'revive', asiento: this.entorno.asientoDiario(jugadorId) });
    }
    if (!muerto) {
      jugador.revivir();
      return;
    }
    const estabaPendiente = jugador.muertePendiente;
    if (!jugador.morir(this.entorno.noche())) return;
    if (estabaPendiente) quitarMarcaDeMuerte(jugador);
    this.quitarCalavera(jugador);
  }

  /**
   * Hace efectiva una muerte pendiente (el narrador la anuncia): ya la ven todos, y
   * se le quita el «Dead» de quien lo mató (ya no hace falta).
   */
  confirmarMuerte(jugadorId: string): boolean {
    const jugador = this.jugador(jugadorId);
    if (!jugador?.confirmarMuerte()) return false;
    quitarMarcaDeMuerte(jugador);
    this.quitarCalavera(jugador);
    return true;
  }

  /** Quita o devuelve el voto al jugador muerto de un asiento. Devuelve false si no está muerto. */
  cambiarVoto(jugadorId: string, gastado: boolean): boolean {
    return !!this.jugador(jugadorId)?.cambiarVoto(gastado);
  }

  /** El Barquero: todos los muertos recuperan su voto. Devuelve cuántos lo recuperan. */
  devolverVotos(): number {
    const sinVoto = this.entorno.jugadores().filter((j) => j.muerto && j.votoGastado);
    for (const jugador of sinVoto) jugador.cambiarVoto(false);
    return sinVoto.length;
  }

  /** Pone o quita la calavera al jugador de un asiento. Solo puede llevarla uno: ponérsela se la quita a los demás. */
  marcar(jugadorId: string, marcado: boolean, votos: number | null = null): void {
    if (marcado) this.desmarcar();
    const jugador = this.jugador(jugadorId);
    if (!jugador) return;
    if (marcado) this.conCalavera = { jugador: jugador.id, votos };
    else this.quitarCalavera(jugador);
  }

  private quitarCalavera(jugador: Jugador): void {
    if (this.conCalavera?.jugador === jugador.id) this.conCalavera = null;
  }

  /** Quita la calavera a quien la lleve. */
  desmarcar(): void {
    this.conCalavera = null;
  }

  /** Quién lleva la calavera (el id de su jugador) y con cuántos votos se le puso, o null. */
  calavera(): { jugador: string; votos: number | null } | null {
    return this.conCalavera && { ...this.conCalavera };
  }

  /** Si alguien lleva la calavera. */
  hayMarca(): boolean {
    return this.conCalavera !== null;
  }

  /** Se ha quitado un asiento: la nota de su jugador y su calavera, con él. */
  olvidar(jugador: Jugador): void {
    this.notas.delete(jugador.id);
    this.quitarCalavera(jugador);
  }

  /** Otra partida: todos los jugadores como al principio, sin notas ni calavera. */
  limpiar(): void {
    for (const jugador of this.entorno.jugadores()) jugador.nuevaPartida();
    this.notas.clear();
    this.conCalavera = null;
  }
}
