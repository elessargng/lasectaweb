import type { SalaAsiento, SalaNominacion, SalaParticipante, SalaRegistroVotacion } from '../../contrato/sala';

/**
 * La cuenta atrás de las nominaciones: siempre de 3 a 0, un segundo cada número
 * (4 s, lo que dura su sonido en el cliente).
 */
export const SALA_CUENTA_ATRAS_MS = 4000;

type NominacionInterna = Omit<SalaNominacion, 'votosNecesarios' | 'votosNecesariosPorDefecto' | 'privada'> & {
  /** Los votos que ha fijado el narrador; null: los de por defecto. */
  votosElegidos: number | null;
  /** Su entrada del registro, que se completa al terminar la votación. */
  registro: SalaRegistroVotacion | null;
  /** Los asientos de muertos que ya no tenían voto al empezar la votación (para la votación secreta). */
  gastadosAlVotar?: string[];
  /**
   * Los votos que hacían falta por defecto cuando terminó su votación: se siguen
   * enseñando hasta la siguiente nominación (el récord del día que deja esta
   * votación, la que más tuvo, solo cuenta para las siguientes).
   */
  porDefectoAlTerminar?: number;
};

/**
 * Lo que la votación necesita saber de la sala. Las reglas de los personajes que
 * cambian quién vota y cuánto vale su voto (Voudon, Banshee, Burócrata, Ladrón,
 * Organ Grinder) vienen de fuera: no son cosa de la votación.
 */
export interface EntornoVotacion {
  /** La mesa, en orden. */
  mesa(): SalaAsiento[];
  buscar(participanteId: string): SalaParticipante | undefined;
  /** El día de la partida (para el registro). */
  dia(): number;
  /** Lo que tarda la aguja en pasar de una ficha a la siguiente. */
  segundosPorFicha(): number;
  /** No puede votar (muerto sin voto; con el Voudon vivo, los vivos que no son él). */
  sinVoto(participanteId: string): boolean;
  /** Vota con las dos manos y sin gastar su voto de muerto (la Banshee con su habilidad). */
  puedeVotarDoble(participanteId: string): boolean;
  /** El Voudon está vivo: basta 1 voto y los muertos no gastan el suyo. */
  voudonVivo(): boolean;
  /** Lo que vale el voto de quien se sienta en un asiento (1, o lo que digan sus recordatorios). */
  valorDelVoto(asiento: SalaAsiento, ocupante: SalaParticipante): number;
  /** La votación es secreta (Organ Grinder). */
  secreta(): boolean;
  /** Para las estadísticas: alguien ha nominado a alguien, y alguien ha votado. */
  alNominar(desdeAsiento: string, hastaAsiento: string): void;
  alVotar(participanteId: string): void;
  /** La votación ha avanzado sola (con el tiempo): hay que mandar el estado a todos. */
  alCambiarSola(): void;
}

/**
 * Las nominaciones del día y sus votaciones: la cuenta atrás, la aguja que
 * recorre las fichas, el registro para el narrador y el récord del día (lo que
 * tiene que superar la siguiente). No comprueba permisos.
 */
export class Nominaciones {
  private nominacionEnCurso: NominacionInterna | null = null;
  /** Lo siguiente que toca en la nominación: el fin de la cuenta atrás o el próximo paso de la votación. */
  private temporizador: NodeJS.Timeout | null = null;
  private registro: SalaRegistroVotacion[] = [];
  /** Los votos de la votación de hoy que más tuvo (de las que llegaron a los necesarios), o null. */
  private maximoDelDia: number | null = null;

  constructor(private readonly entorno: EntornoVotacion) {}

  /** El registro de nominaciones y votaciones, en el orden en que se nominó. */
  votaciones(): SalaRegistroVotacion[] {
    return this.registro.map((v) => ({ ...v, votantes: v.votantes && [...v.votantes] }));
  }

  /** El récord de votos del día (ver maximoDelDia), para que la máquina del tiempo lo devuelva. */
  recordDelDia(): number | null {
    return this.maximoDelDia;
  }

  ponerRecordDelDia(votos: number | null): void {
    this.maximoDelDia = votos;
  }

  /** Otra partida: sin nominación, sin registro y sin récord. */
  olvidarTodo(): void {
    this.cerrarNominacion();
    this.registro = [];
    this.maximoDelDia = null;
  }

  /** Los asientos han cambiado de sitio (ver SalaService.llevarFichas): la nominación los sigue. */
  remapear(a: (asientoId: string) => string): void {
    const n = this.nominacionEnCurso;
    if (!n) return;
    n.desde = a(n.desde);
    n.hasta = a(n.hasta);
    if (n.votacion) {
      n.votacion.orden = n.votacion.orden.map(a);
      n.votacion.resultados = Object.fromEntries(Object.entries(n.votacion.resultados).map(([k, v]) => [a(k), v]));
      if (n.votacion.valores) n.votacion.valores = Object.fromEntries(Object.entries(n.votacion.valores).map(([k, v]) => [a(k), v]));
    }
  }

  private pararTemporizador(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
  }

  /** «asiento 3 (Bea)» o «asiento 3, libre», como lo verá el narrador en el registro. */
  private describirAsiento(asientoId: string): string {
    const i = this.entorno.mesa().findIndex((a) => a.id === asientoId);
    const ocupante = this.entorno.mesa()[i]?.ocupante;
    const nombre = ocupante ? this.entorno.buscar(ocupante)?.nombre : undefined;
    return nombre ? `asiento ${i + 1} (${nombre})` : `asiento ${i + 1}, libre`;
  }

  /**
   * Acaba la cuenta atrás: empieza la votación. La aguja del nominado va al
   * asiento siguiente (en el sentido de las agujas del reloj) y sigue hasta él.
   */
  private empezarVotacion(): void {
    const n = this.nominacionVigente();
    if (!n) return;
    const mesa = this.entorno.mesa();
    const i = mesa.findIndex((a) => a.id === n.hasta);
    const orden = mesa.map((_, k) => mesa[(i + 1 + k) % mesa.length].id);
    n.votacion = { orden, paso: 0, resultados: {}, votos: 0, terminada: false };
    n.gastadosAlVotar = mesa.filter((a) => a.votoGastado).map((a) => a.id);
    this.entorno.alCambiarSola();
    this.temporizador = setTimeout(() => this.avanzarVotacion(), this.entorno.segundosPorFicha() * 1000);
  }

  /**
   * La aguja llega a la siguiente ficha: vota si quien se sienta ahí tiene la mano
   * levantada (y entonces se le baja). Un muerto solo vota si le queda el voto, y
   * al votar lo gasta.
   */
  private avanzarVotacion(): void {
    const n = this.nominacionVigente();
    const v = n?.votacion;
    if (!n || !v || v.terminada) return;
    const asientoId = v.orden[v.paso];
    const asiento = this.entorno.mesa().find((a) => a.id === asientoId);
    const ocupante = asiento?.ocupante ? this.entorno.buscar(asiento.ocupante) : undefined;
    // La Banshee con su habilidad, y los muertos con el Voudon vivo, votan sin gastar el
    // voto de muerto (ni les hace falta); con el Voudon, los vivos no votan (salvo él)
    const conservaVoto = (!!ocupante && this.entorno.puedeVotarDoble(ocupante.id)) || this.entorno.voudonVivo();
    const sinVoto = !ocupante || this.entorno.sinVoto(ocupante.id);
    const vota = ocupante?.rol === 'jugador' && ocupante.manoLevantada && !sinVoto;
    if (vota) {
      const valor = this.entorno.valorDelVoto(asiento!, ocupante);
      v.votos += valor;
      if (valor !== 1) v.valores = { ...v.valores, [asientoId]: valor };
      this.entorno.alVotar(ocupante.id);
      // Voto contado: la mano baja sola.
      ocupante.manoLevantada = false;
      ocupante.dosManos = false;
      if (asiento?.muerto && !conservaVoto) asiento.votoGastado = true;
    }
    v.resultados[asientoId] = vota ? v.votos : null;
    v.paso += 1;
    if (v.paso >= v.orden.length) {
      v.terminada = true;
      this.temporizador = null;
      n.porDefectoAlTerminar = this.votosNecesariosPorDefecto();
      // Si llega a los necesarios, la siguiente tendrá que superarla (aunque empate y
      // nadie se quede con la calavera)
      if (v.votos >= (n.votosElegidos ?? this.votosNecesariosPorDefecto())) {
        this.maximoDelDia = Math.max(this.maximoDelDia ?? 0, v.votos);
      }
      // Se completa su entrada del registro (la que se hizo al nominar)
      if (n.registro) {
        n.registro.votantes = v.orden
          .filter((id) => v.resultados[id] !== null && v.resultados[id] !== undefined)
          .map((id) => {
            const o = this.entorno.mesa().find((a) => a.id === id)?.ocupante;
            const nombre = (o && this.entorno.buscar(o)?.nombre) || this.describirAsiento(id);
            const valor = v.valores?.[id];
            return valor !== undefined ? `${nombre} (${valor} votos)` : nombre;
          });
        n.registro.votos = v.votos;
      }
    } else {
      this.temporizador = setTimeout(() => this.avanzarVotacion(), this.entorno.segundosPorFicha() * 1000);
    }
    this.entorno.alCambiarSola();
  }

  /** La nominación en curso (la de verdad); se anula sola si alguno de los dos asientos ya no existe. */
  private nominacionVigente(): NominacionInterna | null {
    const n = this.nominacionEnCurso;
    const existe = (id: string) => this.entorno.mesa().some((a) => a.id === id);
    if (n && (!existe(n.desde) || !existe(n.hasta))) {
      this.nominacionEnCurso = null;
      this.pararTemporizador();
    }
    return this.nominacionEnCurso;
  }

  /** La nominación en curso (una copia), con los votos que hacen falta. */
  nominacion(): SalaNominacion | null {
    const actual = this.nominacionVigente();
    if (!actual) return null;
    const { votosElegidos: _, registro: __, porDefectoAlTerminar, ...resto } = actual;
    const votosElegidos = actual.votosElegidos;
    // Votada, los de cuando terminó (no cambian al quedar el récord de esta votación)
    const porDefecto = porDefectoAlTerminar ?? this.votosNecesariosPorDefecto();
    return {
      ...resto,
      votacion: actual.votacion ? { ...actual.votacion, resultados: { ...actual.votacion.resultados } } : null,
      votosNecesarios: votosElegidos ?? porDefecto,
      votosNecesariosPorDefecto: porDefecto,
      privada: this.entorno.secreta(),
    };
  }

  /**
   * En la votación en curso, los asientos que ya no tenían voto al empezar (null si
   * no se está votando): en la votación secreta, a los demás se les manda esto en
   * lugar de su voto gastado, para que no se sepa qué muertos votan.
   */
  gastadosAlVotar(): Set<string> | null {
    const n = this.nominacionVigente();
    return n?.votacion && n.gastadosAlVotar ? new Set(n.gastadosAlVotar) : null;
  }

  /**
   * Los votos que hacen falta si el narrador no dice otra cosa: la mitad de las
   * fichas vivas, redondeando hacia arriba; y si ya ha habido hoy una votación
   * que llegó a los necesarios, al menos uno más que la que más tuvo. Nunca menos de 1.
   */
  private votosNecesariosPorDefecto(): number {
    const vivos = this.entorno.mesa().filter((a) => !a.muerto).length;
    // Con el Voudon vivo no hace falta la mitad: basta 1 (y superar la que más tuvo hoy)
    const mayoria = this.entorno.voudonVivo() ? 1 : Math.ceil(vivos / 2);
    return Math.max(1, mayoria, this.maximoDelDia === null ? 0 : this.maximoDelDia + 1);
  }

  /** El narrador fija los votos que hacen falta en la nominación en curso (null: los de por defecto). */
  elegirVotosNecesarios(votos: number | null): void {
    const n = this.nominacionVigente();
    if (n) n.votosElegidos = votos;
  }

  /**
   * Empieza una nominación (sustituye a la que hubiera) y la apunta en el
   * registro, con su día (si no se llega a votar, queda sin votos). Baja la mano
   * a los muertos que ya no tienen voto. No comprueba permisos.
   */
  nominar(desde: string, hasta: string): void {
    this.pararTemporizador();
    const registro: SalaRegistroVotacion = {
      hora: Date.now(),
      dia: this.entorno.dia(),
      nomina: this.describirAsiento(desde),
      nominado: this.describirAsiento(hasta),
      votantes: null,
      votos: null,
    };
    this.registro.push(registro);
    this.entorno.alNominar(desde, hasta);
    this.nominacionEnCurso = { desde, hasta, cuentaAtrasFin: null, votacion: null, votosElegidos: null, registro };
    // Quien no puede votar (un muerto sin voto; con el Voudon vivo, los vivos que no son
    // él): si tenía la mano levantada, se le baja
    for (const a of this.entorno.mesa()) {
      if (!a.ocupante || !this.entorno.sinVoto(a.ocupante)) continue;
      const ocupante = this.entorno.buscar(a.ocupante);
      if (ocupante) {
        ocupante.manoLevantada = false;
        ocupante.dosManos = false;
      }
    }
  }

  cerrarNominacion(): void {
    this.pararTemporizador();
    this.nominacionEnCurso = null;
  }

  /** Si la nominación en curso está votando (o ha votado ya). */
  hayVotacion(): boolean {
    return !!this.nominacion()?.votacion;
  }

  /** Arranca (o reinicia) la cuenta atrás de la nominación en curso; al acabar, se vota. */
  iniciarCuentaAtras(ahora: number): void {
    if (!this.nominacionEnCurso) return;
    this.pararTemporizador();
    this.nominacionEnCurso.cuentaAtrasFin = ahora + SALA_CUENTA_ATRAS_MS;
    this.temporizador = setTimeout(() => this.empezarVotacion(), SALA_CUENTA_ATRAS_MS);
  }
}
