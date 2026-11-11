import type { ModeloVoz, Reproductor, Voz } from './contratos';

/**
 * La voz del modelo neuronal. Las frases suenan en orden: cada una se empieza a
 * sintetizar al llegar (mientras suena la anterior) y suena cuando le toca. Si el
 * modelo falla con una frase, la dice la voz de respaldo (la del navegador).
 */
export class VozNeuronal implements Voz {
  /** La cola: la promesa de que acabe de sonar la última frase encolada. */
  private cola: Promise<void> = Promise.resolve();
  /** Sube al callar: las frases de antes ya no suenan. */
  private turno = 0;

  private readonly modelo: ModeloVoz;
  private readonly reproductor: Reproductor;
  private readonly respaldo: Voz;

  constructor(modelo: ModeloVoz, reproductor: Reproductor, respaldo: Voz) {
    this.modelo = modelo;
    this.reproductor = reproductor;
    this.respaldo = respaldo;
  }

  decir(texto: string): void {
    if (!texto) return;
    const turno = this.turno;
    const audio = this.modelo.sintetizar(texto).catch(() => null);
    this.cola = this.cola.then(async () => {
      const hecho = await audio;
      if (turno !== this.turno) return;
      if (hecho) await this.reproductor.reproducir(hecho);
      else this.respaldo.decir(texto);
    });
  }

  callar(): void {
    this.turno++;
    this.reproductor.parar();
    this.respaldo.callar();
  }
}
