import type { GuionResuelto } from '../../types/guiones';
import { NPC_SILENCIO, NPC_STORMCATCHER } from './personajesEspeciales';

/**
 * Los NPCs de la partida (legendarios y lóricos que el narrador pone en juego) y
 * lo que traen algunos: las reglas del Bootlegger, el personaje del Storm
 * Catcher y el silencio del Bibliotecario del Infierno. No comprueba permisos.
 */
export class Npcs {
  /**
   * Los NPCs en juego (ver SalaEstado.npcs). Siguen al limpiar el grimorio: suelen
   * ser los mismos en la partida siguiente con el mismo guion (y los del guion
   * vuelven si se habían quitado).
   */
  private actuales: string[] = [];
  /** Las reglas del Bootlegger que ha escrito el narrador; null: las del guion. */
  private reglasBootlegger: string[] | null = null;
  /** El personaje bueno nombrado con el Storm Catcher, o null. */
  private rolStormcatcherActual: string | null = null;
  /**
   * El silencio que pide el narrador con el Bibliotecario del Infierno en juego
   * (ver SalaEstado.silencio). Solo vale mientras el NPC siga en juego: si se
   * quita (o cambia el guion), se acaba solo.
   */
  private silencioPedido = false;

  constructor(
    /** El guion de la sala, o null. */
    private readonly guion: () => GuionResuelto | null,
  ) {}

  /** Los legendarios y lóricos que trae el guion: en juego desde el principio de cada partida. */
  private delGuion(): string[] {
    return (this.guion()?.personajes ?? []).filter((p) => p.tipo === 'fabled' || p.tipo === 'loric').map((p) => p.id);
  }

  /** Otro guion: en juego, sus NPCs; sin reglas del Bootlegger escritas ni personaje del Storm Catcher. */
  alCambiarGuion(): void {
    this.actuales = this.delGuion();
    this.reglasBootlegger = null;
    this.rolStormcatcherActual = null;
  }

  /**
   * Otra partida: los NPCs del guion, en juego (si alguno se quitó, vuelve); los
   * demás que se pusieron a mano, siguen. Sin silencio ni personaje del Storm Catcher.
   */
  nuevaPartida(): void {
    this.actuales = [...this.actuales, ...this.delGuion().filter((id) => !this.actuales.includes(id))];
    this.silencioPedido = false;
    this.rolStormcatcherActual = null;
  }

  npcs(): string[] {
    return [...this.actuales];
  }

  /** Pone en juego un NPC, o lo quita si ya estaba. No comprueba que sea del guion. */
  alternar(personajeId: string): void {
    this.actuales = this.actuales.includes(personajeId)
      ? this.actuales.filter((id) => id !== personajeId)
      : [...this.actuales, personajeId];
  }

  activo(id: string): boolean {
    return this.actuales.includes(id);
  }

  /** Las reglas del Bootlegger: las del narrador, si las ha escrito, o las del guion. */
  bootlegger(): string[] {
    return [...(this.reglasBootlegger ?? this.guion()?.bootlegger ?? [])];
  }

  /** Cambia las reglas del Bootlegger (null: vuelven las del guion). No las valida. */
  escribirBootlegger(reglas: string[] | null): void {
    this.reglasBootlegger = reglas;
  }

  rolStormcatcher(): string | null {
    return this.activo(NPC_STORMCATCHER) ? this.rolStormcatcherActual : null;
  }

  nombrarStormcatcher(personajeId: string | null): void {
    this.rolStormcatcherActual = personajeId;
  }

  silencio(): boolean {
    return this.silencioPedido && this.activo(NPC_SILENCIO);
  }

  pedirSilencio(activo: boolean): void {
    this.silencioPedido = activo;
  }
}
