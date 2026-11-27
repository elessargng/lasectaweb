/**
 * El contrato con el cliente (views/botc/dto, alias @views) no depende del dominio:
 * copia los tipos que viajan. Aquí el compilador comprueba que cada copia sigue
 * siendo igual al tipo del dominio: si uno cambia y el otro no, `tsc` falla en
 * esta lista. Los valores de las constantes los comprueba test/botc/contrato.test.ts.
 *
 * Lo que sale del servidor lo comprueban también las vistas (VistaPartida monta
 * los Dto con valores del dominio); esto cubre además lo que entra (EnvioDespertar,
 * PreguntaPartida) y lo que nadie monta a mano (el diario de las estadísticas).
 */
import type * as Chat from '../../models/botc/canalesChat';
import type * as Despertar from '../../models/botc/partida/despertar';
import type * as Diario from '../../models/botc/partida/diario';
import type * as Recordatorio from '../../models/botc/partida/recordatorio';
import type * as Alineamiento from '../../models/botc/partida/alineamiento';
import type * as Partida from '../../models/botc/partida/tiposPartida';
import type * as Pregunta from '../../models/botc/partida/preguntaPartida';
import type * as Narradores from '../../models/botc/narradorVirtual/narradores';
import type * as Persona from '../../models/botc/sala/persona';
import type * as ChatDto from './dto/chat';
import type * as DespertarDto from './dto/despertar';
import type * as DiarioDto from './dto/diario';
import type * as GrimorioDto from './dto/grimorio';
import type * as JugadorDto from './dto/jugador';
import type * as PartidaDto from './dto/partida';
import type * as PreguntaDto from './dto/preguntaPartida';
import type * as NarradorVirtualDto from './dto/narradorVirtual';
import type * as ParticipanteDto from './dto/participante';

/** true si A y B son el mismo tipo (ni más ni menos campos, ni campos distintos). */
type Igual<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Cierto<T extends true> = T;

export type ComprobacionesDelContrato = [
  // Chat
  Cierto<Igual<Chat.MensajesPrivados, ChatDto.MensajesPrivados>>,
  Cierto<Igual<typeof Chat.CANAL_GENERAL, typeof ChatDto.CANAL_GENERAL>>,
  Cierto<Igual<typeof Chat.CANAL_VISITANTES, typeof ChatDto.CANAL_VISITANTES>>,
  Cierto<Igual<typeof Chat.PREFIJO_PRIVADO, typeof ChatDto.PREFIJO_PRIVADO>>,
  // Despertares
  Cierto<Igual<Despertar.FichaDespertar, DespertarDto.FichaDespertar>>,
  Cierto<Igual<Despertar.TarjetaDespertar, DespertarDto.TarjetaDespertar>>,
  Cierto<Igual<Despertar.AdjuntoDespertar, DespertarDto.AdjuntoDespertar>>,
  Cierto<Igual<Despertar.MensajeDespertar, DespertarDto.MensajeDespertar>>,
  Cierto<Igual<Despertar.EnvioDespertar, DespertarDto.EnvioDespertar>>,
  Cierto<Igual<Despertar.EleccionDespertar, DespertarDto.EleccionDespertar>>,
  Cierto<Igual<Despertar.EstadoHabilidad, DespertarDto.EstadoHabilidad>>,
  Cierto<Igual<Despertar.Registro, DespertarDto.Registro>>,
  Cierto<Igual<Despertar.AvisoHabilidad, DespertarDto.AvisoHabilidad>>,
  Cierto<Igual<Despertar.DesenlaceDespertar, DespertarDto.DesenlaceDespertar>>,
  Cierto<Igual<Despertar.OpcionDespertar, DespertarDto.OpcionDespertar>>,
  // Diario
  Cierto<Igual<Diario.AsientoDiario, DiarioDto.AsientoDiario>>,
  Cierto<Igual<Diario.FotoAsiento, DiarioDto.FotoAsiento>>,
  Cierto<Igual<Diario.CausaMuerte, DiarioDto.CausaMuerte>>,
  Cierto<Igual<Diario.HechoDiario, DiarioDto.HechoDiario>>,
  Cierto<Igual<Diario.EntradaDiario, DiarioDto.EntradaDiario>>,
  // Grimorio y jugador
  Cierto<Igual<Recordatorio.Recordatorio, GrimorioDto.Recordatorio>>,
  Cierto<Igual<typeof Recordatorio.RECORDATORIO_TEXTO, typeof GrimorioDto.RECORDATORIO_TEXTO>>,
  Cierto<Igual<Alineamiento.Alineamiento, JugadorDto.Alineamiento>>,
  // Partida
  Cierto<Igual<Partida.Fase, PartidaDto.Fase>>,
  Cierto<Igual<Partida.Distribucion, PartidaDto.Distribucion>>,
  Cierto<Igual<Partida.RegistroVotacion, PartidaDto.RegistroVotacion>>,
  Cierto<Igual<Partida.TurnoNominacion, PartidaDto.TurnoNominacion>>,
  // Pregunta del Artista
  Cierto<Igual<Pregunta.RespuestaPregunta, PreguntaDto.RespuestaPregunta>>,
  Cierto<Igual<Pregunta.TipoPreguntable, PreguntaDto.TipoPreguntable>>,
  Cierto<Igual<Pregunta.QuienPregunta, PreguntaDto.QuienPregunta>>,
  Cierto<Igual<Pregunta.PreguntaPartida, PreguntaDto.PreguntaPartida>>,
  // Narrador virtual
  Cierto<Igual<typeof Narradores.NARRADORES_VIRTUALES, typeof NarradorVirtualDto.NARRADORES_VIRTUALES>>,
  Cierto<Igual<typeof Narradores.JUGADORES_NARRADOR_VIRTUAL, typeof NarradorVirtualDto.JUGADORES_NARRADOR_VIRTUAL>>,
  Cierto<Igual<typeof Narradores.GUION_DE_LA_SALA, typeof NarradorVirtualDto.GUION_DE_LA_SALA>>,
  Cierto<Igual<Narradores.IdNarradorVirtual, NarradorVirtualDto.IdNarradorVirtual>>,
  Cierto<Igual<Narradores.GuionNarrable, NarradorVirtualDto.GuionNarrable>>,
  Cierto<Igual<Narradores.EtapaNarradorVirtual, NarradorVirtualDto.EtapaNarradorVirtual>>,
  // Participantes
  Cierto<Igual<Persona.Rol, ParticipanteDto.Rol>>,
  Cierto<Igual<Persona.FormaMano, ParticipanteDto.FormaMano>>,
  Cierto<Igual<Persona.Persona, ParticipanteDto.Persona>>,
  Cierto<Igual<Persona.EstadoAccesoGrimorio, ParticipanteDto.EstadoAccesoGrimorio>>,
];
