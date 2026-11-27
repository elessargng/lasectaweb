import { describe, expect, it } from 'vitest';
import * as Chat from '../../src/models/botc/canalesChat';
import * as Despertar from '../../src/models/botc/partida/despertar';
import * as Recordatorio from '../../src/models/botc/partida/recordatorio';
import * as Partida from '../../src/models/botc/partida/tiposPartida';
import * as Pregunta from '../../src/models/botc/partida/preguntaPartida';
import * as Narradores from '../../src/models/botc/narradorVirtual/narradores';
import * as ChatDto from '../../src/views/botc/dto/chat';
import * as DespertarDto from '../../src/views/botc/dto/despertar';
import * as GrimorioDto from '../../src/views/botc/dto/grimorio';
import * as PartidaDto from '../../src/views/botc/dto/partida';
import * as PreguntaDto from '../../src/views/botc/dto/preguntaPartida';
import * as NarradorVirtualDto from '../../src/views/botc/dto/narradorVirtual';

/**
 * El contrato con el cliente (views/botc/dto) copia las constantes del dominio que
 * viajan: tienen que valer lo mismo. Los tipos los comprueba views/botc/contrato.ts.
 */
describe('el contrato con el cliente vale lo mismo que el dominio', () => {
  it('los canales del chat y su largo', () => {
    expect(ChatDto.CANAL_GENERAL).toBe(Chat.CANAL_GENERAL);
    expect(ChatDto.CANAL_VISITANTES).toBe(Chat.CANAL_VISITANTES);
    expect(ChatDto.PREFIJO_PRIVADO).toBe(Chat.PREFIJO_PRIVADO);
    expect(ChatDto.LARGO_MAXIMO_MENSAJE).toBe(Chat.LARGO_MAXIMO_MENSAJE);
    expect(ChatDto.canalPrivado('b', 'a')).toBe(Chat.canalPrivado('b', 'a'));
    expect(ChatDto.canalPrivado('a', 'b')).toBe(Chat.canalPrivado('b', 'a'));
  });

  it('las fichas y tarjetas de los despertares', () => {
    expect(DespertarDto.FICHAS_DESPERTAR).toEqual(Despertar.FICHAS_DESPERTAR);
    expect(DespertarDto.TARJETAS_DESPERTAR).toEqual(Despertar.TARJETAS_DESPERTAR);
    expect(DespertarDto.FICHAS_RESPUESTA_GUIADA).toEqual(Despertar.FICHAS_RESPUESTA_GUIADA);
    expect(DespertarDto.ADJUNTOS_DESPERTAR).toEqual(Despertar.ADJUNTOS_DESPERTAR);
  });

  it('los recordatorios y las notas del grimorio', () => {
    expect(GrimorioDto.RECORDATORIO_TEXTO).toBe(Recordatorio.RECORDATORIO_TEXTO);
    expect(GrimorioDto.SALA_RECORDATORIO_TEXTO_MAX).toBe(Recordatorio.SALA_RECORDATORIO_TEXTO_MAX);
    expect(GrimorioDto.SALA_NOTA_LARGO_MAX).toBe(Recordatorio.SALA_NOTA_LARGO_MAX);
  });

  it('los límites del señalamiento', () => {
    expect(PartidaDto.SALA_SENALAMIENTO).toEqual(Partida.SALA_SENALAMIENTO);
  });

  it('la pregunta del Artista', () => {
    expect(PreguntaDto.MAX_PREGUNTA_LIBRE).toBe(Pregunta.MAX_PREGUNTA_LIBRE);
    expect(PreguntaDto.TIPOS_PREGUNTABLES).toEqual(Pregunta.TIPOS_PREGUNTABLES);
    expect(PreguntaDto.PREGUNTAS_PARTIDA).toEqual(Pregunta.PREGUNTAS_PARTIDA);
  });

  it('los narradores virtuales', () => {
    expect(NarradorVirtualDto.NARRADORES_VIRTUALES).toEqual(Narradores.NARRADORES_VIRTUALES);
    expect(NarradorVirtualDto.JUGADORES_NARRADOR_VIRTUAL).toEqual(Narradores.JUGADORES_NARRADOR_VIRTUAL);
    expect(NarradorVirtualDto.GUION_DE_LA_SALA).toBe(Narradores.GUION_DE_LA_SALA);
  });
});
