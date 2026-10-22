import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Estrella {
  /** Posición, de 0 a 1 respecto a la ventana. */
  x: number;
  y: number;
  /** Radio en píxeles CSS. */
  radio: number;
  /** Brillo máximo (0 a 1). */
  brillo: number;
  /** Color (r, g, b). */
  color: string;
  /** Parpadeo: velocidad (radianes por segundo) y fase. */
  velocidad: number;
  fase: number;
  /** Las más grandes, con destellos en cruz. */
  destello: boolean;
}

interface Fugaz {
  x: number;
  y: number;
  /** Dirección y velocidad (px por segundo). */
  vx: number;
  vy: number;
  /** Segundos que lleva y que dura. */
  edad: number;
  vida: number;
}

/** Blancas casi todas; alguna azulada y alguna dorada, como en un cielo de verdad. */
const COLORES = ['255, 255, 255', '255, 255, 255', '255, 255, 255', '200, 220, 255', '170, 200, 255', '255, 236, 200', '255, 214, 160'];

/** Estrellas por cada 10 000 px² de ventana. */
const DENSIDAD = 1.1;

function crearEstrellas(ancho: number, alto: number): Estrella[] {
  const cuantas = Math.round(((ancho * alto) / 10000) * DENSIDAD);
  return Array.from({ length: cuantas }, () => {
    // Más arriba que abajo (el cielo se abre hacia arriba)
    const y = Math.random() ** 1.6;
    // Muchas pequeñas y pocas grandes
    const tamano = Math.random() ** 3;
    return {
      x: Math.random(),
      y,
      radio: 0.4 + tamano * 1.6,
      brillo: 0.35 + Math.random() * 0.65,
      color: COLORES[Math.floor(Math.random() * COLORES.length)],
      velocidad: 0.4 + Math.random() * 2.2,
      fase: Math.random() * Math.PI * 2,
      destello: tamano > 0.55,
    };
  });
}

/**
 * El cielo estrellado de la noche, detrás de toda la sala (encima del fondo y de
 * su velo de medianoche, ver sala.css): estrellas de distintos tamaños y colores
 * que parpadean y, de vez en cuando, una estrella fugaz. Entra y sale
 * fundiéndose; sin noche, no se dibuja. Con «reducir movimiento», las estrellas
 * se quedan quietas y no hay fugaces. Decorativo: fuera del árbol de accesibilidad.
 */
const CieloEstrellado = ({ activo }: { activo: boolean }) => {
  const lienzoRef = useRef<HTMLCanvasElement>(null);
  // Sigue dibujando mientras se funde al salir (1 s), luego se para
  const [dibujando, setDibujando] = useState(activo);
  // Al llegar la noche, ya (durante el render, sin esperar a un efecto)
  if (activo && !dibujando) setDibujando(true);
  useEffect(() => {
    if (activo) return;
    const t = window.setTimeout(() => setDibujando(false), 1100);
    return () => window.clearTimeout(t);
  }, [activo]);

  useEffect(() => {
    const lienzo = lienzoRef.current;
    const ctx = lienzo?.getContext('2d');
    if (!dibujando || !lienzo || !ctx) return;
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)');
    let estrellas: Estrella[] = [];
    let fugaces: Fugaz[] = [];
    let ancho = 0;
    let alto = 0;
    let siguienteFugaz = 3 + Math.random() * 6;

    const ajustar = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      ancho = window.innerWidth;
      alto = window.innerHeight;
      lienzo.width = Math.round(ancho * ratio);
      lienzo.height = Math.round(alto * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      estrellas = crearEstrellas(ancho, alto);
    };

    const dibujarEstrella = (e: Estrella, t: number) => {
      // Parpadeo suave: entre el 45 % y el 100 % de su brillo
      const parpadeo = quieto.matches ? 1 : 0.725 + 0.275 * Math.sin(t * e.velocidad + e.fase);
      const alfa = e.brillo * parpadeo;
      const x = e.x * ancho;
      const y = e.y * alto;
      // Halo
      const halo = ctx.createRadialGradient(x, y, 0, x, y, e.radio * 4);
      halo.addColorStop(0, `rgba(${e.color}, ${alfa * 0.5})`);
      halo.addColorStop(1, `rgba(${e.color}, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, e.radio * 4, 0, Math.PI * 2);
      ctx.fill();
      // Núcleo
      ctx.fillStyle = `rgba(${e.color}, ${alfa})`;
      ctx.beginPath();
      ctx.arc(x, y, e.radio, 0, Math.PI * 2);
      ctx.fill();
      // Destellos en cruz, que crecen al brillar más
      if (e.destello) {
        const largo = e.radio * (5 + 4 * parpadeo);
        ctx.strokeStyle = `rgba(${e.color}, ${alfa * 0.55})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x - largo, y);
        ctx.lineTo(x + largo, y);
        ctx.moveTo(x, y - largo);
        ctx.lineTo(x, y + largo);
        ctx.stroke();
      }
    };

    const dibujarFugaz = (f: Fugaz) => {
      // Aparece y se apaga; la estela, hacia atrás
      const vida = f.edad / f.vida;
      const alfa = Math.sin(vida * Math.PI);
      const estela = 0.12;
      const gradiente = ctx.createLinearGradient(f.x, f.y, f.x - f.vx * estela, f.y - f.vy * estela);
      gradiente.addColorStop(0, `rgba(255, 255, 255, ${alfa})`);
      gradiente.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.strokeStyle = gradiente;
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(f.x - f.vx * estela, f.y - f.vy * estela);
      ctx.stroke();
    };

    let anterior = performance.now();
    let marco = 0;
    const pintar = (ahora: number) => {
      const dt = Math.min((ahora - anterior) / 1000, 0.1);
      anterior = ahora;
      const t = ahora / 1000;
      ctx.clearRect(0, 0, ancho, alto);
      for (const e of estrellas) dibujarEstrella(e, t);
      if (!quieto.matches) {
        siguienteFugaz -= dt;
        if (siguienteFugaz <= 0) {
          // Desde la mitad de arriba, cruzando en diagonal hacia abajo
          const haciaDerecha = Math.random() < 0.5;
          const velocidad = 700 + Math.random() * 500;
          const angulo = (20 + Math.random() * 25) * (Math.PI / 180);
          fugaces.push({
            x: Math.random() * ancho,
            y: Math.random() * alto * 0.45,
            vx: Math.cos(angulo) * velocidad * (haciaDerecha ? 1 : -1),
            vy: Math.sin(angulo) * velocidad,
            edad: 0,
            vida: 0.6 + Math.random() * 0.5,
          });
          siguienteFugaz = 5 + Math.random() * 10;
        }
        for (const f of fugaces) {
          f.edad += dt;
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          dibujarFugaz(f);
        }
        fugaces = fugaces.filter((f) => f.edad < f.vida);
      }
      // Con reducir movimiento, un solo dibujo (y otro si cambia la ventana)
      if (!quieto.matches) marco = requestAnimationFrame(pintar);
    };

    const alCambiarVentana = () => {
      ajustar();
      if (quieto.matches) pintar(performance.now());
    };
    const alCambiarMovimiento = () => {
      cancelAnimationFrame(marco);
      anterior = performance.now();
      marco = requestAnimationFrame(pintar);
    };
    ajustar();
    marco = requestAnimationFrame(pintar);
    window.addEventListener('resize', alCambiarVentana);
    quieto.addEventListener('change', alCambiarMovimiento);
    return () => {
      cancelAnimationFrame(marco);
      window.removeEventListener('resize', alCambiarVentana);
      quieto.removeEventListener('change', alCambiarMovimiento);
    };
  }, [dibujando]);

  // En el body, fuera de las capas de la sala: así queda detrás de todo (y delante del velo)
  return createPortal(
    <canvas
      ref={lienzoRef}
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-1 h-full w-full transition-opacity duration-1000 ease-in-out motion-reduce:transition-none ${
        activo ? 'opacity-100' : 'opacity-0'
      }`}
    />,
    document.body,
  );
};

export default CieloEstrellado;
