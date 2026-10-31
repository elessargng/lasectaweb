import type { MensajeChat, Susurro } from '../models/chat';
import type { MensajeChatDto, SusurroDto } from './dto/chat';

/** Un mensaje de texto tal como se envía a quien puede leerlo. */
export const mensajeChatDto = (m: MensajeChat): MensajeChatDto => ({
  id: m.id,
  canal: m.canal,
  autor: m.autor,
  autorNombre: m.autorNombre,
  texto: m.texto,
  hora: m.hora,
});

/** Un susurro tal como lo ven todos: de quién a quién y cuánto, no qué. */
export const susurroDto = (s: Susurro): SusurroDto => ({ desde: s.desde, hasta: s.hasta, intensidad: s.intensidad });
