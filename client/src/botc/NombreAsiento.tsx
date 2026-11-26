import { Fragment } from 'react';
import { nombreDeAsiento, type Frase } from './despertar';
import { datosAsiento } from './nombresAsiento';
import type { SalaDto } from './useSala';

/**
 * Un nombre de asiento ya calculado: a la vista, el del jugador sentado (más grande
 * y en negrita: es lo que importa) o, sin jugador, el del asiento («Asiento 3,
 * libre»). El lector oye siempre `nombre`, con el asiento: «Asiento 3 (Ana)».
 */
export const NombreVisto = ({ nombre, jugador }: { nombre: string; jugador: string | null }) => {
  if (jugador === null) return <>{nombre}</>;
  return (
    <>
      <span className="sr-only">{nombre}</span>
      <span aria-hidden="true" className="text-[1.3em] font-bold leading-tight">
        {jugador}
      </span>
    </>
  );
};

/** El nombre de un asiento en los despertares (ver NombreVisto). */
export const NombreAsiento = ({ estado, jugadorId }: { estado: SalaDto; jugadorId: string }) => (
  <NombreVisto nombre={nombreDeAsiento(estado, jugadorId)} jugador={datosAsiento(estado, jugadorId).ocupante?.nombre ?? null} />
);

/** Una frase con asientos (ver Frase): cada asiento, con NombreVisto. */
export const FraseVista = ({ frase }: { frase: Frase }) => (
  <>
    {frase.map((p, i) => (
      <Fragment key={i}>{typeof p === 'string' ? p : <NombreVisto nombre={p.nombre} jugador={p.jugador} />}</Fragment>
    ))}
  </>
);

/** Varios, como enumerar: «Ana, Luis y Bea». */
export const NombresAsiento = ({ estado, ids }: { estado: SalaDto; ids: readonly string[] }) => (
  <>
    {ids.map((id, i) => (
      <Fragment key={id}>
        {i > 0 && (i === ids.length - 1 ? ' y ' : ', ')}
        <NombreAsiento estado={estado} jugadorId={id} />
      </Fragment>
    ))}
  </>
);
