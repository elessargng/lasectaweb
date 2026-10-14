import { etiquetaIdioma, useIdiomas } from './guiones';

interface SelectorIdiomaProps {
  id: string;
  etiqueta: string;
  /** Id del idioma elegido. */
  valor: string;
  onCambiar: (id: string) => void;
  className?: string;
  etiquetaClassName?: string;
}

/**
 * Un desplegable nativo con los idiomas de los personajes (English, el original,
 * y los paquetes de traducción). El cambio se aplica al momento.
 */
const SelectorIdioma = ({ id, etiqueta, valor, onCambiar, className, etiquetaClassName }: SelectorIdiomaProps) => {
  const idiomas = useIdiomas();
  // Mientras llega la lista (o si el elegido ya no existe), que no parezca elegido otro
  const opciones = idiomas.some((i) => i.id === valor) ? idiomas : [...idiomas, { id: valor, nombre: valor, codigo: '', tieneGeneros: false }];
  return (
    <>
      <label htmlFor={id} className={etiquetaClassName}>
        {etiqueta}
      </label>
      <select id={id} value={valor} onChange={(e) => onCambiar(e.target.value)} className={className}>
        {opciones.map((i) => (
          <option key={i.id} value={i.id}>
            {etiquetaIdioma(i)}
          </option>
        ))}
      </select>
    </>
  );
};

export default SelectorIdioma;
