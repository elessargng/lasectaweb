import { enElHistorial, type EntradaDiario, type FotoAsiento } from '../compartido/diario';
import type { Alineamiento } from '../compartido/jugador';
import { causaCuenta, type RegistroVotacion } from '../compartido/partida';
import { votaciones } from '../botc/partida/proyecciones/votaciones';

/** Lo de un jugador en una partida, tal como se guarda. */
export interface RegistroJugador {
  userId: string;
  /** Los roles con los que ha empezado la partida o algún día, sin repetir, por orden. */
  roles: string[];
  rolFinal: string | null;
  alineamientoInicial: Alineamiento | null;
  alineamientoFinal: Alineamiento | null;
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
export type AsientoPartida = FotoAsiento;

/** Una partida terminada, tal como se guarda (ver EstadisticasRepository). */
export interface RegistroPartida {
  /** El id de la partida: si se vuelve a guardar (se deshizo la revelación y se reveló otra vez), sustituye a la guardada. */
  id: string;
  fecha: Date;
  guion: string | null;
  edicion: string | null;
  ganador: Alineamiento;
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
  votaciones: RegistroVotacion[];
  /** Lo que se enseña en el historial (ver models/compartido/diario, enElHistorial). */
  diario: EntradaDiario[];
}

/** Lo que se va sabiendo de un jugador con cuenta al recorrer el diario. */
interface Seguido {
  roles: string[];
  alineamientoInicial: Alineamiento | null;
  /** Cómo se le vio por última vez en la plaza. */
  ultima: FotoAsiento;
  nominaciones: number;
  nominado: number;
  votos: number;
  ejecutado: number;
}

/**
 * Una partida terminada, para guardarla, sacada de su diario (que acaba en «final»):
 * lo de cada jugador con cuenta, la mesa, las votaciones y lo que se enseña en el
 * historial. null si no acaba en «final» o si no hay nadie con cuenta.
 *
 * Cada jugador cuenta desde que se le ve en la plaza (al empezar la partida, la
 * primera noche, o al empezar un día, si se sentó después). Un rol cuenta como
 * jugado si empieza la partida o un día con él (los cambios de la noche, no). Lo
 * ejecuta la plaza si se le ejecuta (una vez) o, si ese día no se ha ejecutado a
 * nadie, si lleva la calavera al caer la noche. Si se reinicia una votación, los
 * votos contados en ella no valen.
 */
export function resumenPartida(id: string, diario: readonly EntradaDiario[]): RegistroPartida | null {
  const fin = diario[diario.length - 1];
  if (fin?.tipo !== 'final') return null;
  const seguidos = new Map<string, Seguido>();
  let empezada = false;
  /** Se le ve en la plaza al empezar la partida o un día: ese rol cuenta como jugado. */
  const ver = (foto: FotoAsiento) => {
    if (!foto.userId) return;
    let s = seguidos.get(foto.userId);
    if (!s) seguidos.set(foto.userId, (s = { roles: [], alineamientoInicial: foto.alineamiento, ultima: foto, nominaciones: 0, nominado: 0, votos: 0, ejecutado: 0 }));
    s.ultima = foto;
    if (foto.personaje && !s.roles.includes(foto.personaje)) s.roles.push(foto.personaje);
  };
  const contar = (userId: string | null | undefined, que: 'nominaciones' | 'nominado' | 'votos' | 'ejecutado', cuanto = 1) => {
    const s = userId ? seguidos.get(userId) : undefined;
    if (s) s[que] = Math.max(0, s[que] + cuanto);
  };
  // Las cuentas que han votado en la votación de ahora, y si hoy ya se ha ejecutado a alguien
  let votantes: (string | null | undefined)[] = [];
  let ejecutadoHoy = false;

  for (const e of diario) {
    switch (e.tipo) {
      case 'anochece':
        if (e.desdePreparacion || !empezada) {
          seguidos.clear();
          empezada = true;
          e.plaza.forEach(ver);
        } else if (e.calavera && !ejecutadoHoy) contar(e.calavera.userId, 'ejecutado');
        break;
      case 'amanece':
        ejecutadoHoy = false;
        if (empezada) e.plaza.forEach(ver);
        break;
      case 'nominacion':
        votantes = [];
        if (e.expulsion) break;
        contar(e.asiento.userId, 'nominaciones');
        contar(e.objetivo.userId, 'nominado');
        break;
      case 'voto':
        votantes.push(e.asiento.userId);
        contar(e.asiento.userId, 'votos');
        break;
      case 'reinicioVotacion':
        for (const userId of votantes) contar(userId, 'votos', -1);
        votantes = [];
        break;
      case 'ejecucion':
        ejecutadoHoy = true;
        contar(e.asiento.userId, 'ejecutado');
        break;
    }
  }

  const { ganador, causas, plaza, narradores, npcs, guion, edicion } = fin;
  // Los que siguen en la mesa, como acaban (su rol no cuenta como jugado: no empieza un día); los que se fueron antes, como se les vio por última vez
  if (empezada) {
    for (const foto of plaza) {
      const s = foto.userId ? seguidos.get(foto.userId) : undefined;
      if (s) s.ultima = foto;
    }
  }
  const jugadores: RegistroJugador[] = [...seguidos].map(([userId, s]) => {
    const final = s.ultima;
    return {
      userId,
      roles: s.roles,
      rolFinal: s.roles[s.roles.length - 1] ?? final.personaje,
      alineamientoInicial: s.alineamientoInicial,
      alineamientoFinal: final.alineamiento,
      gano: final.alineamiento ? final.alineamiento === ganador : null,
      vivo: !final.muerto,
      // Cada logro, de quien llevaba ese personaje (o del esbirro elegido); los que exigen ganar, solo si ha ganado
      causas: causas
        .filter((c) => (c.userId !== undefined ? c.userId === userId : s.roles.includes(c.id) || final.personaje === c.id))
        .filter((c) => causaCuenta(c.id, final.alineamiento === ganador))
        .map((c) => c.id),
      nominaciones: s.nominaciones,
      nominado: s.nominado,
      votos: s.votos,
      ejecutado: s.ejecutado,
    };
  });
  const conCuenta = narradores.map((n) => n.userId).filter((u): u is string => !!u);
  if (jugadores.length === 0 && conCuenta.length === 0) return null;
  return {
    id,
    fecha: new Date(fin.hora),
    guion,
    edicion,
    ganador,
    dias: fin.fase.numero,
    causas: causas.map((c) => c.id),
    jugadores,
    narradores: conCuenta,
    mesa: plaza,
    narradoresNombres: narradores.map((n) => n.nombre),
    npcs,
    votaciones: votaciones(diario),
    diario: diario.filter(enElHistorial),
  };
}
