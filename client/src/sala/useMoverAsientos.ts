import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { idAsaMover } from './ids';
import type { JugadorDto, ParticipanteDto, ResultadoAccion } from './useSala';

interface Movimiento {
  /** Asiento del que se coge al jugador. */
  desde: string;
  /** Asiento donde se soltaría ahora (provisional). */
  hasta: string;
  /** Con el puntero (arrastrando) o con el teclado (flechas). */
  modo: 'puntero' | 'teclado';
  /** Posición del puntero, para dibujar al jugador que se arrastra. */
  x: number;
  y: number;
}

interface Opciones {
  asientos: JugadorDto[];
  participantes: ParticipanteDto[];
  /** La mesa: dentro están los asientos, marcados con data-asiento. */
  mesaRef: RefObject<HTMLElement | null>;
  pedir: (accion: string, datos?: unknown) => Promise<ResultadoAccion>;
  onError: (mensaje: string) => void;
  onAnuncio: (mensaje: string) => void;
}

/**
 * Mover a un jugador de asiento (narradores, editando asientos). Se coge por su
 * asa y, mientras no se suelta, la mesa enseña cómo quedaría (provisional): el
 * jugador en el asiento de destino y, si estaba ocupado, el otro en el de origen.
 * Al soltar se pide al servidor; hasta entonces no cambia nada para nadie.
 *
 * - Con ratón o el dedo: se arrastra el asa hasta el asiento.
 * - Con teclado (y lector): Intro o Espacio coge, las flechas eligen asiento,
 *   Intro o Espacio suelta y Escape cancela. Cada paso se anuncia.
 */
export function useMoverAsientos({ asientos, participantes, mesaRef, pedir, onError, onAnuncio }: Opciones) {
  const [movimiento, setMovimiento] = useState<Movimiento | null>(null);
  // Tras soltar con el teclado, el foco va a su asa cuando llega a su nuevo asiento
  // (el id es el de su jugador, que se cambia de silla con él).
  const focoPendienteRef = useRef<{ asiento: string; numero: number } | null>(null);

  const ocupanteDe = (jugadorId: string) => asientos.find((a) => a.id === jugadorId)?.ocupante ?? null;
  const nombreDe = (id: string | null) => participantes.find((p) => p.id === id)?.nombre ?? '';
  const numeroDe = (jugadorId: string) => asientos.findIndex((a) => a.id === jugadorId) + 1;

  // Si mientras tanto el jugador se ha ido o el asiento ya no existe, no hay movimiento.
  const activo =
    movimiento && ocupanteDe(movimiento.desde) && asientos.some((a) => a.id === movimiento.hasta) ? movimiento : null;

  /** Quién se ve en cada asiento, con el movimiento provisional aplicado. */
  const ocupanteVisible = (asiento: JugadorDto): string | null => {
    if (!activo || activo.desde === activo.hasta) return asiento.ocupante;
    if (asiento.id === activo.desde) return ocupanteDe(activo.hasta);
    if (asiento.id === activo.hasta) return ocupanteDe(activo.desde);
    return asiento.ocupante;
  };

  useEffect(() => {
    const pendiente = focoPendienteRef.current;
    if (!pendiente || numeroDe(pendiente.asiento) !== pendiente.numero) return;
    focoPendienteRef.current = null;
    document.getElementById(idAsaMover(pendiente.asiento))?.focus();
  });

  const describirDestino = (desde: string, hasta: string) => {
    if (hasta === desde) return `Asiento ${numeroDe(hasta)}, el suyo.`;
    const otro = ocupanteDe(hasta);
    return otro
      ? `Asiento ${numeroDe(hasta)}, con ${nombreDe(otro)}: se intercambiarán.`
      : `Asiento ${numeroDe(hasta)}, libre.`;
  };

  const cancelar = (avisar: boolean) => {
    if (activo && avisar) onAnuncio(`Cancelado. ${nombreDe(ocupanteDe(activo.desde))} sigue en el asiento ${numeroDe(activo.desde)}.`);
    setMovimiento(null);
  };

  const soltar = async () => {
    if (!activo) return;
    setMovimiento(null);
    const { desde, hasta, modo } = activo;
    const jugador = ocupanteDe(desde);
    if (desde === hasta || !jugador) {
      if (modo === 'teclado') onAnuncio(`${nombreDe(jugador)} sigue en el asiento ${numeroDe(desde)}.`);
      return;
    }
    // El número de destino, antes de que cambie la plaza
    const numero = numeroDe(hasta);
    if (modo === 'teclado') focoPendienteRef.current = { asiento: desde, numero };
    const r = await pedir('narrador:asientos', { cambio: 'mover', desde, hasta });
    if (!r.ok) {
      focoPendienteRef.current = null;
      onError(r.error);
    } else if (modo === 'teclado') {
      onAnuncio(`${nombreDe(jugador)}, al asiento ${numero}.`);
    }
  };

  /** El asiento más cercano al puntero (por el centro de su cuadro). */
  const asientoBajo = (x: number, y: number): string | null => {
    let mejor: { id: string; distancia: number } | null = null;
    for (const el of mesaRef.current?.querySelectorAll<HTMLElement>('[data-asiento]') ?? []) {
      const r = el.getBoundingClientRect();
      const distancia = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
      if (!mejor || distancia < mejor.distancia) mejor = { id: el.dataset.asiento!, distancia };
    }
    return mejor?.id ?? null;
  };

  /** Lo que lleva el asa del asiento `jugadorId` (solo los ocupados la tienen). */
  const propsAsa = (jugadorId: string) => ({
    id: idAsaMover(jugadorId),
    cogido: activo?.desde === jugadorId,
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setMovimiento({ desde: jugadorId, hasta: jugadorId, modo: 'puntero', x: e.clientX, y: e.clientY });
    },
    onPointerMove: (e: PointerEvent<HTMLButtonElement>) => {
      if (activo?.modo !== 'puntero' || activo.desde !== jugadorId) return;
      const hasta = asientoBajo(e.clientX, e.clientY) ?? activo.hasta;
      setMovimiento({ ...activo, hasta, x: e.clientX, y: e.clientY });
    },
    onPointerUp: () => {
      if (activo?.modo === 'puntero') soltar();
    },
    onPointerCancel: () => cancelar(false),
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
      const cogidoAqui = activo?.modo === 'teclado' && activo.desde === jugadorId;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (cogidoAqui) {
          soltar();
        } else {
          setMovimiento({ desde: jugadorId, hasta: jugadorId, modo: 'teclado', x: 0, y: 0 });
          onAnuncio(
            `Has cogido a ${nombreDe(ocupanteDe(jugadorId))}, en el asiento ${numeroDe(jugadorId)}. ` +
              'Elige asiento con las flechas; Intro para soltar, Escape para cancelar.',
          );
        }
        return;
      }
      if (!cogidoAqui) return;
      const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (paso) {
        e.preventDefault();
        const i = asientos.findIndex((a) => a.id === activo.hasta);
        const hasta = asientos[(i + paso + asientos.length) % asientos.length].id;
        setMovimiento({ ...activo, hasta });
        onAnuncio(describirDestino(activo.desde, hasta));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelar(true);
      }
    },
    // Salir con Tab (o el foco a otra parte) cancela el movimiento con teclado.
    onBlur: () => {
      if (activo?.modo === 'teclado' && activo.desde === jugadorId) cancelar(true);
    },
  });

  return {
    /** El movimiento en curso (provisional), si lo hay. */
    activo,
    ocupanteVisible,
    propsAsa,
  };
}
