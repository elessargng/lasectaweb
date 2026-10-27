import { useEffect, useRef, useState } from 'react';
import { ID_CUENTA_ATRAS, ID_REINICIAR, idFichaNominar } from './ids';
import { datosAsiento, describirAsiento } from './nombresAsiento';
import type { SalaEstado, SalaResultado } from './useSala';

interface Opciones {
  estado: SalaEstado;
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  onError: (mensaje: string) => void;
  onAnuncio: (mensaje: string) => void;
}

/** El botón de la ficha de un jugador cuando no se está eligiendo (el de su menú). */
const idMenuFicha = (participanteId: string) => `sala-ficha-${participanteId}-boton`;

/**
 * Nominar (narradores), de la ficha de un asiento a la de otro o a sí misma
 * (haya alguien sentado o no). «Nominar a…» en la ficha que nomina pone todas en
 * modo «elegir»: pulsar una abre la nominación (servidor). Escape, o «Cancelar
 * nominación» en el centro de la mesa, lo cancela. Con la nominación abierta, el narrador
 * tiene en el centro de la mesa Cuenta atrás, Marca (pone o quita la calavera
 * al nominado, solo uno puede llevarla, y cierra la nominación) y Cerrar.
 *
 * El foco acompaña: al empezar a elegir va a la siguiente ficha, al abrir la
 * nominación a «Cuenta atrás», y al cancelar, marcar o cerrar a la ficha de quien nominaba.
 */
export function useNominacion({ estado, pedir, onError, onAnuncio }: Opciones) {
  const { asientos, acciones, nominacion } = estado;
  const [eligiendoDesde, setEligiendoDesde] = useState<string | null>(null);
  // Elemento al que llevar el foco cuando se pinte el cambio.
  const focoRef = useRef<string | null>(null);

  // Si el asiento que nominaba ya no existe, no se está eligiendo.
  const desde = eligiendoDesde && asientos.some((a) => a.id === eligiendoDesde) ? eligiendoDesde : null;
  const nombreDe = (asientoId: string) => {
    const { numero, ocupante } = datosAsiento(estado, asientoId);
    return describirAsiento(numero, ocupante);
  };

  useEffect(() => {
    const id = focoRef.current;
    const el = id && document.getElementById(id);
    if (!el) return;
    focoRef.current = null;
    el.focus();
  });

  const cancelar = () => {
    if (!desde) return;
    setEligiendoDesde(null);
    focoRef.current = idMenuFicha(desde);
    onAnuncio('Nominación cancelada.');
  };

  // Escape cancela mientras se elige.
  useEffect(() => {
    if (!desde) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setEligiendoDesde(null);
      focoRef.current = idMenuFicha(desde);
      onAnuncio('Nominación cancelada.');
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [desde, onAnuncio]);

  const empezar = (id: string) => {
    setEligiendoDesde(id);
    // El foco, a la ficha del asiento siguiente (en el orden de la mesa).
    const i = asientos.findIndex((a) => a.id === id);
    focoRef.current = idFichaNominar(asientos[(i + 1) % asientos.length].id);
    onAnuncio(`Elige a qué ficha nomina el ${nombreDe(id)} (puede ser la suya): pulsa la ficha. Escape para cancelar.`);
  };

  const nominar = async (hasta: string) => {
    if (!desde) return;
    setEligiendoDesde(null);
    const r = await pedir('narrador:nominar', { desde, hasta });
    if (r.ok) {
      focoRef.current = ID_CUENTA_ATRAS;
    } else {
      focoRef.current = idMenuFicha(desde);
      onError(r.error);
    }
  };

  const actuar = async (accion: string, datos?: unknown) => {
    const r = await pedir(accion, datos);
    if (!r.ok) onError(r.error);
    return r.ok;
  };

  const nominado = nominacion ? asientos.find((a) => a.id === nominacion.hasta) : undefined;

  // Las nominaciones de hoy (del registro, que solo tienen los narradores): quién ya
  // nominó y quién ya fue nominado. Es solo un aviso: el narrador puede repetir.
  // Las expulsiones de viajeros no son nominaciones: no cuentan.
  const { fase, votaciones } = estado;
  const deHoy = fase.momento === 'dia' ? votaciones.filter((v) => v.dia === fase.numero && !v.expulsion) : [];
  const nominaronHoy = new Set(deHoy.map((v) => v.nominaAsiento));
  const nominadosHoy = new Set(deHoy.map((v) => v.nominadoAsiento));

  return {
    /** Para «Nominar a…» en la ficha de cada asiento (si el servidor deja nominar). */
    onNominar: acciones.includes('narrador:nominar') ? (id: string) => () => empezar(id) : undefined,
    /** Si el asiento ya ha nominado hoy. */
    yaNomino: (id: string) => nominaronHoy.has(id),
    /**
     * Si se está eligiendo, cómo es la ficha de ese asiento: la que nomina o
     * candidata. Todas se pueden elegir, también la que nomina (se nomina a sí misma)
     * y las que ya fueron nominadas hoy (se avisa, pero se deja).
     */
    eligiendo: (id: string) =>
      desde
        ? {
            papel: (id === desde ? 'origen' : 'candidata') as 'origen' | 'candidata',
            onPulsar: () => nominar(id),
            yaNominado: nominadosHoy.has(id),
          }
        : undefined,
    /** Se está eligiendo a quién nomina: el centro de la mesa ofrece cancelar. */
    cancelar: desde ? cancelar : null,
    /** El panel del centro (solo si el servidor deja manejar la nominación). */
    panel:
      nominacion && acciones.includes('narrador:cerrarNominacion')
        ? {
            marcado: !!nominado?.marcado,
            // Expulsión de un viajero: sin calavera (si sale, muere al terminar la votación)
            expulsion: nominacion.expulsion,
            secreta: !!nominacion.privada,
            puedeCuentaAtras: acciones.includes('narrador:cuentaAtras'),
            votos: acciones.includes('narrador:votosNecesarios')
              ? {
                  necesarios: nominacion.votosNecesarios,
                  porDefecto: nominacion.votosNecesariosPorDefecto,
                  maximo: Math.max(1, asientos.length),
                  onCambiar: (votos: number | null) => void actuar('narrador:votosNecesarios', { votos }),
                }
              : null,
            marcaActual: (() => {
              const marcado = asientos.find((a) => a.marcado);
              if (!marcado || nominacion.expulsion) return null;
              const { numero, ocupante } = datosAsiento(estado, marcado.id);
              const votos = marcado.votosMarca;
              return `${describirAsiento(numero, ocupante)}${votos === null ? '' : `, ${votos === 1 ? '1 voto' : `${votos} votos`}`}`;
            })(),
            // Desmarcar, como marcar, cierra la nominación: el foco vuelve a la ficha de quien nominaba.
            onDesmarcar: acciones.includes('narrador:desmarcar') && !nominacion.expulsion
              ? async () => {
                  if (await actuar('narrador:desmarcar')) focoRef.current = idMenuFicha(nominacion.desde);
                }
              : null,
            // El botón desaparece al arrancarla: el foco pasa a «Reiniciar».
            onCuentaAtras: async () => {
              if (await actuar('narrador:cuentaAtras')) focoRef.current = ID_REINICIAR;
            },
            // Con la cuenta atrás o la votación en marcha: la deja como recién abierta.
            onReiniciar: acciones.includes('narrador:reiniciarVotacion')
              ? async () => {
                  if (await actuar('narrador:reiniciarVotacion')) {
                    focoRef.current = ID_CUENTA_ATRAS;
                    onAnuncio('Votación reiniciada.');
                  }
                }
              : null,
            // Marcar (o desmarcar) cierra la nominación: el foco vuelve a la ficha de quien nominaba.
            onMarca: async () => {
              const ok = await actuar('narrador:marcar', { asientoId: nominacion.hasta, marcado: !nominado?.marcado });
              if (ok) focoRef.current = idMenuFicha(nominacion.desde);
            },
            onCerrar: async () => {
              if (await actuar('narrador:cerrarNominacion')) focoRef.current = idMenuFicha(nominacion.desde);
            },
          }
        : null,
  };
}
