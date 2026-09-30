import { Resend } from 'resend';

export async function sendConfirmationEmail(email: string, username: string, token: string): Promise<void> {
  const clientUrlRaw = process.env.VITE_CLIENT_URL || 'http://localhost:5173';
  const clientUrl = clientUrlRaw.endsWith('/') ? clientUrlRaw.slice(0, -1) : clientUrlRaw;
  const confirmationUrl = `${clientUrl}/confirmar?token=${token}`;

  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  // If no Resend API key configured or it is the placeholder, log the verification link in development mode
  if (!resendApiKey || resendApiKey === 're_xxxxxxxxx') {
    console.log('\n==================================================');
    console.log('📧 [EMAIL DE CONFIRMACIÓN - SIMULACIÓN RESEND]');
    console.log(`Para: ${username} (${email})`);
    console.log(`Enlace de confirmación: ${confirmationUrl}`);
    console.log('Nota: Configura un RESEND_API_KEY real en .env para enviar correos reales.');
    console.log('==================================================\n');
    return;
  }

  const resend = new Resend(resendApiKey);

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ccc; border-radius: 5px; background-color: #121212; color: #ffffff;">
      <h2 style="color: #e53e3e; text-align: center;">Portal de La Secta</h2>
      <p>Hola <strong>${username}</strong>,</p>
      <p>Tu ritual de registro ha comenzado. Para completar el enlace de tu cuenta y tener acceso total a las Crónicas, por favor confirma tu dirección de correo electrónico haciendo clic en el siguiente botón:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${confirmationUrl}" style="background-color: #e53e3e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Confirmar Cuenta</a>
      </div>
      <p style="color: #a0aec0; font-size: 14px;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
      <p style="color: #a0aec0; font-size: 14px; word-break: break-all;">${confirmationUrl}</p>
      <hr style="border: 0; border-top: 1px solid #444; margin: 20px 0;" />
      <p style="color: #718096; font-size: 12px; text-align: center;">Este es un correo automático, por favor no respondas a él.</p>
    </div>
  `;

  try {
    const { error } = await resend.emails.send({
      from: emailFrom,
      to: email,
      subject: 'Activa tu alma en La Secta - Enlace de Confirmación',
      html: htmlContent
    });

    if (error) {
      console.error('Error al enviar el correo con Resend:', JSON.stringify(error, null, 2));
      throw new Error(`No se pudo enviar el correo de confirmación: ${error.message || 'Error desconocido'} (${error.name || 'Desconocido'})`);
    }
  } catch (error: any) {
    console.error('Excepción al enviar correo con Resend:', error);
    throw error;
  }
}

// ------------------------------------------------------ Correos a la comunidad

/** Resend admite como mucho 100 correos por envío por lotes. */
const BATCH_SIZE = 100;

function clientBaseUrl(): string {
  const raw = process.env.VITE_CLIENT_URL || 'http://localhost:5173';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

/** El título y los textos los escribe la comunidad: no se meten en HTML sin escapar. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Envía el mismo correo a toda la comunidad, uno por destinatario.
 *
 * Va por lotes y no con todos en el campo "to": así nadie ve las direcciones de
 * los demás. Lanza un error si el envío falla, para que quien llama pueda
 * reintentarlo.
 */
async function sendToCommunity(
  recipients: string[],
  subject: string,
  html: string,
  text: string
): Promise<void> {
  if (recipients.length === 0) return;

  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  if (!resendApiKey || resendApiKey === 're_xxxxxxxxx') {
    console.log('\n==================================================');
    console.log(`📧 [CORREO A LA COMUNIDAD - SIMULACIÓN RESEND] ${subject}`);
    console.log(`Destinatarios: ${recipients.length}`);
    console.log(text);
    console.log('==================================================\n');
    return;
  }

  const resend = new Resend(resendApiKey);
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    const { error } = await resend.batch.send(
      chunk.map((to) => ({ from: emailFrom, to, subject, html, text }))
    );
    if (error) {
      throw new Error(`No se pudo enviar "${subject}": ${error.message ?? 'error desconocido'}`);
    }
  }
}

/**
 * Avisa de una incidencia en el registro de La Plaza a quienes administran y a
 * quienes hayan activado los avisos del vigilante en su perfil.
 *
 * No va solo a quien administra: es parte de la garantía del sistema, porque
 * un aviso que solo llega a una persona se puede silenciar sin que nadie lo
 * note.
 */
export async function sendPlazaIntegrityAlert(
  recipients: string[],
  incidents: Array<{ proposalId: string; title?: string; problem?: string }>
): Promise<void> {
  const clientUrl = clientBaseUrl();
  const describe = (i: { problem?: string }) =>
    i.problem ?? 'La comprobación no ha superado la verificación.';

  const text = [
    'El vigilante ha encontrado una incidencia al comprobar el registro de votaciones:',
    '',
    ...incidents.map((i) => `- "${i.title ?? i.proposalId}": ${describe(i)}`)
  ].join('\n');

  const incidentHtml = incidents
    .map(
      (i) => `
      <li style="margin-bottom: 12px;">
        <strong style="color:#dfd8c8;">${escapeHtml(i.title ?? i.proposalId)}</strong><br />
        <span style="color:#a69f92;">${escapeHtml(describe(i))}</span><br />
        <a href="${clientUrl}/plaza/${encodeURIComponent(i.proposalId)}" style="color:#b19cd9;">Ver la votación</a>
      </li>`
    )
    .join('');

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #5f1e1e; border-radius: 5px; background-color: #121212; color: #dfd8c8;">
      <h2 style="color: #b19cd9; text-align: center;">La Plaza · Aviso de integridad</h2>
      <p>El vigilante ha encontrado una incidencia al comprobar el registro de votaciones:</p>
      <ul style="padding-left: 18px;">${incidentHtml}</ul>
      <p style="color:#a69f92; font-size: 14px;">Puedes descargar el registro completo de cualquier votación desde su página de resultados y comprobarlo por tu cuenta.</p>
      <hr style="border: 0; border-top: 1px solid #3a322c; margin: 20px 0;" />
      <p style="color: #7d766b; font-size: 12px; text-align: center;">Recibes este aviso porque administras La Secta o activaste los avisos del vigilante en tu perfil.</p>
    </div>
  `;

  try {
    await sendToCommunity(
      recipients,
      'La Plaza · Aviso de integridad del registro de votaciones',
      htmlContent,
      text
    );
  } catch (err) {
    console.error('[MAILER] Error al enviar el aviso de integridad de La Plaza:', err);
  }
}

/** Lo que se anuncia de una votación al cerrarse. */
export interface PlazaResultAnnouncement {
  proposalId: string;
  title: string;
  outcome: 'aprobada' | 'rechazada';
  closeReason?: 'plazo' | 'via_rapida';
  closedAt: Date;
  si: number;
  no: number;
  participantes: number;
  finalHash: string;
  /** Si el registro superaba la verificación en el momento de anunciarlo. */
  verified: boolean;
  verificationProblem?: string;
  /** Qué cambia en el Códice, si es un edicto. */
  change?: {
    action: 'crear' | 'modificar' | 'derogar';
    /** Norma afectada ("norma 3.2") o destino ("sección 3 · Título"). */
    where: string;
    body?: string;
    bullets?: string[];
  };
}

/**
 * Anuncia a toda la comunidad el resultado de una votación.
 *
 * Además de informar, es un ancla: cada buzón guarda una copia de la huella
 * final y, en los edictos, del texto aprobado, fuera del alcance del servidor.
 * Si algún día la web mostrara otra cosa, cualquier correo lo demostraría.
 *
 * Quien no recibe todavía los avisos del vigilante encuentra además una
 * invitación a activarlos: cuantas más personas los reciban, más difícil es
 * que un problema pase desapercibido.
 *
 * Lanza un error si el envío falla, para que se pueda reintentar.
 */
export async function sendPlazaResultAnnouncement(
  recipients: Array<{ email: string; receivesAlerts: boolean }>,
  result: PlazaResultAnnouncement
): Promise<void> {
  const subject = `La Plaza · ${result.outcome === 'aprobada' ? 'Aprobada' : 'Rechazada'}: ${result.title}`;
  const withAlerts = recipients.filter((r) => r.receivesAlerts).map((r) => r.email);
  const withoutAlerts = recipients.filter((r) => !r.receivesAlerts).map((r) => r.email);

  if (withAlerts.length > 0) {
    const mail = buildResultAnnouncement(result, false);
    await sendToCommunity(withAlerts, subject, mail.html, mail.text);
  }
  if (withoutAlerts.length > 0) {
    const mail = buildResultAnnouncement(result, true);
    await sendToCommunity(withoutAlerts, subject, mail.html, mail.text);
  }
}

function buildResultAnnouncement(
  result: PlazaResultAnnouncement,
  inviteToAlerts: boolean
): { html: string; text: string } {
  const clientUrl = clientBaseUrl();
  const url = `${clientUrl}/plaza/${encodeURIComponent(result.proposalId)}`;
  const approved = result.outcome === 'aprobada';
  const reason = result.closeReason === 'via_rapida' ? 'por vía rápida' : 'al vencer el plazo';
  const closedAt = result.closedAt.toISOString();

  const change = result.change;
  const changeText = !change
    ? undefined
    : !approved
      ? `No cambia el Códice (proponía ${change.action} la ${change.where}).`
      : change.action === 'derogar'
        ? `Queda derogada la ${change.where}.`
        : change.action === 'crear'
          ? `Nueva norma en la ${change.where}:`
          : `Nuevo texto de la ${change.where}:`;
  // El texto aprobado va completo: es lo que ancla el Códice en cada buzón.
  const approvedText = approved && change && change.action !== 'derogar' ? change : undefined;

  const text = [
    `Votación: ${result.title}`,
    `Resultado: ${result.outcome.toUpperCase()} ${reason}`,
    `Votos: ${result.si} a favor, ${result.no} en contra (${result.participantes} participantes)`,
    `Cerrada: ${closedAt}`,
    ...(changeText ? ['', changeText] : []),
    ...(approvedText
      ? ['', approvedText.body ?? '', ...(approvedText.bullets ?? []).map((b) => `  - ${b}`)]
      : []),
    '',
    `Huella final: ${result.finalHash}`,
    ...(result.verified
      ? []
      : ['', `ATENCIÓN: el registro no superaba la verificación al anunciarlo. ${result.verificationProblem ?? ''}`]),
    '',
    'Guarda este correo: es tu propia copia del resultado. Con la huella final y el',
    'archivo del registro puedes comprobar la votación cuando quieras.',
    ...(inviteToAlerts
      ? [
          '',
          'El vigilante comprueba cada hora que las votaciones y el Códice están en orden.',
          `Si quieres recibir sus avisos, actívalos en tu perfil: ${clientUrl}/profile`,
          `Qué es el vigilante: ${clientUrl}/plaza/vigilante`
        ]
      : []),
    '',
    url
  ].join('\n');

  const accent = approved ? '#7fb77e' : '#c96b6b';
  const bulletsHtml = (approvedText?.bullets ?? []).map((b) => `<li>${escapeHtml(b)}</li>`).join('');
  const approvedTextHtml = approvedText
    ? `<blockquote style="margin: 0 0 16px; padding: 10px 14px; border-left: 3px solid #b19cd9; background:#1b1917; white-space: pre-wrap;">${escapeHtml(approvedText.body ?? '')}${bulletsHtml ? `<ul style="margin: 8px 0 0; padding-left: 18px;">${bulletsHtml}</ul>` : ''}</blockquote>`
    : '';
  const inviteHtml = inviteToAlerts
    ? `<div style="border: 1px solid #3a322c; background:#1b1917; border-radius: 4px; padding: 12px 14px; margin: 16px 0;">
        <p style="margin: 0 0 6px;"><strong>¿Quieres recibir los avisos del vigilante?</strong></p>
        <p style="margin: 0; color:#a69f92; font-size: 14px;">El vigilante comprueba cada hora que las votaciones y el Códice están en orden. Si lo activas en <a href="${clientUrl}/profile" style="color:#b19cd9;">tu perfil</a>, solo te escribirá si algo no cuadra. <a href="${clientUrl}/plaza/vigilante" style="color:#b19cd9;">Qué es el vigilante</a></p>
      </div>`
    : '';
  const warningHtml = result.verified
    ? ''
    : `<p style="color:#c96b6b;"><strong>Atención:</strong> el registro no superaba la verificación al anunciarlo. ${escapeHtml(result.verificationProblem ?? '')}</p>`;

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #3a322c; border-radius: 5px; background-color: #121212; color: #dfd8c8;">
      <h2 style="color: #b19cd9; text-align: center;">La Plaza · Resultado de la votación</h2>
      <p style="font-size: 18px; margin-bottom: 4px;"><strong>${escapeHtml(result.title)}</strong></p>
      <p style="margin-top: 0;">
        <strong style="color:${accent};">${approved ? 'Aprobada' : 'Rechazada'}</strong>
        <span style="color:#a69f92;"> ${reason} · ${result.si} a favor, ${result.no} en contra · ${result.participantes} participantes</span>
      </p>
      ${changeText ? `<p>${escapeHtml(changeText)}</p>` : ''}
      ${approvedTextHtml}
      <p style="color:#a69f92; font-size: 13px; margin-bottom: 4px;">Huella final del registro:</p>
      <p style="font-family: monospace; font-size: 13px; word-break: break-all; background:#1b1917; padding: 8px; margin-top: 0;">${result.finalHash}</p>
      ${warningHtml}
      <p style="color:#a69f92; font-size: 14px;"><strong>Guarda este correo:</strong> es tu propia copia del resultado. Con la huella final y el archivo del registro puedes comprobar la votación cuando quieras.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${url}" style="background-color: #b19cd9; color: #121212; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Ver la votación y descargar el registro</a>
      </div>
      ${inviteHtml}
      <hr style="border: 0; border-top: 1px solid #3a322c; margin: 20px 0;" />
      <p style="color: #7d766b; font-size: 12px; text-align: center;">Este correo se envía a toda la comunidad al cerrarse cada votación. Cerrada el ${closedAt}.</p>
    </div>
  `;

  return { html: htmlContent, text };
}
