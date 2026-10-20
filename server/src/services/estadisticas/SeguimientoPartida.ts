import { CAUSAS_CON_VICTORIA, type SalaAlineamiento, type SalaRegistroVotacion } from '../../types/sala';

/** Una causa de final y, si es de alguien concreto (el esbirro que cazó a la Doncel), su cuenta. */
export interface CausaFinal {
  id: string;
  /** Solo para causas de esbirro: la cuenta del esbirro elegido (null: sin cuenta, no es de nadie). */
  userId?: string | null;
}

/** Cómo está un jugador con cuenta en un momento de la partida (ver SalaService.fotosDeCuentas). */
export interface FotoJugador {
  userId: string;
  /** Quien es de verdad (su «Is The …»), o null sin personaje. */
  personaje: string | null;
  alineamiento: SalaAlineamiento | null;
  muerto: boolean;
}

/** Lo de un jugador en una partida, tal como se guarda. */
export interface RegistroJugador {
  userId: string;
  /** Los roles con los que ha empezado la partida o algún día, sin repetir, por orden. */
  roles: string[];
  rolFinal: string | null;
  alineamientoInicial: SalaAlineamiento | null;
  alineamientoFinal: SalaAlineamiento | null;
  gano: boolean | null;
  vivo: boolean | null;
  /** Las causas de final (CAUSAS_FIN_PARTIDA) de los roles que ha jugado. */
  causas: string[];
  nominaciones: number;
  nominado: number;
  votos: number;
  ejecutado: number;
}

/** Un asiento de la mesa al terminar la partida (con cuenta o sin ella), para el historial. */
export interface AsientoPartida {
  /** Su número en la mesa (1, el de las 12). */
  numero: number;
  /** Quien se sentaba (su nombre en la sala), o null si estaba libre. */
  nombre: string | null;
  /** Su cuenta, si la tenía. */
  userId: string | null;
  /** Quien era de verdad (su «Is The …» o su ficha). */
  personaje: string | null;
  /** La ficha que llevaba, si no era quien era de verdad (el Borracho que se creía Lavandera). */
  ficha: string | null;
  alineamiento: SalaAlineamiento | null;
  muerto: boolean;
}

/** Una partida terminada, tal como se guarda (ver EstadisticasRepository). */
export interface RegistroPartida {
  fecha: Date;
  guion: string | null;
  edicion: string | null;
  ganador: SalaAlineamiento;
  /** Hasta qué día (o noche) se jugó. */
  dias: number;
  causas: string[];
  jugadores: RegistroJugador[];
  /** Los narradores con cuenta. */
  narradores: string[];
  /** La mesa entera, los nombres de quienes narraban, los NPCs y las nominaciones (para el historial). */
  mesa: AsientoPartida[];
  narradoresNombres: string[];
  npcs: string[];
  votaciones: SalaRegistroVotacion[];
}

/** Lo apuntado en un momento (ver instantanea). */
export interface InstantaneaSeguimiento {
  seguidos: [string, Seguido][];
  empezada: boolean;
}

interface Seguido {
  roles: string[];
  alineamientoInicial: SalaAlineamiento | null;
  /** La última vez que se le vio en la mesa. */
  ultima: FotoJugador;
  nominaciones: number;
  nominado: number;
  votos: number;
  ejecutado: number;
}

/**
 * Lo que se va apuntando de cada jugador con cuenta durante una partida, para
 * guardarlo al terminar. Un cambio de rol solo cuenta si empieza el día con él:
 * se mira al empezar la partida (la primera noche) y en cada amanecer, no lo que
 * pase de noche. Si alguien se sienta con la partida empezada, desde entonces.
 */
export class SeguimientoPartida {
  private seguidos = new Map<string, Seguido>();
  private empezada = false;

  /** Se ha empezado a seguir (la primera noche). */
  estaEmpezada(): boolean {
    return this.empezada;
  }

  /** La partida empieza (cae la primera noche): el rol y el alineamiento con los que empieza cada uno. */
  empezar(fotos: FotoJugador[]): void {
    this.seguidos.clear();
    this.empezada = true;
    this.anotarRoles(fotos);
  }

  /** Empieza el día: el rol con el que empieza cada uno cuenta como jugado. */
  anotarRoles(fotos: FotoJugador[]): void {
    for (const foto of fotos) {
      const s = this.seguido(foto);
      if (foto.personaje && !s.roles.includes(foto.personaje)) s.roles.push(foto.personaje);
    }
  }

  nomina(desde: string | null, hasta: string | null): void {
    if (desde) this.contar(desde, 'nominaciones');
    if (hasta) this.contar(hasta, 'nominado');
  }

  vota(userId: string | null): void {
    if (userId) this.contar(userId, 'votos');
  }

  /** Cae la noche con su calavera puesta: lo ha ejecutado la plaza. */
  ejecutado(userId: string | null): void {
    if (userId) this.contar(userId, 'ejecutado');
  }

  /**
   * Termina la partida: lo de cada uno, con cómo acaba (los que siguen en la mesa)
   * o como se le vio por última vez (los que se fueron antes).
   */
  terminar(finales: FotoJugador[], ganador: SalaAlineamiento, causas: CausaFinal[]): RegistroJugador[] {
    for (const foto of finales) this.seguido(foto).ultima = foto;
    const registros = [...this.seguidos].map(([userId, s]) => {
      const final = s.ultima;
      return {
        userId,
        roles: s.roles,
        rolFinal: s.roles[s.roles.length - 1] ?? final.personaje,
        alineamientoInicial: s.alineamientoInicial,
        alineamientoFinal: final.alineamiento,
        gano: final.alineamiento ? final.alineamiento === ganador : null,
        vivo: !final.muerto,
        // Cada logro, de quien llevaba ese personaje (o del esbirro elegido); los que exigen
        // ganar, solo si ha ganado
        causas: causas
          .filter((c) => (c.userId !== undefined ? c.userId === userId : s.roles.includes(c.id) || final.personaje === c.id))
          .filter((c) => !CAUSAS_CON_VICTORIA.includes(c.id) || final.alineamiento === ganador)
          .map((c) => c.id),
        nominaciones: s.nominaciones,
        nominado: s.nominado,
        votos: s.votos,
        ejecutado: s.ejecutado,
      };
    });
    this.reiniciar();
    return registros;
  }

  /** Una copia de lo apuntado hasta ahora, para volver a ello (la máquina del tiempo del narrador). */
  instantanea(): InstantaneaSeguimiento {
    return { seguidos: structuredClone([...this.seguidos]), empezada: this.empezada };
  }

  /** Vuelve a lo apuntado en una instantánea. */
  restaurar(i: InstantaneaSeguimiento): void {
    this.seguidos = new Map(structuredClone(i.seguidos));
    this.empezada = i.empezada;
  }

  /** Otra partida (o la misma, desde cero): se olvida lo apuntado. */
  reiniciar(): void {
    this.seguidos.clear();
    this.empezada = false;
  }

  private seguido(foto: FotoJugador): Seguido {
    let s = this.seguidos.get(foto.userId);
    if (!s) {
      s = { roles: [], alineamientoInicial: foto.alineamiento, ultima: foto, nominaciones: 0, nominado: 0, votos: 0, ejecutado: 0 };
      this.seguidos.set(foto.userId, s);
    }
    s.ultima = foto;
    return s;
  }

  private contar(userId: string, que: 'nominaciones' | 'nominado' | 'votos' | 'ejecutado'): void {
    const s = this.seguidos.get(userId);
    if (s) s[que] += 1;
  }
}
