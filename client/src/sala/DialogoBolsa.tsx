import { TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Dialog from '../components/Dialog';
import { useAriaLive } from './avisosConfig';
import { botonPrincipal, botonSecundario } from './estilos';
import { contarBolsa, gruposViajeros, TIPOS_REPARTO, useFichas } from './fichas';
import type { PersonajeMostrado } from './guiones';
import PestanasDialogo from './PestanasDialogo';
import RejillaFichas from './RejillaFichas';
import { problemasDelReparto, repartoAjustado } from './comprobarReparto';
import type { SalaDistribucion, SalaResultado } from './useSala';

interface DialogoBolsaProps {
  bolsa: string[];
  /** El reparto de la partida; sus jugadores son los asientos a los que se reparte (sin viajeros). */
  distribucion: SalaDistribucion;
  /** Los NPCs en juego (el Centinela altera la preparación). */
  npcs: string[];
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  /** Se han repartido los personajes. */
  onRepartido: () => void;
  onCerrar: () => void;
}

/** Nombres en una lista, cada uno en su idioma: «Barón, Fang Gu y Ermitaño». */
const ListaNombres = ({ personajes }: { personajes: PersonajeMostrado[] }) => (
  <>
    {personajes.map((p, i) => (
      <span key={p.id}>
        {i > 0 && (i === personajes.length - 1 ? ' y ' : ', ')}
        <span lang={p.nombre.lang} className="font-semibold">
          {p.nombre.texto}
        </span>
      </span>
    ))}
  </>
);

/**
 * Preparar la bolsa (narradores): los aldeanos, forasteros, esbirros y demonios
 * del guion, por tipos, cada uno un botón que lo mete o lo saca (pulsado, si
 * está dentro). Cada tipo dice cuántos lleva de los que tocan («2/5»), pero no
 * se limita: el narrador mete lo que quiera. Con tantos como jugadores (sin
 * viajeros), «Asignar personajes» los reparte al azar entre los asientos.
 *
 * Los personajes que alteran la preparación (el Barón…) llevan una señal; si hay
 * alguno en la bolsa, abajo sale «¡Setup modificado!». Antes de repartir se pide
 * confirmación: con alguno de esos, para recordar cuáles son (¿se ha ajustado la
 * bolsa?); sin ninguno, si las cuentas no son las de por defecto.
 */
const DialogoBolsa = ({ bolsa, distribucion, npcs, pedir, onRepartido, onCerrar }: DialogoBolsaProps) => {
  const { personajes, viajeros, porId } = useFichas();
  // Guion (aldeanos… demonios) o Viajeros (todos, del guion o no)
  const [pestana, setPestana] = useState('guion');
  const viajerosEnBolsa = bolsa.filter((id) => porId.get(id)?.tipo === 'traveller').length;
  // Una ficha por jugador y otra por cada viajero metido (no cuentan para el reparto por tipos)
  const fichasParaRepartir = distribucion.jugadores + viajerosEnBolsa;
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  // Pidiendo confirmación antes de repartir (en el propio diálogo, en lugar de los botones)
  const [confirmando, setConfirmando] = useState(false);
  const confirmacionRef = useRef<HTMLParagraphElement>(null);
  const ariaLiveErrores = useAriaLive('errores');
  const ariaLiveBolsa = useAriaLive('bolsa');
  const enBolsa = contarBolsa(bolsa, (id) => porId.get(id)?.tipo);
  const completa = fichasParaRepartir > 0 && bolsa.length === fichasParaRepartir;

  const conPreparacion = bolsa.map((id) => porId.get(id)).filter((p): p is PersonajeMostrado => !!p?.preparacion);
  // Lo que no cuadra con el reparto de la partida, con lo que alteran la preparación (el
  // Barón, el Ermitaño…, y el Centinela si es NPC). Sin reparto (menos de 5), nada.
  const problemas = problemasDelReparto(enBolsa, distribucion, [...bolsa, ...npcs]);
  // Lo que toca de cada tipo, con el Barón y compañía ya contados (cambia al meterlos o sacarlos)
  const ajustado = repartoAjustado(distribucion, [...bolsa, ...npcs]);

  // Al pedir confirmación, el foco va a la pregunta (los botones de antes desaparecen)
  useEffect(() => {
    if (confirmando) confirmacionRef.current?.focus();
  }, [confirmando]);

  // Con el Pope: aldeanos y forasteros repetidos (− n + debajo de cada uno que esté dentro)
  const pope = npcs.includes('pope');
  const cambiarCantidad = async (personajeId: string, cantidad: number) => {
    setError('');
    setConfirmando(false);
    const r = await pedir('narrador:bolsaCantidad', { personajeId, cantidad });
    if (!r.ok) setError(r.error);
  };
  const cantidadPope = (p: PersonajeMostrado) =>
    pope && (p.tipo === 'townsfolk' || p.tipo === 'outsider')
      ? {
          valor: bolsa.filter((id) => id === p.id).length,
          max: 5,
          onCambiar: (n: number) => void cambiarCantidad(p.id, n),
        }
      : null;

  const alternar = async (personajeId: string) => {
    setError('');
    setConfirmando(false);
    const r = await pedir('narrador:bolsa', { personajeId });
    if (!r.ok) setError(r.error);
  };

  const repartir = async () => {
    setEnviando(true);
    setError('');
    const r = await pedir('narrador:asignarPersonajes');
    setEnviando(false);
    if (!r.ok) {
      setConfirmando(false);
      setError(r.error);
      return;
    }
    onRepartido();
    onCerrar();
  };

  const asignar = () => {
    if (!completa || enviando) return;
    if (problemas.length > 0) setConfirmando(true);
    else void repartir();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-bolsa-titulo"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded border border-outline-ghost bg-surface shadow-2xl"
      >
        <h2 id="sala-bolsa-titulo" className="px-6 py-4 text-xl font-semibold">
          Preparar la bolsa
        </h2>
        <PestanasDialogo
          idBase="sala-bolsa"
          etiqueta="Personajes"
          pestanas={[
            { id: 'guion', etiqueta: 'Guion' },
            { id: 'viajeros', etiqueta: 'Viajeros', contador: { valor: viajerosEnBolsa, texto: 'en la bolsa' } },
          ]}
          activa={pestana}
          onElegir={setPestana}
        >
          <div className="overflow-y-auto px-6 py-4">
            {pestana === 'viajeros' ? (
              viajeros.length === 0 ? (
                <p className="text-on-surface-muted">No hay viajeros en el catálogo todavía.</p>
              ) : (
                <RejillaFichas
                  idBase="sala-bolsa"
                  grupos={gruposViajeros(viajeros, personajes).map((g) => ({ ...g, color: 'text-theme-main' }))}
                  marca={(p) => ({ pulsada: bolsa.includes(p.id) })}
                  onPulsar={(p) => void alternar(p.id)}
                />
              )
            ) : (
              <RejillaFichas
                idBase="sala-bolsa"
                grupos={TIPOS_REPARTO.map(({ tipo, clave, nombre, color }) => {
                  const total = ajustado[clave];
                  return {
                    tipo,
                    color,
                    personajes: personajes.filter((p) => p.tipo === tipo),
                    titulo: (
                      <>
                        {nombre}{' '}
                        <span className="font-normal tabular-nums text-on-surface-muted">
                          {enBolsa[tipo] ?? 0}
                          {total !== null && `/${total}`}
                        </span>
                      </>
                    ),
                  };
                })}
                marca={(p) => ({ pulsada: bolsa.includes(p.id) })}
                cantidad={cantidadPope}
                onPulsar={(p) => void alternar(p.id)}
                conPreparacion
              />
            )}
          </div>
        </PestanasDialogo>

        {/* Setup modificado: se avisa al momento al meter (o sacar) uno de esos personajes */}
        <div aria-live={ariaLiveBolsa} className="px-6">
          {conPreparacion.length > 0 && (
            <p className="mt-3 flex items-start gap-2 rounded border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-400" />
              <span>
                <strong>¡Setup modificado!</strong> Alteran la preparación: <ListaNombres personajes={conPreparacion} />.
              </span>
            </p>
          )}
        </div>
        <div aria-live={ariaLiveErrores} className="px-6">
          {error && <p className="pt-3 text-sm text-red-400">{error}</p>}
        </div>

        {confirmando ? (
          <div className="flex flex-col gap-3 border-t border-outline-ghost px-6 py-3">
            <p ref={confirmacionRef} tabIndex={-1} className="text-sm focus:outline-none">
              La bolsa no cuadra con el reparto de la partida{conPreparacion.length > 0 && (
                <> (con <ListaNombres personajes={conPreparacion} />)</>
              )}
              : {problemas.join('; ')}. ¿Seguro que quieres continuar?
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setConfirmando(false)} className={botonSecundario}>
                Volver a la bolsa
              </button>
              <button
                type="button"
                onClick={() => void repartir()}
                aria-disabled={enviando}
                className={botonPrincipal}
              >
                Asignar de todos modos
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-outline-ghost px-6 py-3">
            <p id="sala-bolsa-cuenta" className="mr-auto text-sm text-on-surface-muted">
              En la bolsa: <span className="tabular-nums">{bolsa.length}</span> de {fichasParaRepartir}
            </p>
            <button
              type="button"
              onClick={asignar}
              aria-disabled={!completa || enviando}
              aria-describedby="sala-bolsa-cuenta"
              className={`${botonPrincipal} aria-disabled:cursor-not-allowed aria-disabled:opacity-50`}
            >
              Asignar personajes
            </button>
            <button type="button" onClick={onCerrar} className={botonSecundario}>
              Cerrar
            </button>
          </div>
        )}
      </Dialog>
    </div>,
    document.body,
  );
};

export default DialogoBolsa;
