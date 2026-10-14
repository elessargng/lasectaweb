/**
 * Sonidos de la partida: los de botc.app (copias locales en public/sonidos),
 * con Web Audio para que suenen a su hora exacta.
 *
 * Los navegadores no dejan sonar nada hasta que se interactúa con la página: el
 * contexto de audio se crea (o se reanuda) con el primer clic o tecla, y entonces
 * se cargan los sonidos. Se pueden quitar en Preferencias > Interfaz
 * (`setSonidosActivos`).
 */

const ARCHIVOS = {
  /** Un jugador vota. */
  voto: '/sonidos/voto.mp3',
  /** Le toca a un jugador y no vota (tic). */
  sinVoto: '/sonidos/sin-voto.mp3',
  /** Los últimos segundos de la cuenta atrás de una nominación. */
  cuentaAtras: '/sonidos/cuenta-atras.mp3',
};
type Sonido = keyof typeof ARCHIVOS;

let contexto: AudioContext | null = null;
let activos = true;
const cargados = new Map<Sonido, Promise<AudioBuffer | null>>();

export function setSonidosActivos(si: boolean): void {
  activos = si;
}

/** Descarga y decodifica un sonido (una vez); null si no se puede. */
function cargar(ctx: AudioContext, sonido: Sonido): Promise<AudioBuffer | null> {
  let buffer = cargados.get(sonido);
  if (!buffer) {
    buffer = fetch(ARCHIVOS[sonido])
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((datos) => ctx.decodeAudioData(datos))
      .catch(() => {
        cargados.delete(sonido); // se reintentará la próxima vez
        return null;
      });
    cargados.set(sonido, buffer);
  }
  return buffer;
}

function desbloquear(): void {
  try {
    contexto ??= new AudioContext();
    if (contexto.state === 'suspended') void contexto.resume();
    // Cargados de antemano, para que suenen sin retraso
    for (const sonido of Object.keys(ARCHIVOS) as Sonido[]) void cargar(contexto, sonido);
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

/**
 * Suena un sonido, ya o en `empiezaEn` (ms, reloj de aquí); si ese momento ya ha
 * pasado, desde el punto por el que iría. Devuelve cómo pararlo.
 */
function sonar(sonido: Sonido, empiezaEn?: number): () => void {
  const ctx = audio();
  if (!ctx) return () => {};
  let fuente: AudioBufferSourceNode | null = null;
  let parado = false;
  void cargar(ctx, sonido).then((buffer) => {
    if (!buffer || parado) return;
    fuente = ctx.createBufferSource();
    fuente.buffer = buffer;
    fuente.connect(ctx.destination);
    // Segundos hasta que empieza (negativo: los que lleva sonando)
    const falta = empiezaEn === undefined ? 0 : (empiezaEn - Date.now()) / 1000;
    if (-falta >= buffer.duration) return;
    fuente.start(ctx.currentTime + Math.max(0, falta), Math.max(0, -falta));
  });
  return () => {
    parado = true;
    try {
      fuente?.stop();
    } catch {
      // Ya había acabado.
    }
  };
}

/** Alguien vota. */
export function tocarVoto(): void {
  sonar('voto');
}

/** Le toca a alguien y no vota. */
export function tocarSinVoto(): void {
  sonar('sinVoto');
}

/**
 * La cuenta atrás de una nominación, entera, desde `empiezaEn` (ms, reloj de
 * aquí). Devuelve cómo pararla (si se cierra la nominación antes).
 */
export function tocarCuentaAtras(empiezaEn: number): () => void {
  return sonar('cuentaAtras', empiezaEn);
}
