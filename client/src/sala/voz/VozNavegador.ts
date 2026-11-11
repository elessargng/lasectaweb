import type { Voz } from './contratos';

/**
 * La síntesis de voz del navegador, en español (si hay una voz de España, esa).
 * El navegador ya encola las frases. Sin síntesis en el navegador, no suena.
 */
export class VozNavegador implements Voz {
  decir(texto: string): void {
    if (!VozNavegador.disponible() || !texto) return;
    const frase = new SpeechSynthesisUtterance(texto);
    frase.lang = 'es-ES';
    const voz = VozNavegador.vozEspanola();
    if (voz) frase.voice = voz;
    window.speechSynthesis.speak(frase);
  }

  callar(): void {
    if (VozNavegador.disponible()) window.speechSynthesis.cancel();
  }

  private static disponible() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /** La voz en español del navegador (la de España antes), o null para la de por defecto con lang es-ES. */
  private static vozEspanola(): SpeechSynthesisVoice | null {
    const voces = window.speechSynthesis.getVoices();
    return voces.find((v) => v.lang === 'es-ES') ?? voces.find((v) => v.lang.startsWith('es')) ?? null;
  }
}
