import cron, { ScheduledTask } from 'node-cron';
import { VillacuervosService } from './VillacuervosService';
import { SocialMediaService } from './SocialMediaService';

export class VigilanteService {
  private cronTask: ScheduledTask | null = null;
  // Mapa de ID de partida -> Fecha de la partida, para evitar duplicados y poder limpiar el mapa
  private announcedPlays = new Map<number, Date>();

  constructor(
    private villacuervosService: VillacuervosService,
    private socialMediaService: SocialMediaService
  ) {}

  /**
   * Inicia el proceso de vigilancia basándose en la expresión cron VIGILANTE_CRON (.env).
   */
  start(): void {
    if (this.cronTask) {
      console.warn('[VigilanteService] El servicio ya está en ejecución.');
      return;
    }

    const cronExpr = (process.env.VIGILANTE_CRON || '*/5 * * * *').trim();

    // Valores aceptados para deshabilitar el servicio por completo
    const disabledValues = ['off', 'none', 'false', 'disabled', 'never', '0'];
    if (disabledValues.includes(cronExpr.toLowerCase())) {
      console.log(`[VigilanteService] Servicio deshabilitado por configuración (VIGILANTE_CRON=${cronExpr}).`);
      return;
    }

    if (!cron.validate(cronExpr)) {
      console.error(`[VigilanteService] Expresión VIGILANTE_CRON no válida: "${cronExpr}". Servicio no iniciado.`);
      return;
    }

    console.log(`[VigilanteService] Servicio iniciado con expresión cron: "${cronExpr}".`);

    this.cronTask = cron.schedule(cronExpr, () => {
      this.checkPlays();
    });
  }

  /**
   * Detiene el proceso de vigilancia liberando la tarea cron.
   */
  stop(): void {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
      console.log('[VigilanteService] Servicio detenido.');
    }
  }

  /**
   * Realiza la consulta a Villacuervos y comprueba partidas próximas.
   */
  async checkPlays(): Promise<void> {
    console.log(`[VigilanteService] [${new Date().toLocaleTimeString('es-ES')}] Comprobando partidas planificadas...`);

    try {
      const plays = await this.villacuervosService.getPendingPlays();
      const now = new Date();
      
      // Limpiar el historial de partidas anunciadas de más de 24 horas para no consumir memoria infinita
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      for (const [id, date] of this.announcedPlays.entries()) {
        if (date < oneDayAgo) {
          this.announcedPlays.delete(id);
        }
      }

      for (const play of plays) {
        const playDate = new Date(play.date);
        const diffMs = playDate.getTime() - now.getTime();

        // Una partida es inminente si empieza en los próximos 5 minutos (añadimos 30s de margen por desfases en el cron)
        const isSoon = diffMs > 0 && diffMs <= (5 * 60 * 1000 + 30000);

        if (isSoon && !this.announcedPlays.has(play.id)) {
          console.log(`[VigilanteService] Partida inminente detectada: "${play.name}" (ID: ${play.id}) programada para las ${playDate.toLocaleTimeString('es-ES')}`);
          
          // Formatear el anuncio
          const playDateFormatted = playDate.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
          });
          const playLink = `https://villacuervos.es/partidas/la-secta/${play.id}/${play.slug}`;
          const format = play.in_person ? 'Presencial 🏢' : 'Online 💻';
          const script = play.script_name ? ` - Guion: ${play.script_name}` : '';

          const message = `📢 ¡Partida inminente en La Secta! 🎮\n\n` +
            `La partida "${play.name}" comenzará a las ${playDateFormatted} (${format}${script}).\n\n` +
            `Detalles e inscripciones aquí 👇\n${playLink}`;

          // Publicar en Twitter (únicamente Twitter, como requiere el usuario)
          const success = await this.socialMediaService.publishToTwitter(message);
          
          if (success) {
            this.announcedPlays.set(play.id, playDate);
            console.log(`[VigilanteService] Anuncio publicado y registrado en memoria para la partida ${play.id}.`);
          } else {
            console.error(`[VigilanteService] No se pudo publicar el anuncio para la partida ${play.id}. Se reintentará en el próximo ciclo si sigue en rango.`);
          }
        }
      }
    } catch (error) {
      console.error('[VigilanteService] Error durante la comprobación de partidas:', error);
    }
  }
}
