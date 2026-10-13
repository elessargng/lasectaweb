import { useEffect, useRef, useState } from 'react';
import { tocarCampanario } from './sonidos';

interface CuentaAtrasProps {
  /** Cuándo acaba (ms, reloj del servidor). */
  fin: number;
  /** Reloj del servidor menos el de aquí (ms). */
  desfase: number;
  /** Aviso al lector al terminar. */
  onTermina: () => void;
}

const restante = (fin: number, desfase: number) => Math.max(0, Math.ceil((fin - (Date.now() + desfase)) / 1000));

/**
 * La cuenta atrás de una nominación, en grande, igual para todos (se calcula con
 * el reloj del servidor). Al llegar a 0 pone «¡Tiempo!». En los 3 últimos
 * segundos suenan campanadas de campanario.
 *
 * Al lector no se le leen los segundos uno a uno (sería un aviso por segundo):
 * se anuncia al empezar (avisosSala) y al terminar (`onTermina`).
 */
const CuentaAtras = ({ fin, desfase, onTermina }: CuentaAtrasProps) => {
  const [segundos, setSegundos] = useState(() => restante(fin, desfase));
  // Si ya había terminado al aparecer (p. ej. al entrar en la sala), no se avisa.
  const avisadoRef = useRef(restante(fin, desfase) === 0);

  useEffect(() => {
    const intervalo = window.setInterval(() => setSegundos(restante(fin, desfase)), 200);
    return () => window.clearInterval(intervalo);
  }, [fin, desfase]);

  // Campanadas de campanario en los 3 últimos segundos (si queda tiempo para oírlas
  // casi enteras: quien entra a mitad de la cuenta no las oye a destiempo).
  useEffect(() => {
    const ms = fin - (Date.now() + desfase);
    if (ms < 2500) return;
    const espera = window.setTimeout(() => tocarCampanario(), Math.max(0, ms - 3000));
    return () => window.clearTimeout(espera);
  }, [fin, desfase]);

  // Avisar una vez al terminar. (Si la cuenta se reinicia, quien la usa la monta
  // de nuevo con otra `key`, así que vuelve a avisar.)
  useEffect(() => {
    if (segundos > 0 || avisadoRef.current) return;
    avisadoRef.current = true;
    onTermina();
  }, [segundos, onTermina]);

  return (
    <p
      aria-hidden="true"
      className="font-teutonic1 text-6xl leading-none text-white tabular-nums drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
    >
      {segundos > 0 ? segundos : '¡Tiempo!'}
    </p>
  );
};

export default CuentaAtras;
