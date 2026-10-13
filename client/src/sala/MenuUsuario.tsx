import { getAvatarUrl } from '../utils/api';
import MenuDesplegable, { type OpcionMenu } from './MenuDesplegable';

interface MenuUsuarioProps {
  nombre: string;
  /** Ruta del avatar de su cuenta; null si es invitado. */
  avatar: string | null;
  conCuenta: boolean;
  /** Abre las preferencias (el diálogo lo pinta la sala). */
  onPreferencias: () => void;
  /** Opciones según tu situación en la sala (hacerse narrador, levantarse, dejar de narrar); van entre Preferencias y salir. */
  enLaSala: OpcionMenu[];
  onSalir: () => void;
}

/**
 * Arriba a la derecha: avatar y nombre de quien está en la sala, que despliega
 * sus opciones. El nombre accesible del botón empieza por el nombre visible y
 * añade «tus opciones», para que se entienda qué abre.
 */
const MenuUsuario = ({ nombre, avatar, conCuenta, onPreferencias, enLaSala, onSalir }: MenuUsuarioProps) => {
  const opciones: OpcionMenu[] = [
    { id: 'preferencias', etiqueta: 'Preferencias', abreDialogo: true, elegir: onPreferencias },
    ...enLaSala,
    { id: 'salir', etiqueta: conCuenta ? 'Cerrar sesión' : 'Salir de la sala', elegir: onSalir },
  ];

  return (
    <MenuDesplegable
      id="sala-menu-usuario"
      alinear="derecha"
      botonClassName="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm text-white hover:bg-theme-main/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main"
      boton={
        <>
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-theme-main bg-surface font-semibold"
          >
            {avatar ? (
              <img src={getAvatarUrl(avatar)} alt="" className="h-full w-full object-cover" />
            ) : (
              nombre.charAt(0).toLocaleUpperCase('es')
            )}
          </span>
          <span className="max-w-[12rem] truncate">{nombre}</span>
          <span className="sr-only">, tus opciones</span>
        </>
      }
      opciones={opciones}
    />
  );
};

export default MenuUsuario;
