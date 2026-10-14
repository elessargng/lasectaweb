import SelectorIdioma from './SelectorIdioma';
import { GENEROS, useIdiomas } from './guiones';
import type { PreferenciasSala } from './preferencias';

interface PanelIdiomasProps {
  preferencias: PreferenciasSala;
  onCambiar: (cambios: Partial<PreferenciasSala>) => void;
}

const selectClass =
  'rounded border border-outline-ghost bg-background px-3 py-2 text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main';

/**
 * En la pestaña Usuario: en qué idioma se ven los personajes, los nombres por
 * un lado y las descripciones (habilidades y recordatorios) por otro, y el
 * género de los textos en las traducciones que lo distinguen. Se aplica al
 * momento y se guarda en este navegador.
 */
const PanelIdiomas = ({ preferencias, onCambiar }: PanelIdiomasProps) => {
  // Las traducciones en que cambia algo el género, para decirlo en la ayuda
  const conGeneros = useIdiomas()
    .filter((i) => i.tieneGeneros)
    .map((i) => i.nombre);
  return (
    <fieldset aria-describedby="sala-pref-idiomas-ayuda" className="flex flex-col gap-4 border-t border-outline-ghost pt-6">
      <legend className="float-left mb-2 w-full text-sm text-on-surface-muted">Idioma de los personajes</legend>
      <div className="flex flex-col gap-1">
        <SelectorIdioma
          id="sala-pref-idioma-nombres"
          etiqueta="Nombres"
          valor={preferencias.idiomaNombres}
          onCambiar={(idiomaNombres) => onCambiar({ idiomaNombres })}
          className={selectClass}
          etiquetaClassName="text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <SelectorIdioma
          id="sala-pref-idioma-descripciones"
          etiqueta="Descripciones"
          valor={preferencias.idiomaDescripciones}
          onCambiar={(idiomaDescripciones) => onCambiar({ idiomaDescripciones })}
          className={selectClass}
          etiquetaClassName="text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="sala-pref-genero" className="text-sm">
          Género
        </label>
        <select
          id="sala-pref-genero"
          value={preferencias.genero}
          onChange={(e) => onCambiar({ genero: e.target.value === 'femenino' ? 'femenino' : 'masculino' })}
          aria-describedby="sala-pref-genero-ayuda"
          className={selectClass}
        >
          {GENEROS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
            </option>
          ))}
        </select>
        <p id="sala-pref-genero-ayuda" className="text-xs text-on-surface-muted">
          Cambia los textos de las traducciones que lo distinguen
          {conGeneros.length > 0 && ` (${conGeneros.join(', ')})`}: «jugadores» o «jugadoras».
        </p>
      </div>
      <p id="sala-pref-idiomas-ayuda" className="text-xs text-on-surface-muted">
        Para la hoja de personajes y el orden de noche. Lo que no esté traducido se ve en inglés.
      </p>
    </fieldset>
  );
};

export default PanelIdiomas;
