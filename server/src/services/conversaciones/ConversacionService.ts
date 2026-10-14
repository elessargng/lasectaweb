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

/**
 * Las conversaciones privadas de la sala (por voz y vídeo), aparte de la mesa.
 *
 * - Miembros: jugadores y narradores. Se entra por invitación y solo al aceptarla
 *   (también quien invita, si no estaba ya en una). De día invita cualquier
 *   jugador o narrador; de noche, solo el narrador. Si quien invita ya está en
 *   una conversación, quien acepta entra en ella.
 * - Oyentes: los visitantes pueden escuchar cualquier conversación, sin
 *   invitación. No hablan ni se ven, y los jugadores no saben que están (solo los
 *   narradores lo ven).
 * - Cada uno está en una como mucho (para aceptar una invitación hay que salir antes).
 * - Al cambiar de noche a día (o al revés) se terminan todas y caducan las invitaciones.
 * - Quien deja de poder estar (cambia de papel o se va) sale; una conversación
 *   con menos de dos miembros se termina.
 *
 * En memoria, como la sala.
 */
export class ConversacionService {
  private conversaciones: SalaConversacion[] = [];
  private invitaciones: SalaInvitacion[] = [];
  private faseVista: string;

  constructor(private readonly sala: SalaService) {
    this.faseVista = this.claveFase();
  }

  /** Todas las conversaciones, con sus oyentes. */
  lista(): SalaConversacion[] {
    return this.conversaciones.map((c) => ({ ...c, miembros: [...c.miembros], oyentes: [...c.oyentes] }));
  }

  /** Las invitaciones pendientes en las que está alguien (las que hace y las que recibe). */
  invitacionesDe(id: string): SalaInvitacion[] {
    return this.invitaciones.filter((i) => i.de === id || i.para === id).map((i) => ({ ...i }));
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
    if (this.invitaciones.some((i) => i.de === yo.id && i.para === otro.id)) {
      throw new ConversacionError(`Ya has invitado a ${otro.nombre}.`);
    }
    const invitacion: SalaInvitacion = { id: randomUUID(), de: yo.id, para: otro.id };
    this.invitaciones.push(invitacion);
    return { ...invitacion };
  }

  /**
   * Acepta (o rechaza) una invitación. Al aceptar, entra en la conversación de
   * quien invitó o, si no estaba en ninguna, empiezan una los dos.
   */
  responder(yoId: string, invitacionId: string, aceptar: boolean): void {
    this.depurar();
    const invitacion = this.invitaciones.find((i) => i.id === invitacionId && i.para === yoId);
    if (!invitacion) throw new ConversacionError('Esa invitación ya no está.');
    if (aceptar && this.esMiembro(yoId)) throw new ConversacionError('Sal de tu conversación para aceptar otra.');
    this.invitaciones = this.invitaciones.filter((i) => i.id !== invitacionId);
    if (!aceptar) return;
    // Se vuelve a comprobar: puede haber cambiado algo desde que se invitó
    const { yo: anfitrion, otro: invitado } = this.comprobar(invitacion.de, yoId);
    // Un visitante que estaba escuchando otra conversación la deja
    this.salir(invitado.id);
    const suya = this.conversaciones.find((c) => c.miembros.includes(anfitrion.id));
    if (suya) suya.miembros.push(invitado.id);
    else this.conversaciones.push({ id: randomUUID(), miembros: [anfitrion.id, invitado.id], oyentes: [] });
    // Ya está en una: las demás invitaciones que había recibido caducan
    this.invitaciones = this.invitaciones.filter((i) => i.para !== invitado.id);
  }

  /** Quien invitó la retira. */
  cancelar(yoId: string, invitacionId: string): void {
    this.invitaciones = this.invitaciones.filter((i) => !(i.id === invitacionId && i.de === yoId));
  }

  /** Un visitante entra a escuchar una conversación (sin invitación; no le ven los jugadores). */
  escuchar(yoId: string, conversacionId: string): void {
    this.depurar();
    const yo = this.sala.buscar(yoId);
    if (!yo) throw new ConversacionError('Ya no estás en la sala.');
    if (yo.rol !== 'visitante') throw new ConversacionError('Solo los visitantes escuchan las conversaciones.');
    const conversacion = this.conversaciones.find((c) => c.id === conversacionId);
    if (!conversacion) throw new ConversacionError('Esa conversación ya ha terminado.');
    this.salir(yoId);
    conversacion.oyentes.push(yoId);
  }

  /** Alguien sale de su conversación (si quedan menos de dos miembros, se termina). */
  salir(id: string): void {
    for (const c of this.conversaciones) {
      c.miembros = c.miembros.filter((m) => m !== id);
      c.oyentes = c.oyentes.filter((o) => o !== id);
    }
    this.conversaciones = this.conversaciones.filter((c) => c.miembros.length >= 2);
  }

  /**
   * Pone las conversaciones al día con la sala: al cambiar de fase se terminan
   * todas (y caducan las invitaciones); quien ya no puede estar sale; las que se
   * quedan con menos de dos miembros se terminan; las invitaciones de quien se ha
   * ido caducan. Devuelve si ha cambiado algo.
   */
  depurar(): boolean {
    const antes = JSON.stringify([this.conversaciones, this.invitaciones]);
    const fase = this.claveFase();
    if (fase !== this.faseVista) {
      this.faseVista = fase;
      this.conversaciones = [];
      this.invitaciones = [];
    }
    const sigue = (id: string, puede: (p: SalaParticipante) => boolean) => {
      const p = this.sala.buscar(id);
      return !!p && puede(p);
    };
    for (const c of this.conversaciones) {
      c.miembros = c.miembros.filter((id) => sigue(id, conversa));
      c.oyentes = c.oyentes.filter((id) => sigue(id, (p) => p.rol === 'visitante'));
    }
    this.conversaciones = this.conversaciones.filter((c) => c.miembros.length >= 2);
    this.invitaciones = this.invitaciones.filter((i) => sigue(i.de, conversa) && sigue(i.para, conversa));
    return JSON.stringify([this.conversaciones, this.invitaciones]) !== antes;
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
    if (this.sala.fase().momento === 'noche' && yo.rol !== 'narrador') {
      throw new ConversacionError('De noche solo el narrador puede invitar a conversar.');
    }
    const mia = this.deParticipante(yo.id);
    const suya = this.deParticipante(otro.id);
    if (mia && suya === mia) throw new ConversacionError(`${otro.nombre} ya está en la conversación.`);
    if (suya?.miembros.includes(otro.id)) throw new ConversacionError(`${otro.nombre} ya está en otra conversación.`);
    return { yo, otro };
  }

  /** Cambia al pasar de día a noche o de noche a día (la preparación cuenta como día). */
  private claveFase(): string {
    const { momento, numero, reinicios } = this.sala.fase();
    return `${momento === 'noche' ? 'noche' : 'dia'}:${numero}:${reinicios}`;
  }
}
