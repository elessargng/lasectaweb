/**
 * El ángulo (radianes) del asiento `i` de `total` en la plaza: el primero a las 12
 * y siguiendo como las agujas del reloj. x = sin, y = -cos (hacia abajo, positivo).
 */
export const anguloAsiento = (i: number, total: number) => (2 * Math.PI * i) / total;
