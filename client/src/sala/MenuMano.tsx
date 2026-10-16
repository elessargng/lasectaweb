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
  onElegirForma: (forma: FormaMano) => Promise<boolean>;
}

/**
 * En la cabecera, para los jugadores: botón con el dibujo de su mano que
 * despliega levantarla o bajarla y elegir su forma (palma, puño o tijera).
 * Levantarla también tiene atajo de teclado (Preferencias > Atajos). Un muerto
 * que ya ha gastado su voto no puede levantarla: la opción sale desactivada.
 */
const MenuMano = ({ forma, levantada, sinVoto = false, atajoLevantar, onAlternar, onElegirForma }: MenuManoProps) => {
  const opciones: OpcionMenu[] = [
    levantada
      ? { id: 'alternar', etiqueta: 'Bajar la mano', atajo: atajoLevantar, elegir: onAlternar }
      : sinVoto
        ? { id: 'alternar', etiqueta: 'Levantar la mano (sin voto)', deshabilitada: true, elegir: onAlternar }
        : { id: 'alternar', etiqueta: 'Levantar la mano', atajo: atajoLevantar, elegir: onAlternar },
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
      descripcion={`${nombreMano(forma)}, ${levantada ? 'levantada' : 'bajada'}${sinVoto ? ', sin voto' : ''}`}
      boton={<Mano forma={forma} className={`h-7 w-7 ${levantada ? '' : 'opacity-60'}`} />}
      botonClassName={botonIcono}
      opciones={opciones}
    />
  );
};

export default MenuMano;
