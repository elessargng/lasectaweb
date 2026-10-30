import type { SalaAccesoGrimorio } from '../../contrato/sala';

/**
 * Quién ha pedido ver el grimorio del narrador y a quién se le ha concedido (ver
 * SalaParticipante.accesoGrimorio). Lo concedido se recuerda por el «recuerdo» de
 * cada uno (su cuenta o su navegador, ver Participantes.recuerdoDe), así que lo
 * recupera si sale de la sala y vuelve; lo solicitado es de su participante y se
 * pierde al salir. No comprueba permisos.
 */
export class AccesoGrimorio {
  /** Los recuerdos de quienes lo ven. */
  private concedidos = new Set<string>();
  /** Los participantes que lo han pedido. */
  private solicitados = new Set<string>();

  constructor(
    /** Por lo que se reconoce a un participante si sale y vuelve; null si no está. */
    private readonly recuerdoDe: (participanteId: string) => string | null,
  ) {}

  de(participanteId: string): SalaAccesoGrimorio {
    const recuerdo = this.recuerdoDe(participanteId);
    if (recuerdo && this.concedidos.has(recuerdo)) return 'concedido';
    return this.solicitados.has(participanteId) ? 'solicitado' : 'ninguno';
  }

  cambiar(participanteId: string, acceso: SalaAccesoGrimorio): void {
    const recuerdo = this.recuerdoDe(participanteId);
    if (!recuerdo) return;
    this.solicitados.delete(participanteId);
    this.concedidos.delete(recuerdo);
    if (acceso === 'solicitado') this.solicitados.add(participanteId);
    if (acceso === 'concedido') this.concedidos.add(recuerdo);
  }

  /** Lo ha expulsado un narrador: si vuelve, no lo recupera. */
  alExpulsar(participanteId: string, recuerdo: string): void {
    this.solicitados.delete(participanteId);
    this.concedidos.delete(recuerdo);
  }

  /**
   * Otra partida: quien veía el grimorio deja de verlo (y puede volver a sentarse),
   * también quien había salido de la sala. Las peticiones pendientes siguen.
   */
  nuevaPartida(): void {
    this.concedidos.clear();
  }
}
