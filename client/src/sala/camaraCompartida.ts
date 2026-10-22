import { VideoPresets } from 'livekit-client';

/**
 * Una sola captura de la cámara para todas las salas de vídeo (la mesa y la
 * conversación privada): cada sala publica una copia (clone) de la misma pista,
 * en vez de abrir la cámara otra vez. Abrirla dos veces funciona en unos
 * navegadores y en otros no (Safari en iPhone y iPad congela la primera al
 * abrir la segunda).
 *
 * La cámara se abre al pedir la primera copia y se cierra cuando ya no la usa
 * ninguna sala. Cada sala para su copia al dejar de publicarla.
 */
export class CamaraCompartida {
  /** La captura (abriéndose o abierta), o null. */
  private captura: Promise<MediaStreamTrack> | null = null;
  /** De qué cámara es (deviceId; vacío: la del sistema). */
  private dispositivo = '';
  /** Quién la usa ahora (las salas de vídeo). */
  private usuarios = new Set<object>();

  /** La cámara se ha cerrado sola (desenchufada, o la ha cogido el sistema). */
  private readonly alTerminar: () => void;

  constructor(alTerminar: () => void) {
    this.alTerminar = alTerminar;
  }

  private abrir(dispositivo: string): Promise<MediaStreamTrack> {
    const { width, height, frameRate } = VideoPresets.h360.resolution;
    const captura = navigator.mediaDevices
      .getUserMedia({
        video: {
          ...(dispositivo ? { deviceId: { exact: dispositivo } } : {}),
          width: { ideal: width },
          height: { ideal: height },
          ...(frameRate ? { frameRate: { ideal: frameRate } } : {}),
        },
      })
      .then((flujo) => {
        const pista = flujo.getVideoTracks()[0];
        pista.addEventListener('ended', () => {
          if (this.captura === captura) {
            this.captura = null;
            this.alTerminar();
          }
        });
        return pista;
      });
    // Si falla, la próxima vez se vuelve a intentar
    captura.catch(() => {
      if (this.captura === captura) this.captura = null;
    });
    this.captura = captura;
    this.dispositivo = dispositivo;
    return captura;
  }

  /**
   * Una copia de la captura para `quien` (la abre si hace falta). null si, mientras
   * se abría, `quien` la ha soltado. Lanza el error del navegador si no se puede abrir.
   */
  async copia(quien: object, dispositivo: string): Promise<MediaStreamTrack | null> {
    this.usuarios.add(quien);
    let captura = this.captura && this.dispositivo === dispositivo ? this.captura : this.abrir(dispositivo);
    let pista = await captura;
    // Ya cerrada (otra sala la soltó a la vez): se abre de nuevo
    if (pista.readyState !== 'live') {
      captura = this.abrir(dispositivo);
      pista = await captura;
    }
    if (!this.usuarios.has(quien)) return null;
    return pista.clone();
  }

  /** `quien` ya no la usa (ha parado su copia): si nadie la usa, se cierra. */
  soltar(quien: object): void {
    this.usuarios.delete(quien);
    if (this.usuarios.size > 0 || !this.captura) return;
    const captura = this.captura;
    this.captura = null;
    void captura.then((p) => p.stop()).catch(() => undefined);
  }

  /**
   * Cambia de cámara: si está abierta, abre la nueva, `cambiar` pone una copia en
   * cada sala y se cierra la de antes. Lanza el error del navegador si no se puede.
   */
  async cambiarDispositivo(dispositivo: string, cambiar: (nueva: MediaStreamTrack) => Promise<void>): Promise<void> {
    if (dispositivo === this.dispositivo) return;
    const antes = this.captura;
    if (!antes || this.usuarios.size === 0) {
      this.dispositivo = dispositivo;
      return;
    }
    const nueva = await this.abrir(dispositivo);
    await cambiar(nueva);
    void antes.then((p) => p.stop()).catch(() => undefined);
  }

  /** Cierra la cámara (al salir de la sala). */
  cerrar(): void {
    this.usuarios.clear();
    this.soltar({});
  }
}
