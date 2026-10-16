import type { CSSProperties } from 'react';

/** Unas ondas que se ven en la mesa: de un asiento a otro (índices), con su intensidad. */
export interface OndaMesa {
  id: number;
  desde: number;
  hasta: number;
  intensidad: 1 | 2 | 3;
}

/**
 * Los susurros de la mesa: cuando dos jugadores se escriben en privado, unas
 * ondas salen del asiento de quien escribe hacia el de quien lo recibe. Más
 * ondas y más grandes cuanto más largo es el mensaje. Todos las ven (no lo que
 * dicen). Con menos movimiento, se ven quietas a medio camino.
 *
 * Los asientos están en un círculo (el 1 a las 12): cada onda va por la cuerda
 * entre los dos, del centro de un cuadro al del otro. Solo visual: se avisa aparte.
 */
const Ondas = ({ ondas, total }: { ondas: OndaMesa[]; total: number }) => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20">
    {ondas.map((o) => {
      const a = (2 * Math.PI * o.desde) / total;
      const b = (2 * Math.PI * o.hasta) / total;
      const radio = '(50% - var(--sala-avatar, 10rem) / 2)';
      // Dirección de la cuerda y su largo (en radios del círculo de asientos)
      const giro = (Math.atan2(-Math.cos(b) + Math.cos(a), Math.sin(b) - Math.sin(a)) * 180) / Math.PI;
      const cuerda = 2 * Math.abs(Math.sin((b - a) / 2));
      const estilo: CSSProperties = {
        left: `calc(50% + ${Math.sin(a).toFixed(4)} * ${radio})`,
        top: `calc(50% + ${(-Math.cos(a)).toFixed(4)} * ${radio})`,
        width: `calc(${cuerda.toFixed(4)} * ${radio})`,
        transform: `rotate(${giro.toFixed(2)}deg)`,
      };
      const cuantas = o.intensidad + 1;
      const lado = `${1.4 + o.intensidad * 0.6}rem`;
      return (
        <div key={o.id} className="absolute h-0 origin-left" style={estilo}>
          {Array.from({ length: cuantas }, (_, k) => (
            <svg
              key={k}
              viewBox="0 0 20 40"
              className="sala-onda absolute top-0 text-theme-main drop-shadow-[0_0_6px_rgba(212,175,106,0.85)]"
              style={{ height: lado, width: `calc(${lado} / 2)`, animationDelay: `${k * 0.25}s` }}
            >
              {/* Un arco abierto hacia quien lo recibe: «)» */}
              <path d="M4 2 Q18 20 4 38" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
          ))}
        </div>
      );
    })}
  </div>
);

export default Ondas;
