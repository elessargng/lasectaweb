import { Cog, Gem } from 'lucide-react';
import { otrosTestigos, type Reliquia } from '../../data/reliquias';

const titulo = 'text-xl font-display text-theme-main flex items-center gap-2 mb-4';

/** «Ana», «Ana y Bea», «Ana, Bea y Carla». */
const lista = (nombres: string[]) =>
  nombres.length <= 1 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** «29 de octubre de 2026, 18:00», tal cual se guardó (sin pasar por la zona horaria de quien lo ve). */
const fechaLarga = (fecha: string) => {
  const [dia, hora] = fecha.split('T');
  const [a, m, d] = dia.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}, ${hora}`;
};

/**
 * La pestaña Reliquias: cada una, en su relicario. Solo sale con alguna (ver
 * PanelEstadisticas): no se ven las que no se tienen, porque no se pueden conseguir.
 */
const Reliquias = ({ reliquias, username }: { reliquias: Reliquia[]; username: string }) => (
  <section aria-labelledby="estadisticas-reliquias">
    <h3 id="estadisticas-reliquias" className={titulo}>
      <Gem className="h-5 w-5" aria-hidden="true" /> Reliquias
    </h3>
    <p className="-mt-2 mb-6 max-w-prose text-sm italic text-on-surface-muted">
      Recuerdos de momentos que no volverán. No se ganan jugando: se tienen por haber estado allí.
    </p>
    <ul className="grid gap-5">
      {reliquias.map((r) => (
        <TarjetaReliquia key={r.id} reliquia={r} otros={otrosTestigos(r, username)} />
      ))}
    </ul>
  </section>
);

const TarjetaReliquia = ({ reliquia, otros }: { reliquia: Reliquia; otros: string[] }) => (
  <li className="reliquia panel-premium flex flex-col items-center gap-6 rounded-sm px-6 py-8 text-center sm:flex-row sm:items-center sm:gap-8 sm:px-8 sm:text-left">
    <span aria-hidden="true" className="corner corner-tl" />
    <span aria-hidden="true" className="corner corner-tr" />
    <span aria-hidden="true" className="corner corner-bl" />
    <span aria-hidden="true" className="corner corner-br" />
    {/* El relicario: un medallón de latón con dos engranajes (dos narradores sintéticos) */}
    <span aria-hidden="true" className="reliquia-medallon">
      <span className="reliquia-brillo" />
      <Cog className="reliquia-engranaje reliquia-engranaje-grande" strokeWidth={1.25} />
      <Cog className="reliquia-engranaje reliquia-engranaje-pequeno" strokeWidth={1.25} />
    </span>
    <div className="min-w-0 flex-1">
      <p aria-hidden="true" className="font-ui text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-gold">
        Reliquia
      </p>
      <h4 className="text-gilded mt-1 font-display text-3xl leading-tight text-balance">{reliquia.nombre}</h4>
      <p className="mt-1.5 font-ui text-xs tracking-[0.12em] text-on-surface-muted">
        <time dateTime={reliquia.fecha}>{fechaLarga(reliquia.fecha)}</time>
      </p>
      <span aria-hidden="true" className="hairline-gold my-3 block sm:mr-auto sm:max-w-xs" />
      <p className="font-body text-lg italic leading-snug text-on-surface">{reliquia.descripcion}</p>
      {otros.length > 0 && (
        <p className="mt-4 text-sm text-on-surface-muted">
          <span className="font-ui text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-gold/80">Junto a</span>{' '}
          {lista(otros)}
        </p>
      )}
    </div>
  </li>
);

export default Reliquias;
