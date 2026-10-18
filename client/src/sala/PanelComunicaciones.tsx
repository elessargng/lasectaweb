import { useCallback, useEffect, useState } from 'react';
import { useAriaLive } from './avisosConfig';
import { botonPrincipal, campo } from './estilos';
import type { PreferenciasSala } from './preferencias';
import Interruptor from './Interruptor';

interface PanelComunicacionesProps {
  preferencias: PreferenciasSala;
  onCambiar: (cambios: Partial<PreferenciasSala>) => void;
  /** La sala tiene videollamada. */
  hayVideo: boolean;
}


/**
 * Pestaña Comunicaciones: qué cámara y qué micrófono usar (de entrada, los
 * predeterminados del sistema). Con cuenta se recuerda en este navegador; no va a los perfiles.
 *
 * Los navegadores no dicen qué dispositivos hay (ni sus nombres) hasta que se
 * les da permiso: si no hay ninguno o faltan los nombres, se explica por qué y
 * cómo darlo, con un botón que pide el permiso.
 */
const PanelComunicaciones = ({ preferencias, onCambiar, hayVideo }: PanelComunicacionesProps) => {
  const [dispositivos, setDispositivos] = useState<MediaDeviceInfo[] | null>(null);
  const [resultado, setResultado] = useState('');
  const ariaLive = useAriaLive('preferencias');

  const leer = useCallback(() => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setDispositivos([]);
      return;
    }
    navigator.mediaDevices
      .enumerateDevices()
      .then(setDispositivos)
      .catch(() => setDispositivos([]));
  }, []);

  useEffect(() => {
    const md = navigator.mediaDevices;
    // Se leen al abrir la pestaña y cada vez que se conecta o desconecta uno
    const alCambiar = () => leer();
    queueMicrotask(alCambiar);
    md?.addEventListener('devicechange', alCambiar);
    return () => md?.removeEventListener('devicechange', alCambiar);
  }, [leer]);

  // Pedir el permiso: se piden cámara y micrófono y se sueltan enseguida
  const darPermiso = async () => {
    setResultado('');
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() =>
        navigator.mediaDevices.getUserMedia({ audio: true }),
      );
      flujo.getTracks().forEach((t) => t.stop());
      setResultado('Permiso concedido.');
    } catch (e) {
      const nombre = e instanceof Error ? e.name : '';
      setResultado(
        nombre === 'NotAllowedError'
          ? 'El navegador no ha dado permiso. Pulsa el candado junto a la dirección de la página, permite «Cámara» y «Micrófono» y recarga la página.'
          : 'No se encuentra ninguna cámara ni ningún micrófono.',
      );
    }
    leer();
  };

  if (!hayVideo) {
    return <p className="text-on-surface-muted">Esta sala no tiene videollamada: no hay cámaras ni micrófonos que configurar.</p>;
  }
  if (!dispositivos) return <p className="text-on-surface-muted">Buscando cámaras y micrófonos…</p>;

  const camaras = dispositivos.filter((d) => d.kind === 'videoinput');
  const microfonos = dispositivos.filter((d) => d.kind === 'audioinput');
  // Sin permiso, el navegador da los dispositivos sin nombre (o ninguno)
  const sinPermiso = dispositivos.length === 0 || dispositivos.some((d) => (d.kind === 'videoinput' || d.kind === 'audioinput') && !d.label);

  const selector = (
    id: string,
    etiqueta: string,
    lista: MediaDeviceInfo[],
    valor: string,
    cambiar: (v: string) => void,
    nombreGenerico: string,
    vacio: string,
  ) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm">
        {etiqueta}
      </label>
      <select id={id} value={valor} onChange={(e) => cambiar(e.target.value)} className={`${campo} max-w-md`}>
        <option value="">Predeterminado del sistema</option>
        {lista
          .filter((d) => d.deviceId && d.deviceId !== 'default')
          .map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `${nombreGenerico} ${i + 1}`}
            </option>
          ))}
      </select>
      {lista.length === 0 && <p className="text-xs text-gold-bright">{vacio}</p>}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {sinPermiso && (
        <div className="flex flex-col items-start gap-2 rounded border border-gold/45 bg-gold/10 p-3 text-sm">
          <p>
            {camaras.length + microfonos.length === 0
              ? 'No se detecta ninguna cámara ni ningún micrófono.'
              : 'El navegador todavía no ha dado permiso para usar la cámara y el micrófono, así que no se ven sus nombres.'}{' '}
            Puede ser que no haya ninguno conectado o que el navegador no tenga permiso. Pulsa «Dar permiso» y acepta el
            aviso del navegador. Si antes lo rechazaste, pulsa el icono del candado a la izquierda de la dirección de la
            página, en «Cámara» y «Micrófono» elige «Permitir» y recarga la página.
          </p>
          <button type="button" onClick={() => void darPermiso()} className={`${botonPrincipal} text-sm`}>
            Dar permiso
          </button>
        </div>
      )}
      <div aria-live={ariaLive}>{resultado && <p className="text-sm text-on-surface-muted">{resultado}</p>}</div>
      {selector(
        'sala-pref-camara',
        'Cámara',
        camaras,
        preferencias.idCamara,
        (idCamara) => onCambiar({ idCamara }),
        'Cámara',
        'No se detecta ninguna cámara.',
      )}
      {selector(
        'sala-pref-microfono',
        'Micrófono',
        microfonos,
        preferencias.idMicrofono,
        (idMicrofono) => onCambiar({ idMicrofono }),
        'Micrófono',
        'No se detecta ningún micrófono.',
      )}
      <p className="text-xs text-on-surface-muted">
        Se encienden y se apagan con los botones de la cabecera (o con las teclas punto y coma). De noche no hay cámaras,
        salvo en las conversaciones privadas.
      </p>
      <div className="flex flex-col gap-1 border-t border-outline-ghost pt-6">
        <Interruptor
          activo={preferencias.salirConversacionSinNadie}
          onCambiar={(salirConversacionSinNadie) => onCambiar({ salirConversacionSinNadie })}
          describedBy="sala-pref-salir-conversacion-ayuda"
          textoClassName="text-sm"
        >
          Salir automáticamente de una conversación privada si se van los demás
        </Interruptor>
        <p id="sala-pref-salir-conversacion-ayuda" className="text-xs text-on-surface-muted">
          Desactivado, sigues en la conversación hasta que pulses «Salir».
        </p>
      </div>
    </div>
  );
};

export default PanelComunicaciones;
