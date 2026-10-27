import { createServer, type Server as HttpServer } from 'http';
import type { AddressInfo } from 'net';
import { io as conectar, type Socket } from 'socket.io-client';
import { MemoriaChatRepository } from '../../src/repositories/ChatRepository';
import { iniciarSalaSocket, SALA_SOCKET_PATH } from '../../src/sockets/salaSocket';
import type { DependenciasSala } from '../../src/sockets/salaAcciones';
import type { SalaEstado, SalaResultado } from '../../src/contrato/sala';
import { guionDePrueba } from './guionDePrueba';

const ESPERA_MAX_MS = 2000;

/** Un navegador conectado a la sala: guarda el último estado que le ha llegado. */
export class Cliente {
  /** Cuántos estados le han llegado (cada difusión manda uno a cada conexión). */
  recibidos = 0;
  private ultimo: SalaEstado | null = null;
  private avisos: (() => void)[] = [];

  constructor(
    readonly nombre: string,
    readonly socket: Socket,
  ) {
    socket.on('sala:estado', (estado: SalaEstado) => {
      this.ultimo = estado;
      this.recibidos += 1;
      for (const avisar of this.avisos.splice(0)) avisar();
    });
  }

  get estado(): SalaEstado {
    if (!this.ultimo) throw new Error(`${this.nombre} aún no ha recibido el estado`);
    return this.ultimo;
  }

  /** Mi id en la sala. */
  get id(): string {
    return this.estado.yo;
  }

  /** El asiento en el que estoy sentado (como lo veo yo). */
  get miAsiento() {
    return this.estado.asientos.find((a) => a.ocupante === this.id);
  }

  /** Espera a haber recibido más de `n` estados. */
  async esperarMasDe(n: number): Promise<void> {
    const limite = Date.now() + ESPERA_MAX_MS;
    while (this.recibidos <= n) {
      if (Date.now() > limite) throw new Error(`${this.nombre} no ha recibido el estado a tiempo`);
      await new Promise<void>((resolver) => {
        this.avisos.push(resolver);
        setTimeout(resolver, 50);
      });
    }
  }
}

/** Un servidor de la sala de verdad (socket.io) en un puerto libre, con sus clientes. */
export class Arnes {
  readonly clientes: Cliente[] = [];

  private constructor(
    private readonly http: HttpServer,
    private readonly url: string,
  ) {}

  static async crear(cambios: Partial<DependenciasSala> = {}): Promise<Arnes> {
    const http = createServer();
    const deps: DependenciasSala = {
      guiones: {
        guionPredeterminado: async () => guionDePrueba(),
        importar: async () => guionDePrueba(),
      },
      mensajes: new MemoriaChatRepository(),
      video: null,
      imagenesBiblioteca: { leerPublica: async () => Promise.reject(new Error('Sin Biblioteca')) },
      ...cambios,
    };
    iniciarSalaSocket(http, async () => null, deps);
    await new Promise<void>((resolver) => http.listen(0, '127.0.0.1', resolver));
    const { port } = http.address() as AddressInfo;
    return new Arnes(http, `http://127.0.0.1:${port}`);
  }

  /** Entra un invitado con ese nombre y espera a que todos tengan el estado nuevo. */
  async entrar(nombre: string): Promise<Cliente> {
    const antes = this.recuento();
    const socket = conectar(this.url, {
      path: SALA_SOCKET_PATH,
      transports: ['websocket'],
      auth: { nombre, clienteId: `cliente-${nombre}` },
      reconnection: false,
    });
    const cliente = new Cliente(nombre, socket);
    await cliente.esperarMasDe(0);
    await this.esperarA(antes);
    this.clientes.push(cliente);
    return cliente;
  }

  /**
   * Pide una acción y, si sale bien, espera a que el estado nuevo les llegue a
   * todos (cada acción que sale bien se difunde una vez). Falla si la acción falla.
   */
  async accion(cliente: Cliente, accion: string, datos?: unknown): Promise<SalaResultado> {
    const resultado = await this.intentar(cliente, accion, datos);
    if (!resultado.ok) throw new Error(`${cliente.nombre} no ha podido ${accion}: ${resultado.error}`);
    return resultado;
  }

  /** Como accion, pero devuelve el resultado aunque falle. */
  async intentar(cliente: Cliente, accion: string, datos?: unknown): Promise<SalaResultado> {
    const antes = this.recuento();
    const resultado = await new Promise<SalaResultado>((resolver) =>
      cliente.socket.emit('sala:accion', { accion, datos }, resolver),
    );
    if (resultado.ok) await this.esperarA(antes);
    return resultado;
  }

  async cerrar(): Promise<void> {
    for (const c of this.clientes) c.socket.disconnect();
    this.http.closeAllConnections();
    await new Promise<void>((resolver) => this.http.close(() => resolver()));
  }

  private recuento(): Map<Cliente, number> {
    return new Map(this.clientes.map((c) => [c, c.recibidos]));
  }

  private async esperarA(antes: Map<Cliente, number>): Promise<void> {
    await Promise.all([...antes].map(([c, n]) => c.esperarMasDe(n)));
  }
}
