import { useEffect, useState } from "react";
import type { PublicPlaySchema } from "./CalendarWidget";
import { Calendar, FileText, Users } from "lucide-react";

const API_URL = `${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api'}`;

async function fetchPendingPlays(): Promise<PublicPlaySchema[]> {
  const response = await fetch(`${API_URL}/villacuervos/plays/pending`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

interface WidgetProps {
    miembros: number;
    escrituras: number;
    eventos: number;
}

function Widget({ miembros, escrituras, eventos }: WidgetProps) {
    const stats = [
        { label: 'Miembros', value: miembros, icon: Users },
        { label: 'Escrituras', value: escrituras, icon: FileText },
        { label: 'Eventos', value: eventos, icon: Calendar },
    ];

    // Cada cifra es una ficha redonda con bisel de latón, como las fichas del Grimorio.
    return (
        <ul className="grid grid-cols-3 gap-3 md:gap-6">
            {stats.map((stat) => (
                <li key={stat.label} className="flex flex-col items-center text-center group">
                    <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center bg-[radial-gradient(circle_at_50%_35%,#1f2538_0%,#0d0f17_75%)] border border-theme-main/60 shadow-[inset_0_0_0_4px_rgba(7,8,13,0.9),inset_0_0_0_5px_rgba(212,175,106,0.25),0_10px_25px_-8px_rgba(0,0,0,0.9)] transition-shadow group-hover:shadow-[inset_0_0_0_4px_rgba(7,8,13,0.9),inset_0_0_0_5px_rgba(212,175,106,0.45),0_0_24px_rgba(212,175,106,0.25)]">
                        <stat.icon size={14} className="absolute top-3 md:top-3.5 text-theme-main/70" />
                        <span className="font-display text-3xl md:text-4xl text-gilded leading-none mt-2">{stat.value}</span>
                    </div>
                    <span className="mt-3 font-ui text-[0.7rem] md:text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-muted">{stat.label}</span>
                </li>
            ))}
        </ul>
    );
}

export default function StatsWidget() {
    const [playsNm, setPlays] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
    fetchPendingPlays()
        .then((data) => setPlays(data.length))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }, []);


    if (loading) return <p className="text-on-surface-muted italic">Cargando las estadísticas…</p>;
    if (error) return <p className="text-blood-bright">Error: {error}</p>;

    return <Widget miembros={570} escrituras={13} eventos={playsNm} />;
}