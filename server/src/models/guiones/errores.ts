/** Un guion que no se puede usar. El mensaje es para quien lo carga (se le muestra tal cual). */
export class GuionInvalidoError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'GuionInvalidoError';
  }
}
