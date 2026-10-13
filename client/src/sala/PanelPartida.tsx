import Deslizador from './Deslizador';
import type { SalaConfiguracion } from './useSala';

/** Duración de la cuenta atrás; el servidor tiene los mismos límites. */
const CUENTA_ATRAS = { min: 3, max: 120, paso: 1, defecto: 3 };
/** Lo que tarda la aguja de ficha en ficha al votar; el servidor tiene los mismos límites. */
const SEGUNDOS_POR_FICHA = { min: 0.25, max: 2, paso: 0.25, defecto: 1 };

interface PanelPartidaProps {
  configuracion: SalaConfiguracion;
  /** Pide el cambio al servidor: estos ajustes valen para toda la sala. */
  onCambiar: (cambios: Partial<SalaConfiguracion>) => void;
}

/**
 * Pestaña Partida (narradores): ajustes de la partida que valen para todos. Se
 * guardan en el servidor; la casilla refleja siempre lo que hay allí.
 */
const PanelPartida = ({ configuracion, onCambiar }: PanelPartidaProps) => (
  <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          id="sala-pref-grimorio"
          type="checkbox"
          checked={configuracion.grimorioJugadores}
          onChange={(e) => onCambiar({ grimorioJugadores: e.target.checked })}
          aria-describedby="sala-pref-grimorio-ayuda"
          className="h-4 w-4 accent-theme-main"
        />
        <label htmlFor="sala-pref-grimorio" className="text-sm">
          Grimorio para los jugadores
        </label>
      </div>
      <p id="sala-pref-grimorio-ayuda" className="text-xs text-on-surface-muted">
        Activado, cada jugador puede cambiar las fichas en su propio grimorio, como el narrador. Si no, ve su ficha con su
        rol y las demás vacías.
      </p>
    </div>
    <Deslizador
      id="sala-pref-cuenta-atras"
      etiqueta="Cuenta atrás de las nominaciones"
      valor={configuracion.segundosCuentaAtras}
      rango={CUENTA_ATRAS}
      unidad="s"
      onCambiar={(segundosCuentaAtras) => onCambiar({ segundosCuentaAtras })}
    />
    <Deslizador
      id="sala-pref-velocidad"
      etiqueta="Velocidad de las agujas al votar"
      valor={configuracion.segundosPorFicha}
      rango={SEGUNDOS_POR_FICHA}
      unidad="s"
      ayuda="Lo que tarda la aguja en pasar de una ficha a la siguiente."
      onCambiar={(segundosPorFicha) => onCambiar({ segundosPorFicha })}
    />
  </div>
);

export default PanelPartida;
