import { randomUUID } from 'crypto';
import { SalaConversacion, SalaInvitacion, SalaParticipante } from '../../types/sala';
import { SalaService } from '../SalaService';

/** Algo que no se puede hacer en una conversación (el mensaje es para quien lo intenta). */
export class ConversacionError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ConversacionError';
  }
}

const conversa = (p: SalaParticipante) => p.rol === 'jugador' || p.rol === 'narrador';
const escucha = (p: SalaParticipante) => p.rol === 'visitante' || p.rol === 'narrador';

/**
 * Las conversaciones privadas de la sala (por voz y vídeo), aparte de la mesa.
 *
 * - Miembros: jugadores y narradores. Se entra por invitación y solo al aceptarla
 *   (también quien invita, si no estaba ya en una). De día invita cualquier
 *   jugador o narrador; de noche, el narrador a quien quiera y los jugadores solo
 *   al narrador (para pedirle hablar). Si quien invita ya está en una
 *   conversación, quien acepta entra en ella.
 * - De noche, los jugadores solo ven las conversaciones en las que están (ver
 *   salaSocket): por eso, si un jugador invita a un narrador que ya conversa con
 *   otro, la invitación se queda pendiente sin decírselo, y el narrador la acepta
 *   al acabar.
 * - Los narradores pueden además entrar en cualquier conversación, sin invitación
 *   ni petición: entran como miembros (hablan y se les ve).
 * - Peticiones para unirse: quien podría invitar pide entrar en la conversación
 *   de alguien; la ven todos sus miembros y cualquiera la acepta o la rechaza.
 * - Oyentes: los visitantes y los narradores pueden escuchar cualquier
 *   conversación, sin invitación (p. ej. al seguir a un jugador). No hablan ni se
 *   ven, y los jugadores no saben que están (solo los narradores y los visitantes
 *   lo ven).
 * - Cada uno está en una como mucho (para aceptar una invitación hay que salir antes).
 *   Si a quien has llamado entra en otra, tu llamada se cancela sola.
 * - Al cambiar de noche a día (o al revés) se terminan todas y caducan las invitaciones.
 *   Limpiar el grimorio (vuelve a la preparación) no las termina: nadie sale de la suya.
 * - Con la Institutriz viva, un jugador solo conversa con sus vecinos de mesa: quien
 *   entra en una conversación tiene que ser vecino de todos los jugadores que hay en ella.
 * - Quien deja de poder estar (cambia de papel o se va) sale. Si queda un solo
 *   miembro, la conversación sigue hasta que sale él: cada uno decide en sus
 *   preferencias si sale automáticamente (lo hace su navegador). Sin miembros
 *   se termina.
 *
 * En memoria, como la sala.
 */
export class ConversacionService {
  private conversaciones: SalaConversacion[] = [];
  private invitaciones: SalaInvitacion[] = [];
  private faseVista: string;
  /** Las veces que se ha limpiado el grimorio, la última vez que se miró. */
  private reiniciosVistos: number;

  constructor(private readonly sala: SalaService) {
    this.faseVista = this.claveFase();
    this.reiniciosVistos = this.sala.fase().reinicios;
  }

  /** Todas las conversaciones, con sus oyentes. */
  lista(): SalaConversacion[] {
    return this.conversaciones.map((c) => ({ ...c, miembros: [...c.miembros], oyentes: [...c.oyentes] }));
  }

  /** Las invitaciones pendientes en las que está alguien (las que hace y las que recibe). */
  invitacionesDe(id: string): SalaInvitacion[] {
    return this.invitaciones.filter((i) => this.laVe(i, id)).map((i) => ({ ...i }));
  }

  /** Quien hace la invitación o la petición, y quien la recibe (en una petición, cualquier miembro). */
  private laVe(i: SalaInvitacion, id: string): boolean {
    if (i.de === id) return true;
    if (!i.conversacion) return i.para === id;
    return !!this.conversaciones.find((c) => c.id === i.conversacion)?.miembros.includes(id);
  }

  /** La conversación en la que está alguien (como miembro u oyente), o undefined. */
  deParticipante(id: string): SalaConversacion | undefined {
    return this.conversaciones.find((c) => c.miembros.includes(id) || c.oyentes.includes(id));
  }

  /** Si alguien está en una conversación como miembro (habla y se le ve). */
  esMiembro(id: string): boolean {
    return this.conversaciones.some((c) => c.miembros.includes(id));
  }

  /** Invita a alguien a conversar (a una nueva o a la propia). Lanza ConversacionError si no se puede. */
  invitar(yoId: string, otroId: string): SalaInvitacion {
    this.depurar();
    const { yo, otro } = this.comprobar(yoId, otroId);
    // Recíproca: si el otro ya me había invitado a mí (invitación directa, no petición),
    // invitarle es lo mismo que coger su llamada: acepto la suya y conversamos. (Salvo que
    // yo ya esté en una conversación: entonces vale la invitación normal, para que entre él.)
    const suyaParaMi = this.invitaciones.find((i) => !i.conversacion && i.de === otro.id && i.para === yo.id);
    if (suyaParaMi && !this.esMiembro(yo.id)) {
      const copia = { ...suyaParaMi };
      try {
        this.responder(yo.id, suyaParaMi.id, true);
        return copia;
      } catch (e) {
        if (!(e instanceof ConversacionError)) throw e;
        // Si por alguna regla de borde no se puede conectar ahora, vale la invitación normal.
      }
    }
    if (this.invitaciones.some((i) => i.de === yo.id && i.para === otro.id)) {
      throw new ConversacionError(`Ya has invitado a ${otro.nombre}.`);
    }
    const invitacion: SalaInvitacion = { id: randomUUID(), de: yo.id, para: otro.id };
    this.invitaciones.push(invitacion);
    return { ...invitacion };
  }

  /** Pide unirse a la conversación en la que está otro. Lanza ConversacionError si no se puede. */
  pedirUnirse(yoId: string, otroId: string): SalaInvitacion {
    this.depurar();
    const yo = this.sala.buscar(yoId);
    const otro = this.sala.buscar(otroId);
    if (!yo) throw new ConversacionError('Ya no estás en la sala.');
    if (!otro) throw new ConversacionError('Esa persona ya no está en la sala.');
    if (!conversa(yo)) throw new ConversacionError('Solo los jugadores y los narradores conversan en privado.');
    if (this.sala.fase().momento === 'noche' && yo.rol !== 'narrador') {
      throw new ConversacionError('De noche solo el narrador puede unirse a una conversación.');
    }
    const suya = this.conversaciones.find((c) => c.miembros.includes(otro.id));
    if (!suya) throw new ConversacionError(`${otro.nombre} ya no está en una conversación.`);
    if (suya.miembros.includes(yo.id)) throw new ConversacionError('Ya estás en esa conversación.');
    if (yo.rol === 'jugador') this.comprobarVecinos(yo.id, suya.miembros);
    if (this.invitaciones.some((i) => i.de === yo.id && i.conversacion === suya.id)) {
      throw new ConversacionError('Ya has pedido unirte a esa conversación.');
    }
    const peticion: SalaInvitacion = { id: randomUUID(), de: yo.id, para: otro.id, conversacion: suya.id };
    this.invitaciones.push(peticion);
    return { ...peticion };
  }

  /**
   * Acepta (o rechaza) una invitación. Al aceptar, entra en la conversación de
   * quien invitó o, si no estaba en ninguna, empiezan una los dos.
   */
  responder(yoId: string, invitacionId: string, aceptar: boolean): void {
    this.depurar();
    const invitacion = this.invitaciones.find((i) => i.id === invitacionId && i.de !== yoId && this.laVe(i, yoId));
    if (!invitacion) throw new ConversacionError('Esa invitación ya no está.');
    if (invitacion.conversacion) {
      this.invitaciones = this.invitaciones.filter((i) => i.id !== invitacionId);
      if (aceptar) this.unir(invitacion.de, invitacion.conversacion);
      return;
    }
    if (aceptar && this.esMiembro(yoId)) throw new ConversacionError('Sal de tu conversación para aceptar otra.');
    this.invitaciones = this.invitaciones.filter((i) => i.id !== invitacionId);
    if (!aceptar) return;
    // Se vuelve a comprobar: puede haber cambiado algo desde que se invitó
    const { yo: anfitrion, otro: invitado } = this.comprobar(invitacion.de, yoId);
    // Quien estaba escuchando otra conversación la deja (también quien invita)
    this.salir(invitado.id);
    if (!this.esMiembro(anfitrion.id)) this.salir(anfitrion.id);
    const suya = this.conversaciones.find((c) => c.miembros.includes(anfitrion.id));
    if (suya) suya.miembros.push(invitado.id);
    else {
      this.conversaciones.push({ id: randomUUID(), miembros: [anfitrion.id, invitado.id], oyentes: [] });
      // Quien invitaba también entra en una
      this.haEntrado(anfitrion.id);
    }
    this.haEntrado(invitado.id);
  }

  /**
   * Alguien acaba de entrar en una conversación: las llamadas que tenía
   * pendientes (las que le hacían y sus peticiones para unirse a otras) se
   * cancelan solas. Sus invitaciones a otros siguen: quien acepte, entra en la suya.
   */
  private haEntrado(id: string): void {
    this.invitaciones = this.invitaciones.filter((i) => i.para !== id && !(i.de === id && i.conversacion));
  }

  /** Un narrador entra en una conversación como miembro (sin invitación). */
  entrar(yoId: string, conversacionId: string): void {
    this.depurar();
    const yo = this.sala.buscar(yoId);
    if (!yo) throw new ConversacionError('Ya no estás en la sala.');
    if (yo.rol !== 'narrador') throw new ConversacionError('Solo los narradores entran sin invitación.');
    const conversacion = this.conversaciones.find((c) => c.id === conversacionId);
    if (!conversacion) throw new ConversacionError('Esa conversación ya ha terminado.');
    if (conversacion.miembros.includes(yoId)) throw new ConversacionError('Ya estás en esa conversación.');
    this.unir(yoId, conversacionId);
  }

  /** Alguien entra en una conversación: al aceptarse su petición o, si narra, sin más (si estaba en otra, la deja). */
  private unir(id: string, conversacionId: string): void {
    const p = this.sala.buscar(id);
    if (!p || !conversa(p)) throw new ConversacionError('Quien lo pedía ya no puede conversar.');
    this.salir(id);
    const conversacion = this.conversaciones.find((c) => c.id === conversacionId);
    if (!conversacion) throw new ConversacionError('Esa conversación ya ha terminado.');
    conversacion.miembros.push(id);
    this.haEntrado(id);
  }

  /** Quien invitó la retira. */
  cancelar(yoId: string, invitacionId: string): void {
    this.invitaciones = this.invitaciones.filter((i) => !(i.id === invitacionId && i.de === yoId));
  }

  /** Un visitante o un narrador entra a escuchar una conversación (sin invitación; no le ven los jugadores). */
  escuchar(yoId: string, conversacionId: string): void {
    this.depurar();
    const yo = this.sala.buscar(yoId);
    if (!yo) throw new ConversacionError('Ya no estás en la sala.');
    if (!escucha(yo)) throw new ConversacionError('Solo los visitantes y los narradores escuchan las conversaciones.');
    if (this.esMiembro(yoId)) throw new ConversacionError('Sal de tu conversación para escuchar otra.');
    const conversacion = this.conversaciones.find((c) => c.id === conversacionId);
    if (!conversacion) throw new ConversacionError('Esa conversación ya ha terminado.');
    this.salir(yoId);
    conversacion.oyentes.push(yoId);
  }

  /** Alguien sale de su conversación (si no queda ningún miembro, se termina). */
  salir(id: string): void {
    for (const c of this.conversaciones) {
      c.miembros = c.miembros.filter((m) => m !== id);
      c.oyentes = c.oyentes.filter((o) => o !== id);
    }
    this.conversaciones = this.conversaciones.filter((c) => c.miembros.length > 0);
  }

  /**
   * Pone las conversaciones al día con la sala: al cambiar de fase se terminan
   * todas (y caducan las invitaciones); quien ya no puede estar sale; las que se
   * quedan sin miembros se terminan; las invitaciones de quien se ha
   * ido caducan. Devuelve si ha cambiado algo.
   */
  depurar(): boolean {
    const antes = JSON.stringify([this.conversaciones, this.invitaciones]);
    const fase = this.claveFase();
    if (fase !== this.faseVista) {
      this.faseVista = fase;
      // Si el cambio es por limpiar el grimorio, las conversaciones siguen
      const { reinicios } = this.sala.fase();
      if (reinicios === this.reiniciosVistos) {
        this.conversaciones = [];
        this.invitaciones = [];
      }
      this.reiniciosVistos = reinicios;
    }
    const sigue = (id: string, puede: (p: SalaParticipante) => boolean) => {
      const p = this.sala.buscar(id);
      return !!p && puede(p);
    };
    for (const c of this.conversaciones) {
      c.miembros = c.miembros.filter((id) => sigue(id, conversa));
      c.oyentes = c.oyentes.filter((id) => sigue(id, escucha));
    }
    this.conversaciones = this.conversaciones.filter((c) => c.miembros.length > 0);
    // Las peticiones, mientras siga la conversación y quien la pide no esté ya en ella
    this.invitaciones = this.invitaciones.filter((i) => {
      if (!sigue(i.de, conversa)) return false;
      if (!i.conversacion) return sigue(i.para, conversa);
      const c = this.conversaciones.find((x) => x.id === i.conversacion);
      return !!c && !c.miembros.includes(i.de);
    });
    return JSON.stringify([this.conversaciones, this.invitaciones]) !== antes;
  }

  /**
   * Con la Institutriz viva: el jugador `quien` tiene que ser vecino de todos los
   * jugadores de `con` (los narradores no cuentan). Lanza ConversacionError si no.
   */
  private comprobarVecinos(quien: string, con: string[]): void {
    if (!this.sala.institutrizViva()) return;
    const jugadores = con.filter((id) => id !== quien && this.sala.buscar(id)?.rol === 'jugador');
    if (jugadores.some((id) => !this.sala.sonVecinos(quien, id))) {
      throw new ConversacionError('Con la Institutriz en juego, solo se puede conversar en privado con los vecinos de mesa.');
    }
  }

  /** Si `yo` puede invitar a `otro` ahora (o, al aceptar, si sigue pudiendo). */
  private comprobar(yoId: string, otroId: string): { yo: SalaParticipante; otro: SalaParticipante } {
    const yo = this.sala.buscar(yoId);
    const otro = this.sala.buscar(otroId);
    if (!yo) throw new ConversacionError('Quien invitaba ya no está en la sala.');
    if (!otro) throw new ConversacionError('Esa persona ya no está en la sala.');
    if (yo.id === otro.id) throw new ConversacionError('No puedes conversar contigo mismo.');
    if (!conversa(yo)) throw new ConversacionError('Solo los jugadores y los narradores invitan a conversar.');
    if (!conversa(otro)) throw new ConversacionError(`${otro.nombre} no está jugando: no puede conversar en privado.`);
    const noche = this.sala.fase().momento === 'noche';
    if (noche && yo.rol !== 'narrador' && otro.rol !== 'narrador') {
      throw new ConversacionError('De noche solo puedes invitar a conversar al narrador.');
    }
    // La mía, si hablo en ella (si solo la escucho, la dejo al empezar otra)
    const mia = this.conversaciones.find((c) => c.miembros.includes(yo.id));
    // Con la Institutriz, el jugador invitado tiene que ser vecino de los jugadores con los que hablará
    if (otro.rol === 'jugador') this.comprobarVecinos(otro.id, mia ? mia.miembros : [yo.id]);
    const suya = this.deParticipante(otro.id);
    if (mia && suya === mia) throw new ConversacionError(`${otro.nombre} ya está en la conversación.`);
    // De noche, un jugador no sabe si el narrador conversa: su invitación espera (al
    // aceptarla, el narrador ya tiene que haber salido de la suya)
    const ocultas = noche && yo.rol !== 'narrador';
    if (suya?.miembros.includes(otro.id) && !ocultas) throw new ConversacionError(`${otro.nombre} ya está en otra conversación.`);
    return { yo, otro };
  }

  /** Cambia al pasar de día a noche o de noche a día (la preparación cuenta como día). */
  private claveFase(): string {
    const { momento, numero, reinicios } = this.sala.fase();
    return `${momento === 'noche' ? 'noche' : 'dia'}:${numero}:${reinicios}`;
  }
}
