/**
 * La voz del narrador virtual: lo que dice se oye con la síntesis de voz del
 * navegador, en español (si hay una voz de España, esa). Se encola: una frase no
 * corta a la anterior. Sin síntesis en el navegador, no suena (la frase sigue
 * escrita junto a su cuadro).
 */

const disponible = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** La voz en español del navegador (la de España antes), o null para la de por defecto con lang es-ES. */
function vozEspanola(): SpeechSynthesisVoice | null {
  const voces = window.speechSynthesis.getVoices();
  return voces.find((v) => v.lang === 'es-ES') ?? voces.find((v) => v.lang.startsWith('es')) ?? null;
}

export function decirEnVoz(texto: string): void {
  if (!disponible() || !texto) return;
  const frase = new SpeechSynthesisUtterance(texto);
  frase.lang = 'es-ES';
  const voz = vozEspanola();
  if (voz) frase.voice = voz;
  window.speechSynthesis.speak(frase);
}

/** Calla lo que esté diciendo y lo que tuviera pendiente (al quitar la voz). */
export function callarVoz(): void {
  if (disponible()) window.speechSynthesis.cancel();
}
