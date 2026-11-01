import type { Participante } from '../../../models/sala/Participantes';
import type { SalaDeJuego } from '../../../models/SalaDeJuego';
import { GUIONES_NARRADOR_VIRTUAL, JUGADORES_NARRADOR_VIRTUAL, NARRADORES_VIRTUALES, type GuionNarradorVirtual, type IdNarradorVirtual } from '../../../models/compartido/narradorVirtual';
import type { AccionJugador } from '../../../models/narradorVirtual/etapas/Etapa';
import { noPuedeNominar, nominoHoy } from '../../../models/narradorVirtual/dia/reglasDia';
import { DECLARACIONES_DIA } from '../../../models/personajes';
import type { DeclaracionDia } from '../../../models/personajes/DeclaracionDia';
import type { DependenciasAcciones } from '../puertos';
import type { Accion, SalaEfecto } from './Accion';

/** Lo que pide un jugador al narrador virtual en el día: se lo pasa (ya comprobado que puede). */
const alNarradorVirtual =
  (accion: AccionJugador) =>
  async (_juego: SalaDeJuego, yo: Participante, datos: unknown, deps: DependenciasAcciones): Promise<SalaEfecto> => {
    if (!deps.narradorVirtual) return { ok: false, error: 'Esta sala no tiene narradores virtuales.' };
    const error = await deps.narradorVirtual.pedir(yo.id, accion, datos);
    return error ? { ok: false, error } : { ok: true };
  };

/** Una declaración del día (ver models/personajes): sus permisos son los suyos; la hace el narrador virtual. */
const accionDeDeclarar = (d: DeclaracionDia): Accion => ({
  puede: (juego, yo) => d.puede(juego, yo),
  noPuede: (juego, yo) => d.noPuede(juego, yo),
  hacer: async (_juego, yo, datos, { narradorVirtual }) => {
    if (!narradorVirtual) return { ok: false, error: 'Esta sala no tiene narradores virtuales.' };
    const r = await narradorVirtual.declarar(yo.id, d.id, datos);
    return 'error' in r ? { ok: false, error: r.error } : { ok: true, ...r };
  },
});

/** El turno de la nominación del narrador virtual en el que está el de ese jugador (quien nomina o el nominado). */
const enSuTurno = (juego: SalaDeJuego, yo: Participante, turno: 'acusacion' | 'defensa') => {
  const { partida, narrador } = juego;
  const n = partida.nominaciones.nominacion();
  const mio = partida.jugadorDe(yo.id)?.id;
  return narrador.actual()?.turno === turno && !!n && !!mio && (turno === 'acusacion' ? n.desde : n.hasta) === mio;
};

/** El narrador virtual: añadirlo, quitarlo y lo que le piden los jugadores de día. */
export const ACCIONES_NARRADOR_VIRTUAL: Record<string, Accion> = {
  /**
   * En lugar de hacerse narrador, añade un narrador virtual que lleva la partida
   * solo. datos: { narrador: id de NARRADORES_VIRTUALES (disponible), guion: id de
   * GUIONES_NARRADOR_VIRTUAL, jugadores: de JUGADORES_NARRADOR_VIRTUAL.min a .max, y
   * de los que admite ese guion }.
   * Solo con cuenta: los invitados, no.
   */
  'sala:anadirNarradorVirtual': {
    puede: ({ sala }, yo) => !sala.participantes.hayNarrador() && yo.rol !== 'narrador' && yo.persona.tipo === 'usuario',
    noPuede: ({ sala }, yo) => (sala.participantes.hayNarrador() || yo.rol === 'narrador' ? 'La sala ya tiene narrador.' : 'Para añadir un narrador virtual necesitas una cuenta.'),
    hacer: async (_sala, yo, datos, { narradorVirtual }) => {
      if (!narradorVirtual) return { ok: false, error: 'Esta sala no tiene narradores virtuales.' };
      const { narrador, guion, jugadores } = (datos as Record<string, unknown>) ?? {};
      if (!NARRADORES_VIRTUALES.some((n) => n.id === narrador && n.disponible)) {
        return { ok: false, error: 'Ese narrador virtual aún no está disponible.' };
      }
      const delGuion = GUIONES_NARRADOR_VIRTUAL.find((g) => g.id === guion);
      if (!delGuion) return { ok: false, error: 'Ese guion aún no se puede jugar con narrador virtual.' };
      const { min, max } = JUGADORES_NARRADOR_VIRTUAL;
      if (typeof jugadores !== 'number' || !Number.isInteger(jugadores) || jugadores < min || jugadores > max) {
        return { ok: false, error: `Tiene que haber de ${min} a ${max} jugadores.` };
      }
      if (jugadores < delGuion.jugadores.min || jugadores > delGuion.jugadores.max) {
        return { ok: false, error: `${delGuion.nombre} es para ${delGuion.jugadores.min} a ${delGuion.jugadores.max} jugadores.` };
      }
      const error = await narradorVirtual.anadir(yo.id, {
        narrador: narrador as IdNarradorVirtual,
        guion: guion as GuionNarradorVirtual,
        jugadores,
      });
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /** Quita el narrador virtual: solo quien lo añadió. */
  'sala:quitarNarradorVirtual': {
    puede: ({ narrador }, yo) => narrador.actual()?.creador === yo.id,
    noPuede: ({ narrador }) => (narrador.actual() ? 'Solo quien añadió al narrador virtual puede quitarlo.' : 'La sala no tiene narrador virtual.'),
    hacer: (_sala, _yo, _datos, { narradorVirtual }) => {
      narradorVirtual?.quitar();
      return { ok: true };
    },
  },

  /**
   * Con narrador virtual, de día: un jugador vivo nomina a otro (una vez al día, y a
   * cada uno se le nomina una vez). datos: { jugadorId } del nominado.
   */
  'jugador:nominar': {
    puede: (juego, yo) => !noPuedeNominar(juego, yo),
    noPuede: (juego, yo) => noPuedeNominar(juego, yo) ?? '',
    hacer: alNarradorVirtual('nominar'),
  },

  /** Quien nomina termina su acusación: le toca hablar al nominado. */
  'jugador:defensa': {
    puede: (juego, yo) => enSuTurno(juego, yo, 'acusacion'),
    noPuede: 'Ahora no te toca acusar.',
    hacer: alNarradorVirtual('defensa'),
  },

  /** El nominado termina su defensa: empieza la votación. */
  'jugador:voto': {
    puede: (juego, yo) => enSuTurno(juego, yo, 'defensa'),
    noPuede: 'Ahora no te toca defenderte.',
    hacer: alNarradorVirtual('voto'),
  },

  /** Listo para pasar a la noche (con narrador virtual, en las nominaciones). */
  'jugador:listo': {
    // En medio de una nominación, no: se decide al acabarla
    puede: ({ partida, narrador }, yo) =>
      narrador.actual()?.etapa === 'nominaciones' && !partida.nominaciones.nominacion() && !!partida.jugadorDe(yo.id) && !narrador.actual()!.listos.includes(yo.id),
    noPuede: 'Ahora no hay que decir si estás listo.',
    hacer: alNarradorVirtual('listo'),
  },

  /** Ya no está listo: quiere seguir nominando (quien ya ha nominado hoy, no). */
  'jugador:seguirNominando': {
    puede: (juego, yo) => {
      const { partida, narrador } = juego;
      const jugador = partida.jugadorDe(yo.id);
      return (
        narrador.actual()?.etapa === 'nominaciones' &&
        !partida.nominaciones.nominacion() &&
        !!jugador &&
        !jugador.muerto &&
        narrador.actual()!.listos.includes(yo.id) &&
        !nominoHoy(juego, jugador.id)
      );
    },
    noPuede: 'Ahora no puedes dejar de estar listo.',
    hacer: alNarradorVirtual('seguirNominando'),
  },

  /** Las declaraciones del día con narrador virtual: `jugador:<id>` (ver models/personajes). */
  ...Object.fromEntries(DECLARACIONES_DIA.map((d) => [`jugador:${d.id}`, accionDeDeclarar(d)])),
};
