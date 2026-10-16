import { Check, X } from 'lucide-react';
import { IconoMascaras } from './IconosJuego';
import { useState } from 'react';
import Dialog from '../components/Dialog';
import { useAriaLive } from './avisosConfig';
import { botonPrincipal, botonSecundario } from './estilos';
import { listaFaroles } from './fichas';
import type { PersonajeMostrado } from './guiones';
import { BotoneraDespertar, HistorialDespertar, MensajeVisto } from './PiezasDespertar';
import type { SalaDespertar, SalaEstado, SalaResultado } from './useSala';

interface DespertarJugadorProps {
  estado: SalaEstado;
  despertar: SalaDespertar;
  /** Mis faroles, si soy el demonio (para copiar los que me enseña el narrador); si no, null. */
  faroles: (string | null)[] | null;
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
  faroles,
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
  const [copiando, setCopiando] = useState(false);

  // «Estos personajes no están en juego» al demonio: se los puede copiar a sus faroles
  const aCopiar = faroles && ultimo?.tarjeta === 'noEnJuego' ? ultimo.personajes : null;
  const yaCopiados = !!aCopiar && aCopiar.slice(0, faroles!.length).every((id, i) => faroles![i] === id);
  const copiar = async () => {
    if (!aCopiar || copiando || yaCopiados) return;
    setCopiando(true);
    const r = await pedir('jugador:copiarFaroles', { personajes: aCopiar });
    setCopiando(false);
    if (r.ok) onEnviado(`Faroles copiados: ${listaFaroles(aCopiar.slice(0, 3), porId)}.`);
    else onError(r.error);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sala-velo">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-despierto-titulo"
        describedBy="sala-despierto-ultimo"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col gap-4 overflow-y-auto sala-cofre p-4"
      >
        <div className="flex items-start gap-2">
          <h2 id="sala-despierto-titulo" className="sala-cofre-titulo flex-1 text-center text-3xl">
            Te ha despertado el narrador
          </h2>
          <button type="button" onClick={onCerrar} className={`${botonSecundario} flex items-center gap-1`}>
            <X size={14} />
            Cerrar
          </button>
        </div>
        <div className="flex flex-col items-center gap-2">
          <h3 className="rotulo">El narrador te muestra</h3>
          <div id="sala-despierto-ultimo">
            {ultimo ? (
              <MensajeVisto mensaje={ultimo} estado={estado} personajes={porId} grande />
            ) : (
              <p className="text-on-surface-muted">Espera a que el narrador te diga algo.</p>
            )}
          </div>
          {aCopiar && (
            // Copiados, el botón se queda (para no perder el foco) y lo dice
            <button
              type="button"
              onClick={() => void copiar()}
              aria-disabled={copiando || yaCopiados}
              className={`${botonPrincipal} flex items-center gap-2 font-ui aria-disabled:cursor-default`}
            >
              {yaCopiados ? <Check size={18} /> : <IconoMascaras size={18} />}
              {yaCopiados ? 'Faroles copiados' : 'Copiar faroles'}
            </button>
          )}
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
        <div aria-live={ariaLiveErrores}>{error && <p className="text-sm text-blood-pale">{error}</p>}</div>
      </Dialog>
    </div>
  );
};

export default DespertarJugador;
