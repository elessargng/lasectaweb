import MenuDesplegable, { type OpcionMenu } from './MenuDesplegable';
import ImagenAvatar from './ImagenAvatar';

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
      ayuda="Preferencias y salir"
      botonClassName="flex items-center gap-2 rounded-full border border-gold/25 bg-background/40 py-1 pl-1 pr-1 sm:pr-3 font-ui text-sm text-on-surface-bright transition-colors hover:border-gold/70 aria-expanded:border-gold/70 motion-reduce:transition-none"
      boton={
        <>
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gold bg-surface font-display text-gold-bright shadow-[0_0_0_2px_var(--color-background),0_0_0_3px_rgba(212,175,106,0.35)]"
          >
            {avatar ? (
              <ImagenAvatar avatar={avatar} />
            ) : (
              nombre.charAt(0).toLocaleUpperCase('es')
            )}
          </span>
          {/* En pantallas estrechas, solo el avatar a la vista */}
          <span className="max-w-[12rem] truncate max-sm:sr-only">{nombre}</span>
          <span className="sr-only">, tus opciones</span>
        </>
      }
      opciones={opciones}
    />
  );
};

export default MenuUsuario;
