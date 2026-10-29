import type { MensajeDespertar, SalaAsiento, SalaEnvioDespertar, SalaOpcionDespertar, SalaRegistroVotacion } from '../../contrato/sala';
import { droison } from '../partida/reglas/ReglaPersonaje';
import type { Opcion } from './estrategias/EstrategiaNarrador';
import type { SalaService } from '../SalaService';
import { contextoNoche, nombreDeAsiento, tipoReal, vivo } from './mesaDeJuego';

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
  votaciones: SalaRegistroVotacion[];
}

/** El número (1, 2…) de cada asiento, por su id. */
const numeros = (asientos: SalaAsiento[]) => new Map(asientos.map((a, i) => [a.id, i + 1]));

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

export function instantaneaGrimorio(sala: SalaService): Grimorio {
  const asientos = sala.asientos();
  const numero = numeros(asientos);
  const noche = contextoNoche(sala);
  const despertares = sala.despertares();
  return {
    guion: sala.guion()?.edicion ?? null,
    fase: { momento: sala.fase().momento, numero: sala.fase().numero },
    asientos: asientos.map((a, i) => {
      const identidad = sala.identidad(a) ?? null;
      const alineamiento = sala.alineamientoEfectivo(a) ?? null;
      const malvado = alineamiento === 'malvado';
      return {
        numero: i + 1,
        nombre: nombreDeAsiento(sala, a.id),
        ocupado: !!a.ocupante,
        personaje: identidad,
        tipo: tipoReal(sala, a) ?? null,
        ...(a.personaje && a.personaje !== identidad ? { ficha: a.personaje } : {}),
        alineamiento,
        vivo: vivo(a),
        droison: droison(noche, a),
        votoGastado: a.votoGastado,
        recordatorios: a.recordatorios.map((r) => ({ personaje: r.personaje, texto: r.texto })),
        ...(malvado ? { faroles: a.faroles.filter((f): f is string => !!f), farolEnUso: a.farolEnUso ?? null } : {}),
        despertar: (despertares.find((d) => d.asiento === a.id)?.mensajes ?? []).map((m) => mensaje(m, numero)),
      };
    }),
    personajes: (sala.guion()?.personajes ?? []).map((p) => ({ id: p.id, nombre: p.nombre, tipo: p.tipo })),
    farolesDemonio: sala.faroles().filter((f): f is string => !!f),
    votaciones: sala.votaciones(),
  };
}

/** Un asiento como opción de una decisión: «Asiento 3: Ana (chef, bueno)». */
export function describirAsiento(sala: SalaService, asiento: SalaAsiento): string {
  const i = sala.asientos().findIndex((a) => a.id === asiento.id);
  const quien = sala.identidad(asiento);
  const datos = [quien && (sala.personaje(quien)?.nombre ?? quien), sala.alineamientoEfectivo(asiento), vivo(asiento) ? null : 'muerto'].filter(Boolean);
  return `Asiento ${i + 1}: ${nombreDeAsiento(sala, asiento.id)}${datos.length ? ` (${datos.join(', ')})` : ''}`;
}

/** Un personaje como opción: «Monje (townsfolk)». */
export function describirPersonaje(sala: SalaService, id: string): string {
  const p = sala.personaje(id);
  return p ? `${p.nombre} (${p.tipo})` : id;
}

/** Unos asientos como opciones de una decisión (la clave, su número: «a3»). */
export function opcionesDeAsientos(sala: SalaService, asientos: readonly SalaAsiento[]): Opcion<SalaAsiento>[] {
  const numero = numeros(sala.asientos());
  return asientos.map((a) => ({ clave: `a${numero.get(a.id) ?? a.id}`, descripcion: describirAsiento(sala, a), valor: a }));
}

/** Lo que se le manda a alguien en su despertar, en palabras: «tarjeta esteJugadorEs; ficha dos; jugadores 3 y 5; personajes Chef». */
export function describirEnvio(sala: SalaService, envio: SalaEnvioDespertar): string {
  const numero = numeros(sala.asientos());
  const partes = [
    envio.tarjeta && `tarjeta ${envio.tarjeta}`,
    envio.ficha && `ficha ${envio.ficha}`,
    envio.jugadores.length > 0 && `jugadores ${envio.jugadores.map((id) => numero.get(id) ?? id).join(' y ')}`,
    envio.personajes.length > 0 && `personajes ${envio.personajes.map((id) => sala.personaje(id)?.nombre ?? id).join(' y ')}`,
    envio.texto && `texto «${envio.texto}»`,
  ];
  return partes.filter(Boolean).join('; ') || 'nada';
}

/** Una respuesta propuesta de un despertar, con cómo registra cada uno para que salga. */
export function describirOpcion(sala: SalaService, { envio, registros }: SalaOpcionDespertar): string {
  const numero = numeros(sala.asientos());
  const como = registros.map((r) => `el asiento ${numero.get(r.asiento) ?? r.asiento} registra como ${r.como}`);
  return `${describirEnvio(sala, envio)}${como.length ? ` (${como.join(', ')})` : ''}`;
}
