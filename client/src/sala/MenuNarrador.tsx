import { ScrollText } from 'lucide-react';
import { useState } from 'react';
import DialogoElegirParticipante from './DialogoElegirParticipante';
import MenuDesplegable, { type OpcionMenu } from './MenuDesplegable';
import { botonIcono } from './estilos';
import { ID_MENU_NARRADOR } from './ids';
import type { SalaEstado, SalaResultado } from './useSala';

interface MenuNarradorProps {
  estado: SalaEstado;
  /** Pide una acción a la sala (ver `useSala`). */
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  /** Para avisar de errores de las acciones. */
  onError: (mensaje: string) => void;
  /** Activa o desactiva la edición de asientos (botones en el centro de la mesa). */
  onAsientos: () => void;
}

type Eleccion = 'nombrar' | 'expulsar' | null;

/**
 * En la cabecera: botón con icono (un papiro) con las opciones del narrador.
 * Cada opción es una acción del servidor y solo sale si `estado.acciones` la
 * permite; si no queda ninguna (no narras), el botón no sale.
 */
const MenuNarrador = ({ estado, pedir, onError, onAsientos }: MenuNarradorProps) => {
  const [eligiendo, setEligiendo] = useState<Eleccion>(null);
  const puede = (accion: string) => estado.acciones.includes(accion);

  const actuar = async (accion: string) => {
    const r = await pedir(accion);
    if (!r.ok) onError(r.error);
    return r.ok;
  };

  // id = acción del servidor que la respalda.
  const opciones: OpcionMenu[] = [
    { id: 'narrador:asientos', etiqueta: 'Asientos', elegir: onAsientos },
    { id: 'narrador:nombrarNarrador', etiqueta: 'Añadir narrador', abreDialogo: true, elegir: () => setEligiendo('nombrar') },
    { id: 'narrador:expulsarNarrador', etiqueta: 'Expulsar narrador', abreDialogo: true, elegir: () => setEligiendo('expulsar') },
    { id: 'narrador:dejar', etiqueta: 'Dejar de ser narrador', elegir: () => actuar('narrador:dejar') },
  ].filter((o) => puede(o.id));

  const otrosNarradores = estado.participantes.filter((p) => p.rol === 'narrador' && p.id !== estado.yo);

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
      {eligiendo === 'nombrar' && (
        <DialogoElegirParticipante
          titulo="Añadir narrador"
          confirmar="Nombrar narrador"
          sinCandidatos="No hay nadie más en la sala a quien nombrar."
          candidatos={estado.participantes.filter((p) => p.rol !== 'narrador')}
          onElegir={(participanteId) => pedir('narrador:nombrarNarrador', { participanteId })}
          onCerrar={() => setEligiendo(null)}
        />
      )}
      {eligiendo === 'expulsar' && (
        <DialogoElegirParticipante
          titulo="Expulsar narrador"
          confirmar="Quitarle el papel de narrador"
          sinCandidatos="No hay otro narrador."
          candidatos={otrosNarradores}
          onElegir={(participanteId) => pedir('narrador:expulsarNarrador', { participanteId })}
          onCerrar={() => setEligiendo(null)}
        />
      )}
    </>
  );
};

export default MenuNarrador;
