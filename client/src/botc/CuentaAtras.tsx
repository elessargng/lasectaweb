import { useEffect, useRef, useState } from 'react';
import { tocarCuentaAtras } from './sonidos';

interface CuentaAtrasProps {
  /** Cuándo acaba (ms, reloj del servidor). */
  fin: number;
  /** Reloj del servidor menos el de aquí (ms). */
  desfase: number;
  /** Aviso al lector al terminar. */
  onTermina: () => void;
}

/** Lo que dura: de 3 a 0, un segundo cada número (como el servidor, SALA_CUENTA_ATRAS_MS). */
const DURACION_MS = 4000;

/** El número que toca (3, 2, 1, 0), o null si ya ha acabado. */
const numero = (fin: number, desfase: number) => {
  const ms = fin - (Date.now() + desfase);
  return ms > 0 ? Math.ceil(ms / 1000) - 1 : null;
};

/**
 * La cuenta atrás de una nominación, en grande, igual para todos (se calcula con
 * el reloj del servidor): 3, 2, 1, 0, un segundo cada uno, y al acabar
 * «¡Tiempo!». Suena entero el sonido de la cuenta atrás de botc.app, que dura lo
 * mismo.
 *
 * Al lector no se le leen los segundos uno a uno (sería un aviso por segundo):
 * se anuncia al empezar (avisosSala) y al terminar (`onTermina`).
 */
const CuentaAtras = ({ fin, desfase, onTermina }: CuentaAtrasProps) => {
  const [actual, setActual] = useState(() => numero(fin, desfase));
  // Si ya había terminado al aparecer (p. ej. al entrar en la sala), no se avisa.
  const avisadoRef = useRef(numero(fin, desfase) === null);

  useEffect(() => {
    const intervalo = window.setInterval(() => setActual(numero(fin, desfase)), 100);
    return () => window.clearInterval(intervalo);
  }, [fin, desfase]);

  // El sonido, entero, desde que empieza la cuenta (quien entra a mitad lo oye
  // desde ese punto; con menos de un segundo por delante, ya no). Si la cuenta
  // se quita antes, se para.
  useEffect(() => {
    const terminaEn = fin - desfase;
    if (terminaEn - Date.now() < 1000) return;
    return tocarCuentaAtras(terminaEn - DURACION_MS);
  }, [fin, desfase]);

  // Avisar una vez al terminar. (Si la cuenta se reinicia, quien la usa la monta
  // de nuevo con otra `key`, así que vuelve a avisar.)
  useEffect(() => {
    if (actual !== null || avisadoRef.current) return;
    avisadoRef.current = true;
    onTermina();
  }, [actual, onTermina]);

  return (
    <p
      aria-hidden="true"
      className="font-teutonic1 text-6xl leading-none text-gold-bright tabular-nums drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
    >
      {actual ?? '¡Tiempo!'}
    </p>
  );
};

export default CuentaAtras;
