import Deslizador from './Deslizador';
import FondoSala, { type CambioFondo } from './FondoSala';
import type { SalaMensajesPrivados } from './chat';
import type { SalaConfiguracion, SalaResultado } from './useSala';
import { campo } from './estilos';
import Interruptor from './Interruptor';

/** Lo que tarda la aguja de ficha en ficha al votar; el servidor tiene los mismos límites. */
const SEGUNDOS_POR_FICHA = { min: 0.25, max: 2, paso: 0.25, defecto: 1 };

interface PanelPartidaProps {
  configuracion: SalaConfiguracion;
  /** Pide el cambio al servidor: estos ajustes valen para toda la sala. */
  onCambiar: (cambios: Partial<SalaConfiguracion>) => void;
  /** Cambia el fondo de la sala (subida, Biblioteca o el de por defecto). */
  onCambiarFondo: (cambio: CambioFondo) => Promise<SalaResultado>;
}

/**
 * Pestaña Partida (narradores): ajustes de la partida que valen para todos. Se
 * guardan en el servidor; la casilla refleja siempre lo que hay allí.
 */
const PanelPartida = ({ configuracion, onCambiar, onCambiarFondo }: PanelPartidaProps) => (
  <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-1">
      <Interruptor
        id="sala-pref-grimorio"
        activo={configuracion.grimorioJugadores}
        onCambiar={(grimorioJugadores) => onCambiar({ grimorioJugadores })}
        describedBy="sala-pref-grimorio-ayuda"
        textoClassName="text-sm"
      >
        Grimorio para los jugadores
      </Interruptor>
      <p id="sala-pref-grimorio-ayuda" className="text-xs text-on-surface-muted">
        Activado, cada jugador puede cambiar las fichas en su propio grimorio, como el narrador. Si no, ve su ficha con su
        rol y las demás vacías.
      </p>
    </div>
    <div className="flex flex-col gap-1">
      <label htmlFor="sala-pref-mensajes" className="text-sm">
        Mensajes privados entre jugadores
      </label>
      <select
        id="sala-pref-mensajes"
        value={configuracion.mensajes}
        onChange={(e) => onCambiar({ mensajes: e.target.value as SalaMensajesPrivados })}
        aria-describedby="sala-pref-mensajes-ayuda"
        className={`${campo} max-w-xs`}
      >
        <option value="ninguno">Sin mensajes de texto</option>
        <option value="vecinos">Solo con los vecinos</option>
        <option value="todos">Con todos</option>
      </select>
      <p id="sala-pref-mensajes-ayuda" className="text-xs text-on-surface-muted">
        Al narrador se le puede escribir siempre, y él a todos. El chat general (jugadores) y el de visitantes están
        siempre abiertos. Con la Institutriz en juego, solo con los vecinos aunque aquí diga «Con todos».
      </p>
    </div>
    <Deslizador
      id="sala-pref-velocidad"
      etiqueta="Velocidad de las agujas al votar"
      valor={configuracion.segundosPorFicha}
      rango={SEGUNDOS_POR_FICHA}
      unidad="s"
      ayuda="Lo que tarda la aguja en pasar de una ficha a la siguiente."
      onCambiar={(segundosPorFicha) => onCambiar({ segundosPorFicha })}
    />
    <FondoSala fondo={configuracion.fondo} onCambiar={onCambiarFondo} />
  </div>
);

export default PanelPartida;
