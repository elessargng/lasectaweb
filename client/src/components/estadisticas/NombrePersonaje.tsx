import type { DatosPersonajes } from './personajes';

/**
 * El nombre de un personaje en el idioma de quien mira, con su `lang` (si no hay
 * traducción, va en el original, en inglés). `destacado`: en negrita y en latón.
 */
const NombrePersonaje = ({
  id,
  personajes,
  className = '',
  destacado = false,
}: {
  id: string;
  personajes: DatosPersonajes;
  className?: string;
  destacado?: boolean;
}) =>
  destacado ? (
    <strong lang={personajes.lang(id)} className={`font-semibold text-gold-bright ${className}`}>
      {personajes.nombre(id)}
    </strong>
  ) : (
    <span lang={personajes.lang(id)} className={className}>
      {personajes.nombre(id)}
    </span>
  );

/** Los roles de alguien en una partida, en orden («Adivino → Imp»), cada uno con su idioma. */
export const CadenaRoles = ({ roles, personajes }: { roles: string[]; personajes: DatosPersonajes }) => (
  <>
    {roles.map((id, i) => (
      <span key={`${id}-${i}`}>
        {i > 0 && ' → '}
        <NombrePersonaje id={id} personajes={personajes} />
      </span>
    ))}
  </>
);

export default NombrePersonaje;
