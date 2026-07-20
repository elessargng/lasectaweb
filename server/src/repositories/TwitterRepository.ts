import crypto from 'crypto';

export class TwitterRepository {
  private get consumerKey(): string {
    return process.env.TWITTER_CLIENT_ID || '';
  }

  private get consumerSecret(): string {
    return process.env.TWITTER_CLIENT_SECRET || '';
  }

  private get accessToken(): string {
    return process.env.TWITTER_TOKEN || '';
  }

  private get tokenSecret(): string {
    return process.env.TWITTER_TOKEN_SECRET || '';
  }

  private percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  }

  async publish(message: string): Promise<boolean> {
    const consumerKey = this.consumerKey;
    const consumerSecret = this.consumerSecret;
    const accessToken = this.accessToken;
    const tokenSecret = this.tokenSecret;

    if (!consumerKey || !consumerSecret || !accessToken || !tokenSecret) {
      console.warn('[TwitterRepository] No se puede publicar: faltan credenciales en .env.');
      return false;
    }

    console.log(`[TwitterRepository] Publicando tweet mediante OAuth 1.0a: "${message}"`);

    try {
      const url = 'https://api.twitter.com/2/tweets';
      const method = 'POST';

      // 1. Parámetros de OAuth 1.0a
      const oauthParams = {
        oauth_consumer_key: consumerKey,
        oauth_token: accessToken,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_version: '1.0'
      };

      // 2. Ordenar y codificar parámetros
      const parameterString = Object.keys(oauthParams)
        .sort()
        .map(key => `${this.percentEncode(key)}=${this.percentEncode((oauthParams as any)[key])}`)
        .join('&');

      // 3. Crear base string para la firma
      const baseString = [
        method.toUpperCase(),
        this.percentEncode(url),
        this.percentEncode(parameterString)
      ].join('&');

      // 4. Crear la clave de firma
      const signingKey = `${this.percentEncode(consumerSecret)}&${this.percentEncode(tokenSecret)}`;

      // 5. Calcular la firma HMAC-SHA1
      const signature = crypto
        .createHmac('sha1', signingKey)
        .update(baseString)
        .digest('base64');

      // 6. Añadir firma a los parámetros de cabecera
      const headerParams = {
        ...oauthParams,
        oauth_signature: signature
      };

      // 7. Generar cabecera Authorization
      const authHeader = 'OAuth ' + Object.keys(headerParams)
        .sort()
        .map(key => `${this.percentEncode(key)}="${this.percentEncode((headerParams as any)[key])}"`)
        .join(', ');

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: message })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TwitterRepository] Error al publicar tweet (HTTP ${response.status}): ${errorText}`);
        return false;
      }

      const responseData = await response.json();
      console.log('[TwitterRepository] Tweet publicado con éxito:', responseData);
      return true;
    } catch (error) {
      console.error('[TwitterRepository] Error de red o inesperado al publicar tweet:', error);
      return false;
    }
  }
}
