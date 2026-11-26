/**
 * Los desplegables (menús de las fichas, la habilidad de un NPC…) se abren hacia
 * abajo; si abajo no caben y arriba hay más sitio, se abren hacia arriba. Así no
 * alargan la página (ni el panel con scroll en el que están) y no sale una barra
 * de desplazamiento.
 *
 * Marca el desplegable con `data-arriba` («true» o «false»); quien lo pinta pone
 * las clases de cada caso (p. ej. `top-full data-[arriba=true]:top-auto
 * data-[arriba=true]:bottom-full`). Hay que llamarlo con el desplegable ya en la
 * página (visible o con visibility: hidden, que ocupa su sitio).
 */
export function colocarDesplegable(ancla: HTMLElement, desplegable: HTMLElement, margen = 8): void {
  const a = ancla.getBoundingClientRect();
  // El hueco: la ventana, recortada por el primer contenedor que recorta (con scroll u oculto)
  let arriba = 0;
  let abajo = window.innerHeight;
  for (let el = ancla.parentElement; el && el !== document.body; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if (overflowY === 'visible') continue;
    const r = el.getBoundingClientRect();
    arriba = Math.max(arriba, r.top);
    abajo = Math.min(abajo, r.bottom);
    break;
  }
  const alto = desplegable.offsetHeight + margen;
  const sitioAbajo = abajo - a.bottom;
  const sitioArriba = a.top - arriba;
  desplegable.dataset.arriba = String(sitioAbajo < alto && sitioArriba > sitioAbajo);
}
