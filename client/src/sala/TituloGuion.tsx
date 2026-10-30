import { IconoLibroHechizos, IconoLuna, IconoPluma } from './IconosJuego';
import IconoBolsa from './IconoBolsa';
import ConAyuda from './ConAyuda';
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import type { TipoAviso } from './avisosConfig';
import DialogoBolsa from './DialogoBolsa';
import DialogoConfirmar from './DialogoConfirmar';
import MenuDesplegable, { type OpcionMenu } from './MenuDesplegable';
import PanelGuion, { type RecordatoriosNoche } from './PanelGuion';
import { botonIcono } from './estilos';
import { aspectoDeGuion, usePredeterminados, type Genero, type GuionResuelto } from './guiones';
import type { SalaDistribucion, SalaResultado } from './useSala';

interface TituloGuionProps {
  guion: GuionResuelto | null;
  /** El narrador puede cambiar el guion (lo decide el servidor). */
  puedeCambiar: boolean;
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  onError: (mensaje: string) => void;
  /** Idiomas (ids) en que se ven los nombres y las descripciones de los personajes. */
  idiomas: { nombres: string; descripciones: string; genero: Genero };
  onCambiarIdiomaDescripciones: (id: string) => void;
  /** Los recordatorios del orden de noche (solo el narrador); null si no se ven. */
  recordatorios: RecordatoriosNoche | null;
  /** La noche que se ve al abrir el orden de noche (ver PanelGuion). */
  nochePorDefecto: 'primera' | 'otras';
  /**
   * Preparar la bolsa (narradores, con guion): lo que lleva y el reparto; null si no se puede.
   * `puedeAsignar`: se pueden repartir los personajes (solo en la preparación).
   */
  bolsa: { bolsa: string[]; distribucion: SalaDistribucion; npcs: string[]; puedeAsignar: boolean } | null;
  /** Avisa al lector (al repartir los personajes de la bolsa). */
  onAnuncio: (tipo: TipoAviso, texto: string) => void;
  /**
   * La partida ya ha empezado (fichas, bolsa, votaciones o fase): cambiar de guion
   * limpia el grimorio, así que antes se pide confirmación.
   */
  partidaEmpezada: boolean;
  /** El reparto de la partida: va en la cabecera de la hoja mientras está abierta. */
  reparto: ReactNode;
  /** Se abre o se cierra la hoja (el reparto deja su sitio de siempre, que la hoja taparía). */
  onHojaAbierta: (abierta: boolean) => void;
}

type Vista = 'guion' | 'noche';
const ID_BOTON: Record<Vista, string> = { guion: 'sala-boton-hoja', noche: 'sala-boton-noche' };
const ID_BOTON_BOLSA = 'sala-boton-bolsa';

/**
 * En el centro de la cabecera: el título del guion y sus iconos. La hoja de
 * personajes y el orden de noche (todos, si hay guion) se abren en un panel por
 * la derecha, sin tapar la plaza; uno a la vez. Para los narradores, preparar la
 * bolsa (una bolsa; con guion) y cambiar el guion (una pluma): uno de los tres
 * por defecto o un JSON del disco.
 */
const TituloGuion = ({
  guion,
  puedeCambiar,
  pedir,
  onError,
  idiomas,
  onCambiarIdiomaDescripciones,
  bolsa,
  onAnuncio,
  recordatorios,
  nochePorDefecto,
  partidaEmpezada,
  reparto,
  onHojaAbierta,
}: TituloGuionProps) => {
  const [preparandoBolsa, setPreparandoBolsa] = useState(false);
  const predeterminados = usePredeterminados();
  const [vista, setVista] = useState<Vista | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const aspecto = guion && aspectoDeGuion(guion);
  const hojaAbierta = !!(vista && guion);
  useEffect(() => onHojaAbierta(hojaAbierta), [hojaAbierta, onHojaAbierta]);

  // Al cerrar, el foco vuelve al botón que lo abrió.
  const cerrar = useCallback(() => {
    setVista((actual) => {
      if (actual) window.setTimeout(() => document.getElementById(ID_BOTON[actual])?.focus(), 0);
      return null;
    });
  }, []);
  const alternar = (v: Vista) => setVista((actual) => (actual === v ? null : v));

  // El servidor interpreta y resuelve el guion (y limpia el grimorio): aquí solo se dice
  // cuál (o se manda el JSON). Con la partida empezada, antes se confirma (pendiente).
  type DatosGuion = { predeterminado: string } | { json: string; archivo: string };
  const [pendiente, setPendiente] = useState<{ datos: DatosGuion; nombre: string } | null>(null);
  const cambiar = async (datos: DatosGuion, nombre: string) => {
    if (partidaEmpezada) {
      setPendiente({ datos, nombre });
      return false;
    }
    const r = await pedir('narrador:cambiarGuion', datos);
    if (!r.ok) onError(r.error);
    return false;
  };

  const cargarArchivo = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (archivo) await cambiar({ json: await archivo.text(), archivo: archivo.name }, archivo.name);
  };

  const opciones: OpcionMenu[] = [
    ...(predeterminados ?? []).map((p) => ({
      id: p.id,
      etiqueta: p.nombre,
      marcada: guion?.nombre === p.nombre && guion.autor === p.autor,
      abreDialogo: partidaEmpezada,
      elegir: () => cambiar({ predeterminado: p.id }, p.nombre),
    })),
    { id: 'archivo', etiqueta: 'Cargar desde archivo…', elegir: () => archivoRef.current?.click() },
  ];

  // «que» es lo que se ve o se cierra, para la ayuda: «la hoja de personajes»
  const botonVista = (v: Vista, etiqueta: string, que: string, icono: ReactNode) => (
    <ConAyuda texto={`${vista === v ? 'Cerrar' : 'Ver'} ${que}`} alinear="izquierda">
      <button
        id={ID_BOTON[v]}
        type="button"
        aria-label={etiqueta}
        aria-expanded={vista === v}
        aria-controls={vista === v ? 'sala-panel-guion' : undefined}
        onClick={() => alternar(v)}
        className={botonIcono}
      >
        {icono}
      </button>
    </ConAyuda>
  );

  return (
    <div className="flex min-w-0 items-center gap-1">
      {guion ? (
        // Una cartela de pergamino con filo de latón (sala-cartela, en sala.css): el nombre
        // y, debajo, el autor en pequeño, en tinta, como en la hoja del guion
        <div className="mr-1 flex min-w-0 items-center px-1">
          <p className="sala-cartela flex min-w-0 flex-col items-center gap-0.5 text-center leading-none">
            {/* En LHF Unlovable, como los títulos del juego: en las ediciones oficiales, del color
                de su logo; si no, el lacre de la hoja */}
            <span
              className={`sala-titulo-guion truncate font-guion text-2xl ${aspecto ? '' : 'text-hoja-lacre'}`}
              style={aspecto ? { color: aspecto.color } : undefined}
              lang={guion.edicion ? 'en' : undefined}
            >
              {guion.nombre}
            </span>
            {guion.autor && (
              <span className="truncate font-ui text-[0.56rem] font-semibold uppercase tracking-[0.2em] text-hoja-cuerpo">
                <span className="sr-only">, </span>
                por {guion.autor}
              </span>
            )}
          </p>
        </div>
      ) : (
        <p className="truncate px-2 font-ui text-sm italic tracking-wide text-on-surface-muted">Sin guion</p>
      )}
      {guion && (
        <>
          {botonVista('guion', 'Hoja de personajes', 'la hoja de personajes', <IconoLibroHechizos size={20} />)}
          {botonVista('noche', 'Orden de noche', 'el orden de noche', <IconoLuna size={20} />)}
        </>
      )}
      {bolsa && (
        <ConAyuda texto="Preparar la bolsa de personajes" alinear="izquierda">
          <button
            id={ID_BOTON_BOLSA}
            type="button"
            aria-label="Preparar la bolsa"
            aria-haspopup="dialog"
            onClick={() => setPreparandoBolsa(true)}
            className={botonIcono}
          >
            <IconoBolsa size={20} />
          </button>
        </ConAyuda>
      )}
      {puedeCambiar && (
        <>
          <MenuDesplegable
            id="sala-menu-guion"
            etiqueta="Cambiar de guion"
            ayuda="Cambiar de guion"
            boton={<IconoPluma size={20} />}
            botonClassName={botonIcono}
            opciones={opciones}
          />
          <input
            ref={archivoRef}
            type="file"
            accept=".json,application/json"
            onChange={cargarArchivo}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          />
        </>
      )}

      {pendiente && (
        <DialogoConfirmar
          titulo="Cambiar de guion"
          confirmar="Cambiar y limpiar"
          onConfirmar={() => pedir('narrador:cambiarGuion', pendiente.datos)}
          onCerrar={() => setPendiente(null)}
        >
          Para jugar con <span lang="en">{pendiente.nombre}</span> se limpia el grimorio: se borra el registro de
          votaciones, las fichas vuelven a como estaban al principio, la bolsa se vacía y la partida vuelve a la
          preparación. Los jugadores siguen en sus asientos.
        </DialogoConfirmar>
      )}

      {preparandoBolsa && bolsa && (
        <DialogoBolsa
          bolsa={bolsa.bolsa}
          distribucion={bolsa.distribucion}
          npcs={bolsa.npcs}
          puedeAsignar={bolsa.puedeAsignar}
          pedir={pedir}
          onRepartido={() => onAnuncio('bolsa', 'Personajes repartidos.')}
          onCerrar={() => setPreparandoBolsa(false)}
        />
      )}

      {vista && guion && (
        <div id="sala-panel-guion" className="contents">
          <PanelGuion
            vista={vista}
            guion={guion}
            idiomas={idiomas}
            recordatorios={recordatorios}
            nochePorDefecto={nochePorDefecto}
            onCambiarIdiomaDescripciones={onCambiarIdiomaDescripciones}
            onCerrar={cerrar}
            reparto={reparto}
          />
        </div>
      )}
    </div>
  );
};

export default TituloGuion;
