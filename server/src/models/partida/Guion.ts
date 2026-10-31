import type { GuionResuelto, PersonajeDeGuion } from '../guiones';

/** El guion de la partida (ya resuelto por GuionService) y sus personajes. */
export class Guion {
  private guion: GuionResuelto | null = null;
  /** Sube cada vez que cambia el guion, para mandarlo solo entonces. */
  private versionActual = 0;

  actual(): GuionResuelto | null {
    return this.guion;
  }

  version(): number {
    return this.versionActual;
  }

  cambiar(guion: GuionResuelto): void {
    this.guion = guion;
    this.versionActual += 1;
  }

  /**
   * Un personaje de la partida: del guion o, aunque el guion no lo traiga, uno de
   * los viajeros o de los NPCs (legendarios y lóricos) del catálogo. undefined si no.
   */
  personaje(id: string): PersonajeDeGuion | undefined {
    const g = this.guion;
    if (!g) return undefined;
    return g.personajes.find((p) => p.id === id) ?? g.viajeros?.find((p) => p.id === id) ?? g.npcs?.find((p) => p.id === id);
  }

  esViajero(id: string): boolean {
    return this.personaje(id)?.tipo === 'traveller';
  }
}
