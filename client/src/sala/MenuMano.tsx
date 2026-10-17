import Mano from './Mano';
import MenuDesplegable, { type OpcionMenu } from './MenuDesplegable';
import { botonIcono } from './estilos';
import { FORMAS_MANO, nombreMano } from './formasMano';
import type { Atajo } from './atajos';
import type { FormaMano } from './useSala';

interface MenuManoProps {
  forma: FormaMano;
  levantada: boolean;
  /** Muerto y sin voto: no puede levantarla (solo bajarla, si la tenía levantada). */
  sinVoto?: boolean;
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
}

/**
 * En la cabecera, para los jugadores: botón con el dibujo de su mano que
 * despliega levantarla o bajarla y elegir su forma (palma, puño o tijera).
 * Levantarla también tiene atajo de teclado (Preferencias > Atajos). Un muerto
 * que ya ha gastado su voto no puede levantarla: la opción sale desactivada.
 */
const MenuMano = ({
  forma,
  levantada,
  sinVoto = false,
  atajoLevantar,
  onAlternar,
  onElegirForma,
  manos = levantada ? 1 : 0,
  puedeDosManos = false,
  siguientes,
  onManos,
}: MenuManoProps) => {
  // La Banshee con su habilidad: una mano, las dos o bajarlas (la tecla, en la que toca)
  const conDos: OpcionMenu[] =
    puedeDosManos && onManos
      ? ([
          manos !== 1 && { id: 'una', etiqueta: manos === 2 ? 'Bajar una mano' : 'Levantar la mano', n: 1 as const },
          manos !== 2 && { id: 'dos', etiqueta: 'Levantar las dos manos', n: 2 as const },
          manos !== 0 && { id: 'bajar', etiqueta: manos === 2 ? 'Bajar las manos' : 'Bajar la mano', n: 0 as const },
        ].filter(Boolean) as { id: string; etiqueta: string; n: 0 | 1 | 2 }[]).map(({ id, etiqueta, n }) => ({
          id,
          etiqueta: n > 0 && sinVoto ? `${etiqueta} (sin voto)` : etiqueta,
          deshabilitada: n > 0 && sinVoto,
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
            : sinVoto
              ? { id: 'alternar', etiqueta: 'Levantar la mano (sin voto)', deshabilitada: true, elegir: onAlternar }
              : { id: 'alternar', etiqueta: 'Levantar la mano', atajo: atajoLevantar, elegir: onAlternar },
        ]),
    ...FORMAS_MANO.map(({ forma: f, nombre }) => ({
      id: f,
      etiqueta: nombre,
      marcada: f === forma,
      elegir: () => onElegirForma(f),
    })),
  ];

  return (
    <MenuDesplegable
      id="sala-menu-mano"
      alinear="derecha"
      etiqueta="Tu mano"
      // El estado, en la descripción: al bajarse sola (al votar) no se anuncia
      descripcion={`${nombreMano(forma)}, ${manos === 2 ? 'las dos levantadas' : levantada ? 'levantada' : 'bajada'}${sinVoto ? ', sin voto' : ''}`}
      boton={<Mano forma={forma} className={`h-7 w-7 ${levantada ? '' : 'opacity-60'}`} />}
      botonClassName={botonIcono}
      opciones={opciones}
    />
  );
};

export default MenuMano;
