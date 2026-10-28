import { ConversacionService } from '../conversaciones/ConversacionService';
import { SalaService } from '../SalaService';
import { PermisosVideo, ProveedorVideo } from './ProveedorVideo';

/** No se puede entrar en esa sala de vídeo (el mensaje es para quien lo intenta). */
export class VideollamadaError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'VideollamadaError';
  }
}

export const SALA_PRINCIPAL = 'principal';
const SALA_VIDEO_PRINCIPAL = 'la-secta-mesa';
const salaDeConversacion = (id: string) => `la-secta-conversacion-${id}`;

/** Un pase para el navegador: a qué servidor conectarse y con qué token. */
export interface PaseVideo {
  url: string;
  token: string;
}

/**
 * Quién se ve y se oye en la sala.
 *
 * - En la mesa (sala principal) todos ven y oyen; emiten los jugadores y los
 *   narradores. De noche, nadie emite cámara (solo voz).
 * - Quien está en una conversación privada no emite en la mesa: su cámara y su
 *   voz solo llegan a los de su conversación (que tiene su propia sala de vídeo,
 *   con cámara también de noche). Los visitantes que la escuchan no emiten.
 *   Si el narrador no oculta las cámaras de las conversaciones (Preferencias >
 *   Partida), sus miembros siguen emitiendo la cámara en la mesa, sin la voz.
 *
 * Firma los pases (solo a quien está en la sala o en la conversación) y, cada vez
 * que cambia la sala, ajusta los permisos de quien ya está dentro y saca a quien
 * ya no debe estar. No sabe de LiveKit: usa un ProveedorVideo.
 */
export class VideollamadaService {
  /** Lo último que se le dijo al servidor de vídeo, para no repetirlo. */
  private permisosMesa = new Map<string, string>();
  private miembrosVistos = new Map<string, string[]>();
  /** Los permisos de cada uno en cada conversación («conversación|id»), para cambiarlos cuando cambien. */
  private permisosVistos = new Map<string, string>();

  constructor(
    private readonly proveedor: ProveedorVideo,
    private readonly sala: SalaService,
    private readonly conversaciones: ConversacionService,
  ) {}

  /**
   * Si alguien tiene que callar: un jugador, con el silencio pedido o si la palabra
   * la tiene otro (al nominar con el narrador virtual). Los narradores siguen hablando.
   */
  private callado(id: string): boolean {
    const palabra = this.sala.palabra();
    return (this.sala.silencio() || (palabra !== null && palabra !== id)) && this.sala.buscar(id)?.rol === 'jugador';
  }

  /** Los permisos en la mesa de alguien, según su papel, la fase, si conversa en privado y el silencio. */
  private permisosEnMesa(id: string): PermisosVideo {
    const p = this.sala.buscar(id);
    const puede = !!p && (p.rol === 'jugador' || p.rol === 'narrador');
    const dia = this.sala.fase().momento !== 'noche';
    // Quien está en una conversación (hablando o escuchando) no emite en la mesa; si
    // el narrador no oculta sus cámaras, los que hablan en ella siguen emitiendo la cámara
    const conversacion = this.conversaciones.deParticipante(id);
    if (!conversacion) return { publicar: puede, camara: dia, microfono: !this.callado(id) };
    const camara = puede && dia && !this.sala.configuracion().ocultarCamarasConversacion && conversacion.miembros.includes(id);
    return { publicar: camara, camara, microfono: false };
  }

  /** Los permisos en una conversación: los miembros hablan y se ven (salvo el silencio); los oyentes, no. */
  private permisosEnConversacion(id: string, habla: boolean): PermisosVideo {
    return { publicar: habla, camara: habla, microfono: habla && !this.callado(id) };
  }

  /**
   * El pase para entrar en la mesa («principal») o en una conversación (su id).
   * Lanza VideollamadaError si no puede.
   */
  async pase(participanteId: string, cual: string): Promise<PaseVideo> {
    const p = this.sala.buscar(participanteId);
    if (!p) throw new VideollamadaError('Ya no estás en la sala.');
    if (cual === SALA_PRINCIPAL) {
      const token = await this.proveedor.token(SALA_VIDEO_PRINCIPAL, p.id, p.nombre, this.permisosEnMesa(p.id));
      return { url: this.proveedor.urlPublica, token };
    }
    const conversacion = this.conversaciones.deParticipante(p.id);
    if (!conversacion || conversacion.id !== cual) throw new VideollamadaError('No estás en esa conversación.');
    // Los miembros hablan y se ven; los oyentes (visitantes) solo escuchan y miran
    const habla = conversacion.miembros.includes(p.id);
    const token = await this.proveedor.token(salaDeConversacion(cual), p.id, p.nombre, this.permisosEnConversacion(p.id, habla));
    return { url: this.proveedor.urlPublica, token };
  }

  /**
   * Pone el servidor de vídeo al día con la sala: permisos en la mesa de cada
   * uno, fuera de la mesa quien se ha ido, fuera de cada conversación quien ya
   * no está en ella, y cerradas las que se han terminado.
   */
  sincronizar(): void {
    const presentes = new Set(this.sala.participantes().map((p) => p.id));
    for (const id of presentes) {
      const permisos = this.permisosEnMesa(id);
      const clave = JSON.stringify(permisos);
      if (this.permisosMesa.get(id) === clave) continue;
      this.permisosMesa.set(id, clave);
      void this.proveedor.cambiarPermisos(SALA_VIDEO_PRINCIPAL, id, permisos);
    }
    for (const id of [...this.permisosMesa.keys()]) {
      if (presentes.has(id)) continue;
      this.permisosMesa.delete(id);
      void this.proveedor.expulsar(SALA_VIDEO_PRINCIPAL, id);
    }

    const actuales = new Map(this.conversaciones.lista().map((c) => [c.id, [...c.miembros, ...c.oyentes]]));
    for (const [id, miembros] of this.miembrosVistos) {
      const ahora = actuales.get(id);
      if (!ahora) {
        void this.proveedor.cerrarSala(salaDeConversacion(id));
        continue;
      }
      for (const m of miembros) if (!ahora.includes(m)) void this.proveedor.expulsar(salaDeConversacion(id), m);
    }
    this.miembrosVistos = actuales;

    // Quien pasa de escuchar a hablar (un narrador que entra) o al revés, o calla
    // por el silencio, sin salir de la sala de vídeo: se le cambian los permisos ahí
    // dentro. (Quien acaba de entrar ya los tiene en su pase.)
    const permisos = new Map<string, { conversacion: string; id: string; permisos: PermisosVideo }>();
    for (const c of this.conversaciones.lista()) {
      for (const m of c.miembros) permisos.set(`${c.id}|${m}`, { conversacion: c.id, id: m, permisos: this.permisosEnConversacion(m, true) });
      for (const o of c.oyentes) permisos.set(`${c.id}|${o}`, { conversacion: c.id, id: o, permisos: this.permisosEnConversacion(o, false) });
    }
    const vistos = new Map<string, string>();
    for (const [clave, { conversacion, id, permisos: p }] of permisos) {
      const ahora = JSON.stringify(p);
      vistos.set(clave, ahora);
      const antes = this.permisosVistos.get(clave);
      if (antes && antes !== ahora) void this.proveedor.cambiarPermisos(salaDeConversacion(conversacion), id, p);
    }
    this.permisosVistos = vistos;
  }
}
