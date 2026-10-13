import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { botonPrincipal } from './estilos';
import Cabecera from './Cabecera';
import DialogoPreferencias, { type Pestana } from './DialogoPreferencias';
import ListaParticipantes from './ListaParticipantes';
import MenuMano from './MenuMano';
import MenuNarrador from './MenuNarrador';
import Mesa, { type FocoAsiento, type TamanosMesa } from './Mesa';
import type { OpcionMenu } from './MenuDesplegable';
import MenuUsuario from './MenuUsuario';
import PanelAtajos from './PanelAtajos';
import PanelInterfaz from './PanelInterfaz';
import PanelPartida from './PanelPartida';
import PanelUsuario, { type ResultadoPerfil } from './PanelUsuario';
import RegistroVotaciones from './RegistroVotaciones';
import ZonaNarradores from './ZonaNarradores';
import { esAtajo, puedeUsarAtajo, useAtajos } from './atajos';
import { avisosDeCambio } from './avisosSala';
import { setSonidosActivos, tocarCampanada, tocarTic } from './sonidos';
import { ID_BOTON_MENU_NARRADOR, ID_SIN_NARRADOR, idNombreNarrador } from './ids';
import { getPerfil, limpiarNombre, setPerfil } from './invitado';
import { usePreferencias } from './preferencias';
import { tamanoFichaAuto, tamanoNarradorAuto } from './tamanosAutomaticos';
import { nombreMano } from './formasMano';
import { useSala, type FormaMano, type SalaConfiguracion, type SalaEstado } from './useSala';

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

/**
 * La sala por dentro: en la cabecera, a la derecha, las opciones del narrador
 * (si narras), el botón de participantes y el menú del usuario; debajo, los
 * narradores arriba a la izquierda y la mesa con los asientos.
 *
 * Avisos:
 * - Cambios que hacen otros (narradores que entran, salen o cambian; quién se
 *   sienta o se levanta; ver avisosSala): solo para el lector, sin interrumpir
 *   (en pantalla ya se ven). Los que provoca uno mismo no se avisan: ya sabe lo
 *   que ha hecho; si le afectan (hacerse narrador, dejarlo), el foco pasa a su
 *   cuadro o al aviso de que no hay narrador.
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
    // ¿Este cambio viene de una acción propia? (La marca vale para el siguiente cambio.)
    const propia = accionPropiaRef.current;
    accionPropiaRef.current = false;

    // Votación: cada ficha por la que pasa la aguja suena (campanada si vota, tic si no).
    const votoAntes = anterior.nominacion?.votacion;
    const votoAhora = nuevo.nominacion?.votacion;
    if (votoAhora) {
      for (const id of votoAhora.orden.slice(votoAntes?.paso ?? 0, votoAhora.paso)) {
        if (typeof votoAhora.resultados[id] === 'number') tocarCampanada();
        else tocarTic();
      }
    }

    // Lo que han hecho otros (ver avisosSala); lo propio no se avisa: ya se sabe.
    const avisos = propia ? [] : avisosDeCambio(anterior, nuevo);

    // El narrador cambia el grimorio para los jugadores: se avisa a los jugadores,
    // que son a quienes les cambia lo que ven.
    const grimorio = nuevo.configuracion.grimorioJugadores;
    const juego = nuevo.participantes.some((p) => p.id === nuevo.yo && p.rol === 'jugador');
    if (grimorio !== anterior.configuracion.grimorioJugadores && juego) {
      avisos.push(
        grimorio
          ? 'El narrador ha activado el grimorio para los jugadores: puedes cambiar las fichas en el tuyo.'
          : 'El narrador ha desactivado el grimorio para los jugadores.',
      );
    }
    if (avisos.length) setAnuncio(avisos.join(' '));

    // Cambio de narradores: si es fruto de la propia acción y le afecta a uno, el
    // foco va a su cuadro o al aviso de que no hay; si no, se rescata si se pierde.
    const ids = (e: SalaEstado) =>
      narradoresDe(e)
        .map((p) => p.id)
        .join();
    if (ids(anterior) === ids(nuevo)) return;
    const meAfecta =
      narradoresDe(anterior).some((p) => p.id === nuevo.yo) !== narradoresDe(nuevo).some((p) => p.id === nuevo.yo);
    if (propia && meAfecta) focoPendienteRef.current = destinoFoco(nuevo);
    else rescatarFocoRef.current = destinoFoco(nuevo);
  };

  const cuentaId = cuenta?.id ?? null;
  // Nombre y avatar elegidos para la sala (vacío: los de siempre); se recuerdan en el navegador.
  const [alias, setAlias] = useState(() => getPerfil('alias', cuentaId));
  const [avatarElegido, setAvatarElegido] = useState(() => getPerfil('avatar', cuentaId));
  const { estado, conexion, desfaseReloj, pedir, reconectar } = useSala(
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
  useEffect(() => setSonidosActivos(preferencias.sonidos), [preferencias.sonidos]);
  // Tamaños con los que pinta la mesa (automáticos o no), para la vista previa.
  const [tamanosMesa, setTamanosMesa] = useState<TamanosMesa | null>(null);
  // Tamaño de la ventana, para el tamaño automático de los cuadros de narrador.
  const [ventana, setVentana] = useState(() => ({ ancho: window.innerWidth, alto: window.innerHeight }));
  useEffect(() => {
    const alCambiar = () => setVentana({ ancho: window.innerWidth, alto: window.innerHeight });
    window.addEventListener('resize', alCambiar);
    return () => window.removeEventListener('resize', alCambiar);
  }, []);

  // Opciones del menú de usuario según tu situación en la sala (hacerse narrador,
  // levantarse, dejar de narrar); salen si el servidor las permite.
  const focoAsientoRef = useRef<FocoAsiento | null>(null);
  const levantarme = async () => {
    const mio = estado?.asientos.find((a) => a.ocupante === estado.yo);
    if (mio) focoAsientoRef.current = { asientoId: mio.id, sentado: false };
    const r = await pedir('sala:levantarse');
    if (!r.ok) {
      focoAsientoRef.current = null;
      setAviso(r.error);
    }
    return r.ok;
  };
  const dejarDeNarrar = async () => {
    const r = await pedirPropio('narrador:dejar');
    if (!r.ok) setAviso(r.error);
    return r.ok;
  };
  const hacermeNarrador = async () => {
    const r = await pedirPropio('sala:hacerseNarrador');
    if (!r.ok) setAviso(r.error);
    return r.ok;
  };
  const puedeHacermeNarrador = !!estado?.acciones.includes('sala:hacerseNarrador');
  const puedeLevantarme = !!estado?.acciones.includes('sala:levantarse');
  const puedeDejarDeNarrar = !!estado?.acciones.includes('narrador:dejar');
  // Levantar o bajar la mano y elegir su forma (jugadores): con el atajo de
  // teclado o desde el menú de la mano de la cabecera. Como no cambia nada donde
  // está el foco, se confirma al lector.
  const puedeLevantarMano = !!estado?.acciones.includes('sala:levantarMano');
  const manoLevantada = !!yo?.manoLevantada;
  const alternarMano = async () => {
    const levantada = !manoLevantada;
    const r = await pedir('sala:levantarMano', { levantada });
    if (r.ok) setAnuncio(levantada ? 'Has levantado la mano.' : 'Has bajado la mano.');
    else setAviso(r.error);
    // false: el menú (si se ha usado) se cierra y el foco vuelve a su botón.
    return false;
  };
  const elegirFormaMano = async (forma: FormaMano) => {
    const r = await pedir('sala:elegirMano', { forma });
    if (r.ok) setAnuncio(`Tu mano: ${nombreMano(forma).toLocaleLowerCase('es')}.`);
    else setAviso(r.error);
    return false;
  };
  const { atajos, cambiar: cambiarAtajo } = useAtajos();
  // El atajo tiene prioridad sobre el control con el foco: se escucha en la fase
  // de captura (antes que él) y no se deja seguir, ni al pulsar ni al soltar
  // (con Espacio, algunos navegadores pulsan el botón al soltar).
  useEffect(() => {
    if (!puedeLevantarMano) return;
    const esElAtajo = (e: KeyboardEvent) => esAtajo(e, atajos.levantarMano) && puedeUsarAtajo(e);
    const alPulsar = (e: KeyboardEvent) => {
      if (!esElAtajo(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) alternarMano();
    };
    const alSoltar = (e: KeyboardEvent) => {
      if (!esElAtajo(e)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', alPulsar, true);
    window.addEventListener('keyup', alSoltar, true);
    return () => {
      window.removeEventListener('keydown', alPulsar, true);
      window.removeEventListener('keyup', alSoltar, true);
    };
  });

  const enLaSala: OpcionMenu[] = [
    ...(puedeHacermeNarrador
      ? [{ id: 'sala:hacerseNarrador', etiqueta: 'Hacerse narrador', elegir: hacermeNarrador }]
      : []),
    ...(puedeLevantarme ? [{ id: 'sala:levantarse', etiqueta: 'Levantarse del asiento', elegir: levantarme }] : []),
    ...(puedeDejarDeNarrar ? [{ id: 'narrador:dejar', etiqueta: 'Dejar de ser narrador', elegir: dejarDeNarrar }] : []),
  ];

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
    let guardado = avatar;
    if (avatar.startsWith('data:')) {
      // Imagen propia nueva: se sube y queda su ruta
      const r = await pedir('sala:subirAvatar', { imagen: avatar });
      if (!r.ok) return { ...r, campo: 'avatar' };
      guardado = r.valor ?? '';
    } else if (avatar !== avatarElegido) {
      const r = await pedir('sala:cambiarAvatar', { avatar: avatar || null });
      if (!r.ok) return { ...r, campo: 'avatar' };
    }
    if (guardado !== avatarElegido) {
      setPerfil('avatar', cuentaId, guardado);
      setAvatarElegido(guardado);
    }
    return { ok: true, avatar: guardado };
  };

  const configurarPartida = async (cambios: Partial<SalaConfiguracion>) => {
    const r = await pedir('narrador:configurarPartida', cambios);
    if (!r.ok) setAviso(r.error);
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
      contenido: (
        <PanelInterfaz
          nombre={yo?.nombre ?? (alias || cuenta?.username || invitado || '')}
          preferencias={preferencias}
          tamanosMesa={tamanosMesa}
          onCambiar={cambiarPreferencias}
        />
      ),
    },
    {
      id: 'atajos',
      etiqueta: 'Atajos de teclado',
      conControles: true,
      contenido: <PanelAtajos atajos={atajos} onCambiar={cambiarAtajo} />,
    },
    {
      id: 'comunicaciones',
      etiqueta: 'Comunicaciones',
      contenido: <p className="text-on-surface-muted">Todavía no hay opciones.</p>,
    },
    // Solo si el servidor deja configurar la partida (narradores).
    ...(estado?.acciones.includes('narrador:configurarPartida')
      ? [
          {
            id: 'partida',
            etiqueta: 'Partida',
            conControles: true,
            contenido: <PanelPartida configuracion={estado.configuracion} onCambiar={configurarPartida} />,
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
  // Si lo ha expulsado un narrador no hay botón: el foco va al mensaje.
  const volverRef = useRef<HTMLButtonElement>(null);
  const expulsadoRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (conexion === 'expulsada') volverRef.current?.focus();
    if (conexion === 'expulsadaPorNarrador') expulsadoRef.current?.focus();
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

  // Los tamaños elegidos llegan a los cuadros (CuadroAvatar) y a las fichas
  // (FichaRedonda, Mesa) por estas variables CSS.
  // Fuera de la mesa (cuadros de narrador): automático según la ventana. La mesa
  // pone los suyos (ver Mesa).
  const avatarFuera = preferencias.avatarAuto
    ? tamanoNarradorAuto(ventana.ancho, ventana.alto)
    : preferencias.tamanoAvatar;
  const tamanos = {
    '--sala-avatar': `${avatarFuera}px`,
    '--sala-ficha': `${preferencias.fichaAuto ? tamanoFichaAuto(avatarFuera) : preferencias.tamanoFicha}px`,
    '--sala-ficha-distancia': `${preferencias.distanciaFicha / 100}`,
  } as CSSProperties;

  return (
    <div className="contents" style={tamanos}>
      <Cabecera
        derecha={
          <div className="flex items-center gap-2">
            {conexion === 'expulsadaPorNarrador' && (
          <p ref={expulsadoRef} tabIndex={-1} className="focus:outline-none">
            Un narrador te ha expulsado de la sala.
          </p>
        )}

        {estado && (
              <MenuNarrador
                estado={estado}
                pedir={pedirPropio}
                onAsientos={() => setEditandoAsientos((v) => !v)}
              />
            )}
            {puedeLevantarMano && yo && (
              <MenuMano
                forma={yo.formaMano}
                levantada={manoLevantada}
                onAlternar={alternarMano}
                onElegirForma={elegirFormaMano}
              />
            )}
            {/* Solo narradores: el servidor solo les manda a ellos el registro */}
            {yo?.rol === 'narrador' && estado && <RegistroVotaciones votaciones={estado.votaciones} />}
            {estado && <ListaParticipantes participantes={estado.participantes} yo={estado.yo} />}
            <MenuUsuario
              nombre={yo?.nombre ?? (alias || cuenta?.username || invitado || '')}
              avatar={yo?.avatar ?? null}
              conCuenta={!!cuenta}
              onPreferencias={() => setPreferenciasAbiertas(true)}
              enLaSala={enLaSala}
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
          {(conexion === 'conectando' || conexion === 'reconectando' || conexion === 'error') && (
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
                manual={{ avatar: preferencias.tamanoAvatar, ficha: preferencias.tamanoFicha }}
                auto={{ avatar: preferencias.avatarAuto, ficha: preferencias.fichaAuto }}
                onTamanos={setTamanosMesa}
                editando={editando}
                grimorio={yo?.rol === 'jugador' && estado.configuracion.grimorioJugadores}
                pedir={pedirPropio}
                onError={setAviso}
                onAnuncio={setAnuncio}
                focoAsientoRef={focoAsientoRef}
                onTerminar={terminarAsientos}
                desfaseReloj={desfaseReloj}
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
