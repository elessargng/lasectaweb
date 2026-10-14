import { ScrollText } from 'lucide-react';
import { useState } from 'react';
import DialogoConfirmar from './DialogoConfirmar';
import DialogoElegirParticipante from './DialogoElegirParticipante';
import MenuDesplegable, { type OpcionMenu } from './MenuDesplegable';
import { botonIcono } from './estilos';
import { ID_MENU_NARRADOR } from './ids';
import type { SalaEstado, SalaParticipante, SalaResultado } from './useSala';

interface MenuNarradorProps {
  estado: SalaEstado;
  /** Pide una acción a la sala (ver `useSala`). */
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  /** Activa o desactiva la edición de asientos (botones en el centro de la mesa). */
  onAsientos: () => void;
}

/** Opciones del menú que abren el diálogo para elegir a alguien; la clave es la acción del servidor. */
const ELEGIR: Record<
  string,
  {
    etiqueta: string;
    titulo: string;
    confirmar: string;
    sinCandidatos: string;
    candidatos: (e: SalaEstado) => SalaParticipante[];
    detalle?: (e: SalaEstado, p: SalaParticipante) => string;
  }
> = {
  'narrador:nombrarNarrador': {
    etiqueta: 'Añadir narrador',
    titulo: 'Añadir narrador',
    confirmar: 'Nombrar narrador',
    sinCandidatos: 'No hay nadie más en la sala a quien nombrar.',
    candidatos: (e) => e.participantes.filter((p) => p.rol !== 'narrador'),
  },
  'narrador:expulsarNarrador': {
    etiqueta: 'Expulsar narrador',
    titulo: 'Expulsar narrador',
    confirmar: 'Quitarle el papel de narrador',
    sinCandidatos: 'No hay otro narrador.',
    candidatos: (e) => e.participantes.filter((p) => p.rol === 'narrador' && p.id !== e.yo),
  },
  'narrador:expulsarJugador': {
    etiqueta: 'Expulsar jugador',
    titulo: 'Expulsar de la sala',
    confirmar: 'Expulsar de la sala',
    sinCandidatos: 'No hay nadie a quien expulsar.',
    candidatos: (e) => e.participantes.filter((p) => p.rol !== 'narrador'),
    detalle: (e, p) => {
      const asiento = e.asientos.findIndex((a) => a.ocupante === p.id);
      return asiento >= 0 ? `asiento ${asiento + 1}` : 'visitante';
    },
  },
  'narrador:levantarJugador': {
    etiqueta: 'Levantar jugador',
    titulo: 'Levantar jugador',
    confirmar: 'Levantarlo del asiento',
    sinCandidatos: 'No hay nadie sentado.',
    candidatos: (e) => e.participantes.filter((p) => p.rol === 'jugador'),
    detalle: (e, p) => `asiento ${e.asientos.findIndex((a) => a.ocupante === p.id) + 1}`,
  },
};

/**
 * En la cabecera: botón con icono (un papiro) con las opciones del narrador.
 * Cada opción es una acción del servidor y solo sale si `estado.acciones` la
 * permite; si no queda ninguna (no narras), el botón no sale.
 */
const MenuNarrador = ({ estado, pedir, onAsientos }: MenuNarradorProps) => {
  // Acción de ELEGIR cuyo diálogo está abierto.
  const [eligiendo, setEligiendo] = useState<string | null>(null);
  const [limpiando, setLimpiando] = useState(false);
  const puede = (accion: string) => estado.acciones.includes(accion);

  // id = acción del servidor que la respalda.
  const opciones: OpcionMenu[] = [
    { id: 'narrador:asientos', etiqueta: 'Asientos', elegir: onAsientos },
    // Noche y día: solo sale el que toca
    { id: 'narrador:irANoche', etiqueta: 'Ir a la noche', elegir: () => void pedir('narrador:irANoche') },
    { id: 'narrador:amanecer', etiqueta: 'Amanece', elegir: () => void pedir('narrador:amanecer') },
    { id: 'narrador:limpiarGrimorio', etiqueta: 'Limpiar grimorio', abreDialogo: true, elegir: () => setLimpiando(true) },
    ...Object.entries(ELEGIR).map(([accion, { etiqueta }]) => ({
      id: accion,
      etiqueta,
      abreDialogo: true,
      elegir: () => setEligiendo(accion),
    })),
  ].filter((o) => puede(o.id));

  const dialogo = eligiendo ? ELEGIR[eligiendo] : null;

  return (
    <>
      <MenuDesplegable
        id={ID_MENU_NARRADOR}
        alinear="derecha"
        etiqueta="Opciones de narrador"
        boton={<ScrollText size={22} />}
        botonClassName={botonIcono}
        opciones={opciones}
      />
      {eligiendo && dialogo && (
        <DialogoElegirParticipante
          titulo={dialogo.titulo}
          confirmar={dialogo.confirmar}
          sinCandidatos={dialogo.sinCandidatos}
          candidatos={dialogo.candidatos(estado)}
          detalle={dialogo.detalle && ((p) => dialogo.detalle!(estado, p))}
          onElegir={(participanteId) => pedir(eligiendo, { participanteId })}
          onCerrar={() => setEligiendo(null)}
        />
      )}
      {limpiando && (
        <DialogoConfirmar
          titulo="Limpiar grimorio"
          confirmar="Limpiar grimorio"
          onConfirmar={() => pedir('narrador:limpiarGrimorio')}
          onCerrar={() => setLimpiando(false)}
        >
          Se borra el registro de votaciones, las fichas vuelven a como estaban al principio y la partida vuelve a la
          preparación. Los jugadores siguen en sus asientos.
        </DialogoConfirmar>
      )}
    </>
  );
};

export default MenuNarrador;
