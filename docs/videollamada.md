# Videollamada de la sala (cámaras y micrófonos)

La sala usa **LiveKit** (código abierto) como servidor de vídeo: cada navegador le manda su cámara y su micrófono una vez y LiveKit se los reparte a los demás. Nuestro servidor (Express) no toca el vídeo: solo dice quién puede entrar y qué puede emitir (firma un pase) y ajusta los permisos cuando cambia la sala.

Sin las variables `LIVEKIT_*` la sala funciona igual, sin cámaras ni micrófonos.

## Reglas

- **Mesa**: todos ven y oyen; emiten jugadores y narradores (los visitantes solo miran y escuchan). **De noche no hay cámaras** (solo voz).
- **Conversaciones privadas** (voz y vídeo, de 2 en adelante): se entra **por invitación y solo al aceptarla** (también quien invita, si no estaba ya en una). De día invita cualquier jugador o narrador; **de noche, solo el narrador**. Si quien invita ya está en una conversación, quien acepta entra en ella. Quien conversa no emite en la mesa ni la oye: su cámara y su voz solo llegan a los de su conversación (también de noche). Al cambiar de noche a día (o al revés) se terminan todas y caducan las invitaciones.
- **Visitantes**: pueden entrar a escuchar cualquier conversación (sin invitación). Ni hablan ni se ven, y los jugadores no saben que están: solo lo ven los narradores.
- Cámara y micrófono **empiezan apagados**: se encienden con los botones de la cabecera o con las teclas **,** (cámara) y **.** (micrófono). El navegador pide permiso la primera vez.

## En desarrollo (Windows)

1. Descargar `livekit_<versión>_windows_amd64.zip` de https://github.com/livekit/livekit/releases y descomprimir `livekit-server.exe`.
2. Arrancarlo en modo desarrollo: `livekit-server --dev` (escucha en el puerto 7880, claves `devkey` / `secret`).
3. En el `.env` del servidor (con `127.0.0.1` y no `localhost`: Node no prueba IPv4 si `localhost` resuelve a IPv6):
   ```
   LIVEKIT_URL=ws://127.0.0.1:7880
   LIVEKIT_API_KEY=devkey
   LIVEKIT_API_SECRET=secret
   ```
4. Para probar con varias personas en un solo ordenador: varias ventanas (o perfiles) de Chrome; con `--use-fake-device-for-media-stream` cada una tiene una cámara falsa.

## En el VPS (2 núcleos, 4 GB: suficiente)

LiveKit no recodifica vídeo, solo lo reenvía, así que gasta poca CPU; lo que más gasta es ancho de banda. Con los cuadros pequeños de la mesa cada cámara viaja a baja resolución (unos 150 kbps por cámara y persona que la ve): una partida de 18 personas son unos 40–50 Mbps de salida mientras dura.

1. **Docker** instalado.
2. **Claves**: inventar una clave y un secreto largos (p. ej. `openssl rand -hex 32`). Ponerlos en el `.env` del servidor de la web y en `deploy/livekit/.env`:
   ```
   LIVEKIT_API_KEY=…
   LIVEKIT_API_SECRET=…
   ```
3. **Arrancar LiveKit**: `cd deploy/livekit && docker compose up -d`.
4. **Subdominio con TLS**: un registro DNS `video.<dominio>` al VPS; copiar `deploy/livekit/nginx-video.conf` (cambiando el dominio), activarlo y `sudo certbot --nginx -d video.<dominio>`.
5. **Cortafuegos** (p. ej. `ufw`): abrir `7881/tcp`, `50000:50200/udp` y `3478/udp` (además del 80/443 que ya tiene la web).
6. **`.env` del servidor de la web**:
   ```
   LIVEKIT_URL=wss://video.<dominio>
   LIVEKIT_API_URL=http://127.0.0.1:7880
   ```
   y reiniciar el servidor. En el arranque, si falta algo, dice: «Sin LIVEKIT_URL… la sala no tendrá cámaras ni micrófonos».
7. **Probar**: entrar en la sala desde dos dispositivos, uno de ellos con datos móviles (4G), y encender cámara y micrófono.

## Dónde está en el código

- Servidor: `server/src/config/videollamada.ts` (configuración), `services/videollamada/` (`ProveedorVideo` es la interfaz; `LiveKitProveedor`, su implementación; `VideollamadaService`, las reglas y los pases), `services/conversaciones/ConversacionService.ts` (las conversaciones privadas) y `sockets/salaSocket.ts` (eventos `video:pase` y `conversacion:invitar`, `responder`, `cancelar`, `escuchar` y `salir`).
- Cliente: `client/src/sala/useVideollamada.ts` (conexión con LiveKit, qué se emite y dónde), `ControlesVideo.tsx` (botones de la cabecera y avisos de permisos), `PanelInvitaciones.tsx`, `PanelConversaciones.tsx` (quién conversa con quién), `VentanaConversacion.tsx` (la llamada privada, grande o pequeña y movible), `PanelComunicaciones.tsx` (Preferencias > Comunicaciones) y `VideoPista.tsx`.
