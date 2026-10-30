import type { ReactNode } from 'react';
import type { AsientoDiario, EntradaDiario, HechoDiario } from '@contrato/diario';
import { NOMBRE_BANDO, fichaDespertar, tarjetaDespertar, textoEleccion } from '../../sala/despertar';
import type { VotacionHistorial } from '../../utils/estadisticasApi';
import NombrePersonaje from './NombrePersonaje';
import type { DatosPersonajes } from './personajes';

/** El recordatorio de texto libre (como en el servidor, contrato/sala RECORDATORIO_TEXTO): no es de ningún personaje. */
const RECORDATORIO_TEXTO = '_texto';

type Fase = EntradaDiario['fase'];
type Despertar = Extract<EntradaDiario, { tipo: 'despertar' }>;

/** Lo que se cuenta de una fase: hechos sueltos, despertares (los mensajes seguidos de un asiento) y nominaciones. */
type Linea =
  | { tipo: 'hecho'; hora: number; hecho: HechoDiario }
  | { tipo: 'despertar'; hora: number; asiento: AsientoDiario; mensajes: Despertar[] }
  | { tipo: 'nominacion'; hora: number; votacion: VotacionHistorial };

const tituloFase = (f: Fase) => (f.momento === 'preparacion' ? 'Preparación' : `${f.momento === 'noche' ? 'Noche' : 'Día'} ${f.numero}`);
const mismaFase = (a: Fase, b: Fase) => a.momento === b.momento && a.numero === b.numero;
const mismoAsiento = (a: AsientoDiario, b: AsientoDiario) => a.numero === b.numero && a.nombre === b.nombre;
/** «Bea» o, si estaba libre, «el asiento 4 (libre)». */
const quien = (a: AsientoDiario) => a.nombre ?? `el asiento ${a.numero} (libre)`;
const mayuscula = (t: string) => t.charAt(0).toLocaleUpperCase('es') + t.slice(1);

/** «A, B y C» con nodos (para los nombres de personaje con su idioma). */
const enumerar = (partes: ReactNode[]): ReactNode =>
  partes.map((p, i) => (
    <span key={i}>
      {i > 0 && (i === partes.length - 1 ? ' y ' : ', ')}
      {p}
    </span>
  ));

/**
 * Las fases de la partida en orden, con lo de cada una: los despertares seguidos de
 * un mismo asiento van juntos; las nominaciones, en su día por la hora.
 */
function porFases(diario: EntradaDiario[], votaciones: VotacionHistorial[]): { fase: Fase; lineas: Linea[] }[] {
  const fases: { fase: Fase; lineas: Linea[] }[] = [];
  const faseDe = (fase: Fase) => {
    let f = fases.find((x) => mismaFase(x.fase, fase));
    if (!f) fases.push((f = { fase, lineas: [] }));
    return f;
  };
  for (const e of diario) {
    const { lineas } = faseDe(e.fase);
    const ultima = lineas[lineas.length - 1];
    if (e.tipo !== 'despertar') lineas.push({ tipo: 'hecho', hora: e.hora, hecho: e });
    else if (ultima?.tipo === 'despertar' && mismoAsiento(ultima.asiento, e.asiento)) ultima.mensajes.push(e);
    else lineas.push({ tipo: 'despertar', hora: e.hora, asiento: e.asiento, mensajes: [e] });
  }
  for (const v of votaciones) faseDe({ momento: 'dia', numero: v.dia }).lineas.push({ tipo: 'nominacion', hora: v.hora, votacion: v });
  const orden = (f: Fase) => (f.momento === 'preparacion' ? 0 : f.numero * 2 + (f.momento === 'dia' ? 1 : 0));
  for (const f of fases) f.lineas.sort((a, b) => a.hora - b.hora);
  return fases.sort((a, b) => orden(a.fase) - orden(b.fase));
}

interface DiarioPartidaProps {
  diario: EntradaDiario[];
  votaciones: VotacionHistorial[];
  personajes: DatosPersonajes;
  /** Prefijo de los ids (el de la partida). */
  id: string;
}

/**
 * El diario de una partida del historial: todo lo que se hizo, por noches y días
 * (cada una con su título, para ir de una a otra): los despertares (lo que dijo el
 * narrador y lo que contestó cada uno), las muertes, las ejecuciones, las
 * nominaciones, los faroles y lo que se declaró de día.
 */
const DiarioPartida = ({ diario, votaciones, personajes, id }: DiarioPartidaProps) => {
  const p = (pid: string) => <NombrePersonaje id={pid} personajes={personajes} />;
  return (
    <div className="space-y-5">
      {porFases(diario, votaciones).map(({ fase, lineas }) => {
        const idFase = `${id}-${fase.momento}-${fase.numero}`;
        return (
          <section key={idFase} aria-labelledby={idFase}>
            <h6 id={idFase} className="mb-1 font-display text-on-surface">
              {tituloFase(fase)}
            </h6>
            <ol className="space-y-1.5 border-l border-gold/20 pl-4 text-sm">
              {lineas.map((l, i) => (
                <li key={i}>
                  {l.tipo === 'despertar' ? (
                    <>
                      <span className="text-on-surface">Despierta {quien(l.asiento)}:</span>
                      <ol className="mt-1 space-y-0.5 pl-4 text-on-surface-muted">
                        {l.mensajes.map((m, j) => (
                          <li key={j}>
                            {m.delNarrador ? 'Narrador' : mayuscula(quien(m.asiento))}: <Mensaje m={m} p={p} />
                          </li>
                        ))}
                      </ol>
                    </>
                  ) : l.tipo === 'nominacion' ? (
                    <Nominacion v={l.votacion} />
                  ) : (
                    <Hecho h={l.hecho} p={p} />
                  )}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
};

/** Un mensaje de un despertar: «Haz una elección (elige 1 jugador)», «Jugador: Ceci», «Tú eres: Imp; Malvado». */
const Mensaje = ({ m, p }: { m: Despertar; p: (id: string) => ReactNode }) => {
  if (m.ficha === 'personalizado') return <>«{m.texto}»</>;
  const titulo = tarjetaDespertar(m.tarjeta)?.texto ?? fichaDespertar(m.ficha)?.etiqueta ?? '';
  const partes: ReactNode[] = [
    m.jugadores.length ? enumerar(m.jugadores.map(quien)) : null,
    m.personajes.length ? enumerar(m.personajes.map(p)) : null,
    m.alineamiento ? NOMBRE_BANDO[m.alineamiento] : null,
    m.texto ? `«${m.texto}»` : null,
  ].filter((x) => x !== null);
  return (
    <>
      {titulo}
      {m.eleccion !== null && ` (${textoEleccion(m.eleccion).toLocaleLowerCase('es')})`}
      {partes.map((parte, i) => (
        <span key={i}>
          {i === 0 ? ': ' : '; '}
          {parte}
        </span>
      ))}
    </>
  );
};

const Nominacion = ({ v }: { v: VotacionHistorial }) => (
  <>
    <span className="text-on-surface">
      {mayuscula(v.nomina)} nomina a {v.nominado}
    </span>
    <span className="text-on-surface-muted">
      {' · '}
      {v.votos === null ? 'sin votación' : v.votos === 1 ? '1 voto' : `${v.votos} votos`}
      {v.votantes && v.votantes.length > 0 && ` (${v.votantes.join(', ')})`}
    </span>
  </>
);

const RESPUESTA: Record<Extract<HechoDiario, { tipo: 'artista' }>['respuesta'], string> = {
  si: 'sí',
  no: 'no',
  reformular: 'pide que la reformule',
};

/** Un hecho suelto, en una frase. */
const Hecho = ({ h, p }: { h: HechoDiario; p: (id: string) => ReactNode }) => {
  switch (h.tipo) {
    case 'muere':
      return <>Muere {quien(h.asiento)}.</>;
    case 'revive':
      return <>{mayuscula(quien(h.asiento))} revive.</>;
    case 'ejecucion':
      return <span className="text-on-surface">Se ejecuta a {quien(h.asiento)}.</span>;
    case 'personaje':
      return h.personaje ? (
        <>
          {mayuscula(quien(h.asiento))} pasa a ser {p(h.personaje)}.
        </>
      ) : (
        <>A {quien(h.asiento)} se le quita el personaje.</>
      );
    case 'alineamiento':
      return (
        <>
          {mayuscula(quien(h.asiento))} pasa al bando {NOMBRE_BANDO[h.alineamiento].toLocaleLowerCase('es')}.
        </>
      );
    case 'recordatorio':
      return (
        <>
          A {quien(h.asiento)} se le {h.quitado ? 'quita' : 'pone'} el recordatorio{' '}
          <span lang={h.personaje === RECORDATORIO_TEXTO ? undefined : 'en'}>«{h.texto}»</span>
          {h.personaje !== RECORDATORIO_TEXTO && <> ({p(h.personaje)})</>}.
        </>
      );
    case 'grimorio':
      return <>El narrador le enseña el grimorio a {quien(h.asiento)}.</>;
    case 'farol':
      if (!h.asiento) {
        return h.personaje ? <>El narrador prepara para el demonio el farol {p(h.personaje)}.</> : <>El narrador quita un farol del demonio.</>;
      }
      return h.personaje ? (
        <>
          {mayuscula(quien(h.asiento))} apunta el farol {p(h.personaje)}.
        </>
      ) : (
        <>{mayuscula(quien(h.asiento))} quita un farol.</>
      );
    case 'copiaFaroles':
      return (
        <>
          {mayuscula(quien(h.asiento))} apunta como faroles los que le enseñó el narrador: {enumerar(h.personajes.map(p))}.
        </>
      );
    case 'usaFarol':
      return h.personaje ? (
        <>
          {mayuscula(quien(h.asiento))} se hace pasar por {p(h.personaje)}.
        </>
      ) : (
        <>{mayuscula(quien(h.asiento))} deja de usar su farol.</>
      );
    case 'senala':
      return h.objetivo ? (
        <>
          {mayuscula(quien(h.asiento))} señala a {quien(h.objetivo)}.
        </>
      ) : (
        <>{mayuscula(quien(h.asiento))} deja de señalar.</>
      );
    case 'exterminador':
      return (
        <span className="text-on-surface">
          {mayuscula(quien(h.asiento))} se declara Exterminador y dispara a {quien(h.objetivo)}: {h.muere ? 'muere' : 'no pasa nada'}.
        </span>
      );
    case 'patoso':
      return (
        <span className="text-on-surface">
          {mayuscula(quien(h.asiento))} se declara Patoso y elige a {quien(h.objetivo)}
          {h.porElNarrador && ' (no eligió a tiempo: eligió el narrador)'}.
        </span>
      );
    case 'artista':
      return (
        <span className="text-on-surface">
          {mayuscula(quien(h.asiento))} pregunta como Artista «{h.pregunta}»: {RESPUESTA[h.respuesta]}.
        </span>
      );
    default:
      return null;
  }
};

export default DiarioPartida;
