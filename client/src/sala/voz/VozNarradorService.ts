import { paraLaVoz } from '../pronunciacion';
import type { ModeloVoz, Voz } from './contratos';

/** En qué está la voz neuronal: apagada, descargándose y cargándose (con cuánto lleva de descarga), lista o con un error. */
export type EstadoVozNeuronal =
  | { fase: 'apagada' }
  | { fase: 'descargando'; progreso: number }
  | { fase: 'lista' }
  | { fase: 'error'; mensaje: string };

/**
 * La voz del narrador virtual: decide qué voz suena (la del navegador o la
 * neuronal) y prepara la neuronal al activarla (la descarga si no está). Mientras
 * se descarga, o si no se pudo, suena la del navegador. Los nombres ingleses de
 * los personajes se dicen como se pronuncian en español (ver pronunciacion.ts).
 *
 * Quien quiera saber en qué está la neuronal (la pestaña que la activa) se suscribe.
 */
export class VozNarradorService {
  private estado: EstadoVozNeuronal = { fase: 'apagada' };
  private readonly oyentes = new Set<() => void>();
  /** Sube cada vez que se activa o se desactiva: una descarga que acaba tarde no cambia lo de después. */
  private peticion = 0;

  private readonly navegador: Voz;
  private readonly neuronal: Voz;
  private readonly modelo: ModeloVoz;

  constructor(navegador: Voz, neuronal: Voz, modelo: ModeloVoz) {
    this.navegador = navegador;
    this.neuronal = neuronal;
    this.modelo = modelo;
  }

  decir(texto: string): void {
    if (texto) this.vozActual().decir(paraLaVoz(texto));
  }

  callar(): void {
    this.navegador.callar();
    this.neuronal.callar();
  }

  /** Activa (y descarga si hace falta) o desactiva la voz neuronal. Activarla dos veces no descarga dos veces. */
  async usarNeuronal(activa: boolean): Promise<void> {
    const { fase } = this.estado;
    if (!activa) {
      if (fase === 'apagada') return;
      this.peticion++;
      this.callar();
      return this.cambiar({ fase: 'apagada' });
    }
    if (fase === 'descargando' || fase === 'lista') return;

    const peticion = ++this.peticion;
    this.cambiar({ fase: 'descargando', progreso: 0 });
    try {
      if (!(await this.modelo.descargado())) {
        await this.modelo.descargar((progreso) => {
          if (peticion === this.peticion) this.cambiar({ fase: 'descargando', progreso });
        });
      }
      // Cargado en memoria antes de usarlo: hasta entonces habla el navegador, sin esperas
      await this.modelo.preparar();
      if (peticion === this.peticion) this.cambiar({ fase: 'lista' });
    } catch {
      if (peticion === this.peticion) {
        this.cambiar({ fase: 'error', mensaje: 'No se pudo preparar la voz neuronal. Sigue sonando la del navegador.' });
      }
    }
  }

  consultar = (): EstadoVozNeuronal => this.estado;

  /** Avisa de cada cambio de estado; devuelve cómo dejar de oír. */
  suscribir = (oyente: () => void): (() => void) => {
    this.oyentes.add(oyente);
    return () => this.oyentes.delete(oyente);
  };

  private vozActual(): Voz {
    return this.estado.fase === 'lista' ? this.neuronal : this.navegador;
  }

  private cambiar(estado: EstadoVozNeuronal) {
    this.estado = estado;
    for (const oyente of this.oyentes) oyente();
  }
}
