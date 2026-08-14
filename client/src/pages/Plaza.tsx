import Button from '../components/Button';
import { Flame } from 'lucide-react';
import PageHeader from '../components/PageHeader';

const Plaza = () => {
  return (
    <div className="flex flex-col w-full min-h-[80vh]">
      <PageHeader
        title="La Plaza"
        imageSrc="/profile_banner_wide.jpg"
        imageAlt="La Plaza"
        maxWidthClass="max-w-3xl"
      />

      {/* Main Container */}
      <div className="max-w-3xl w-full mx-auto px-0 md:px-8 py-4 md:py-10 relative z-20 -mt-20 flex-1">
        <div className="bg-transparent md:bg-surface border-0 md:border border-transparent md:border-outline-ghost rounded-none md:rounded shadow-none md:shadow-2xl px-4 py-6 md:p-10 relative text-center flex flex-col items-center">
          <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
            {/* Pulsing glow background */}
            <div className="absolute inset-0 bg-theme-main/10 rounded-full animate-ping pointer-events-none"></div>
            <div className="w-20 h-20 bg-theme-container/40 border border-theme-main/40 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(177,156,217,0.15)]">
              <Flame className="w-10 h-10 text-theme-main animate-pulse" />
            </div>
          </div>

          <h3 className="text-3xl font-display text-theme-main mb-4">Sección en Construcción</h3>

          <p className="text-on-surface-muted text-lg font-body leading-relaxed max-w-lg mb-8">
            Los escribas e iniciados de La Secta están preparando este espacio en las profundidades de las Crónicas. Muy pronto se abrirán las puertas para debatir, proponer y votar los edictos que gobernarán el Culto.
          </p>

          <div className="flex gap-4">
            <Button to="/" variant="primary" className="px-8 py-3">
              Volver al Atrio
            </Button>
            <Button to="/cronicas" variant="outline" className="px-8 py-3">
              Ver las Crónicas
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Plaza;
