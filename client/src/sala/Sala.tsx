import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Entrada from './Entrada';
import SalaJuego from './SalaJuego';
import Cabecera from './Cabecera';
import { clearInvitado, getInvitado, setInvitado } from './invitado';

/**
 * La sala de juego. Es una página aparte (sala.html, con su propio bundle y su
 * propio CSS) que se abre siempre en otra ventana desde Rituales y rompe con
 * el resto de la web: cabecera mínima y sin navegación.
 *
 * Se entra con la sesión de la web o, sin ella, como invitado con un nombre;
 * en los dos casos, como visitante.
 *
 * La prioridad es que se pueda jugar con lector de pantalla, así que todo lo
 * decorativo va oculto (alt vacío, aria-hidden) para que no se lea de más.
 */
const Sala = () => {
  const { user, token, isAuthenticated, logout, sessionExpired, dismissSessionExpired } = useAuth();
  const [invitado, setInvitadoState] = useState<string | null>(getInvitado);
  // Solo se mueve el foco al cambiar de pantalla, no al cargar la página.
  const [cambio, setCambio] = useState(false);
  // Error con el que se vuelve a la entrada (nombre de invitado ya en uso).
  const [errorInvitado, setErrorInvitado] = useState('');

  const nombre = isAuthenticated ? user!.username : invitado;
  const dentro = !!nombre;

  // Al entrar (con cuenta o como invitado) o al salir, el foco va al nuevo título.
  const [antes, setAntes] = useState(dentro);
  if (antes !== dentro) {
    setAntes(dentro);
    setCambio(true);
  }

  const entrarComoInvitado = (n: string) => {
    setErrorInvitado('');
    setInvitado(n);
    setInvitadoState(n);
    dismissSessionExpired();
  };

  const nombreOcupado = (n: string) => {
    clearInvitado();
    setInvitadoState(null);
    setErrorInvitado(`Ya hay alguien llamado ${n} en la sala. Elige otro nombre.`);
  };

  const salir = () => {
    if (isAuthenticated) logout();
    else {
      clearInvitado();
      setInvitadoState(null);
    }
  };

  return (
    // Sin fondo propio: se ve el de la sala (el del body, ver sala.css)
    <div className="min-h-screen flex flex-col text-on-surface">
      {dentro ? (
        <SalaJuego
          cuenta={
            isAuthenticated && token
              ? { token, id: user!.id, username: user!.username, avatar: user!.profilePicture || null }
              : null
          }
          invitado={invitado}
          enfocar={cambio}
          onSalir={salir}
          onNombreOcupado={nombreOcupado}
        />
      ) : (
        <>
          <Cabecera />
          <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8">
            <Entrada
              enfocar={cambio}
              aviso={sessionExpired ? 'Tu sesión ha caducado. Vuelve a entrar.' : ''}
              errorInvitado={errorInvitado}
              onInvitado={entrarComoInvitado}
            />
          </main>
        </>
      )}
    </div>
  );
};

export default Sala;
