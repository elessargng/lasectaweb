/**
 * Sonidos de la sala. Los de la partida son los de botc.app (copias locales en
 * public/sonidos), con Web Audio para que suenen a su hora exacta; los de las
 * conversaciones privadas y los despertadores de noche se sintetizan aquí (sin
 * archivos), salvo el tono de llamada de botc.app, que también es una copia suya.
 *
 * Los navegadores no dejan sonar nada hasta que se interactúa con la página: el
 * contexto de audio se crea (o se reanuda) con el primer clic o tecla, y entonces
 * se cargan los sonidos. Cada uno se puede quitar por separado en Preferencias >
 * Sonido (`setSonidosActivos`).
 */

/** Los sonidos, en el orden en que salen en las preferencias. */
export const SONIDOS = [
  { id: 'gong', nombre: 'Gong del narrador', descripcion: 'Cuando el narrador llama a todos a la plaza.' },
  { id: 'cuentaAtras', nombre: 'Cuenta atrás de las nominaciones', descripcion: 'Los últimos segundos antes de votar y de un señalamiento de día.' },
  { id: 'voto', nombre: 'Cada voto', descripcion: 'Al votar, un sonido por cada mano levantada.' },
  { id: 'sinVoto', nombre: 'Quien no vota', descripcion: 'Un tic cuando la aguja pasa por alguien que no vota.' },
  { id: 'solicitudLlamada', nombre: 'Te solicitan una llamada', descripcion: 'Cuando alguien te pide conversar, con el tono que elijas.' },
  { id: 'despertar', nombre: 'Te despierta el narrador', descripcion: 'De noche, al despertarte o mostrarte algo, con el despertador que elijas.' },
  { id: 'entrarPrivado', nombre: 'Entras en una conversación privada', descripcion: 'Dos notas que suben.' },
  { id: 'salirPrivado', nombre: 'Sales de una conversación privada', descripcion: 'Dos notas que bajan.' },
  { id: 'saleOtro', nombre: 'Alguien sale de tu conversación privada', descripcion: 'Una nota grave.' },
] as const;
export type IdSonido = (typeof SONIDOS)[number]['id'];
export type SonidosActivos = Record<IdSonido, boolean>;

export const TODOS_ACTIVOS = Object.fromEntries(SONIDOS.map((s) => [s.id, true])) as SonidosActivos;

/** Los tonos de las llamadas entrantes, en el orden en que salen en las preferencias. */
export const TONOS_LLAMADA = [
  { id: 'botc', nombre: 'El de botc.app' },
  { id: 'campanilla', nombre: 'Campanilla' },
  { id: 'telefono', nombre: 'Timbre de teléfono' },
] as const;
export type TonoLlamada = (typeof TONOS_LLAMADA)[number]['id'];
export const TONO_LLAMADA_DEFECTO: TonoLlamada = 'botc';
export const esTonoLlamada = (v: unknown): v is TonoLlamada => TONOS_LLAMADA.some((t) => t.id === v);

/** Los despertadores de noche (ver DESPERTADORES), en el orden en que salen en las preferencias: del más corto al más largo. */
export const TONOS_DESPERTAR = [
  { id: 'pitido', nombre: 'Pitido digital' },
  { id: 'alba', nombre: 'Carillón del alba' },
  { id: 'campana', nombre: 'Campana de despertador' },
] as const;
export type TonoDespertar = (typeof TONOS_DESPERTAR)[number]['id'];
export const TONO_DESPERTAR_DEFECTO: TonoDespertar = 'pitido';
export const esTonoDespertar = (v: unknown): v is TonoDespertar => TONOS_DESPERTAR.some((t) => t.id === v);

const ARCHIVOS = {
  voto: '/sonidos/voto.mp3',
  sinVoto: '/sonidos/sin-voto.mp3',
  cuentaAtras: '/sonidos/cuenta-atras.mp3',
  gong: '/sonidos/gong.mp3',
  llamadaBotc: '/sonidos/llamada-botc.mp3',
};
type Archivo = keyof typeof ARCHIVOS;
/** Los sonidos que son un archivo (su id es el del archivo). */
type SonidoArchivo = Extract<IdSonido, Archivo>;
/** Los sonidos que son campanillas (el despertar va con su despertador). */
type Campanilla = Exclude<IdSonido, SonidoArchivo | 'despertar'>;

/** Las campanillas: notas (Hz) y cuándo suena cada una (s), con su timbre. */
const CAMPANILLAS: Record<Campanilla, { notas: [number, number][]; onda: OscillatorType; volumen: number; dura: number }> = {
  solicitudLlamada: { notas: [[880, 0]], onda: 'sine', volumen: 0.15, dura: 0.22 },
  entrarPrivado: { notas: [[784, 0], [1047, 0.13]], onda: 'sine', volumen: 0.16, dura: 0.9 },
  salirPrivado: { notas: [[1047, 0], [784, 0.13]], onda: 'sine', volumen: 0.14, dura: 0.8 },
  saleOtro: { notas: [[392, 0]], onda: 'triangle', volumen: 0.16, dura: 0.9 },
};

let contexto: AudioContext | null = null;
let activos: SonidosActivos = { ...TODOS_ACTIVOS };
let tonoLlamada: TonoLlamada = TONO_LLAMADA_DEFECTO;
let tonoDespertar: TonoDespertar = TONO_DESPERTAR_DEFECTO;
const cargados = new Map<Archivo, Promise<AudioBuffer | null>>();

export function setSonidosActivos(si: SonidosActivos): void {
  activos = si;
}

export function setTonoLlamada(tono: TonoLlamada): void {
  tonoLlamada = tono;
}

export function setTonoDespertar(tono: TonoDespertar): void {
  tonoDespertar = tono;
}

/** Descarga y decodifica un sonido (una vez); null si no se puede. */
function cargar(ctx: AudioContext, sonido: Archivo): Promise<AudioBuffer | null> {
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
    for (const sonido of Object.keys(ARCHIVOS) as Archivo[]) void cargar(contexto, sonido);
  } catch {
    // Sin Web Audio: la sala sigue igual, sin sonido.
  }
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', desbloquear, { capture: true });
  window.addEventListener('keydown', desbloquear, { capture: true });
}

/** El contexto si se puede sonar ahora (ese sonido activo, o `forzar`, y desbloqueado). */
function audio(id: IdSonido, forzar = false): AudioContext | null {
  if ((!activos[id] && !forzar) || !contexto || contexto.state !== 'running') return null;
  return contexto;
}

/**
 * Suena un archivo, ya o en `empiezaEn` (ms, reloj de aquí); si ese momento ya ha
 * pasado, desde el punto por el que iría. Devuelve cómo pararlo. `id`, el sonido
 * de las preferencias del que es (de entrada, el suyo).
 */
function sonar(sonido: Archivo, empiezaEn?: number, forzar = false, id: IdSonido = sonido as SonidoArchivo): () => void {
  const ctx = audio(id, forzar);
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

/** Una campanilla: cada nota, la fundamental y un parcial agudo (de campana), con caída. */
function campanilla(id: Campanilla, forzar = false): void {
  const ctx = audio(id, forzar);
  if (!ctx) return;
  const { notas, onda, volumen, dura } = CAMPANILLAS[id];
  const ahora = ctx.currentTime;
  for (const [frecuencia, cuando] of notas) {
    const t = ahora + cuando;
    for (const [multiplo, nivel] of [[1, 1], [2.76, 0.18]] as const) {
      const osc = ctx.createOscillator();
      const ganancia = ctx.createGain();
      osc.type = multiplo === 1 ? onda : 'sine';
      osc.frequency.value = frecuencia * multiplo;
      ganancia.gain.setValueAtTime(0.0001, t);
      ganancia.gain.exponentialRampToValueAtTime(volumen * nivel, t + 0.012);
      ganancia.gain.exponentialRampToValueAtTime(0.0001, t + dura * (multiplo === 1 ? 1 : 0.5));
      osc.connect(ganancia).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dura + 0.05);
    }
  }
}

/**
 * Un timbre de teléfono: dos repiques, cada uno con dos notas que se alternan
 * muy deprisa (como la campana de un teléfono), con una pausa en medio.
 */
function timbre(id: 'solicitudLlamada', forzar = false): void {
  const ctx = audio(id, forzar);
  if (!ctx) return;
  const ahora = ctx.currentTime;
  const volumen = 0.1;
  for (const inicio of [0, 0.55]) {
    const t = ahora + inicio;
    const dura = 0.4;
    const osc = ctx.createOscillator();
    const ganancia = ctx.createGain();
    osc.type = 'triangle';
    for (let i = 0; i * 0.04 < dura; i++) osc.frequency.setValueAtTime(i % 2 ? 1250 : 1000, t + i * 0.04);
    ganancia.gain.setValueAtTime(0.0001, t);
    ganancia.gain.exponentialRampToValueAtTime(volumen, t + 0.015);
    ganancia.gain.setValueAtTime(volumen, t + dura - 0.05);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, t + dura);
    osc.connect(ganancia).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dura + 0.05);
  }
}

/** La llamada entrante, con el tono elegido. */
function tonoDeLlamada(forzar = false, tono = tonoLlamada): void {
  if (tono === 'botc') sonar('llamadaBotc', undefined, forzar, 'solicitudLlamada');
  else if (tono === 'telefono') timbre('solicitudLlamada', forzar);
  else campanilla('solicitudLlamada', forzar);
}

/** Una nota con caída: la fundamental y los parciales que se pidan ([múltiplo, nivel, caída relativa a `dura`]). */
function nota(
  ctx: AudioContext,
  salida: AudioNode,
  { frecuencia, t, dura, volumen, parciales, ataque }: { frecuencia: number; t: number; dura: number; volumen: number; parciales: [number, number, number][]; ataque: number },
): void {
  for (const [multiplo, nivel, caida] of parciales) {
    const osc = ctx.createOscillator();
    const ganancia = ctx.createGain();
    osc.frequency.value = frecuencia * multiplo;
    ganancia.gain.setValueAtTime(0.0001, t);
    ganancia.gain.exponentialRampToValueAtTime(volumen * nivel, t + ataque);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, t + dura * caida);
    osc.connect(ganancia).connect(salida);
    osc.start(t);
    osc.stop(t + dura + 0.05);
  }
}

/** Los despertadores de noche: cada uno empieza en `t0`. */
const DESPERTADORES: Record<TonoDespertar, (ctx: AudioContext, t0: number) => void> = {
  /** Tres pitidos cortos, una pausa y otros tres (0,7 s); onda cuadrada filtrada para que no chirríe. */
  pitido(ctx, t0) {
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 2600;
    filtro.connect(ctx.destination);
    for (const serie of [0, 0.42]) {
      for (let i = 0; i < 3; i++) {
        const t = t0 + serie + i * 0.1;
        const osc = ctx.createOscillator();
        const ganancia = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 1760; // la6
        ganancia.gain.setValueAtTime(0.0001, t);
        ganancia.gain.exponentialRampToValueAtTime(0.045, t + 0.004);
        ganancia.gain.setValueAtTime(0.045, t + 0.07);
        ganancia.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
        osc.connect(ganancia).connect(filtro);
        osc.start(t);
        osc.stop(t + 0.1);
      }
    }
  },
  /** Sol-do-mi-sol subiendo y, más arriba, otra vez hasta el do (1,2 s); timbre de marimba. */
  alba(ctx, t0) {
    const parciales: [number, number, number][] = [[1, 1, 1], [4, 0.25, 0.25], [10, 0.05, 0.1]];
    const arpegios: [number, number[]][] = [
      [0, [392, 523.25, 659.25, 783.99]],
      [0.5, [523.25, 659.25, 783.99, 1046.5]],
    ];
    for (const [inicio, notas] of arpegios) {
      notas.forEach((frecuencia, i) => {
        const ultima = i === notas.length - 1;
        nota(ctx, ctx.destination, { frecuencia, t: t0 + inicio + i * 0.1, dura: ultima ? 0.4 : 0.35, volumen: 0.16, parciales, ataque: 0.004 });
      });
    }
  },
  /** El martillo golpea dos campanas, alternando, unas 18 veces por segundo; dos repiques (1,7 s). */
  campana(ctx, t0) {
    const campanas = [1318.5, 1568]; // mi6 y sol6
    const parciales: [number, number, number][] = [[1, 1, 1], [2.76, 0.35, 0.6], [5.4, 0.12, 0.35]];
    for (const inicio of [0, 0.88]) {
      for (let i = 0; i < 13; i++) {
        nota(ctx, ctx.destination, { frecuencia: campanas[i % 2], t: t0 + inicio + i * 0.055, dura: 0.16, volumen: 0.07, parciales, ataque: 0.002 });
      }
    }
  },
};

/** El despertar de noche, con el despertador elegido. */
function despertador(forzar = false, tono = tonoDespertar): void {
  const ctx = audio('despertar', forzar);
  if (ctx) DESPERTADORES[tono](ctx, ctx.currentTime + 0.02);
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

/** El gong del narrador: todos a la plaza. */
export function tocarGong(): void {
  sonar('gong');
}

/** Las conversaciones privadas: entrar, salir o que salga alguien de la tuya. */
export function tocarPrivado(id: 'entrarPrivado' | 'salirPrivado' | 'saleOtro'): void {
  campanilla(id);
}

/** Alguien te pide conversar (una llamada entrante): con el tono elegido. */
export function tocarSolicitud(): void {
  tonoDeLlamada();
}

/** De noche, el narrador te despierta o te muestra algo: con el despertador elegido. */
export function tocarDespertar(): void {
  despertador();
}

/**
 * Para probarlo en las preferencias: suena aunque esté quitado (la cuenta atrás,
 * sus 3 primeros segundos; la llamada entrante y el despertar, con `tono` o el
 * elegido). Si el audio aún no estaba en marcha (es el primer clic), espera a que arranque.
 */
export function probarSonido(id: IdSonido, tono?: TonoLlamada | TonoDespertar): void {
  desbloquear();
  const ctx = contexto;
  if (!ctx) return;
  void (ctx.state === 'running' ? Promise.resolve() : ctx.resume()).then(() => {
    if (id === 'voto' || id === 'sinVoto' || id === 'gong') sonar(id, undefined, true);
    else if (id === 'solicitudLlamada') tonoDeLlamada(true, esTonoLlamada(tono) ? tono : undefined);
    else if (id === 'despertar') despertador(true, esTonoDespertar(tono) ? tono : undefined);
    else if (id === 'cuentaAtras') {
      const parar = sonar(id, undefined, true);
      window.setTimeout(parar, 3000);
    } else campanilla(id, true);
  });
}
