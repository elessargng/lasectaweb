import type { DatosPersonajes } from './personajes';

/**
 * Un texto de logro: los personajes ({klutz}) con su nombre en el idioma de quien
 * mira (y su `lang`) y los tipos (*Demonio*), los dos destacados, en negrita y en
 * latón. Para el lector es el mismo texto, sin las marcas.
 */
const TextoLogro = ({ texto, personajes }: { texto: string; personajes: DatosPersonajes }) => (
  <>
    {texto.split(/\{([a-z0-9]+)\}|\*([^*]+)\*/).map((trozo, i) => {
      // split con dos grupos: cada tres trozos, el texto, el personaje (o nada) y el tipo (o nada)
      if (trozo === undefined || trozo === '') return null;
      if (i % 3 === 0) return trozo;
      const personaje = i % 3 === 1;
      return (
        <strong key={i} lang={personaje ? personajes.lang(trozo) : undefined} className="font-semibold text-gold-bright">
          {personaje ? personajes.nombre(trozo) : trozo}
        </strong>
      );
    })}
  </>
);

export default TextoLogro;
