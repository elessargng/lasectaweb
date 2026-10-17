import { useRef, useState, type KeyboardEvent } from 'react';
import {
  ACCIONES_ATAJO,
  ATAJOS_INICIALES,
  ATRIBUTO_CAPTURANDO,
  atajoDe,
  describirAtajo,
  type AccionAtajo,
  type Atajo,
} from './atajos';
import { useAriaLive } from './avisosConfig';
import { botonSecundario, campo } from './estilos';
import { describirGesto, GESTOS, type Gesto, type GestosAsignados } from './gestos';
import TeclaAtajo from './TeclaAtajo';

interface PanelAtajosProps {
  atajos: Record<AccionAtajo, Atajo>;
  onCambiar: (accion: AccionAtajo, atajo: Atajo) => void;
  /** Los gestos táctiles de cada acción (los que tienen). */
  gestos: GestosAsignados;
  /** Asigna o quita (null) el gesto de una acción; si lo tenía otra, se le quita. */
  onCambiarGesto: (accion: AccionAtajo, gesto: Gesto | null) => void;
}

/**
 * Pestaña Atajos: cada acción con su tecla. «Cambiar» se queda
 * escuchando y la siguiente tecla (o combinación) que se pulse pasa a ser el
 * atajo; Escape cancela. Mientras escucha, los atajos no actúan (lleva la marca
 * ATRIBUTO_CAPTURANDO), para poder asignar también la tecla de uno de ellos.
 *
 * Para móviles y tabletas, cada acción puede tener además un gesto con varios
 * dedos, elegido de una lista (gestos.ts). Un gesto es de una sola acción: si se
 * elige uno que ya tenía otra, se le quita a esa.
 */
const PanelAtajos = ({ atajos, onCambiar, gestos, onCambiarGesto }: PanelAtajosProps) => {
  const etiquetaDe = (accion: AccionAtajo) => ACCIONES_ATAJO.find((a) => a.accion === accion)?.etiqueta ?? accion;
  const quienTiene = (gesto: Gesto) => (Object.keys(gestos) as AccionAtajo[]).find((a) => gestos[a] === gesto);
  const elegirGesto = (accion: AccionAtajo, etiqueta: string, valor: string) => {
    const gesto = (GESTOS.find((g) => g.id === valor)?.id ?? null) as Gesto | null;
    const otra = gesto ? quienTiene(gesto) : undefined;
    onCambiarGesto(accion, gesto);
    setAviso(
      gesto
        ? `${etiqueta}: ${describirGesto(gesto).toLocaleLowerCase('es')}.${otra && otra !== accion ? ` Se le quita a «${etiquetaDe(otra)}».` : ''}`
        : `${etiqueta}: sin gesto.`,
    );
  };
  const [escuchando, setEscuchando] = useState<AccionAtajo | null>(null);
  const [aviso, setAviso] = useState('');
  const ariaLive = useAriaLive('preferencias');
  // Al capturar Espacio o Intro con el foco en «Cambiar», el navegador hace después
  // clic en el botón: ese clic se ignora para no volver a escuchar.
  const ignorarClicRef = useRef(false);

  const capturar = (accion: AccionAtajo, etiqueta: string) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if (escuchando !== accion) return;
    // Tab sigue moviendo el foco (y al salir se deja de escuchar).
    if (e.key === 'Tab') return;
    e.preventDefault();
    // Que Escape no cierre el diálogo: aquí solo cancela.
    e.stopPropagation();
    if (e.key === 'Escape') {
      setEscuchando(null);
      setAviso('Cambio cancelado.');
      return;
    }
    const atajo = atajoDe(e);
    if (!atajo) return; // solo un modificador: se espera a la tecla
    onCambiar(accion, atajo);
    ignorarClicRef.current = true;
    setEscuchando(null);
    setAviso(`${etiqueta}: ${describirAtajo(atajo)}.`);
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-on-surface-muted">
        Los atajos funcionan estés donde estés, también con el foco en un botón; solo no mientras escribes en un campo
        de texto.
      </p>
      <p className="text-sm text-on-surface-muted">
        En el móvil o la tableta puedes darle además a cada acción un gesto con dos o tres dedos (tocar o deslizar
        sobre la sala). Si un gesto no responde, puede que lo use tu sistema: elige otro.
      </p>
      <ul className="flex flex-col gap-4">
        {ACCIONES_ATAJO.map(({ accion, etiqueta }) => (
          <li key={accion} className="flex flex-wrap items-center gap-3">
            <span id={`sala-atajo-${accion}`} className="min-w-48 text-sm">
              {etiqueta}
            </span>
            <TeclaAtajo atajo={atajos[accion]} ocultoALector className="px-2 py-1 text-sm" />
            <button
              type="button"
              aria-describedby={`sala-atajo-${accion}`}
              onClick={() => {
                if (ignorarClicRef.current) {
                  ignorarClicRef.current = false;
                  return;
                }
                setAviso('');
                setEscuchando(escuchando === accion ? null : accion);
              }}
              onKeyUp={() => {
                // Si la tecla no ha acabado en clic (no era Espacio ni Intro), no hay nada que ignorar.
                window.setTimeout(() => (ignorarClicRef.current = false), 0);
              }}
              onKeyDown={capturar(accion, etiqueta)}
              onBlur={() => escuchando === accion && setEscuchando(null)}
              {...{ [ATRIBUTO_CAPTURANDO]: escuchando === accion ? '' : undefined }}
              className={botonSecundario}
            >
              {escuchando === accion ? 'Pulsa la nueva tecla (Escape para cancelar)' : 'Cambiar'}
            </button>
            <button
              type="button"
              aria-describedby={`sala-atajo-${accion}`}
              onClick={() => {
                onCambiar(accion, ATAJOS_INICIALES[accion]);
                setAviso(`${etiqueta}: ${describirAtajo(ATAJOS_INICIALES[accion])}.`);
              }}
              className={botonSecundario}
            >
              Volver a {describirAtajo(ATAJOS_INICIALES[accion])}
            </button>
            <label className="flex items-center gap-2 text-sm">
              <span className="sr-only">Gesto para {etiqueta}</span>
              <span aria-hidden="true">Gesto</span>
              <select
                value={gestos[accion] ?? ''}
                onChange={(e) => elegirGesto(accion, etiqueta, e.target.value)}
                className={`${campo} py-1 text-sm`}
              >
                <option value="">Sin gesto</option>
                {GESTOS.map((g) => {
                  const otra = quienTiene(g.id);
                  return (
                    <option key={g.id} value={g.id}>
                      {g.nombre}
                      {otra && otra !== accion ? ` (ahora: ${etiquetaDe(otra)})` : ''}
                    </option>
                  );
                })}
              </select>
            </label>
          </li>
        ))}
      </ul>
      <p aria-live={ariaLive} className="text-sm text-on-surface-muted">
        {aviso}
      </p>
    </div>
  );
};

export default PanelAtajos;
