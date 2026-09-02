import React, { useState, useEffect, type FormEvent } from 'react';
import type {
  LibraryPovMatch,
  LibraryAccessLevel,
  CharacterType,
  InitialAlignment,
  PovInputDTO
} from '../../utils/libraryApi';
import {
  X,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Layers,
  User,
  Link as LinkIcon
} from 'lucide-react';
import Button from '../Button';
import AccessLevelSelector from '../AccessLevelSelector';

interface PovMatchFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  sectionId?: string;
  match?: LibraryPovMatch | null;
  sectionsList: Array<{ id: string; name: string; depth: number }>;
  onClose: () => void;
  onSave: (data: {
    sectionId: string;
    title: string;
    description?: string;
    accessLevel: LibraryAccessLevel;
    allowedRoles: string[];
    povs: PovInputDTO[];
  }) => Promise<void>;
}

const emptyPov = (): PovInputDTO => ({
  id: undefined,
  name: '',
  sectaUserId: '',
  initialAlignment: 'bueno',
  character: '',
  characterType: 'aldeano',
  youtubeUrl: ''
});

export const PovMatchFormModal: React.FC<PovMatchFormModalProps> = ({
  isOpen,
  mode,
  sectionId = '',
  match = null,
  sectionsList,
  onClose,
  onSave
}) => {
  const [title, setTitle] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState(sectionId);
  const [description, setDescription] = useState('');
  const [accessLevel, setAccessLevel] = useState<LibraryAccessLevel>('all');
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [povs, setPovs] = useState<PovInputDTO[]>([emptyPov()]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && match) {
        setTitle(match.title);
        setSelectedSectionId(match.sectionId);
        setDescription(match.description || '');
        setAccessLevel(match.accessLevel || 'all');
        setAllowedRoles(match.allowedRoles || []);
        setPovs(
          (match.povs || []).map(p => ({
            id: p.id,
            name: p.name,
            sectaUserId: p.sectaUserId || '',
            initialAlignment: p.initialAlignment,
            character: p.character,
            characterType: p.characterType,
            youtubeUrl: p.youtubeUrl,
            position: p.position
          }))
        );
      } else {
        setTitle('');
        setSelectedSectionId(sectionId);
        setDescription('');
        setAccessLevel('all');
        setAllowedRoles([]);
        setPovs([emptyPov()]);
      }
      setFormError(null);
    }
  }, [isOpen, mode, match, sectionId]);

  if (!isOpen) return null;

  const handleAddPov = () => {
    setPovs(prev => [...prev, emptyPov()]);
  };

  const handleRemovePov = (index: number) => {
    if (povs.length <= 1) {
      setFormError('La partida debe contener al menos un punto de vista (POV).');
      return;
    }
    setPovs(prev => prev.filter((_, i) => i !== index));
  };

  const handleMovePov = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= povs.length) return;

    setPovs(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleUpdatePovField = (index: number, field: keyof PovInputDTO, value: any) => {
    setPovs(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      
      // Auto-ajuste inteligente de alineamiento si es Demonio o Esbirro
      if (field === 'characterType') {
        if (value === 'demonio' || value === 'esbirro') {
          copy[index].initialAlignment = 'malo';
        } else if (value === 'narrador') {
          copy[index].initialAlignment = 'na';
        } else if (copy[index].initialAlignment === 'na') {
          copy[index].initialAlignment = 'bueno';
        }
      }
      return copy;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError('El título de la partida es obligatorio.');
      return;
    }

    if (!selectedSectionId) {
      setFormError('Debes seleccionar una carpeta/sección de destino.');
      return;
    }

    if (povs.length === 0) {
      setFormError('Debes añadir al menos un punto de vista.');
      return;
    }

    // Validar cada POV
    for (let i = 0; i < povs.length; i++) {
      const p = povs[i];
      if (!p.name.trim()) {
        setFormError(`El nombre del jugador en el POV #${i + 1} es obligatorio.`);
        return;
      }
      if (!p.character.trim()) {
        setFormError(`El personaje en el POV #${i + 1} es obligatorio.`);
        return;
      }
      if (!p.youtubeUrl.trim()) {
        setFormError(`El enlace de YouTube en el POV #${i + 1} es obligatorio.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      await onSave({
        sectionId: selectedSectionId,
        title: title.trim(),
        description: description.trim() || undefined,
        accessLevel,
        allowedRoles: accessLevel === 'roles' ? allowedRoles : [],
        povs
      });
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar la partida POV.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in zoom-in duration-200">
      <div className="bg-theme-container border border-outline-ghost rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Cabecera del modal */}
        <div className="flex items-center justify-between p-5 border-b border-outline-ghost/50 bg-surface-container/40 shrink-0">
          <h3 className="text-xl font-display text-on-surface font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-theme-main" />
            <span>{mode === 'create' ? 'Nueva Partida POV (Multicámara)' : 'Editar Partida POV'}</span>
          </h3>
          <button onClick={onClose} className="text-on-surface-muted hover:text-on-surface">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 flex flex-col gap-6">
          {formError && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
              {formError}
            </div>
          )}

          {/* DATOS GENERALES DE LA PARTIDA */}
          <div className="flex flex-col gap-4 bg-surface-container/30 p-4 rounded-xl border border-outline-ghost/40">
            <h4 className="text-xs font-display uppercase tracking-wider font-bold text-theme-main flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>Información General de la Partida</span>
            </h4>

            <div>
              <label className="block text-xs font-display tracking-wider text-on-surface-muted uppercase mb-1">
                Título de la Partida
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ej: Partida #42 - Problemas en Villa Cuervos (Narrador + 8 Jugadores)"
                className="w-full bg-surface-container border border-outline-ghost rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:border-theme-main transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-display tracking-wider text-on-surface-muted uppercase mb-1">
                Carpeta / Sección de Destino
              </label>
              <select
                value={selectedSectionId}
                onChange={e => setSelectedSectionId(e.target.value)}
                className="w-full bg-surface-container border border-outline-ghost rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:border-theme-main transition-colors text-sm"
              >
                {sectionsList.map(sec => (
                  <option key={sec.id} value={sec.id}>
                    {'\u00A0'.repeat(sec.depth * 4)} {sec.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-display tracking-wider text-on-surface-muted uppercase mb-1">
                Descripción (Opcional)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Resumen del guion, detalles de la partida o edición..."
                className="w-full bg-surface-container border border-outline-ghost rounded-xl px-4 py-2 text-on-surface focus:outline-none focus:border-theme-main transition-colors text-sm"
              />
            </div>

            <AccessLevelSelector
              accessLevel={accessLevel}
              allowedRoles={allowedRoles}
              onAccessLevelChange={setAccessLevel}
              onAllowedRolesChange={setAllowedRoles}
            />
          </div>

          {/* LISTA DINÁMICA DE POVs */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-display uppercase tracking-wider font-bold text-on-surface flex items-center gap-1.5">
                  <User className="w-4 h-4 text-theme-main" />
                  <span>Puntos de Vista / Cámaras ({povs.length})</span>
                </h4>
                <p className="text-xs text-on-surface-muted mt-0.5">
                  Añade cada perspectiva con su enlace de YouTube y los datos del jugador/personaje.
                </p>
              </div>

              <Button
                type="button"
                variant="primary"
                onClick={handleAddPov}
                className="flex items-center gap-1.5 text-xs px-3.5 py-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Añadir POV</span>
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              {povs.map((pov, index) => (
                <div
                  key={pov.id || index}
                  className="p-4 rounded-xl bg-surface-container/50 border border-outline-ghost/60 hover:border-theme-main/40 transition-all flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between border-b border-outline-ghost/30 pb-2">
                    <span className="font-display font-semibold text-xs text-theme-main uppercase tracking-wider">
                      Cámara #{index + 1}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMovePov(index, 'up')}
                        className="p-1 rounded text-on-surface-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Subir"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={index === povs.length - 1}
                        onClick={() => handleMovePov(index, 'down')}
                        className="p-1 rounded text-on-surface-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Bajar"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemovePov(index)}
                        className="p-1 rounded text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-1"
                        title="Eliminar este POV"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {/* 1. Nombre del jugador */}
                    <div>
                      <label className="block text-[11px] font-display text-on-surface-muted uppercase mb-1">
                        1. Nombre del Jugador *
                      </label>
                      <input
                        type="text"
                        required
                        value={pov.name}
                        onChange={e => handleUpdatePovField(index, 'name', e.target.value)}
                        placeholder="Ej: Mag1cw, Bostom, Elessar..."
                        className="w-full bg-surface-container border border-outline-ghost rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-theme-main"
                      />
                    </div>

                    {/* 2. Usuario en la secta (opcional) */}
                    <div>
                      <label className="block text-[11px] font-display text-on-surface-muted uppercase mb-1">
                        2. Usuario Secta (Opcional)
                      </label>
                      <input
                        type="text"
                        value={pov.sectaUserId || ''}
                        onChange={e => handleUpdatePovField(index, 'sectaUserId', e.target.value)}
                        placeholder="Ej: @elessargng"
                        className="w-full bg-surface-container border border-outline-ghost rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-theme-main"
                      />
                    </div>

                    {/* 3. Alineamiento Inicial */}
                    <div>
                      <label className="block text-[11px] font-display text-on-surface-muted uppercase mb-1">
                        3. Alineamiento Inicial *
                      </label>
                      <select
                        value={pov.initialAlignment}
                        onChange={e => handleUpdatePovField(index, 'initialAlignment', e.target.value as InitialAlignment)}
                        className="w-full bg-surface-container border border-outline-ghost rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-theme-main"
                      >
                        <option value="bueno">Bueno</option>
                        <option value="malo">Malo</option>
                        <option value="na">N.A (Narrador / Neutral)</option>
                      </select>
                    </div>

                    {/* 4. Personaje */}
                    <div>
                      <label className="block text-[11px] font-display text-on-surface-muted uppercase mb-1">
                        4. Personaje *
                      </label>
                      <input
                        type="text"
                        required
                        value={pov.character}
                        onChange={e => handleUpdatePovField(index, 'character', e.target.value)}
                        placeholder="Ej: Imp, Lavandera, Narrador..."
                        className="w-full bg-surface-container border border-outline-ghost rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-theme-main"
                      />
                    </div>

                    {/* 5. Tipo de personaje */}
                    <div>
                      <label className="block text-[11px] font-display text-on-surface-muted uppercase mb-1">
                        5. Tipo de Personaje *
                      </label>
                      <select
                        value={pov.characterType}
                        onChange={e => handleUpdatePovField(index, 'characterType', e.target.value as CharacterType)}
                        className="w-full bg-surface-container border border-outline-ghost rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-theme-main"
                      >
                        <option value="narrador">Narrador</option>
                        <option value="demonio">Demonio</option>
                        <option value="esbirro">Esbirro</option>
                        <option value="aldeano">Aldeano</option>
                        <option value="forastero">Forastero</option>
                        <option value="viajero">Viajero</option>
                      </select>
                    </div>

                    {/* 6. Enlace a YT */}
                    <div>
                      <label className="block text-[11px] font-display text-on-surface-muted uppercase mb-1 flex items-center gap-1">
                        <LinkIcon className="w-3 h-3" />
                        <span>6. Enlace de YouTube *</span>
                      </label>
                      <input
                        type="url"
                        required
                        value={pov.youtubeUrl}
                        onChange={e => handleUpdatePovField(index, 'youtubeUrl', e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full bg-surface-container border border-outline-ghost rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-theme-main"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Botones de acción inferiores */}
          <div className="flex justify-end gap-3 pt-4 border-t border-outline-ghost/50 sticky bottom-0 bg-theme-container">
            <Button type="button" variant="text" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Guardando...' : 'Guardar Partida POV'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default PovMatchFormModal;
