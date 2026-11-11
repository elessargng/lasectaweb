import type { Reproductor } from './contratos';

/** Hace sonar un audio con un elemento <audio> (sale por donde salga el resto de la página). */
export class ReproductorAudio implements Reproductor {
  private actual: { audio: HTMLAudioElement; url: string; acabar: () => void } | null = null;

  reproducir(audio: Blob): Promise<void> {
    this.parar();
    return new Promise((resolver) => {
      const url = URL.createObjectURL(audio);
      const elemento = new Audio(url);
      const acabar = () => {
        URL.revokeObjectURL(url);
        if (this.actual?.audio === elemento) this.actual = null;
        resolver();
      };
      this.actual = { audio: elemento, url, acabar };
      elemento.onended = acabar;
      elemento.onerror = acabar;
      // Si el navegador no deja reproducir (sin haber tocado la página), no suena
      elemento.play().catch(acabar);
    });
  }

  parar(): void {
    if (!this.actual) return;
    this.actual.audio.pause();
    this.actual.acabar();
  }
}
