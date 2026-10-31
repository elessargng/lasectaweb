import type { MensajeDespertar, EnvioDespertar, OpcionDespertar } from '../../contrato/despertar';
import type { RegistroVotacionDto } from '../../contrato/partida';
import { droison } from '../partida/reglas/ReglaPersonaje';
import type { Opcion } from './estrategias/EstrategiaNarrador';
import type { SalaDeJuego } from '../../services/SalaDeJuego';
import { contextoNoche, nombreDeAsiento, tipoReal, vivo } from './plazaDeJuego';
import { identidadDe } from '../partida/Grimorio';
import type { Jugador } from '../partida/Jugador';

/**
 * El grimorio tal como lo ve el narrador, en una foto para decidir: lo que la
 * estrategia del narrador virtual recibe junto con cada decisión (Jarvis se lo
 * manda a su modelo). Solo datos: se puede convertir en JSON tal cual.
 */

/** Lo que el narrador le ha dicho a un asiento de noche (o lo que ha contestado). */
export interface MensajeGrimorio {
  de: 'narrador' | 'jugador';
  fase: string;
  ficha: string | null;
  tarjeta: string | null;
  /** Números de asiento. */
  jugadores: number[];
  personajes: string[];
  texto: string | null;
}

export interface AsientoGrimorio {
  numero: number;
  nombre: string;
  /** Si lo ocupa alguien (si no, elige el narrador por él). */
  ocupado: boolean;
  /** Quién es de verdad (su «Is The …» o su ficha), o null si aún no tiene. */
  personaje: string | null;
  tipo: string | null;
  /** La ficha que tiene, si no es quien es (el Borracho cree ser otro). */
  ficha?: string;
  alineamiento: string | null;
  vivo: boolean;
  /** Envenenado o borracho, o null. */
  droison: 'envenenado' | 'borracho' | null;
  /** Le queda el voto de muerto (solo los muertos lo gastan). */
  votoGastado: boolean;
  recordatorios: { personaje: string; texto: string }[];
  /** Malvados: los personajes por los que se hacen pasar y el que dicen usar. */
  faroles?: string[];
  farolEnUso?: string | null;
  /** Lo hablado en su despertar. */
  despertar: MensajeGrimorio[];
}

export interface Grimorio {
  guion: string | null;
  fase: { momento: string; numero: number };
  asientos: AsientoGrimorio[];
  /** Los personajes del guion: id, nombre y tipo. */
  personajes: { id: string; nombre: string; tipo: string }[];
  /** Los faroles que tiene el demonio (los del narrador). */
  farolesDemonio: string[];
  votaciones: RegistroVotacionDto[];
}

/** El número (1, 2…) de cada asiento, por su id. */
const numeros = (jugadores: readonly Jugador[]) => new Map(jugadores.map((a, i) => [a.id, i + 1]));

function mensaje(m: MensajeDespertar, numero: Map<string, number>): MensajeGrimorio {
  return {
    de: m.autor === 'narrador' ? 'narrador' : 'jugador',
    fase: `${m.fase.momento} ${m.fase.numero}`,
    ficha: m.ficha,
    tarjeta: m.tarjeta,
    jugadores: m.jugadores.flatMap((id) => numero.get(id) ?? []),
    personajes: m.personajes,
    texto: m.texto,
  };
}

export function instantaneaGrimorio(juego: SalaDeJuego): Grimorio {
  const { partida } = juego;
  const jugadores = partida.plaza();
  const numero = numeros(jugadores);
  const noche = contextoNoche(juego);
  const despertares = partida.despertares.despertares();
  return {
    guion: partida.guion.actual()?.edicion ?? null,
    fase: { momento: partida.fases.actual().momento, numero: partida.fases.actual().numero },
    asientos: jugadores.map((a, i) => {
      const identidad = identidadDe(a) ?? null;
      const alineamiento = partida.grimorio.alineamiento(a) ?? null;
      const malvado = alineamiento === 'malvado';
      return {
        numero: i + 1,
        nombre: nombreDeAsiento(juego, a.id),
        ocupado: !!a.participanteId,
        personaje: identidad,
        tipo: tipoReal(juego, a) ?? null,
        ...(a.personaje && a.personaje !== identidad ? { ficha: a.personaje } : {}),
        alineamiento,
        vivo: vivo(a),
        droison: droison(noche, a),
        votoGastado: a.votoGastado,
        recordatorios: a.recordatorios.map((r) => ({ personaje: r.personaje, texto: r.texto })),
        ...(malvado ? { faroles: partida.faroles.deJugador(a).filter((f): f is string => !!f), farolEnUso: partida.faroles.enUso(a) } : {}),
        despertar: (despertares.find((d) => d.jugador === a.id)?.mensajes ?? []).map((m) => mensaje(m, numero)),
      };
    }),
    personajes: (partida.guion.actual()?.personajes ?? []).map((p) => ({ id: p.id, nombre: p.nombre, tipo: p.tipo })),
    farolesDemonio: partida.faroles.faroles().filter((f): f is string => !!f),
    votaciones: partida.nominaciones.votaciones(),
  };
}

/** Un asiento como opción de una decisión: «Asiento 3: Ana (chef, bueno)». */
export function describirAsiento(juego: SalaDeJuego, jugador: Jugador): string {
  const { partida } = juego;
  const i = partida.plaza().findIndex((a) => a.id === jugador.id);
  const quien = identidadDe(jugador);
  const datos = [quien && (partida.guion.personaje(quien)?.nombre ?? quien), partida.grimorio.alineamiento(jugador), vivo(jugador) ? null : 'muerto'].filter(Boolean);
  return `Asiento ${i + 1}: ${nombreDeAsiento(juego, jugador.id)}${datos.length ? ` (${datos.join(', ')})` : ''}`;
}

/** Un personaje como opción: «Monje (townsfolk)». */
export function describirPersonaje(juego: SalaDeJuego, id: string): string {
  const { partida } = juego;
  const p = partida.guion.personaje(id);
  return p ? `${p.nombre} (${p.tipo})` : id;
}

/** Unos asientos como opciones de una decisión (la clave, su número: «a3»). */
export function opcionesDeAsientos(juego: SalaDeJuego, jugadores: readonly Jugador[]): Opcion<Jugador>[] {
  const { partida } = juego;
  const numero = numeros(partida.plaza());
  return jugadores.map((a) => ({ clave: `a${numero.get(a.id) ?? a.id}`, descripcion: describirAsiento(juego, a), valor: a }));
}

/** Lo que se le manda a alguien en su despertar, en palabras: «tarjeta esteJugadorEs; ficha dos; jugadores 3 y 5; personajes Chef». */
export function describirEnvio(juego: SalaDeJuego, envio: EnvioDespertar): string {
  const { partida } = juego;
  const numero = numeros(partida.plaza());
  const partes = [
    envio.tarjeta && `tarjeta ${envio.tarjeta}`,
    envio.ficha && `ficha ${envio.ficha}`,
    envio.jugadores.length > 0 && `jugadores ${envio.jugadores.map((id) => numero.get(id) ?? id).join(' y ')}`,
    envio.personajes.length > 0 && `personajes ${envio.personajes.map((id) => partida.guion.personaje(id)?.nombre ?? id).join(' y ')}`,
    envio.texto && `texto «${envio.texto}»`,
  ];
  return partes.filter(Boolean).join('; ') || 'nada';
}

/** Una respuesta propuesta de un despertar, con cómo registra cada uno para que salga. */
export function describirOpcion(juego: SalaDeJuego, { envio, registros }: OpcionDespertar): string {
  const { partida } = juego;
  const numero = numeros(partida.plaza());
  const como = registros.map((r) => `el asiento ${numero.get(r.jugador) ?? r.jugador} registra como ${r.como}`);
  return `${describirEnvio(juego, envio)}${como.length ? ` (${como.join(', ')})` : ''}`;
}
