import type { ConfiguracionDto } from '../../contrato/partida';

/** Lo que tarda la aguja de ficha en ficha al votar, en segundos (de cuarto en cuarto). */
export const SALA_SEGUNDOS_POR_FICHA = { min: 0.25, max: 2, paso: 0.25, defecto: 1 };

/** Los ajustes de la partida (ver ConfiguracionDto) y si se puede conversar en privado. No comprueba permisos. */
export class Configuracion {
  private ajustes: ConfiguracionDto = {
    grimorioJugadores: false,
    segundosPorFicha: SALA_SEGUNDOS_POR_FICHA.defecto,
    // Por defecto, los privados entre jugadores solo con los vecinos
    mensajes: 'vecinos',
    fondo: null,
    ocultarCamarasConversacion: true,
  };
  private privadosAbiertos = true;

  /** Los ajustes (una copia). */
  actual(): ConfiguracionDto {
    return { ...this.ajustes };
  }

  cambiar(cambios: Partial<ConfiguracionDto>): void {
    this.ajustes = { ...this.ajustes, ...cambios };
  }

  /** Si se puede conversar en privado (el narrador virtual lo cierra fuera de los privados). */
  privadosPermitidos(): boolean {
    return this.privadosAbiertos;
  }

  /** Abre o cierra las conversaciones privadas. */
  permitirPrivados(abiertos: boolean): void {
    this.privadosAbiertos = abiertos;
  }
}
