import {
  SalaAccesoGrimorio,
  SalaAlineamiento,
  SalaRecordatorio,
  SalaAsiento,
  SalaConfiguracion,
  SalaDistribucion,
  SalaFase,
  SalaDespertar,
  SalaFormaMano,
  SalaNominacion,
  SalaRegistroVotacion,
  SalaReloj,
  SalaSenalamiento,
  SalaRevelacion,
  SalaRol,
  SalaFichaEnviada,
  SalaGrimorioEnviado,
  SalaEleccionDespertar,
  SalaEnvioDespertar,
  SalaHabilidadNoche,
  SalaNarradorVirtual,
} from '../contrato/sala';
import { GuionResuelto, PersonajeDeGuion } from '../types/guiones';
import { type Participante, type SalaLlegada } from './sala/Participantes';
import { Sala, SALA_ASIENTOS } from './sala/Sala';
import { Partida } from './partida/Partida';
import { identidadDe } from './partida/Grimorio';
import { NarradorVirtualEnMemoria, type NarradorVirtualRepository } from '../repositories/NarradorVirtualRepository';
import { NarradorVirtual } from './narradorVirtual/NarradorVirtual';
import type { Despertares } from './partida/Despertares';
import type { Senalamientos } from './partida/Senalamientos';
import type { FichaEntregada } from './partida/Entregas';
import { SALA_SEGUNDOS_POR_FICHA } from './partida/Configuracion';
import type { AsientoDiario, HechoDiario } from '../contrato/diario';
import type { OyentePartida } from './partida/eventos';
import type { RegistroAlNominar } from './partida/reglas/ReglaPersonaje';

export { SALA_ASIENTOS, SALA_SEGUNDOS_POR_FICHA };

/**
 * La sala de juego, en memoria: quién está, la mesa y la partida. Se pierde al
 * reiniciar el servidor, como una sala que se vacía. Es la fachada de la sala:
 * las acciones, el chat, las conversaciones y la vista solo hablan con ella, y
 * ella pasa cada cosa a la sala (quién está y dónde se sienta, ver Sala), a la
 * partida (ver Partida) o al narrador virtual (ver NarradorVirtual), que es de las dos.
 */
export class SalaDeJuego {
  /** Quién está en la sala y en qué asiento se sienta cada jugador. */
  readonly sala = new Sala();
  /** La partida que se juega en la sala. */
  readonly partida = new Partida(this.sala, { hayNarradorVirtual: () => !!this.narrador.actual() });
  /** El narrador virtual, si lo hay: es de las dos (su participante, de la sala; lo que lleva, de la partida). */
  readonly narrador: NarradorVirtual;

  constructor(
    /** Dónde se guarda el narrador virtual de la sala (ver NarradorVirtualService). */
    narradoresVirtuales: NarradorVirtualRepository = new NarradorVirtualEnMemoria(),
  ) {
    this.narrador = new NarradorVirtual(narradoresVirtuales, this.sala, this.partida);
  }

  // El guion

  /** El guion de la sala (ya resuelto por GuionService), o null. */
  guion(): GuionResuelto | null {
    return this.partida.guion.actual();
  }

  versionGuion(): number {
    return this.partida.guion.version();
  }

  /** Ver Partida.cambiarGuion. No comprueba permisos. */
  cambiarGuion(guion: GuionResuelto): void {
    this.partida.cambiarGuion(guion);
  }

  /** Un personaje de la partida (ver Guion.personaje). */
  personaje(id: string): PersonajeDeGuion | undefined {
    return this.partida.guion.personaje(id);
  }

  // El reparto y la bolsa

  setupAceptado(): string | null {
    return this.partida.reparto.setupAceptado();
  }

  aceptarSetup(firma: string | null): void {
    this.partida.reparto.aceptarSetup(firma);
  }

  bolsa(): string[] {
    return this.partida.reparto.bolsa.bolsa();
  }

  alternarEnBolsa(personajeId: string): void {
    this.partida.reparto.bolsa.alternar(personajeId);
  }

  ponerEnBolsa(personajeId: string, cantidad: number): void {
    this.partida.reparto.bolsa.poner(personajeId, cantidad);
  }

  reemplazarBolsa(personajes: string[]): void {
    this.partida.reparto.bolsa.reemplazar(personajes);
  }

  vaciarBolsa(): void {
    this.partida.reparto.bolsa.vaciar();
  }

  distribucion(): SalaDistribucion {
    return this.partida.reparto.distribucion();
  }

  fichasParaRepartir(): number {
    return this.partida.reparto.fichasParaRepartir();
  }

  repartirBolsa(): void {
    this.partida.reparto.repartir();
  }

  // Los NPCs y lo que traen

  npcs(): string[] {
    return this.partida.npcs.npcs();
  }

  /** Ver Partida.alternarNpc. */
  alternarNpc(personajeId: string): void {
    this.partida.alternarNpc(personajeId);
  }

  npcActivo(id: string): boolean {
    return this.partida.npcs.activo(id);
  }

  bootlegger(): string[] {
    return this.partida.npcs.bootlegger();
  }

  escribirBootlegger(reglas: string[] | null): void {
    this.partida.npcs.escribirBootlegger(reglas);
  }

  rolStormcatcher(): string | null {
    return this.partida.npcs.rolStormcatcher();
  }

  nombrarStormcatcher(personajeId: string | null): void {
    this.partida.npcs.nombrarStormcatcher(personajeId);
  }

  silencio(): boolean {
    return this.partida.npcs.silencio();
  }

  pedirSilencio(activo: boolean): void {
    this.partida.npcs.pedirSilencio(activo);
  }

  // Lo entregado a los jugadores y los grimorios enviados

  entregarFichas(): void {
    this.partida.entregas.entregarFichas();
  }

  comunicarFicha(asientoId: string, personajes: string[], alineamiento: SalaAlineamiento | null): void {
    this.partida.entregas.comunicarFicha(asientoId, personajes, alineamiento);
  }

  fichaEntregada(asientoId: string): FichaEntregada {
    return this.partida.entregas.fichaEntregada(asientoId);
  }

  fichasRetenidas(): boolean {
    return this.partida.entregas.fichasRetenidas();
  }

  retenerFichas(retenidas: boolean): void {
    this.partida.entregas.retenerFichas(retenidas);
  }

  enviarGrimorio(asientoId: string, fichas: SalaFichaEnviada[], faroles: string[] = []): void {
    this.partida.entregas.enviarGrimorio(asientoId, fichas, faroles);
  }

  grimorioRecibidoPor(participanteId: string): SalaGrimorioEnviado | null {
    return this.partida.entregas.grimorioRecibidoPor(participanteId);
  }

  // Los faroles

  faroles(): (string | null)[] {
    return this.partida.faroles.faroles();
  }

  ponerFarol(posicion: number, personajeId: string | null): void {
    this.partida.faroles.ponerFarol(posicion, personajeId);
  }

  ponerFarolAsiento(asientoId: string, posicion: number, personajeId: string | null): void {
    this.partida.faroles.ponerFarolAsiento(asientoId, posicion, personajeId);
  }

  copiarFaroles(asientoId: string, personajes: string[]): void {
    this.partida.faroles.copiarFaroles(asientoId, personajes);
  }

  /** Ver Faroles.usarFarol. */
  usarFarol(asientoId: string, personajeId: string | null): string | null {
    return this.partida.faroles.usarFarol(asientoId, personajeId);
  }

  // Lo que pasa en la partida: los oyentes y el diario

  /** Ver Partida.alCambiarSola. */
  get alCambiarSola(): () => void {
    return this.partida.alCambiarSola;
  }

  set alCambiarSola(alCambiar: () => void) {
    this.partida.alCambiarSola = alCambiar;
  }

  /** Ver Partida.suscribir. */
  suscribir(oyente: OyentePartida): () => void {
    return this.partida.suscribir(oyente);
  }

  anotar(hecho: HechoDiario): void {
    this.partida.anotar(hecho);
  }

  asientoDiario(asientoId: string): AsientoDiario {
    return this.partida.asientoDiario(asientoId);
  }

  // La fase y la máquina del tiempo

  fase(): SalaFase {
    return this.partida.fases.actual();
  }

  irANoche(): void {
    this.partida.irANoche();
  }

  amanecer(): void {
    this.partida.amanecer();
  }

  /** Ver Fases.anterior. */
  faseAnterior(): SalaFase | null {
    return this.partida.fases.anterior();
  }

  /** Ver Partida.volverAtras. No comprueba permisos. */
  volverAtras(): boolean {
    return this.partida.volverAtras();
  }

  recordatoriosNoche(): Record<string, boolean> {
    return this.partida.recordatoriosNoche();
  }

  cambiarRecordatorio(id: string, activo: boolean): void {
    this.partida.cambiarRecordatorio(id, activo);
  }

  /** Ver Partida.limpiarGrimorio. */
  limpiarGrimorio(): void {
    this.partida.limpiarGrimorio();
  }

  // Los despertares

  despertares(): SalaDespertar[] {
    return this.partida.despertares.despertares();
  }

  hayDespertar(asientoId: string): boolean {
    return this.partida.despertares.hayDespertar(asientoId);
  }

  asientoDespiertoDe(participanteId: string): string | null {
    return this.partida.despertares.asientoDespiertoDe(participanteId);
  }

  despertar(asientoId: string): string | null {
    return this.partida.despertares.despertar(asientoId);
  }

  enviarDespertar(asientoId: string, mensaje: Parameters<Despertares['enviar']>[1]): void {
    this.partida.despertares.enviar(asientoId, mensaje);
  }

  /** Ver Partida.mandarDelNarrador. */
  mandarDelNarrador(
    asientoId: string,
    envio: SalaEnvioDespertar,
    opciones: { eleccion?: SalaEleccionDespertar; guiado?: boolean } = {},
  ): void {
    this.partida.mandarDelNarrador(asientoId, envio, opciones);
  }

  respuestaGuiada(asientoId: string): boolean {
    return this.partida.despertares.respuestaGuiada(asientoId);
  }

  // El despertar guiado

  habilidadesNoche(): SalaHabilidadNoche[] {
    return this.partida.guiado.habilidadesNoche();
  }

  despertarHabilidad(personaje: string): string | null {
    return this.partida.guiado.despertar(personaje);
  }

  eleccionPendiente(asientoId: string): SalaEleccionDespertar | null {
    return this.partida.guiado.eleccionPendiente(asientoId);
  }

  alElegirHabilidad(asientoId: string, elegidos: string[]): void {
    this.partida.guiado.alElegir(asientoId, elegidos);
  }

  /** El jugador de un asiento ha contestado «Entendido» en su despertar: le llega lo siguiente de su cola (ver DespertarGuiado). */
  alEntenderHabilidad(asientoId: string): void {
    this.partida.guiado.alEntender(asientoId);
  }

  resolverHabilidad(personaje: string, envio: SalaEnvioDespertar): string | null {
    return this.partida.guiado.resolver(personaje, envio);
  }

  nuevoImp(): string | null {
    return this.partida.guiado.nuevoImp();
  }

  elegirNuevoImp(asientoId: string): string | null {
    return this.partida.guiado.elegirNuevoImp(asientoId);
  }

  // Las nominaciones y votaciones

  /** El registro de nominaciones y votaciones, en el orden en que se nominó. */
  votaciones(): SalaRegistroVotacion[] {
    return this.partida.nominaciones.votaciones();
  }

  votacionSecreta(): boolean {
    return this.partida.votacionSecreta();
  }

  nominacion(): SalaNominacion | null {
    return this.partida.nominaciones.nominacion();
  }

  gastadosAlVotar(): Set<string> | null {
    return this.partida.nominaciones.gastadosAlVotar();
  }

  elegirVotosNecesarios(votos: number | null): void {
    this.partida.nominaciones.elegirVotosNecesarios(votos);
  }

  /** Ver Partida.nominar. No comprueba permisos. */
  nominar(
    desde: string,
    hasta: string,
    registro: RegistroAlNominar = {},
  ): { pregunta: 'comoAldeano' } | { anochece: boolean; final: boolean } | null {
    return this.partida.nominar(desde, hasta, registro);
  }

  cerrarNominacion(): void {
    this.partida.nominaciones.cerrarNominacion();
  }

  hayVotacion(): boolean {
    return this.partida.nominaciones.hayVotacion();
  }

  votacionEnMarcha(): boolean {
    return this.partida.nominaciones.votacionEnMarcha();
  }

  reiniciarVotacion(): void {
    this.partida.nominaciones.reiniciarVotacion();
  }

  iniciarCuentaAtras(ahora: number): void {
    this.partida.nominaciones.iniciarCuentaAtras(ahora);
  }

  /** Quien tiene la palabra en la nominación (los demás jugadores callan), o null: hablan todos. */
  palabra(): string | null {
    return this.partida.nominaciones.palabra();
  }

  /** Da la palabra a uno en la nominación en curso (o, con null, a todos). Devuelve el error, si lo hay. No comprueba permisos. */
  darPalabra(participanteId: string | null): string | null {
    return this.partida.nominaciones.darPalabra(participanteId);
  }

  // Las fichas de la mesa

  /** Quién es de verdad el de un asiento (ver identidadDe). */
  identidad(asiento: SalaAsiento): string | null {
    return identidadDe(asiento);
  }

  /** El alineamiento de un asiento (ver Grimorio.alineamiento). */
  alineamientoEfectivo(asiento: SalaAsiento): SalaAlineamiento | null {
    return this.partida.grimorio.alineamiento(asiento);
  }

  marcar(asientoId: string, marcado: boolean, votos: number | null = null): void {
    this.partida.grimorio.marcar(asientoId, marcado, votos);
  }

  desmarcar(): void {
    this.partida.grimorio.desmarcar();
  }

  hayMarca(): boolean {
    return this.partida.grimorio.hayMarca();
  }

  cambiarPersonaje(asientoId: string, personaje: string | null): void {
    this.partida.grimorio.cambiarPersonaje(asientoId, personaje);
  }

  intercambiarFichas(desdeId: string, hastaId: string): void {
    this.partida.grimorio.intercambiarFichas(desdeId, hastaId);
  }

  ponerRecordatorio(asientoId: string, recordatorio: Omit<SalaRecordatorio, 'id'>): void {
    this.partida.grimorio.ponerRecordatorio(asientoId, recordatorio);
  }

  quitarRecordatorio(asientoId: string, recordatorioId: string): void {
    this.partida.grimorio.quitarRecordatorio(asientoId, recordatorioId);
  }

  recordatorioQueSobra(asientoId: string, personajeId: string, indice: number): { asientoId: string; recordatorioId: string } | null {
    return this.partida.grimorio.recordatorioQueSobra(asientoId, personajeId, indice);
  }

  escribirNota(asientoId: string, texto: string | null): boolean {
    return this.partida.grimorio.escribirNota(asientoId, texto);
  }

  cambiarAlineamiento(asientoId: string, alineamiento: SalaAlineamiento): void {
    this.partida.grimorio.cambiarAlineamiento(asientoId, alineamiento);
  }

  /** Ver Grimorio.cambiarVida. */
  cambiarVida(asientoId: string, muerto: boolean, opciones: { anotar?: boolean } = {}): void {
    this.partida.grimorio.cambiarVida(asientoId, muerto, opciones);
  }

  /** Ver Partida.ejecutar. No comprueba permisos. */
  ejecutar(asientoId: string): { anochece: boolean; final: boolean } | null {
    return this.partida.ejecutar(asientoId);
  }

  confirmarMuerte(asientoId: string): boolean {
    return this.partida.grimorio.confirmarMuerte(asientoId);
  }

  cambiarVoto(asientoId: string, gastado: boolean): boolean {
    return this.partida.grimorio.cambiarVoto(asientoId, gastado);
  }

  devolverVotos(): number {
    return this.partida.grimorio.devolverVotos();
  }

  // Lo que dicen las reglas de los personajes

  /** Ver Partida.sinVoto. */
  sinVoto(participanteId: string): boolean {
    return this.partida.sinVoto(participanteId);
  }

  institutrizViva(): boolean {
    return this.partida.institutrizViva();
  }

  voudonVivo(): boolean {
    return this.partida.voudonVivo();
  }

  puedeVotarDoble(participanteId: string): boolean {
    return this.partida.puedeVotarDoble(participanteId);
  }

  // El gong y el reloj

  gong(): number | null {
    return this.partida.reloj.gong();
  }

  sonarGong(): void {
    this.partida.reloj.sonarGong();
  }

  reloj(): SalaReloj | null {
    return this.partida.reloj.reloj();
  }

  ponerReloj(segundos: number, mensaje: string): void {
    this.partida.reloj.ponerReloj(segundos, mensaje);
  }

  relojEnMarcha(): boolean {
    return this.partida.reloj.relojEnMarcha();
  }

  terminarReloj(): void {
    this.partida.reloj.terminarReloj();
  }

  quitarReloj(): void {
    this.partida.reloj.quitarReloj();
  }

  // El señalamiento

  senalamiento(): SalaSenalamiento | null {
    return this.partida.senalamientos.senalamiento();
  }

  veSenalamiento(participante: Participante): boolean {
    return this.partida.senalamientos.veSenalamiento(participante);
  }

  /** Ver Partida.manosBloqueadas. */
  manosBloqueadas(participante: Participante): boolean {
    return this.partida.manosBloqueadas(participante);
  }

  /** Ver Partida.empezarSenalamiento. No comprueba permisos. */
  empezarSenalamiento(datos: Parameters<Senalamientos['empezar']>[0]): void {
    this.partida.empezarSenalamiento(datos);
  }

  /** Ver Partida.senalar. */
  senalar(participanteId: string, objetivo: string | null): string | null {
    return this.partida.senalar(participanteId, objetivo);
  }

  /** Quita el señalamiento. No comprueba permisos. */
  terminarSenalamiento(): void {
    this.partida.senalamientos.terminar();
  }

  esbirrosLilmonsta(): string[] | null {
    return this.partida.esbirrosLilmonsta();
  }

  // La revelación del grimorio

  revelacion(): SalaRevelacion | null {
    return this.partida.revelacion.revelacion();
  }

  revelarFicha(asientoId: string): void {
    this.partida.revelacion.revelarFicha(asientoId);
  }

  revelarTodas(): void {
    this.partida.revelacion.revelarTodas();
  }

  /** Ver Partida.empezarRevelacion. */
  empezarRevelacion(ganador: SalaAlineamiento, causas: string[] = [], esbirros: Record<string, string> = {}): void {
    this.partida.empezarRevelacion(ganador, causas, esbirros);
  }

  // La configuración

  configuracion(): SalaConfiguracion {
    return this.partida.configuracion.actual();
  }

  /** Cambia ajustes de la partida. No comprueba permisos. */
  configurar(cambios: Partial<SalaConfiguracion>): void {
    this.partida.configuracion.cambiar(cambios);
  }

  /** Si se puede conversar en privado (el narrador virtual lo cierra fuera de los privados). */
  privadosPermitidos(): boolean {
    return this.partida.configuracion.privadosPermitidos();
  }

  /** Abre o cierra las conversaciones privadas (cerrarlas termina las que haya). No comprueba permisos. */
  permitirPrivados(abiertos: boolean): void {
    this.partida.configuracion.permitirPrivados(abiertos);
  }

  // El acceso al grimorio

  /** Si un participante ha pedido ver el grimorio o lo ve (ver AccesoGrimorio). */
  accesoGrimorio(id: string): SalaAccesoGrimorio {
    return this.partida.acceso.de(id);
  }

  cambiarAccesoGrimorio(id: string, acceso: SalaAccesoGrimorio): void {
    this.partida.acceso.cambiar(id, acceso);
  }

  // La mesa: los asientos (de la sala) con sus fichas (de la partida)

  /** Los asientos, en orden (el primero a las 12, como las agujas del reloj), con su ficha. */
  asientos(): SalaAsiento[] {
    return this.partida.mesa();
  }

  /** El asiento en el que se sienta un participante, o null. */
  asientoDe(participanteId: string): SalaAsiento | null {
    return this.partida.asientoDe(participanteId);
  }

  /** Si existe ese asiento. */
  hayAsiento(id: string): boolean {
    return !!this.sala.asiento(id);
  }

  anadirAsiento(): void {
    this.sala.anadirAsiento();
  }

  /** Quita el último asiento y su ficha. */
  quitarAsiento(): void {
    this.sala.quitarAsiento();
  }

  /** Ver Sala.mezclar: cada jugador cambia de silla con su ficha (ver Partida.llevarFichas). */
  mezclarAsientos(): number {
    return this.sala.mezclar();
  }

  moverOcupante(desde: string, hasta: string): string | null {
    return this.sala.moverOcupante(desde, hasta);
  }

  sentar(id: string, asientoId: string): string | null {
    return this.sala.sentar(id, asientoId);
  }

  levantar(id: string): void {
    this.sala.levantar(id);
  }

  /** Ver Sala.sonVecinos. */
  sonVecinos(unoId: string, otroId: string): boolean {
    return this.sala.sonVecinos(unoId, otroId);
  }

  // Quién está en la sala: lo lleva Participantes (ver allí lo que hace cada uno)

  conectar(socketId: string, clienteId: string | null, llegada: SalaLlegada, conexionViva: (socketId: string) => boolean) {
    return this.sala.participantes.conectar(socketId, clienteId, llegada, conexionViva);
  }

  cambiarPartidasJugadas(userId: string, partidas: number): void {
    this.sala.participantes.cambiarPartidasJugadas(userId, partidas);
  }

  salir(clave: string, socketId: string): void {
    this.sala.participantes.salir(clave, socketId);
  }

  expulsar(id: string): string | null {
    return this.sala.participantes.expulsar(id);
  }

  desconectar(clave: string, socketId: string, alExpulsar: () => void): void {
    this.sala.participantes.desconectar(clave, socketId, alExpulsar);
  }

  participanteDe(clave: string): Participante | undefined {
    return this.sala.participantes.participanteDe(clave);
  }

  buscar(id: string): Participante | undefined {
    return this.sala.participantes.buscar(id);
  }

  nombreBase(id: string): string | undefined {
    return this.sala.participantes.nombreBase(id);
  }

  nombreOcupado(nombre: string, salvoId: string): boolean {
    return this.sala.participantes.nombreOcupado(nombre, salvoId);
  }

  nombreLibreParaInvitado(nombre: string, clienteId: string | null, conexionViva: (socketId: string) => boolean): boolean {
    return this.sala.participantes.nombreLibreParaInvitado(nombre, clienteId, conexionViva);
  }

  cambiarAvatar(id: string, elegido: string | null): void {
    this.sala.participantes.cambiarAvatar(id, elegido);
  }

  renombrar(id: string, nombre: string): void {
    this.sala.participantes.renombrar(id, nombre);
  }

  hayNarrador(): boolean {
    return this.sala.participantes.hayNarrador();
  }

  cambiarRol(id: string, rol: SalaRol): void {
    this.sala.participantes.cambiarRol(id, rol);
  }

  cambiarSonido(id: string, sinSonido: boolean): void {
    this.sala.participantes.cambiarSonido(id, sinSonido);
  }

  levantarMano(id: string, levantada: boolean, dos = false): void {
    this.sala.participantes.levantarMano(id, levantada, dos);
  }

  elegirFormaMano(id: string, forma: SalaFormaMano): void {
    this.sala.participantes.elegirFormaMano(id, forma);
  }

  elegirEstiloMano(id: string, estilo: string): void {
    this.sala.participantes.elegirEstiloMano(id, estilo);
  }

  participantes(): Participante[] {
    return this.sala.participantes.participantes();
  }

  conexiones(): { socketId: string; clave: string; id: string }[] {
    return this.sala.participantes.conexiones();
  }

  // El narrador virtual (ver NarradorVirtual)

  narradorVirtual(): SalaNarradorVirtual | null {
    return this.narrador.actual();
  }

  anadirNarradorVirtual(datos: Pick<SalaNarradorVirtual, 'id' | 'creador' | 'guion' | 'jugadores'>, nombre: string, avatar: string): string {
    return this.narrador.anadir(datos, nombre, avatar);
  }

  actualizarNarradorVirtual(cambios: Parameters<NarradorVirtual['actualizar']>[0]): void {
    this.narrador.actualizar(cambios);
  }

  relevarNarradorVirtual(id: SalaNarradorVirtual['id'], nombre: string, avatar: string): void {
    this.narrador.relevar(id, nombre, avatar);
  }

  quitarNarradorVirtual(): void {
    this.narrador.quitar();
  }
}
