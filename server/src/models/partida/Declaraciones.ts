/** Hasta cuándo puede un jugador hacer una declaración: hasta que se acaba esa noche o ese día. */
export interface Plazo {
  jugador: string;
  hasta: 'amanecer' | 'anochecer';
}

/**
 * Las declaraciones del día (disparar como Exterminador, preguntar como Artista,
 * declararse Patoso…): quién ha hecho ya cada una, si solo se puede una vez por
 * partida y persona, y quién puede aún hacerla y hasta cuándo, si solo se puede en
 * un plazo. Cualquiera puede declararse lo que sea, lo sea o no: aquí no se mira
 * quién es nadie. Cada declaración, por su nombre (ver models/personajes).
 */
export class Declaraciones {
  /** Por declaración, los participantes que ya la han hecho. */
  private hechas = new Map<string, string[]>();
  /** Por declaración, los jugadores que aún pueden hacerla y hasta cuándo. */
  private plazos = new Map<string, Plazo[]>();

  /** Si ese participante ya ha hecho esa declaración en esta partida. */
  hecha(declaracion: string, participante: string): boolean {
    return this.hechas.get(declaracion)?.includes(participante) ?? false;
  }

  apuntar(declaracion: string, participante: string): void {
    if (!this.hecha(declaracion, participante)) this.hechas.set(declaracion, [...(this.hechas.get(declaracion) ?? []), participante]);
  }

  /** Esos jugadores pueden hacer la declaración hasta `hasta` (quien ya podía, sigue con su plazo). */
  abrir(declaracion: string, jugadores: string[], hasta: Plazo['hasta']): void {
    const actuales = this.plazos.get(declaracion) ?? [];
    const nuevos = jugadores.filter((jugador) => !actuales.some((p) => p.jugador === jugador)).map((jugador) => ({ jugador, hasta }));
    if (nuevos.length) this.plazos.set(declaracion, [...actuales, ...nuevos]);
  }

  /** Los plazos abiertos de una declaración (los de `hasta`, si se dice). */
  abiertos(declaracion: string, hasta?: Plazo['hasta']): Plazo[] {
    return (this.plazos.get(declaracion) ?? []).filter((p) => !hasta || p.hasta === hasta).map((p) => ({ ...p }));
  }

  /** Si ese jugador puede aún hacer la declaración. */
  enPlazo(declaracion: string, jugador: string): boolean {
    return this.plazos.get(declaracion)?.some((p) => p.jugador === jugador) ?? false;
  }

  /** Ese jugador ya no puede hacerla (la ha hecho, o se le ha acabado el plazo). */
  cerrar(declaracion: string, jugador: string): void {
    const quedan = (this.plazos.get(declaracion) ?? []).filter((p) => p.jugador !== jugador);
    this.plazos.set(declaracion, quedan);
  }

  /** Se acaba la partida: nadie puede ya hacer ninguna en plazo. */
  cerrarTodos(): void {
    this.plazos.clear();
  }

  /** Otra partida: nadie ha hecho nada. */
  olvidar(): void {
    this.hechas.clear();
    this.plazos.clear();
  }
}
