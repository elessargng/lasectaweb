/**
 * La bolsa: los personajes que el narrador mete para repartir, en el orden en
 * que se metieron. No comprueba permisos ni que estén en el guion.
 */
export class Bolsa {
  private personajes: string[] = [];

  constructor(
    /** Si un personaje es viajero (los viajeros se quedan al llenar la bolsa al azar). */
    private readonly esViajero: (personajeId: string) => boolean,
  ) {}

  bolsa(): string[] {
    return [...this.personajes];
  }

  contiene(personajeId: string): boolean {
    return this.personajes.includes(personajeId);
  }

  /** Mete un personaje en la bolsa, o lo saca si ya estaba. */
  alternar(personajeId: string): void {
    this.personajes = this.personajes.includes(personajeId)
      ? this.personajes.filter((id) => id !== personajeId)
      : [...this.personajes, personajeId];
  }

  /**
   * Cuántas fichas de un personaje hay en la bolsa: quita las de más o añade
   * las que falten (al final). Con el Pope puede haber más de una; no lo comprueba.
   */
  poner(personajeId: string, cantidad: number): void {
    const otros = this.personajes.filter((id) => id !== personajeId);
    const primera = this.personajes.indexOf(personajeId);
    const suyas = Array.from({ length: cantidad }, () => personajeId);
    // Se quedan donde estaba la primera (o al final, si no estaba)
    const donde = primera < 0 ? otros.length : this.personajes.slice(0, primera).filter((id) => id !== personajeId).length;
    this.personajes = [...otros.slice(0, donde), ...suyas, ...otros.slice(donde)];
  }

  /**
   * Cambia de una vez los aldeanos, forasteros, esbirros y demonios de la bolsa
   * (al llenarla al azar); los viajeros que hubiera se quedan.
   */
  reemplazar(personajes: string[]): void {
    this.personajes = [...this.personajes.filter((id) => this.esViajero(id)), ...personajes];
  }

  /** Vacía la bolsa entera (también los viajeros). */
  vaciar(): void {
    this.personajes = [];
  }

  /** Los viajeros metidos en la bolsa: se reparten con los demás, pero no cuentan para el reparto por tipos. */
  viajeros(): number {
    return this.personajes.filter((id) => this.esViajero(id)).length;
  }
}
