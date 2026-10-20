// Genera los gestos del guante, de la mano esquelética y del guantelete (SVG de 256 × 256) de la sala.
// Uso, desde client/: node scripts/generar-manos.cjs public/manos
const fs = require('fs');
const path = require('path');
const salida = process.argv[2];

const rad = (g) => (g * Math.PI) / 180;
/** El punto a `largo` de (x, y) en la dirección `angulo` (grados desde la vertical, positivo a la derecha). */
const hacia = (x, y, angulo, largo) => [x + Math.sin(rad(angulo)) * largo, y - Math.cos(rad(angulo)) * largo];
const n = (v) => Math.round(v * 10) / 10;

/**
 * Los gestos: para cada dedo (índice, corazón, anular, meñique), su ángulo si va
 * estirado o null si va doblado; y el pulgar, fuera (con ángulo) o doblado.
 * `girar`: el lagarto va tumbado, mirando a la derecha, con el pulgar debajo.
 */
const GESTOS = {
  palma: { dedos: [-11, -3, 5, 13], pulgar: -58 },
  tijera: { dedos: [-9, 9, null, null], pulgar: null },
  paz: { dedos: [-16, 13, null, null], pulgar: null },
  puno: { dedos: [null, null, null, null], pulgar: null },
  peineta: { dedos: [null, 0, null, null], pulgar: null },
  cuernos: { dedos: [-12, null, null, 15], pulgar: null },
  spock: { dedos: [-13, -9, 11, 15], pulgar: -52 },
  lagarto: { dedos: [-2, 0, 2, 3], pulgar: -24, girar: true },
  // Señalar: el índice, recto hacia arriba (la sala la gira hacia la ficha señalada)
  senalar: { dedos: [0, null, null, null], pulgar: null },
};

// ───────────── El guante (tres dedos y pulgar, en una sola pieza) ─────────────

function guante(g) {
  // Tres dedos: el índice, el corazón y uno por el anular y el meñique
  const dedos = [g.dedos[0], g.dedos[1], g.dedos[2] ?? g.dedos[3]];
  // Con el anular y el meñique distintos (Spock, cuernos), el tercero sigue al meñique
  if (g.dedos[2] === null && g.dedos[3] !== null) dedos[2] = g.dedos[3];
  const bases = [[95, 120], [128, 112], [161, 120]];
  const grosor = 40;
  const largo = [74, 84, 74];
  const piezas = []; // [tipo, datos]: 'linea' (cápsula) o 'forma' (camino relleno)
  dedos.forEach((a, i) => {
    const [bx, by] = bases[i];
    if (a === null) {
      // Doblado: solo asoma el nudillo
      piezas.push(['linea', { x1: bx, y1: by + 6, x2: bx, y2: by - 8, w: grosor }]);
    } else {
      const [tx, ty] = hacia(bx, by, a, largo[i]);
      piezas.push(['linea', { x1: bx, y1: by + 14, x2: tx, y2: ty, w: grosor }]);
    }
  });
  // El dorso
  piezas.push(['forma', 'M128,100 C178,100 194,128 192,160 C190,196 168,212 128,212 C88,212 66,196 64,160 C62,128 78,100 128,100 Z']);
  // El pulgar
  if (g.pulgar !== null) {
    const [tx, ty] = hacia(80, 168, g.pulgar, 58);
    piezas.push(['linea', { x1: 86, y1: 172, x2: tx, y2: ty, w: 42 }]);
  }
  // El puño vuelto, abierto hacia abajo
  piezas.push(['forma', 'M88,198 C112,206 144,206 168,198 L192,240 C194,249 188,253 177,253 L79,253 C68,253 62,249 64,240 Z']);

  const dibujar = (color, extra) =>
    piezas
      .map(([tipo, p]) =>
        tipo === 'linea'
          ? `<line x1="${n(p.x1)}" y1="${n(p.y1)}" x2="${n(p.x2)}" y2="${n(p.y2)}" stroke="${color}" stroke-width="${p.w + extra}" stroke-linecap="round"/>`
          : `<path d="${p}" fill="${color}" stroke="${color}" stroke-width="${extra}" stroke-linejoin="round"/>`,
      )
      .join('');
  // El pulgar doblado no se dibuja aparte: una sombra suave sobre el dorso (sin cortar la pieza)
  const pulgarDoblado =
    g.pulgar === null
      ? '<path d="M82,170 C104,160 132,158 150,166" fill="none" stroke="#c9c3d4" stroke-width="5" stroke-linecap="round"/>'
      : '';
  const cuerpo = `
  <g>${dibujar('#14100c', 9)}</g>
  <g>${dibujar('url(#guante-tela)', 0)}</g>
  ${pulgarDoblado}
  <g fill="none" stroke="#14100c" stroke-width="7" stroke-linecap="round">
    <path d="M106,136 C101,151 101,166 106,180"/>
    <path d="M128,132 L128,184"/>
    <path d="M150,136 C155,151 155,166 150,180"/>
  </g>
  <path d="M86,118 C96,109 110,106 122,107" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity=".95"/>`;
  return envolver(
    `<radialGradient id="guante-tela" cx="104" cy="88" r="200" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f3f1f6"/><stop offset="1" stop-color="#c9c3d4"/>
    </radialGradient>`,
    cuerpo,
    g.girar,
  );
}

// ───────────── La mano esquelética (cuatro dedos y pulgar, hueso a hueso) ─────────────

function esqueleto(g) {
  const huesos = []; // cápsulas: [x1, y1, x2, y2, grosor]
  const nudos = []; // círculos: [x, y, r]
  // Los nudillos (donde acaba cada metacarpiano) y de dónde salen, en el carpo
  const nudillos = [[86, 126], [113, 116], [141, 118], [167, 130]];
  const carpo = [[112, 196], [124, 194], [136, 195], [148, 198]];
  const falanges = [[30, 20, 15], [33, 22, 16], [31, 21, 15], [25, 16, 12]];
  const gruesos = [16, 14, 12];
  // Los metacarpianos
  nudillos.forEach(([x, y], i) => huesos.push([carpo[i][0], carpo[i][1], x, y + 4, 14.5]));
  // Los dedos
  g.dedos.forEach((a, i) => {
    let [x, y] = nudillos[i];
    if (a === null) {
      // Doblado: la primera falange se ve corta hacia arriba y la segunda vuelve hacia la palma
      const [x1, y1] = hacia(x, y, 0, 13);
      huesos.push([x, y - 3, x1, y1, gruesos[0]]);
      const [x2, y2] = hacia(x1, y1, 168, 13);
      huesos.push([x1, y1 + 2, x2, y2, gruesos[1]]);
      return;
    }
    falanges[i].forEach((largo, k) => {
      const [x2, y2] = hacia(x, y, a, largo);
      huesos.push([x, y - 3, x2, y2 + 3 * Math.cos(rad(a)), gruesos[k]]);
      x = x2;
      y = y2 - 3;
    });
  });
  // El pulgar: su metacarpiano y dos falanges, fuera o cruzado sobre la palma
  const [mx, my] = hacia(108, 198, -40, 46);
  huesos.push([106, 198, mx, my, 15]);
  if (g.pulgar !== null) {
    const [p1x, p1y] = hacia(mx, my, g.pulgar, 25);
    const [p2x, p2y] = hacia(p1x, p1y, g.pulgar - 6, 18);
    huesos.push([mx, my - 2, p1x, p1y, 14], [p1x, p1y - 1, p2x, p2y, 12]);
  } else {
    const [p1x, p1y] = hacia(mx, my, 62, 26);
    const [p2x, p2y] = hacia(p1x, p1y, 110, 18);
    huesos.push([mx + 2, my, p1x, p1y, 14], [p1x + 1, p1y, p2x, p2y, 12]);
  }
  // El carpo: un montón de huesecillos
  [[110, 206, 9.5], [125, 203, 9], [140, 204, 9], [153, 209, 8.5], [118, 217, 8.5], [134, 216, 9], [148, 219, 8]].forEach((c) => nudos.push(c));
  // El cúbito y el radio, asomando por abajo
  huesos.push([116, 222, 112, 262, 19], [146, 224, 150, 262, 17]);

  const capsulas = (color, extra) =>
    huesos
      .map(([x1, y1, x2, y2, w]) => `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${color}" stroke-width="${n(w + extra)}" stroke-linecap="round"/>`)
      .join('');
  const circulos = (color, extra) => nudos.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${n(r + extra / 2)}" fill="${color}"/>`).join('');
  // Cada hueso, con su contorno (son piezas: se ven las juntas)
  const cuerpo = huesos
    .map(([x1, y1, x2, y2, w]) => {
      const l = `x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke-linecap="round"`;
      return `<line ${l} stroke="#1a1206" stroke-width="${n(w + 8)}"/><line ${l} stroke="url(#hueso)" stroke-width="${n(w)}"/>`;
    })
    .join('');
  const carpales = nudos.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${n(r + 3.5)}" fill="#1a1206"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#hueso)"/>`).join('');
  void capsulas;
  void circulos;
  return envolver(
    `<radialGradient id="hueso" cx="100" cy="80" r="210" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fdf8ec"/><stop offset=".55" stop-color="#ecdfc3"/><stop offset="1" stop-color="#bfae88"/>
    </radialGradient>`,
    `<g transform="translate(128 140) scale(1.1) translate(-128 -140)">${carpales}${cuerpo}</g>`,
    g.girar,
  );
}

// ───────────── El guantelete (dorado, articulado, con las seis gemas) ─────────────

/** Las gemas: una por dedo, en el nudillo, la del pulgar y la grande del dorso. */
const GEMAS = {
  indice: ['#ff4a4a', '#8a0f14'], // roja
  corazon: ['#ffe14a', '#a87a00'], // amarilla
  anular: ['#58a8ff', '#123e8a'], // azul
  menique: ['#c27bff', '#4a1488'], // morada
  pulgar: ['#5fe08a', '#11683a'], // verde
  dorso: ['#ffad42', '#9a4a00'], // naranja
};

function guantelete(g) {
  const nudillos = [[87, 126], [114, 116], [142, 118], [168, 130]];
  const anchos = [25, 26, 25, 22];
  const placas = [[28, 22, 17], [31, 24, 18], [29, 22, 17], [23, 17, 14]];
  const piezas = []; // placas: [x1, y1, x2, y2, ancho]
  g.dedos.forEach((a, i) => {
    let [x, y] = nudillos[i];
    const w = anchos[i];
    if (a === null) {
      // Doblado: la primera placa corta hacia arriba y la siguiente vuelve hacia la palma
      const [x1, y1] = hacia(x, y, 0, 12);
      piezas.push([x, y + 4, x1, y1, w]);
      const [x2, y2] = hacia(x1, y1, 168, 12);
      piezas.push([x1, y1 + 2, x2, y2, w - 3]);
      return;
    }
    placas[i].forEach((largo, k) => {
      const [x2, y2] = hacia(x, y, a, largo);
      piezas.push([x, y + (k === 0 ? 6 : 0), x2, y2, w - k * 2.5]);
      x = x2;
      y = y2;
    });
  });
  // El pulgar: dos placas, fuera o cruzado sobre el dorso
  const pulgar = [];
  if (g.pulgar !== null) {
    const [p1x, p1y] = hacia(88, 178, g.pulgar, 30);
    const [p2x, p2y] = hacia(p1x, p1y, g.pulgar - 8, 24);
    pulgar.push([90, 180, p1x, p1y, 30], [p1x, p1y, p2x, p2y, 25]);
  } else {
    const [p1x, p1y] = hacia(86, 182, 64, 30);
    const [p2x, p2y] = hacia(p1x, p1y, 96, 22);
    pulgar.push([86, 182, p1x, p1y, 30], [p1x, p1y, p2x, p2y, 25]);
  }
  const placa = ([x1, y1, x2, y2, w]) => {
    const l = `x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke-linecap="round"`;
    // Contorno, oro y un filo de luz a lo largo de la placa
    return `<line ${l} stroke="#2a1a05" stroke-width="${n(w + 7)}"/><line ${l} stroke="url(#oro)" stroke-width="${n(w)}"/><line ${l} stroke="#fff6d0" stroke-width="${n(w * 0.16)}" opacity=".55" transform="translate(${n(-w * 0.22)} 0)"/>`;
  };
  const gema = (x, y, rx, ry, [claro, oscuro], id) => `
    <ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx + 5)}" ry="${n(ry + 5)}" fill="url(#oro)" stroke="#2a1a05" stroke-width="3.5"/>
    <radialGradient id="${id}" cx="${n(x - rx * 0.35)}" cy="${n(y - ry * 0.4)}" r="${n(Math.max(rx, ry) * 1.6)}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".22" stop-color="${claro}"/><stop offset="1" stop-color="${oscuro}"/>
    </radialGradient>
    <ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="url(#${id})" stroke="#2a1a05" stroke-width="2"/>
    <ellipse cx="${n(x - rx * 0.35)}" cy="${n(y - ry * 0.42)}" rx="${n(rx * 0.32)}" ry="${n(ry * 0.22)}" fill="#ffffff" opacity=".85"/>`;
  const nombres = ['indice', 'corazon', 'anular', 'menique'];
  const cuerpo = `
    ${piezas.map(placa).join('')}
    <!-- El dorso: una placa con nervios que van a la gema grande -->
    <path d="M78,128 C78,106 104,102 128,102 C152,102 180,106 180,130 L177,192 C176,210 158,216 128,216 C98,216 81,210 80,192 Z" fill="url(#oro)" stroke="#2a1a05" stroke-width="7" stroke-linejoin="round"/>
    <g fill="none" stroke="#7a4e0e" stroke-width="3" stroke-linecap="round" opacity=".85">
      <path d="M96,118 C104,132 110,142 116,150"/><path d="M160,118 C152,132 146,142 140,150"/>
      <path d="M100,202 C108,190 114,182 118,176"/><path d="M156,202 C148,190 142,182 138,176"/>
    </g>
    <path d="M90,114 C104,106 118,105 132,106" fill="none" stroke="#fff6d0" stroke-width="4" stroke-linecap="round" opacity=".7"/>
    ${pulgar.map(placa).join('')}
    <!-- El brazal, abocinado, con su ribete y sus remaches -->
    <path d="M84,206 L172,206 L190,248 C191,253 188,256 183,256 L73,256 C68,256 65,253 66,248 Z" fill="url(#oro)" stroke="#2a1a05" stroke-width="7" stroke-linejoin="round"/>
    <path d="M78,222 L178,222" stroke="#2a1a05" stroke-width="4"/>
    <g fill="#fff0b8" stroke="#2a1a05" stroke-width="2">
      <circle cx="92" cy="238" r="4"/><circle cx="128" cy="240" r="4"/><circle cx="164" cy="238" r="4"/>
    </g>
    <!-- Las gemas: en los nudillos de los dedos estirados o doblados, en el pulgar y la del dorso -->
    ${nudillos.map(([x, y], i) => gema(x, y + 6, 7.5, 6.5, GEMAS[nombres[i]], `gema-${nombres[i]}`)).join('')}
    ${gema(...hacia(90, 180, g.pulgar ?? 64, 12), 7.5, 6.5, GEMAS.pulgar, 'gema-pulgar')}
    ${gema(128, 160, 13, 17, GEMAS.dorso, 'gema-dorso')}`;
  return envolver(
    `<linearGradient id="oro" x1="40" y1="20" x2="210" y2="250" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff3b8"/><stop offset=".35" stop-color="#f0c457"/><stop offset=".7" stop-color="#c88a22"/><stop offset="1" stop-color="#8a5a12"/>
    </linearGradient>`,
    cuerpo,
    g.girar,
  );
}

/** El SVG, con el gesto tumbado si toca (mirando a la derecha, el pulgar abajo). */
function envolver(defs, cuerpo, girar) {
  const contenido = girar ? `<g transform="rotate(90 128 128) translate(256 0) scale(-1 1)">${cuerpo}</g>` : cuerpo;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><defs>${defs}</defs>${contenido}</svg>\n`;
}

for (const [estilo, fn] of [['guante', guante], ['esqueleto', esqueleto], ['guantelete', guantelete]]) {
  const carpeta = path.join(salida, estilo);
  fs.mkdirSync(carpeta, { recursive: true });
  for (const [forma, g] of Object.entries(GESTOS)) fs.writeFileSync(path.join(carpeta, `${forma}.svg`), fn(g));
}
console.log('ok', Object.keys(GESTOS).length, 'gestos');
