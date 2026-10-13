import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { botonPrincipal } from './estilos';
import Cabecera from './Cabecera';
import DialogoPreferencias, { type Pestana } from './DialogoPreferencias';
import ListaParticipantes from './ListaParticipantes';
import MenuNarrador from './MenuNarrador';
import Mesa from './Mesa';
import MenuUsuario from './MenuUsuario';
import PanelInterfaz from './PanelInterfaz';
import PanelUsuario, { type ResultadoPerfil } from './PanelUsuario';
import ZonaNarradores from './ZonaNarradores';
import { ID_BOTON_MENU_NARRADOR, ID_SIN_NARRADOR, idNombreNarrador } from './ids';
import { getPerfil, limpiarNombre, setPerfil } from './invitado';
import { usePreferencias } from './preferencias';
import { useSala, type SalaEstado, type SalaParticipante } from './useSala';

interface SalaJuegoProps {
  /** Con cuenta: su token, su id de usuario (para recordar su perfil en la sala) y su avatar en la web. */
  cuenta: { token: string; id: string; username: string; avatar: string | null } | null;
  /** Nombre de invitado; se ignora si hay `cuenta`. */
  invitado: string | null;
  /** Hay que mover el foco al título (se acaba de entrar). */
  enfocar: boolean;
  /** Cerrar sesión (con cuenta) o salir de la sala (invitado). */
  onSalir: () => void;
  /** Como invitado, el nombre ya lo usa otro en la sala: hay que elegir otro. */
  onNombreOcupado: (nombre: string) => void;
}

const MENSAJE_CONEXION = {
  conectando: 'Conectando con la sala…',
  reconectando: 'Se ha perdido la conexión. Reconectando…',
  error: 'No se pudo entrar en la sala. Recarga la página para intentarlo de nuevo.',
};

const narradoresDe = (estado: SalaEstado) => estado.participantes.filter((p) => p.rol === 'narrador');

/** A dónde va el foco tras un cambio de narradores: el cuadro de uno mismo, el primero, o el aviso de que no hay. */
function destinoFoco(estado: SalaEstado): string {
  const narradores = narradoresDe(estado);
  const yo = narradores.find((n) => n.id === estado.yo);
  const destino = yo ?? narradores[0];
  return destino ? idNombreNarrador(destino.id) : ID_SIN_NARRADOR;
}

/** Frases para el lector sobre quién entra y sale de la narración. */
function avisosNarradores(anterior: SalaEstado, nuevo: SalaEstado): string[] {
  const antes = narradoresDe(anterior);
  const ahora = narradoresDe(nuevo);
  const ids = (lista: SalaParticipante[]) => new Set(lista.map((p) => p.id));
  const idsAntes = ids(antes);
  const idsAhora = ids(ahora);
  const avisos: string[] = [];
  for (const p of ahora.filter((p) => !idsAntes.has(p.id))) {
    avisos.push(p.id === nuevo.yo ? 'Ahora eres narrador.' : `${p.nombre} ahora narra.`);
  }
  if (ahora.length === 0 && antes.length > 0) {
    avisos.push('La sala se ha quedado sin narrador.');
  } else {
    for (const p of antes.filter((p) => !idsAhora.has(p.id))) {
      avisos.push(p.id === nuevo.yo ? 'Ya no eres narrador.' : `${p.nombre} ya no narra.`);
    }
  }
  return avisos;
}

/**
 * La sala por dentro: en la cabecera, a la derecha, las opciones del narrador
 * (si narras), el botón de participantes y el menú del usuario; debajo, los
 * narradores arriba a la izquierda y la mesa con los asientos.
 *
 * Avisos:
 * - Cambios de narradores que hacen otros: solo para el lector (en pantalla ya
 *   se ven en los cuadros). Los que hace uno mismo no se avisan: ya sabe lo que
 *   ha hecho; si le afectan (hacerse narrador, dejarlo), el foco pasa a su cuadro
 *   o al aviso de que no hay narrador.
 * - Errores y estado de la conexión: a la vista, flotando abajo para no mover
 *   la página, y también para el lector.
 */
const SalaJuego = ({ cuenta, invitado, enfocar, onSalir, onNombreOcupado }: SalaJuegoProps) => {
  const tituloRef = useRef<HTMLHeadingElement>(null);
  // Errores de las acciones, a la vista; se van solos al rato.
  const [aviso, setAviso] = useState('');
  // Cambios que hacen otros, solo para el lector.
  const [anuncio, setAnuncio] = useState('');
  // El próximo cambio de narradores viene de una acción propia.
  const accionPropiaRef = useRef(false);
  // id al que llevar el foco cuando se pinte el nuevo estado.
  const focoPendienteRef = useRef<string | null>(null);
  // El foco estaba en un control que puede desaparecer con el cambio.
  const rescatarFocoRef = useRef<string | null>(null);

  const alCambiar = (anterior: SalaEstado | null, nuevo: SalaEstado) => {
    if (!anterior) return;
    const ids = (e: SalaEstado) =>
      narradoresDe(e)
        .map((p) => p.id)
        .join();
    if (ids(anterior) === ids(nuevo)) return;

    const propia = accionPropiaRef.current;
    accionPropiaRef.current = false;
    const meAfecta =
      narradoresDe(anterior).some((p) => p.id === nuevo.yo) !== narradoresDe(nuevo).some((p) => p.id === nuevo.yo);

    if (propia && meAfecta) focoPendienteRef.current = destinoFoco(nuevo);
    else rescatarFocoRef.current = destinoFoco(nuevo);
    setAnuncio(propia ? '' : avisosNarradores(anterior, nuevo).join(' '));
  };

  const cuentaId = cuenta?.id ?? null;
  // Nombre y avatar elegidos para la sala (vacío: los de siempre); se recuerdan en el navegador.
  const [alias, setAlias] = useState(() => getPerfil('alias', cuentaId));
  const [avatarElegido, setAvatarElegido] = useState(() => getPerfil('avatar', cuentaId));
  const { estado, conexion, pedir, reconectar } = useSala(
    cuenta?.token ?? null,
    cuenta ? null : invitado,
    { alias, avatar: avatarElegido },
    {
      alCambiar,
      alNombreOcupado: () => onNombreOcupado(alias || invitado || ''),
    },
  );
  const yo = estado?.participantes.find((p) => p.id === estado.yo);

  const { preferencias, cambiar: cambiarPreferencias } = usePreferencias();

  // Edición de asientos (narradores): botones en el centro de la mesa.
  const [editandoAsientos, setEditandoAsientos] = useState(false);
  const editando = editandoAsientos && !!estado?.acciones.includes('narrador:asientos');
  const terminarAsientos = () => {
    setEditandoAsientos(false);
    document.getElementById(ID_BOTON_MENU_NARRADOR)?.focus();
  };
  const [preferenciasAbiertas, setPreferenciasAbiertas] = useState(false);

  // Pestaña Usuario: se mandan solo los cambios, primero el nombre.
  const guardarPerfil = async (nombre: string, avatar: string): Promise<ResultadoPerfil> => {
    const nuevoAlias = limpiarNombre(nombre);
    if (nuevoAlias !== alias) {
      const r = await pedir('sala:cambiarNombre', { nombre: nuevoAlias });
      if (!r.ok) return { ...r, campo: 'nombre' };
      setPerfil('alias', cuentaId, nuevoAlias);
      setAlias(nuevoAlias);
    }
    if (avatar !== avatarElegido) {
      const r = await pedir('sala:cambiarAvatar', { avatar: avatar || null });
      if (!r.ok) return { ...r, campo: 'avatar' };
      setPerfil('avatar', cuentaId, avatar);
      setAvatarElegido(avatar);
    }
    return { ok: true };
  };

  const pestanasPreferencias: Pestana[] = [
    {
      id: 'usuario',
      etiqueta: 'Usuario',
      conControles: true,
      contenido: (
        <PanelUsuario
          nombreActual={yo?.nombre ?? alias}
          avatarElegido={avatarElegido}
          cuenta={cuenta && { avatar: cuenta.avatar }}
          onGuardar={guardarPerfil}
        />
      ),
    },
    {
      id: 'interfaz',
      etiqueta: 'Interfaz',
      conControles: true,
      contenido: <PanelInterfaz preferencias={preferencias} onCambiar={cambiarPreferencias} />,
    },
    {
      id: 'comunicaciones',
      etiqueta: 'Comunicaciones',
      contenido: <p className="text-on-surface-muted">Todavía no hay opciones.</p>,
    },
    // Solo para quien narra.
    ...(yo?.rol === 'narrador'
      ? [
          {
            id: 'partida',
            etiqueta: 'Partida',
            contenido: <p className="text-on-surface-muted">Todavía no hay opciones.</p>,
          },
        ]
      : []),
  ];

  const pedirPropio = async (accion: string, datos?: unknown) => {
    setAviso('');
    accionPropiaRef.current = true;
    const r = await pedir(accion, datos);
    if (!r.ok) accionPropiaRef.current = false;
    return r;
  };

  useEffect(() => {
    if (enfocar) tituloRef.current?.focus();
  }, [enfocar]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(''), 6000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  // Expulsada: la sala desaparece de esta ventana. El foco va al botón para volver,
  // que lleva el motivo como descripción (por eso ese mensaje no va en aria-live).
  const volverRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (conexion === 'expulsada') volverRef.current?.focus();
  }, [conexion]);

  // Tras pintar un cambio de narradores: llevar el foco a donde toca, o
  // recuperarlo si el control que lo tenía ha desaparecido.
  useEffect(() => {
    const pendiente = focoPendienteRef.current;
    const rescate = rescatarFocoRef.current;
    focoPendienteRef.current = null;
    rescatarFocoRef.current = null;
    const perdido = document.activeElement === document.body || !document.activeElement;
    const destino = pendiente ?? (perdido ? rescate : null);
    if (destino) document.getElementById(destino)?.focus();
  });

  // El tamaño de avatar elegido llega a todos los cuadros (CuadroAvatar) por esta variable.
  const tamanoAvatar = { '--sala-avatar': `${preferencias.tamanoAvatar}px` } as CSSProperties;

  return (
    <div className="contents" style={tamanoAvatar}>
      <Cabecera
        derecha={
          <div className="flex items-center gap-2">
            {estado && (
              <MenuNarrador
                estado={estado}
                pedir={pedirPropio}
                onError={setAviso}
                onAsientos={() => setEditandoAsientos((v) => !v)}
              />
            )}
            {estado && <ListaParticipantes participantes={estado.participantes} yo={estado.yo} />}
            <MenuUsuario
              nombre={yo?.nombre ?? (alias || cuenta?.username || invitado || '')}
              avatar={yo?.avatar ?? null}
              conCuenta={!!cuenta}
              onPreferencias={() => setPreferenciasAbiertas(true)}
              onSalir={onSalir}
            />
          </div>
        }
      />

      {/* La sala ocupa todo el ancho: los narradores van arriba a la izquierda */}
      <main className="flex-1 w-full px-4 py-6">
        {/* Oculto a la vista (ocupaba sitio), pero es el título de la página para el lector y el destino del foco al entrar */}
        <h1 ref={tituloRef} tabIndex={-1} className="sr-only">
          Sala de juego
        </h1>

        <div aria-live="polite" className="sr-only">
          {anuncio}
        </div>

        {/* Flota abajo: no empuja el contenido ni genera scroll */}
        <div
          aria-live="polite"
          className="pointer-events-none fixed bottom-4 left-1/2 z-40 flex w-[min(90vw,32rem)] -translate-x-1/2 flex-col gap-2"
        >
          {conexion !== 'conectada' && conexion !== 'expulsada' && (
            <p className="rounded border border-outline-ghost bg-surface px-4 py-2 text-center text-on-surface-muted shadow-lg">
              {MENSAJE_CONEXION[conexion]}
            </p>
          )}
          {aviso && (
            <p className="rounded border border-red-400/60 bg-surface px-4 py-2 text-center shadow-lg">{aviso}</p>
          )}
        </div>

        {conexion === 'expulsada' && (
          <div className="flex flex-col items-start gap-4">
            <p id="sala-expulsada">
              Has entrado en la sala desde otra ventana o dispositivo, así que aquí se ha cerrado.
            </p>
            <button
              ref={volverRef}
              type="button"
              onClick={reconectar}
              aria-describedby="sala-expulsada"
              className={botonPrincipal}
            >
              Volver a entrar aquí
            </button>
          </div>
        )}

        {estado && (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <ZonaNarradores estado={estado} pedir={pedirPropio} onError={setAviso} />
            <div className="min-w-0 flex-1">
              <Mesa
                estado={estado}
                editando={editando}
                pedir={pedir}
                onError={setAviso}
                onTerminar={terminarAsientos}
              />
            </div>
          </div>
        )}
      </main>

      {preferenciasAbiertas && (
        <DialogoPreferencias pestanas={pestanasPreferencias} onCerrar={() => setPreferenciasAbiertas(false)} />
      )}
    </div>
  );
};

export default SalaJuego;
