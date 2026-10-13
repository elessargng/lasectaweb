/**
 * Sonidos de la partida, sintetizados con Web Audio (sin archivos): campanas con
 * varios armónicos que se apagan poco a poco y el tic de un reloj de pared.
 *
 * Los navegadores no dejan sonar nada hasta que se interactúa con la página: el
 * contexto de audio se crea (o se reanuda) con el primer clic o tecla.
 * Se pueden quitar en Preferencias > Interfaz (`setSonidosActivos`).
 */

let contexto: AudioContext | null = null;
let activos = true;

export function setSonidosActivos(si: boolean): void {
  activos = si;
}

function desbloquear(): void {
  try {
    contexto ??= new AudioContext();
    if (contexto.state === 'suspended') void contexto.resume();
  } catch {
    // Sin Web Audio: la sala sigue igual, sin sonido.
  }
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', desbloquear, { capture: true });
  window.addEventListener('keydown', desbloquear, { capture: true });
}

/** El contexto si se puede sonar ahora (activos, desbloqueado). */
function audio(): AudioContext | null {
  if (!activos || !contexto || contexto.state !== 'running') return null;
  return contexto;
}

/** Armónicos de una campana (proporción de frecuencia y volumen): no son múltiplos exactos, por eso suena a metal. */
const ARMONICOS: [number, number][] = [
  [0.5, 0.35],
  [1, 1],
  [2, 0.55],
  [2.76, 0.4],
  [5.4, 0.22],
  [8.9, 0.12],
];

/** Una campanada: `frecuencia` (Hz), empieza en `inicio` (s del contexto), se apaga en `duracion` s. */
function campana(ctx: AudioContext, frecuencia: number, inicio: number, duracion: number, volumen: number): void {
  const salida = ctx.createGain();
  salida.gain.value = volumen;
  salida.connect(ctx.destination);
  ARMONICOS.forEach(([proporcion, fuerza], i) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frecuencia * proporcion;
    // Golpe rápido y caída exponencial; los armónicos agudos se apagan antes
    const fin = inicio + duracion / (1 + i * 0.35);
    env.gain.setValueAtTime(0.0001, inicio);
    env.gain.exponentialRampToValueAtTime(fuerza, inicio + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, fin);
    osc.connect(env).connect(salida);
    osc.start(inicio);
    osc.stop(fin + 0.05);
  });
}

/**
 * Campanadas de campanario (Taaan, taaan, taaaan, taaaaan): cuatro notas del
 * carillón de Westminster, cada una más larga, que terminan en `dentroDe + 3` s.
 */
export function tocarCampanario(dentroDe = 0): void {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime + Math.max(0, dentroDe);
  const notas: [number, number, number][] = [
    // [frecuencia, empieza, dura]
    [329.63, 0, 1.4], // mi
    [261.63, 0.75, 1.5], // do
    [293.66, 1.5, 1.8], // re
    [196.0, 2.25, 3.2], // sol
  ];
  for (const [f, empieza, dura] of notas) campana(ctx, f, t + empieza, dura, 0.18);
}

/** Una campanada pequeña y aguda (paan!): alguien vota. */
export function tocarCampanada(): void {
  const ctx = audio();
  if (!ctx) return;
  campana(ctx, 1046.5, ctx.currentTime, 1.1, 0.16);
}

/** El tic seco del segundero de un reloj de pared: alguien no vota. */
export function tocarTic(): void {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime;
  // Ruido muy corto, filtrado a medios-agudos: el «tic» de madera y metal
  const muestras = Math.floor(ctx.sampleRate * 0.03);
  const buffer = ctx.createBuffer(1, muestras, ctx.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < muestras; i++) datos[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / muestras, 6);
  const ruido = ctx.createBufferSource();
  ruido.buffer = buffer;
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'bandpass';
  filtro.frequency.value = 2800;
  filtro.Q.value = 3;
  const volumen = ctx.createGain();
  volumen.gain.value = 0.9;
  ruido.connect(filtro).connect(volumen).connect(ctx.destination);
  ruido.start(t);
}
