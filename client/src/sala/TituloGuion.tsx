import { BookOpen, Feather, Moon } from 'lucide-react';
import IconoBolsa from './IconoBolsa';
import { useCallback, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import type { TipoAviso } from './avisosConfig';
import DialogoBolsa from './DialogoBolsa';
import MenuDesplegable, { type OpcionMenu } from './MenuDesplegable';
import PanelGuion, { type RecordatoriosNoche } from './PanelGuion';
import { botonIcono } from './estilos';
import { tituloDeGuion, usePredeterminados, type Genero, type GuionResuelto } from './guiones';
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
  /** Preparar la bolsa (narradores, con guion): lo que lleva y el reparto; null si no se puede. */
  bolsa: { bolsa: string[]; distribucion: SalaDistribucion; npcs: string[] } | null;
  /** Avisa al lector (al repartir los personajes de la bolsa). */
  onAnuncio: (tipo: TipoAviso, texto: string) => void;
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
}: TituloGuionProps) => {
  const [preparandoBolsa, setPreparandoBolsa] = useState(false);
  const predeterminados = usePredeterminados();
  const [vista, setVista] = useState<Vista | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  // Al cerrar, el foco vuelve al botón que lo abrió.
  const cerrar = useCallback(() => {
    setVista((actual) => {
      if (actual) window.setTimeout(() => document.getElementById(ID_BOTON[actual])?.focus(), 0);
      return null;
    });
  }, []);
  const alternar = (v: Vista) => setVista((actual) => (actual === v ? null : v));

  // El servidor interpreta y resuelve el guion: aquí solo se dice cuál (o se manda el JSON).
  const cambiar = async (datos: { predeterminado: string } | { json: string; archivo: string }) => {
    const r = await pedir('narrador:cambiarGuion', datos);
    if (!r.ok) onError(r.error);
    return false;
  };

  const cargarArchivo = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (archivo) await cambiar({ json: await archivo.text(), archivo: archivo.name });
  };

  const opciones: OpcionMenu[] = [
    ...(predeterminados ?? []).map((p) => ({
      id: p.id,
      etiqueta: p.nombre,
      marcada: guion?.nombre === p.nombre && guion.autor === p.autor,
      elegir: () => cambiar({ predeterminado: p.id }),
    })),
    { id: 'archivo', etiqueta: 'Cargar desde archivo…', elegir: () => archivoRef.current?.click() },
  ];

  const botonVista = (v: Vista, etiqueta: string, icono: ReactNode) => (
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
  );

  return (
    <div className="flex min-w-0 items-center gap-1">
      <p className="truncate px-2 text-center text-sm font-semibold text-white">
        {guion ? tituloDeGuion(guion) : <span className="font-normal text-on-surface-muted">Sin guion</span>}
      </p>
      {guion && (
        <>
          {botonVista('guion', 'Hoja de personajes', <BookOpen size={20} />)}
          {botonVista('noche', 'Orden de noche', <Moon size={20} />)}
        </>
      )}
      {bolsa && (
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
      )}
      {puedeCambiar && (
        <>
          <MenuDesplegable
            id="sala-menu-guion"
            etiqueta="Cambiar de guion"
            boton={<Feather size={20} />}
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

      {preparandoBolsa && bolsa && (
        <DialogoBolsa
          bolsa={bolsa.bolsa}
          distribucion={bolsa.distribucion}
          npcs={bolsa.npcs}
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
            onCambiarIdiomaDescripciones={onCambiarIdiomaDescripciones}
            onCerrar={cerrar}
          />
        </div>
      )}
    </div>
  );
};

export default TituloGuion;
