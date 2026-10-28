import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Mano from './Mano';
import MenuDesplegable, { type OpcionMenu } from './MenuDesplegable';
import { botonIcono } from './estilos';
import { EMOTICONOS_MANO, FORMAS_MANO, nombreMano } from './formasMano';
import { ESTILOS_MANO, type PreferenciaMano } from './marcas';
import type { Atajo } from './atajos';
import type { PersonajeMostrado } from './guiones';
import type { FormaMano } from './useSala';

interface MenuManoProps {
  forma: FormaMano;
  levantada: boolean;
  /** Muerto y sin voto: no puede levantarla (solo bajarla, si la tenía levantada). */
  sinVoto?: boolean;
  /** Hay un señalamiento (que se ve): tampoco se puede levantar. */
  senalando?: boolean;
  /** La tecla de levantar o bajar la mano (se ve al lado de la opción). */
  atajoLevantar?: Atajo;
  /** Levanta o baja la mano; devuelve false para que el menú se cierre. */
  onAlternar: () => Promise<boolean>;
  /** Manos levantadas ahora (0, 1 o 2) y si puede levantar las dos (la Banshee con su habilidad). */
  manos?: 0 | 1 | 2;
  puedeDosManos?: boolean;
  /** Lo que hace la tecla ahora (en esa opción se ve). */
  siguientes?: 0 | 1 | 2;
  onManos?: (n: 0 | 1 | 2) => Promise<boolean>;
  onElegirForma: (forma: FormaMano) => Promise<boolean>;
  /** Los personajes del guion: la mano también puede ser su icono (van detrás de las formas). */
  personajes?: PersonajeMostrado[];
  /** El estilo de las manos (Preferencias > Interfaz): las flechas junto a «Manos» lo cambian. */
  estilo: PreferenciaMano;
  onEstilo: (estilo: PreferenciaMano) => void;
}

/** Lo que se espera desde la última flecha para guardar el estilo: aquí se ve al momento, a los demás les llega al dejarlo. */
const ESPERA_ESTILO = 700;
/** Los estilos por los que pasan las flechas: los de verdad, sin «Al azar». */
const ESTILOS_FLECHAS = ESTILOS_MANO.filter((e) => e.id !== 'azar');

/**
 * En la cabecera, para los jugadores y los narradores: botón con el dibujo de su
 * mano que despliega levantarla o bajarla y elegir su forma (ver FORMAS_MANO) o
 * el icono de un personaje del guion. La del narrador no vota.
 * Levantarla también tiene atajo de teclado (Preferencias > Atajos). Un muerto
 * que ya ha gastado su voto no puede levantarla, ni nadie mientras se señala:
 * la opción sale desactivada, con el motivo. Junto al rótulo «Manos», unas
 * flechas pasan por los estilos de las manos; el que se deja queda elegido, como
 * en Preferencias > Interfaz.
 */
const MenuMano = ({
  forma,
  levantada,
  sinVoto = false,
  senalando = false,
  atajoLevantar,
  onAlternar,
  onElegirForma,
  manos = levantada ? 1 : 0,
  puedeDosManos = false,
  siguientes,
  onManos,
  personajes = [],
  estilo,
  onEstilo,
}: MenuManoProps) => {
  const porId = new Map(personajes.map((p) => [p.id, p]));
  // El estilo por el que se va pasando con las flechas, aún sin guardar (null: el elegido)
  const [vista, setVista] = useState<PreferenciaMano | null>(null);
  const mostrado = vista ?? estilo;
  const esperaRef = useRef<number | undefined>(undefined);
  const pendienteRef = useRef<PreferenciaMano | null>(null);
  const onEstiloRef = useRef(onEstilo);
  useEffect(() => {
    onEstiloRef.current = onEstilo;
  });
  // Si se va antes de guardarlo (sale de la sala), se guarda igual
  useEffect(
    () => () => {
      window.clearTimeout(esperaRef.current);
      if (pendienteRef.current) onEstiloRef.current(pendienteRef.current);
    },
    [],
  );
  const pasarEstilo = (paso: 1 | -1) => {
    // «Al azar» no sale en las flechas: desde él, la primera o la última
    const i = ESTILOS_FLECHAS.findIndex((e) => e.id === mostrado);
    const desde = i === -1 ? (paso === 1 ? -1 : 0) : i;
    const nuevo = ESTILOS_FLECHAS[(desde + paso + ESTILOS_FLECHAS.length) % ESTILOS_FLECHAS.length].id;
    setVista(nuevo);
    pendienteRef.current = nuevo;
    window.clearTimeout(esperaRef.current);
    esperaRef.current = window.setTimeout(() => {
      pendienteRef.current = null;
      onEstiloRef.current(nuevo);
      setVista(null);
    }, ESPERA_ESTILO);
  };
  // «Al azar» se ve con la de esta partida
  const estiloDibujo = mostrado === 'azar' ? undefined : mostrado;
  // Por qué no se puede levantar ahora (se dice junto a la opción, desactivada), o null
  const bloqueo = senalando ? 'se está señalando' : sinVoto ? 'sin voto' : null;
  // La Banshee con su habilidad: una mano, las dos o bajarlas (la tecla, en la que toca)
  const conDos: OpcionMenu[] =
    puedeDosManos && onManos
      ? ([
          manos !== 1 && { id: 'una', etiqueta: manos === 2 ? 'Bajar una mano' : 'Levantar la mano', n: 1 as const },
          manos !== 2 && { id: 'dos', etiqueta: 'Levantar las dos manos', n: 2 as const },
          manos !== 0 && { id: 'bajar', etiqueta: manos === 2 ? 'Bajar las manos' : 'Bajar la mano', n: 0 as const },
        ].filter(Boolean) as { id: string; etiqueta: string; n: 0 | 1 | 2 }[]).map(({ id, etiqueta, n }) => ({
          id,
          etiqueta: n > 0 && bloqueo ? `${etiqueta} (${bloqueo})` : etiqueta,
          deshabilitada: n > 0 && !!bloqueo,
          atajo: n === siguientes ? atajoLevantar : undefined,
          elegir: () => onManos(n),
        }))
      : [];
  const opciones: OpcionMenu[] = [
    ...(conDos.length
      ? conDos
      : [
          levantada
            ? { id: 'alternar', etiqueta: 'Bajar la mano', atajo: atajoLevantar, elegir: onAlternar }
            : bloqueo
              ? { id: 'alternar', etiqueta: `Levantar la mano (${bloqueo})`, deshabilitada: true, elegir: onAlternar }
              : { id: 'alternar', etiqueta: 'Levantar la mano', atajo: atajoLevantar, elegir: onAlternar },
        ]),
    // Las formas y los personajes, en rejilla: la mano tal como se verá (en el estilo de cada uno)
    ...FORMAS_MANO.map(({ forma: f, nombre }) => ({
      id: f,
      etiqueta: nombre,
      marcada: f === forma,
      elegir: () => onElegirForma(f),
      dibujo: <Mano forma={f} estilo={estiloDibujo} className="h-full w-full" />,
      grupo: 'Manos',
    })),
    ...EMOTICONOS_MANO.map(({ forma: f, nombre }) => ({
      id: f,
      etiqueta: nombre,
      marcada: f === forma,
      elegir: () => onElegirForma(f),
      dibujo: <Mano forma={f} className="h-full w-full" />,
      grupo: 'Emoticonos',
    })),
    ...personajes
      .filter((p) => p.icono)
      .map((p) => ({
        id: `personaje-${p.id}`,
        etiqueta: p.nombre.texto,
        marcada: p.id === forma,
        elegir: () => onElegirForma(p.id),
        dibujo: <Mano forma={p.id} className="h-full w-full" />,
        grupo: 'Personajes',
      })),
  ];

  return (
    <MenuDesplegable
      id="sala-menu-mano"
      alinear="derecha"
      etiqueta="Tu mano"
      // El estado, en la descripción: al bajarse sola (al votar) no se anuncia
      descripcion={`${nombreMano(forma, porId)}, ${manos === 2 ? 'las dos levantadas' : levantada ? 'levantada' : 'bajada'}${sinVoto ? ', sin voto' : ''}`}
      boton={<Mano forma={forma} className={`h-7 w-7 ${levantada ? '' : 'opacity-60'}`} />}
      botonClassName={botonIcono}
      opciones={opciones}
      extrasGrupo={{
        Manos: (
          <div className="ml-auto flex items-center gap-1">
            <button type="button" aria-label="Estilo anterior" onClick={() => pasarEstilo(-1)} className={`${botonIcono} h-7 w-7`}>
              <ChevronLeft size={16} />
            </button>
            {/* El nombre del estilo, que se anuncia al cambiarlo */}
            <span aria-live="polite" className="min-w-[5.5rem] text-center text-xs text-on-surface">
              {ESTILOS_MANO.find((e) => e.id === mostrado)?.nombre}
            </span>
            <button type="button" aria-label="Estilo siguiente" onClick={() => pasarEstilo(1)} className={`${botonIcono} h-7 w-7`}>
              <ChevronRight size={16} />
            </button>
          </div>
        ),
      }}
    />
  );
};

export default MenuMano;
