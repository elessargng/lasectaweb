import { Volume2 } from 'lucide-react';
import Interruptor from './Interruptor';
import { botonSecundario } from './estilos';
import type { PreferenciasSala } from './preferencias';
import type { EstadoVozNeuronal } from './voz';

interface PanelNarradorVirtualProps {
  preferencias: PreferenciasSala;
  onCambiar: (cambios: Partial<PreferenciasSala>) => void;
  /** En qué está la voz neuronal (descargándose, lista…). */
  estadoVoz: EstadoVozNeuronal;
  /** Dice una frase con la voz que esté puesta, para escucharla. */
  onProbarVoz: () => void;
}

/** Lo que se anuncia de la voz neuronal: sin el porcentaje, que va en la barra (si no, se leería a cada paso). */
const AVISO: Record<EstadoVozNeuronal['fase'], string> = {
  apagada: '',
  descargando: 'Preparando la voz neuronal…',
  lista: 'Voz neuronal lista.',
  error: '',
};

/**
 * Pestaña Narrador virtual: cómo suena. La voz neuronal se descarga al activarla
 * (la primera vez) y, mientras, suena la del navegador. Se aplica al momento; con
 * cuenta se guarda en el servidor.
 */
const PanelNarradorVirtual = ({ preferencias, onCambiar, estadoVoz, onProbarVoz }: PanelNarradorVirtualProps) => (
  <div className="flex flex-col gap-4">
    <div>
      <Interruptor
        id="sala-pref-voz-neuronal"
        activo={preferencias.vozNeuronal}
        onCambiar={(vozNeuronal) => onCambiar({ vozNeuronal })}
        describedBy="sala-pref-voz-neuronal-desc"
      >
        Activar voz neuronal
      </Interruptor>
      <p id="sala-pref-voz-neuronal-desc" className="ml-12 mt-0.5 text-xs text-on-surface-muted">
        Una voz más natural para el narrador virtual. Al activarla se descarga el modelo de voz{' '}
        <span lang="en">Piper</span> «davefx», en castellano de España (unos 60 MB, solo la primera vez), que se guarda
        y se ejecuta en tu navegador: la voz se genera en tu equipo. Mientras se descarga, suena la voz
        del navegador.
      </p>
    </div>

    <div className="ml-12 flex flex-col gap-2">
      <p role="status" className={`text-sm ${estadoVoz.fase === 'error' ? 'text-blood-bright' : 'text-on-surface-muted'}`}>
        {estadoVoz.fase === 'error' ? estadoVoz.mensaje : AVISO[estadoVoz.fase]}
      </p>
      {/* La barra, solo mientras se descarga (si ya estaba descargada, solo se carga) */}
      {estadoVoz.fase === 'descargando' && estadoVoz.progreso > 0 && estadoVoz.progreso < 1 && (
        <div className="flex items-center gap-3">
          <progress
            value={estadoVoz.progreso}
            max={1}
            aria-label="Descarga de la voz neuronal"
            className="h-2 w-full max-w-xs accent-[var(--color-theme-main)]"
          />
          <span aria-hidden="true" className="font-ui text-xs tabular-nums text-on-surface-muted">
            {Math.round(estadoVoz.progreso * 100)} %
          </span>
        </div>
      )}
    </div>

    <div>
      <button type="button" onClick={onProbarVoz} className={botonSecundario}>
        <Volume2 size={14} />
        Escuchar al narrador
      </button>
    </div>
  </div>
);

export default PanelNarradorVirtual;
