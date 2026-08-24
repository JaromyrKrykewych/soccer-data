'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

export interface MatchRow {
  id: number;
  season_id: number;
  home_team_id: number;
  away_team_id: number;
  home_goals: number;
  away_goals: number;
  penalty_home_goals: number | null;
  penalty_away_goals: number | null;
  is_leg1: boolean;
  is_neutral: boolean;
  round: string;
  seasons: {
    id: number;
    year_start: number;
    year_end: number;
    competitions: {
      id: number;
      name: string;
    } | null;
  } | null;
}

export interface TeamInfo {
  id: number;
  current_name: string;
}

interface MatchesClientProps {
  initialMatches: any[];
  teams: TeamInfo[];
}

export default function MatchesClient({ initialMatches, teams }: MatchesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Estados de filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedComp, setSelectedComp] = useState('ALL');
  const [selectedSeason, setSelectedSeason] = useState('2026-27');
  const [selectedType, setSelectedType] = useState('ALL');

  // Mapeo de equipos en memoria
  const teamsMap = useMemo(() => {
    return new Map<number, string>(teams.map((t) => [t.id, t.current_name]));
  }, [teams]);

  const getTeamName = (id: number) => {
    return teamsMap.get(id) || `Club ID #${id}`;
  };

  // Obtener lista única de competiciones y temporadas para filtros
  const filterOptions = useMemo(() => {
    const comps = new Set<string>();
    const seasons = new Set<string>();

    initialMatches.forEach((m) => {
      if (m.seasons?.competitions?.name) {
        comps.add(m.seasons.competitions.name);
      }
      if (m.seasons?.year_start) {
        const yrStart = m.seasons.year_start;
        const yrEnd = String(m.seasons.year_end).slice(-2);
        seasons.add(`${yrStart}-${yrEnd}`);
      }
    });

    return {
      competitions: Array.from(comps).sort(),
      seasons: Array.from(seasons).sort((a, b) => b.localeCompare(a)), // Más recientes primero
    };
  }, [initialMatches]);

  // Filtrado de partidos en memoria
  const filteredMatches = useMemo(() => {
    return initialMatches.filter((m: MatchRow) => {
      // 1. Filtro por búsqueda
      const homeName = getTeamName(m.home_team_id).toLowerCase();
      const awayName = getTeamName(m.away_team_id).toLowerCase();
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || homeName.includes(query) || awayName.includes(query);

      // 2. Filtro por competición
      const compName = m.seasons?.competitions?.name || '';
      const matchesComp = selectedComp === 'ALL' || compName === selectedComp;

      // 3. Filtro por temporada
      const yrStart = m.seasons?.year_start;
      const yrEnd = String(m.seasons?.year_end).slice(-2);
      const seasonName = yrStart ? `${yrStart}-${yrEnd}` : '';
      const matchesSeason = selectedSeason === 'ALL' || seasonName === selectedSeason;

      // 4. Filtro por tipo de partido
      const isDesempate = m.round?.toLowerCase().includes('desempate');
      let matchesType = true;
      if (selectedType === 'LEG1') {
        matchesType = m.is_leg1 && !isDesempate;
      } else if (selectedType === 'LEG2') {
        matchesType = !m.is_leg1 && !isDesempate;
      } else if (selectedType === 'PLAYOFF') {
        matchesType = isDesempate;
      }

      return matchesSearch && matchesComp && matchesSeason && matchesType;
    });
  }, [initialMatches, searchQuery, selectedComp, selectedSeason, selectedType, getTeamName]);

  // Acción para eliminar partido
  const handleDeleteMatch = async (id: number) => {
    const confirmDelete = window.confirm(`¿Estás seguro de que quieres eliminar el partido con ID #${id}? Esta acción no se puede deshacer.`);
    if (!confirmDelete) return;

    try {
      const res = await fetch('/api/importer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete-match',
          id,
        }),
      });

      const data = await res.json();
      if (data.success) {
        startTransition(() => {
          router.refresh();
        });
      } else {
        alert('Error al eliminar: ' + data.error);
      }
    } catch (err) {
      alert('Error de red al intentar eliminar el partido.');
    }
  };

  // Acción para alternar la condición de neutral
  const handleToggleNeutral = async (id: number, currentNeutral: boolean) => {
    try {
      const res = await fetch('/api/importer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle-neutral',
          id,
          is_neutral: !currentNeutral,
        }),
      });

      const data = await res.json();
      if (data.success) {
        startTransition(() => {
          router.refresh();
        });
      } else {
        alert('Error al actualizar condición neutral: ' + data.error);
      }
    } catch (err) {
      alert('Error de red al intentar actualizar el partido.');
    }
  };


  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-16">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-10 px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-emerald-400">Partidos en Supabase</h1>
            <p className="text-slate-400 text-sm">Inspecciona y limpia el historial de partidos importados.</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/"
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-lg transition font-medium text-sm cursor-pointer flex items-center gap-1.5"
            >
              🏠 Menú Principal
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 mt-8">
        {/* Panel de Filtros */}
        <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Buscador */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Buscar Club</label>
              <input
                type="text"
                placeholder="Ej: Real Madrid, Inter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none transition"
              />
            </div>

            {/* Competición */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Competición</label>
              <select
                value={selectedComp}
                onChange={(e) => setSelectedComp(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer"
              >
                <option value="ALL">Todas las Competiciones</option>
                {filterOptions.competitions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Temporada */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Temporada</label>
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer"
              >
                <option value="ALL">Todas las Temporadas</option>
                {filterOptions.seasons.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo de Partido */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Tipo de Partido</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer"
              >
                <option value="ALL">Todos</option>
                <option value="LEG1">Partido de Ida (Leg 1)</option>
                <option value="LEG2">Partido de Vuelta (Leg 2)</option>
                <option value="PLAYOFF">Partido de Desempate</option>
              </select>
            </div>
          </div>
        </div>

        {/* Resumen */}
        <div className="flex justify-between items-center mb-4">
          <p className="text-slate-400 text-sm">
            Mostrando <strong className="text-slate-200">{filteredMatches.length}</strong> partidos de{' '}
            <strong className="text-slate-200">{initialMatches.length}</strong> guardados.
          </p>
        </div>

        {/* Tabla */}
        <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
          {filteredMatches.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              No se encontraron partidos con los filtros aplicados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 text-xs uppercase font-semibold">
                    <th className="py-4 px-6 text-center w-16">ID</th>
                    <th className="py-4 px-6">Temporada / Competición</th>
                    <th className="py-4 px-6 w-18">Ronda</th>
                    <th className="py-4 px-6 text-center w-34">Tipo</th>
                    <th className="py-4 px-6 text-right">Local</th>
                    <th className="py-4 px-6 text-center w-28">Score</th>
                    <th className="py-4 px-6">Visitante</th>
                    <th className="py-4 px-6 text-center w-28">Extra</th>
                    <th className="py-4 px-6 text-center w-24">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-sm">
                  {filteredMatches.map((m: MatchRow) => {
                    const isDesempate = m.round?.toLowerCase().includes('desempate');
                    const yrStart = m.seasons?.year_start;
                    const yrEnd = String(m.seasons?.year_end).slice(-2);
                    const seasonText = yrStart ? `${yrStart}-${yrEnd}` : 'N/A';

                    return (
                      <tr key={m.id} className="hover:bg-slate-900/30 transition">
                        <td className="py-4 px-6 text-center font-mono text-slate-500">{m.id}</td>
                        <td className="py-4 px-6">
                          <div className="font-semibold text-slate-300">{m.seasons?.competitions?.name || 'Desconocida'}</div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">{seasonText}</div>
                        </td>
                        <td className="py-4 px-6 font-mono text-xs uppercase text-slate-400">{m.round}</td>
                        <td className="py-4 px-6 text-center">
                          {isDesempate ? (
                            <span className="bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                              ⚽ PlayOff
                            </span>
                          ) : m.is_leg1 ? (
                            <span className="bg-indigo-950/60 text-indigo-400 border border-indigo-800/40 text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                              🏠 Ida
                            </span>
                          ) : (
                            <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                              ✈️ Vuelta
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right font-semibold text-slate-200">
                          {getTeamName(m.home_team_id)}
                        </td>
                        <td className="py-4 px-6 text-center font-mono font-bold text-base text-slate-200 bg-slate-900/10">
                          {m.home_goals} - {m.away_goals}
                        </td>
                        <td className="py-4 px-6 font-semibold text-slate-200">
                          {getTeamName(m.away_team_id)}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="flex flex-col items-center justify-center gap-1">
                            {m.penalty_home_goals !== null && m.penalty_away_goals !== null && (
                              <span className="text-amber-400 font-mono text-xs" title="Tanda de Penales">
                                Pen: ({m.penalty_away_goals}-{m.penalty_home_goals})
                              </span>
                            )}
                            {m.is_neutral && (
                              <span className="bg-indigo-950/60 text-indigo-400 border border-indigo-850 text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">
                                Neutral
                              </span>
                            )}
                            {m.penalty_home_goals === null && !m.is_neutral && (
                              <span className="text-slate-600">-</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleToggleNeutral(m.id, m.is_neutral)}
                            disabled={isPending}
                            className={`mr-2 px-2 py-1 rounded text-xs font-semibold transition cursor-pointer disabled:opacity-50 border ${
                              m.is_neutral
                                ? 'bg-indigo-950/60 text-indigo-400 border-indigo-850 hover:bg-indigo-900 hover:text-white hover:border-indigo-600'
                                : 'bg-slate-900 text-slate-500 border-slate-800 hover:bg-slate-800 hover:text-slate-250 hover:border-slate-700'
                            }`}
                            title="Alternar entre cancha neutral o ida/vuelta"
                          >
                            {m.is_neutral ? '🌐 Neutral' : '🏟️ Localía'}
                          </button>
                          <button
                            onClick={() => handleDeleteMatch(m.id)}
                            disabled={isPending}
                            className="bg-rose-950 text-rose-300 hover:bg-rose-900 hover:text-white border border-rose-800/50 hover:border-rose-600 px-2 py-1 rounded text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
