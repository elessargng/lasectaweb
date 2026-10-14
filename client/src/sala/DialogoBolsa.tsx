import { TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Dialog from '../components/Dialog';
import { urlDelServidor } from '../utils/api';
import { useAriaLive } from './avisosConfig';
import { botonPrincipal, botonSecundario } from './estilos';
import { contarBolsa, iconoDe, TIPOS_REPARTO, useFichas } from './fichas';
import type { PersonajeMostrado } from './guiones';
import type { SalaDistribucion, SalaResultado } from './useSala';

interface DialogoBolsaProps {
  bolsa: string[];
  /** El reparto de la partida; sus jugadores son los asientos a los que se reparte (sin viajeros). */
  distribucion: SalaDistribucion;
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
const DialogoBolsa = ({ bolsa, distribucion, pedir, onRepartido, onCerrar }: DialogoBolsaProps) => {
  const fichasParaRepartir = distribucion.jugadores;
  const { personajes, porId } = useFichas();
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
  // Los tipos cuyas cuentas no son las de por defecto (si hay reparto, con 5 o más jugadores)
  const distintos = TIPOS_REPARTO.filter(({ tipo, clave }) => {
    const total = distribucion[clave];
    return total !== null && (enBolsa[tipo] ?? 0) !== total;
  });

  // Al pedir confirmación, el foco va a la pregunta (los botones de antes desaparecen)
  useEffect(() => {
    if (confirmando) confirmacionRef.current?.focus();
  }, [confirmando]);

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
    if (conPreparacion.length > 0 || distintos.length > 0) setConfirmando(true);
    else void repartir();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-bolsa-titulo"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded border border-outline-ghost bg-surface shadow-2xl"
      >
        <h2 id="sala-bolsa-titulo" className="border-b border-outline-ghost px-6 py-4 text-xl font-semibold">
          Preparar la bolsa
        </h2>
        <div className="overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-5">
            {TIPOS_REPARTO.map(({ tipo, clave, nombre, color }) => {
              const grupo = personajes.filter((p) => p.tipo === tipo);
              if (grupo.length === 0) return null;
              const total = distribucion[clave];
              return (
                <section key={tipo} aria-labelledby={`sala-bolsa-${tipo}`}>
                  <h3 id={`sala-bolsa-${tipo}`} className={`mb-2 text-sm font-semibold uppercase tracking-wide ${color}`}>
                    {nombre}{' '}
                    <span className="font-normal tabular-nums text-on-surface-muted">
                      {enBolsa[tipo] ?? 0}
                      {total !== null && `/${total}`}
                    </span>
                  </h3>
                  <ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
                    {grupo.map((p) => {
                      const icono = iconoDe(p, null);
                      const dentro = bolsa.includes(p.id);
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            aria-pressed={dentro}
                            onClick={() => void alternar(p.id)}
                            className="relative flex w-full flex-col items-center gap-1 rounded border border-transparent p-2 text-center text-sm opacity-60 hover:border-theme-main/60 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main aria-pressed:border-theme-main aria-pressed:bg-theme-container aria-pressed:opacity-100"
                          >
                            {p.preparacion && (
                              // Altera la preparación: señal de advertencia (el lector lo oye en el texto de abajo)
                              <TriangleAlert size={18} className="absolute right-1 top-1 text-amber-400" />
                            )}
                            {icono ? (
                              <img src={urlDelServidor(icono)} alt="" className="h-14 w-14 object-contain" loading="lazy" />
                            ) : (
                              <span aria-hidden="true" className="h-14 w-14 rounded-full border border-outline-ghost" />
                            )}
                            <span lang={p.nombre.lang}>{p.nombre.texto}</span>
                            {p.preparacion && <span className="sr-only"> (altera la preparación)</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>

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
              {conPreparacion.length > 0 ? (
                <>
                  Estos personajes alteran la preparación: <ListaNombres personajes={conPreparacion} />. ¿Has ajustado ya
                  la bolsa?
                </>
              ) : (
                <>
                  La bolsa no tiene el reparto por defecto (
                  {distintos
                    .map(({ tipo, clave, nombre }) => `${nombre.toLocaleLowerCase('es')}: ${enBolsa[tipo] ?? 0} de ${distribucion[clave]}`)
                    .join('; ')}
                  ). ¿Seguro que quieres continuar?
                </>
              )}
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
                {conPreparacion.length > 0 ? 'Sí, asignar personajes' : 'Asignar de todos modos'}
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
