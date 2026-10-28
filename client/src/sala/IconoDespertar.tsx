import LunaDespertar from './LunaDespertar';
import { DESPERTAR_DEFECTO, ENTENDIDO_DEFECTO, useMarcas, type EstiloDespertar, type EstiloEntendido } from './marcas';

/** Las capas de cada ilustración, en public/despertar (cuadradas y encajadas al píxel). */
const img = (nombre: string) => `/despertar/${nombre}.webp`;

/**
 * El icono del despertar sobre la ficha, en el estilo elegido (Preferencias >
 * Interfaz; o `estilo`, para las muestras): la luna de siempre (LunaDespertar) o
 * una ilustración que, con algo sin ver (`nueva`), se anima (sala.css,
 * sala-despertar): la vela apagada se enciende y su llama titila con un halo; el
 * ojo cerrado se abre, brilla y parpadea de vez en cuando; a la máscara sencilla
 * le salen encima las plumas y los adornos, que van y vienen. Con «menos
 * movimiento», el estado nuevo sin animar. `entendido`: el pulgar arriba en su
 * estilo (el guante, el guantelete o el dibujo sencillo; o `estiloEntendido`),
 * que brilla si hay algo nuevo. Solo visual: el botón que lo lleva dice qué es.
 */
const IconoDespertar = ({
  nueva,
  entendido = false,
  estilo,
  estiloEntendido,
  className = '',
}: {
  nueva: boolean;
  entendido?: boolean;
  estilo?: EstiloDespertar;
  estiloEntendido?: EstiloEntendido;
  className?: string;
}) => {
  const marcas = useMarcas();
  const elegido = estilo ?? marcas.despertar ?? DESPERTAR_DEFECTO;
  const pulgar = estiloEntendido ?? marcas.entendido ?? ENTENDIDO_DEFECTO;
  if (entendido && pulgar !== 'pulgar') {
    return (
      <span aria-hidden="true" data-nueva={nueva || undefined} className={`sala-despertar pointer-events-auto cursor-pointer ${className}`}>
        <img src={img(pulgar)} alt="" decoding="async" />
      </span>
    );
  }
  if (entendido || elegido === 'luna') return <LunaDespertar nueva={nueva} entendido={entendido} className={className} />;
  return (
    <span
      aria-hidden="true"
      data-nueva={nueva || undefined}
      className={`sala-despertar sala-despertar-${elegido} pointer-events-auto cursor-pointer ${className}`}
    >
      {elegido === 'vela' && (
        <>
          <span className="halo" />
          <img src={img('vela')} alt="" decoding="async" />
          <img className="llama" src={img('vela-llama')} alt="" decoding="async" />
        </>
      )}
      {elegido === 'ojo' && (
        <>
          <span className="halo" />
          <img className="cerrado" src={img('ojo-cerrado')} alt="" decoding="async" />
          <img className="abierto" src={img('ojo-abierto')} alt="" decoding="async" />
        </>
      )}
      {elegido === 'mascara' && (
        <>
          <img src={img('mascara')} alt="" decoding="async" />
          <img className="adornos" src={img('mascara-adornos')} alt="" decoding="async" />
        </>
      )}
    </span>
  );
};

export default IconoDespertar;
