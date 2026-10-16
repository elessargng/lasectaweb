import { X } from 'lucide-react';
import Dialog from '../components/Dialog';
import { useAriaLive } from './avisosConfig';
import { botonSecundario } from './estilos';
import type { PersonajeMostrado } from './guiones';
import { BotoneraDespertar, HistorialDespertar, MensajeVisto } from './PiezasDespertar';
import type { SalaDespertar, SalaEstado, SalaResultado } from './useSala';

interface DespertarJugadorProps {
  estado: SalaEstado;
  despertar: SalaDespertar;
  personajes: PersonajeMostrado[];
  porId: Map<string, PersonajeMostrado>;
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  onError: (mensaje: string) => void;
  onEnviado: (texto: string) => void;
  /** La cierra (Escape o «Cerrar»); se vuelve a abrir desde la fase de la cabecera. */
  onCerrar: () => void;
  /** Los avisos de la sala y el último error: fuera de un modal no se leerían. */
  anuncio: string;
  /** Lo urgente (las manos vigiladas), que interrumpe. */
  anuncioUrgente: string;
  error: string;
}

/**
 * El despertar del jugador: en grande, lo último que le muestra el narrador;
 * debajo, las fichas para contestar y lo que se han dicho esta noche (al
 * amanecer se acaba: la noche siguiente empieza de cero).
 * Es modal. Se puede cerrar: se vuelve a abrir desde «Noche N» en la cabecera y,
 * sola, cuando el narrador manda algo. Al abrirse se lee el título y lo último
 * que mostró el narrador.
 */
const DespertarJugador = ({
  estado,
  despertar,
  personajes,
  porId,
  pedir,
  onError,
  onEnviado,
  onCerrar,
  anuncio,
  anuncioUrgente,
  error,
}: DespertarJugadorProps) => {
  const ariaLiveErrores = useAriaLive('errores');
  const ultimo = [...despertar.mensajes].reverse().find((m) => m.autor === 'narrador');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-despierto-titulo"
        describedBy="sala-despierto-ultimo"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col gap-4 overflow-y-auto rounded-lg border border-theme-main/70 bg-surface p-4 shadow-2xl"
      >
        <div className="flex items-start gap-2">
          <h2 id="sala-despierto-titulo" className="flex-1 text-center font-display text-2xl text-on-surface-bright">
            Te ha despertado el narrador
          </h2>
          <button type="button" onClick={onCerrar} className={`${botonSecundario} flex items-center gap-1`}>
            <X size={14} />
            Cerrar
          </button>
        </div>
        <div className="flex flex-col items-center gap-2">
          <h3 className="font-ui text-sm font-semibold text-theme-main">El narrador te muestra</h3>
          <div id="sala-despierto-ultimo">
            {ultimo ? (
              <MensajeVisto mensaje={ultimo} estado={estado} personajes={porId} grande />
            ) : (
              <p className="text-on-surface-muted">Espera a que el narrador te diga algo.</p>
            )}
          </div>
        </div>
        <BotoneraDespertar
          estado={estado}
          asientoId={null}
          personajes={personajes}
          conTarjetas={false}
          tituloFichas="Contestar"
          pedir={pedir}
          onError={onError}
          onEnviado={onEnviado}
        />
        <h3 id="sala-despierto-mensajes" className="font-ui text-sm font-semibold text-theme-main">
          Mensajes
        </h3>
        <HistorialDespertar
          mensajes={despertar.mensajes}
          estado={estado}
          personajes={porId}
          tituloId="sala-despierto-mensajes"
        />
        <div aria-live="polite" className="sr-only">
          {anuncio}
        </div>
        <div aria-live="assertive" className="sr-only">
          {anuncioUrgente}
        </div>
        <div aria-live={ariaLiveErrores}>{error && <p className="text-sm text-red-400">{error}</p>}</div>
      </Dialog>
    </div>
  );
};

export default DespertarJugador;
