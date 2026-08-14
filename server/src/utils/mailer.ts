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
