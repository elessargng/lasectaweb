import { AVATAR_INVITADO } from './avatares';
import CuadroAvatar from './CuadroAvatar';
import FichaRedonda from './FichaRedonda';

/**
 * Cómo se verá un jugador en la mesa con las preferencias de ahora: su cuadro
 * (con el avatar de La Secta) y el nombre encima, y la ficha a la derecha a la
 * distancia elegida. Usa los mismos componentes y variables CSS que la mesa
 * (--sala-avatar, --sala-ficha, --sala-ficha-distancia), así que se ve igual.
 *
 * Solo visual: el lector ya oye los valores en los deslizadores.
 */
const VistaPreviaJugador = ({ nombre }: { nombre: string }) => (
  <div aria-hidden="true" className="flex flex-col gap-2">
    <p className="text-sm text-on-surface-muted">Vista previa</p>
    {/* Ancho: el cuadro y, a su derecha, hasta una ficha entera fuera */}
    <div className="relative mt-6 w-[calc(var(--sala-avatar,10rem)+var(--sala-ficha,4.5rem))]">
      <CuadroAvatar
        imagen={AVATAR_INVITADO}
        pieFuera="arriba"
        pie={<p className="mb-1 truncate text-center text-sm font-semibold">{nombre}</p>}
      />
      {/* Hacia la derecha: 0, centrada en el cuadro; 1, entera fuera tocando el lado */}
      <div
        className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
        style={{
          left: 'calc(var(--sala-avatar, 10rem) / 2 + var(--sala-ficha-distancia, 0.75) * (var(--sala-avatar, 10rem) / 2 + var(--sala-ficha, 4.5rem) / 2))',
          top: 'calc(var(--sala-avatar, 10rem) / 2)',
        }}
      >
        <FichaRedonda />
      </div>
    </div>
  </div>
);

export default VistaPreviaJugador;
