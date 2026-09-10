'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  computeH2HStandings,
  TeamBasic,
  MatchBasic,
  H2HStandingRow,
} from '@/business/h2hStandings';

interface StandingsCustomClientProps {
  teams: TeamBasic[];
  matches: MatchBasic[];
}

export default function StandingsCustomClient({ teams, matches }: StandingsCustomClientProps) {
  // Lista de equipos seleccionados
  const [selectedTeams, setSelectedTeams] = useState<TeamBasic[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Vista activa: 'table' (Tabla de Posiciones) | 'matrix' (Matriz de Resultados)
  const [viewMode, setViewMode] = useState<'table' | 'matrix'>('table');

  // Buscador de equipos
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Estado para modal de detalle de duelos de un equipo
  const [selectedRow, setSelectedRow] = useState<H2HStandingRow | null>(null);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cargar selección guardada de localStorage al montar
  useEffect(() => {
    const stored = localStorage.getItem('custom_standings_selected_teams');
    if (stored) {
      try {
        const parsedIds = JSON.parse(stored) as number[];
        const restored = parsedIds
          .map((id) => teams.find((t) => t.id === id))
          .filter((t): t is TeamBasic => !!t);
        setSelectedTeams(restored);
      } catch (e) {
        console.error('Error al restaurar equipos desde localStorage:', e);
      }
    }
    setIsLoaded(true);
  }, [teams]);

  // Guardar cambios en localStorage
  useEffect(() => {
    if (isLoaded) {
      const ids = selectedTeams.map((t) => t.id);
      localStorage.setItem('custom_standings_selected_teams', JSON.stringify(ids));
    }
  }, [selectedTeams, isLoaded]);

  // Autocompletado de búsqueda
  const autocompleteResults = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return [];
    const selectedIds = new Set(selectedTeams.map((t) => t.id));
    return teams
      .filter((t) => t.current_name.toLowerCase().includes(q) && !selectedIds.has(t.id))
      .slice(0, 8);
  }, [searchTerm, selectedTeams, teams]);

  // Handlers para agregar y quitar equipos
  const handleSelectTeam = (team: TeamBasic) => {
    if (!selectedTeams.some((t) => t.id === team.id)) {
      setSelectedTeams([...selectedTeams, team]);
    }
    setSearchTerm('');
    setIsDropdownOpen(false);
  };

  const handleRemoveTeam = (id: number) => {
    setSelectedTeams(selectedTeams.filter((t) => t.id !== id));
    if (selectedRow?.team.id === id) setSelectedRow(null);
  };

  const handleClearAll = () => {
    setSelectedTeams([]);
    setSelectedRow(null);
  };

  // Importar los equipos seleccionados en la otra vista (/historic)
  const handleImportFromHistoric = () => {
    const stored = localStorage.getItem('historic_selected_teams');
    if (!stored) {
      alert('No se encontraron equipos guardados en la sección H2H (/historic).');
      return;
    }
    try {
      const parsedIds = JSON.parse(stored) as number[];
      const restored = parsedIds
        .map((id) => teams.find((t) => t.id === id))
        .filter((t): t is TeamBasic => !!t);

      if (restored.length === 0) {
        alert('No se pudieron encontrar coincidencias de los equipos guardados.');
        return;
      }
      setSelectedTeams(restored);
    } catch (e) {
      console.error(e);
      alert('Error al leer los equipos de la sección H2H.');
    }
  };

  // Predefinir algunos clubes históricos populares
  const handleLoadClassicPreset = () => {
    const classicNames = [
      'Real Madrid',
      'Bayern Munich',
      'Liverpool',
      'AC Milan',
      'Barcelona',
      'Juventus',
      'Internazionale',
      'Ajax',
    ];
    const matched = classicNames
      .map((name) =>
        teams.find((t) => t.current_name.toLowerCase().includes(name.toLowerCase()))
      )
      .filter((t): t is TeamBasic => !!t);

    setSelectedTeams(matched);
  };

  // Exportar / Importar lista en JSON
  const handleExportJson = () => {
    if (selectedTeams.length === 0) return;
    const data = {
      type: 'soccer-custom-standings',
      teamIds: selectedTeams.map((t) => t.id),
      teamNames: selectedTeams.map((t) => t.current_name),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabla-h2h-personalizada-${selectedTeams.length}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        let ids: number[] = [];
        if (parsed?.teamIds && Array.isArray(parsed.teamIds)) {
          ids = parsed.teamIds;
        } else if (Array.isArray(parsed)) {
          ids = parsed.map((item: any) => (typeof item === 'number' ? item : item?.id)).filter(Boolean);
        }
        const restored = ids
          .map((id) => teams.find((t) => t.id === id))
          .filter((t): t is TeamBasic => !!t);

        if (restored.length > 0) {
          setSelectedTeams(restored);
        } else {
          alert('No se encontraron equipos válidos en el archivo JSON.');
        }
      } catch (err) {
        alert('Archivo JSON no válido.');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  // 2. Calcular la tabla de posiciones con los equipos seleccionados
  const selectedIds = useMemo(() => new Set(selectedTeams.map((t) => t.id)), [selectedTeams]);

  const customStandings = useMemo(() => {
    if (selectedTeams.length === 0) return [];
    return computeH2HStandings(selectedTeams, matches, selectedIds);
  }, [selectedTeams, matches, selectedIds]);

  // 3. Diccionario para la matriz cruzada de duelos
  const matrixDict = useMemo(() => {
    const dict = new Map<string, { winsA: number; winsB: number; draws: number; total: number }>();
    if (selectedTeams.length < 2) return dict;

    matches.forEach((m) => {
      if (!selectedIds.has(m.home_team_id) || !selectedIds.has(m.away_team_id)) return;

      const idA = Math.min(m.home_team_id, m.away_team_id);
      const idB = Math.max(m.home_team_id, m.away_team_id);
      const key = `${idA}_${idB}`;

      if (!dict.has(key)) {
        dict.set(key, { winsA: 0, winsB: 0, draws: 0, total: 0 });
      }
      const stat = dict.get(key)!;
      stat.total++;
      if (m.home_goals > m.away_goals) {
        if (m.home_team_id === idA) stat.winsA++;
        else stat.winsB++;
      } else if (m.away_goals > m.home_goals) {
        if (m.away_team_id === idA) stat.winsA++;
        else stat.winsB++;
      } else {
        stat.draws++;
      }
    });

    return dict;
  }, [selectedTeams, matches, selectedIds]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-24 selection:bg-indigo-500 selection:text-slate-950">
      {/* Background glow decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-linear-to-b from-indigo-500/10 via-purple-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 px-6 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-indigo-400">
                  Tabla H2H Personalizada
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-950/60 border border-indigo-800/60 text-indigo-400">
                  {selectedTeams.length} Clubes Seleccionados
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">
                Escoge cualquier grupo de clubes para calcular su tabla de posiciones por historial directo.
              </p>
            </div>
          </div>

          {/* Navigation links */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/standings"
              className="bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/60 px-3.5 py-1.5 rounded-lg transition font-medium text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>🌐</span> Tabla General
            </Link>
            <Link
              href="/historic"
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3.5 py-1.5 rounded-lg transition font-medium text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>⚔️</span> Matriz H2H
            </Link>
            <Link
              href="/"
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3.5 py-1.5 rounded-lg transition font-medium text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>🏠</span> Inicio
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 mt-8">
        {/* Selector Section */}
        <section className="bg-slate-950 p-6 rounded-xl border border-slate-800 mb-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🔍</span> Selección de Clubes
            </h2>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleLoadClassicPreset}
                className="px-3 py-1.5 text-xs bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 rounded-lg transition"
              >
                ⭐ Preset Clásicos (8)
              </button>
              <button
                onClick={handleImportFromHistoric}
                className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition"
                title="Cargar los equipos que ya seleccionaste en el comparador H2H"
              >
                📥 Traer desde /historic
              </button>
              <button
                onClick={handleExportJson}
                disabled={selectedTeams.length === 0}
                className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition disabled:opacity-40"
              >
                💾 Exportar JSON
              </button>
              <label className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition cursor-pointer">
                📂 Cargar JSON
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJson}
                  className="hidden"
                />
              </label>
              {selectedTeams.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="px-3 py-1.5 text-xs bg-rose-950/50 hover:bg-rose-900/80 border border-rose-800/60 text-rose-300 rounded-lg transition"
                >
                  🗑️ Limpiar ({selectedTeams.length})
                </button>
              )}
            </div>
          </div>

          {/* Autocomplete Input */}
          <div className="relative mb-4" ref={searchContainerRef}>
            <input
              type="text"
              placeholder="Buscar club para añadir a la tabla (ej: Real Madrid, Milan, Ajax, Bayern...)"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition shadow-inner"
            />

            {/* Dropdown */}
            {isDropdownOpen && autocompleteResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-40 overflow-hidden divide-y divide-slate-800">
                {autocompleteResults.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTeam(t)}
                    className="w-full text-left px-4 py-2.5 hover:bg-indigo-600/20 text-slate-200 hover:text-white flex items-center justify-between text-sm transition"
                  >
                    <span className="font-semibold">{t.current_name}</span>
                    <span className="text-xs text-slate-400">{t.countries?.name || 'Internacional'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected badges */}
          <div className="flex flex-wrap gap-2">
            {selectedTeams.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                No has seleccionado ningún club aún. Utiliza el buscador o pulsa "Preset Clásicos".
              </p>
            ) : (
              selectedTeams.map((team) => (
                <div
                  key={team.id}
                  className="bg-indigo-950/50 border border-indigo-700/50 text-indigo-200 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-xs group"
                >
                  <span>{team.current_name}</span>
                  <button
                    onClick={() => handleRemoveTeam(team.id)}
                    className="text-indigo-400 hover:text-rose-400 transition"
                    title="Quitar equipo"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* View Toggle Tabs */}
        {selectedTeams.length > 1 && (
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 rounded-lg font-bold transition ${
                  viewMode === 'table'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                📊 Tabla de Posiciones
              </button>
              <button
                onClick={() => setViewMode('matrix')}
                className={`px-4 py-2 rounded-lg font-bold transition ${
                  viewMode === 'matrix'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ⚔️ Matriz de Duelos Directos
              </button>
            </div>

            <span className="text-xs text-slate-400 hidden sm:inline">
              Máximo teórico de duelos por club: <strong className="text-slate-200">{selectedTeams.length - 1}</strong>
            </span>
          </div>
        )}

        {/* Content Mode 1: Tabla de Posiciones */}
        {viewMode === 'table' && (
          <div className="bg-slate-950 rounded-xl border border-slate-800 shadow-2xl overflow-hidden mb-12">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-900/90 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 select-none">
                    <th className="py-3 px-3 text-center w-12">#</th>
                    <th className="py-3 px-4">Club</th>
                    <th className="py-3 px-3 text-center" title="Duelos disputados contra rivales del grupo">
                      PJ
                    </th>
                    <th className="py-3 px-3 text-center text-emerald-400" title="Duelos ganados (más victorias directas)">
                      PG
                    </th>
                    <th className="py-3 px-3 text-center text-amber-400" title="Duelos empatados (igual cantidad de victorias o 0-0)">
                      PE
                    </th>
                    <th className="py-3 px-3 text-center text-rose-400" title="Duelos perdidos (menos victorias directas)">
                      PP
                    </th>
                    <th className="py-3 px-3 text-center" title="Victorias directas a favor">
                      GF
                    </th>
                    <th className="py-3 px-3 text-center" title="Victorias directas en contra">
                      GC
                    </th>
                    <th className="py-3 px-3 text-center" title="Diferencia: GF - GC">
                      DIF
                    </th>
                    <th className="py-3 px-4 text-center text-indigo-300 font-bold bg-slate-900/60" title="Puntos: PG*3 + PE">
                      PTS
                    </th>
                    <th className="py-3 px-3 text-center hidden sm:table-cell" title="% de puntos sobre posibles">
                      % Efec.
                    </th>
                    <th className="py-3 px-3 text-center w-24">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {customStandings.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate-500 font-sans">
                        Agrega al menos 2 clubes en el selector de arriba para calcular la tabla de posiciones.
                      </td>
                    </tr>
                  ) : (
                    customStandings.map((row, index) => {
                      const maxDuels = selectedTeams.length - 1;
                      const hasPendingDuels = row.pj < maxDuels;
                      const maxPossiblePts = row.pj * 3;
                      const efecPct = maxPossiblePts > 0 ? Math.round((row.pts / maxPossiblePts) * 100) : 0;
                      const diffPositive = row.dg > 0;
                      const diffNegative = row.dg < 0;

                      return (
                        <tr
                          key={row.team.id}
                          className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                          onClick={() => setSelectedRow(row)}
                        >
                          <td className="py-3 px-3 text-center font-bold text-slate-400">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                          </td>
                          <td className="py-3 px-4 font-sans font-medium text-slate-100">
                            <div className="flex items-center gap-2">
                              <span className="group-hover:text-indigo-400 transition-colors font-semibold text-sm">
                                {row.team.current_name}
                              </span>
                              {row.team.countries && (
                                <span className="text-xs text-slate-500 font-normal">
                                  ({row.team.countries.name})
                                </span>
                              )}
                              {hasPendingDuels && (
                                <span
                                  className="text-3xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700"
                                  title={`Jugó contra ${row.pj} de los ${maxDuels} rivales posibles en esta selección`}
                                >
                                  {row.pj}/{maxDuels}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center text-slate-300 font-bold">{row.pj}</td>
                          <td className="py-3 px-3 text-center text-emerald-400 font-semibold">{row.pg}</td>
                          <td className="py-3 px-3 text-center text-amber-400">{row.pe}</td>
                          <td className="py-3 px-3 text-center text-rose-400">{row.pp}</td>
                          <td className="py-3 px-3 text-center text-slate-300">{row.gf}</td>
                          <td className="py-3 px-3 text-center text-slate-400">{row.gc}</td>
                          <td
                            className={`py-3 px-3 text-center font-bold ${
                              diffPositive ? 'text-emerald-400' : diffNegative ? 'text-rose-400' : 'text-slate-400'
                            }`}
                          >
                            {diffPositive ? `+${row.dg}` : row.dg}
                          </td>
                          <td className="py-3 px-4 text-center text-indigo-300 font-bold text-sm bg-slate-900/30 group-hover:bg-indigo-950/30 transition-colors">
                            {row.pts}
                          </td>
                          <td className="py-3 px-3 text-center text-slate-400 hidden sm:table-cell">
                            {efecPct}%
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRow(row);
                              }}
                              className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 rounded border border-slate-700 transition"
                            >
                              Ver duelos
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Content Mode 2: Matriz Cruzada de Resultados */}
        {viewMode === 'matrix' && selectedTeams.length > 1 && (
          <div className="bg-slate-950 rounded-xl border border-slate-800 shadow-2xl p-6 overflow-x-auto mb-12">
            <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
              <span>⚔️</span> Resultados de Duelos Directos (Fila vs Columna)
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Cada celda indica el resultado para el equipo de la fila: <span className="text-emerald-400 font-bold">G (Victorias)</span>, <span className="text-amber-400 font-bold">E (Empates)</span> o <span className="text-rose-400 font-bold">P (Derrotas)</span>.
            </p>

            <table className="text-xs border-collapse font-mono">
              <thead>
                <tr>
                  <th className="p-2 border border-slate-800 bg-slate-900 text-slate-400 font-sans text-left">Club</th>
                  {selectedTeams.map((colTeam) => (
                    <th
                      key={colTeam.id}
                      className="p-2 border border-slate-800 bg-slate-900 text-slate-300 font-sans text-center max-w-24 truncate"
                      title={colTeam.current_name}
                    >
                      {colTeam.current_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedTeams.map((rowTeam) => (
                  <tr key={rowTeam.id} className="hover:bg-slate-900/50">
                    <td className="p-2 border border-slate-800 bg-slate-900/80 font-sans font-semibold text-slate-200 whitespace-nowrap">
                      {rowTeam.current_name}
                    </td>

                    {selectedTeams.map((colTeam) => {
                      if (rowTeam.id === colTeam.id) {
                        return (
                          <td key={colTeam.id} className="p-2 border border-slate-800 bg-slate-900/30 text-center text-slate-600">
                            —
                          </td>
                        );
                      }

                      const idA = Math.min(rowTeam.id, colTeam.id);
                      const idB = Math.max(rowTeam.id, colTeam.id);
                      const stat = matrixDict.get(`${idA}_${idB}`);

                      if (!stat || stat.total === 0) {
                        return (
                          <td key={colTeam.id} className="p-2 border border-slate-800 text-center text-slate-600" title="Sin partidos disputados">
                            -
                          </td>
                        );
                      }

                      const winsRow = rowTeam.id === idA ? stat.winsA : stat.winsB;
                      const winsCol = rowTeam.id === idA ? stat.winsB : stat.winsA;

                      let label = 'E';
                      let colorClass = 'bg-amber-950/40 text-amber-300 border-amber-800/50';

                      if (winsRow > winsCol) {
                        label = 'G';
                        colorClass = 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50 font-bold';
                      } else if (winsCol > winsRow) {
                        label = 'P';
                        colorClass = 'bg-rose-950/40 text-rose-300 border-rose-800/50';
                      }

                      return (
                        <td
                          key={colTeam.id}
                          className="p-1.5 border border-slate-800 text-center"
                          title={`${rowTeam.current_name} vs ${colTeam.current_name}: ${winsRow}-${winsCol} (${stat.draws} empates en ${stat.total} partidos)`}
                        >
                          <span className={`inline-block px-1.5 py-0.5 rounded border text-3xs ${colorClass}`}>
                            {label} {winsRow}-{winsCol}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modal / Drawer de Detalle del Club */}
      {selectedRow && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex justify-end transition-opacity"
          onClick={() => setSelectedRow(null)}
        >
          <div
            className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full p-6 overflow-y-auto flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🛡️</span>
                  <h2 className="text-xl font-bold text-white">{selectedRow.team.current_name}</h2>
                </div>
                {selectedRow.team.countries && (
                  <p className="text-xs text-slate-400 mt-0.5">{selectedRow.team.countries.name}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedRow(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
              >
                ✕ Cerrar
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2 mb-6 text-center font-mono">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-2xs block uppercase font-sans">Puntos</span>
                <span className="text-lg font-bold text-indigo-400">{selectedRow.pts}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-2xs block uppercase font-sans">Ganadas</span>
                <span className="text-lg font-bold text-emerald-400">{selectedRow.pg}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-2xs block uppercase font-sans">Empates</span>
                <span className="text-lg font-bold text-amber-400">{selectedRow.pe}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-2xs block uppercase font-sans">Perdidas</span>
                <span className="text-lg font-bold text-rose-400">{selectedRow.pp}</span>
              </div>
            </div>

            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Enfrentamientos en esta selección ({selectedRow.duels.length})
            </h3>

            {/* Duels list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {selectedRow.duels.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No disputó partidos contra ninguno de los clubes seleccionados.
                </div>
              ) : (
                selectedRow.duels.map((duel) => {
                  const isWin = duel.outcome === 'W';
                  const isDraw = duel.outcome === 'D';
                  const isLoss = duel.outcome === 'L';

                  return (
                    <div
                      key={duel.opponent.id}
                      className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-2xs ${
                            isWin
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : isDraw
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {duel.outcome}
                        </span>
                        <div className="truncate">
                          <span className="font-semibold text-slate-200 block truncate">
                            {duel.opponent.current_name}
                          </span>
                          <span className="text-3xs text-slate-500">
                            {duel.opponent.countries?.name || 'Internacional'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-sm">
                          <span className={isWin ? 'text-emerald-400' : 'text-slate-300'}>
                            {duel.wins}
                          </span>{' '}
                          -{' '}
                          <span className={isLoss ? 'text-rose-400' : 'text-slate-300'}>
                            {duel.losses}
                          </span>
                        </div>
                        <span className="text-3xs text-slate-500 font-sans">
                          {duel.draws} {duel.draws === 1 ? 'empate' : 'empates'} ({duel.totalMatches} PJ)
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
