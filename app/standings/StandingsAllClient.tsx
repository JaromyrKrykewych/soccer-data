'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  computeH2HStandings,
  TeamBasic,
  MatchBasic,
  H2HStandingRow,
  H2HDuelDetail,
} from '@/business/h2hStandings';

interface StandingsAllClientProps {
  teams: TeamBasic[];
  matches: MatchBasic[];
}

type SortField = 'pts' | 'dg' | 'gf' | 'gc' | 'pg' | 'pe' | 'pp' | 'pj' | 'totalRealMatches' | 'name';

export default function StandingsAllClient({ teams, matches }: StandingsAllClientProps) {
  // 1. Calcular la tabla base usando el motor de negocio
  const baseStandings = useMemo(() => {
    return computeH2HStandings(teams, matches);
  }, [teams, matches]);

  // Estados de filtros y paginación
  const [searchTerm, setSearchTerm] = useState('');
  const [minPj, setMinPj] = useState<number>(1); // 1 = solo equipos con al menos 1 duelo
  const [sortField, setSortField] = useState<SortField>('pts');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Estado para el modal de detalle del equipo
  const [selectedRow, setSelectedRow] = useState<H2HStandingRow | null>(null);
  const [duelFilter, setDuelFilter] = useState<'all' | 'W' | 'D' | 'L'>('all');
  const [duelSearch, setDuelSearch] = useState('');

  // 2. Filtrar y ordenar la tabla según controles del usuario
  const filteredAndSortedStandings = useMemo(() => {
    let list = baseStandings;

    // Filtro por mínimo de duelos jugados
    if (minPj > 0) {
      list = list.filter((row) => row.pj >= minPj);
    }

    // Filtro por término de búsqueda
    const q = searchTerm.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (row) =>
          row.team.current_name.toLowerCase().includes(q) ||
          (row.team.countries?.name && row.team.countries.name.toLowerCase().includes(q))
      );
    }

    // Ordenamiento dinámico
    return [...list].sort((a, b) => {
      let diff = 0;
      if (sortField === 'name') {
        diff = a.team.current_name.localeCompare(b.team.current_name);
        return sortAsc ? diff : -diff;
      }

      if (sortField === 'pts') diff = a.pts - b.pts;
      else if (sortField === 'dg') diff = a.dg - b.dg;
      else if (sortField === 'gf') diff = a.gf - b.gf;
      else if (sortField === 'gc') diff = a.gc - b.gc;
      else if (sortField === 'pg') diff = a.pg - b.pg;
      else if (sortField === 'pe') diff = a.pe - b.pe;
      else if (sortField === 'pp') diff = a.pp - b.pp;
      else if (sortField === 'pj') diff = a.pj - b.pj;
      else if (sortField === 'totalRealMatches') diff = a.totalRealMatches - b.totalRealMatches;

      if (diff !== 0) {
        return sortAsc ? diff : -diff;
      }

      // Desempate secundario siempre por puntos y diferencia
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.dg !== a.dg) return b.dg - a.dg;
      return a.team.current_name.localeCompare(b.team.current_name);
    });
  }, [baseStandings, minPj, searchTerm, sortField, sortAsc]);

  // Manejador de clic en cabecera de columna para ordenar
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // Por defecto descendente en métricas numéricas
    }
    setCurrentPage(1);
  };

  // Paginación
  const totalItems = filteredAndSortedStandings.length;
  const totalPages = pageSize === -1 ? 1 : Math.ceil(totalItems / pageSize);
  const paginatedRows = useMemo(() => {
    if (pageSize === -1) return filteredAndSortedStandings;
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedStandings.slice(start, start + pageSize);
  }, [filteredAndSortedStandings, currentPage, pageSize]);

  // KPIs globales
  const kpiStats = useMemo(() => {
    const teamsWithMatches = baseStandings.filter((r) => r.pj > 0).length;
    const totalDuels = Math.floor(
      baseStandings.reduce((acc, r) => acc + r.pj, 0) / 2
    );
    return {
      totalTeams: teams.length,
      activeTeams: teamsWithMatches,
      totalDuels,
      totalMatches: matches.length,
    };
  }, [baseStandings, teams.length, matches.length]);

  // Filtrado de duelos en el modal de detalle
  const filteredDuels = useMemo(() => {
    if (!selectedRow) return [];
    let duels = selectedRow.duels;
    if (duelFilter !== 'all') {
      duels = duels.filter((d) => d.outcome === duelFilter);
    }
    const q = duelSearch.toLowerCase().trim();
    if (q) {
      duels = duels.filter(
        (d) =>
          d.opponent.current_name.toLowerCase().includes(q) ||
          (d.opponent.countries?.name && d.opponent.countries.name.toLowerCase().includes(q))
      );
    }
    return duels;
  }, [selectedRow, duelFilter, duelSearch]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-24 selection:bg-emerald-500 selection:text-slate-950">
      {/* Background glow decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-linear-to-b from-emerald-500/10 via-teal-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 px-6 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌐</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-emerald-400">
                  Tabla Histórica General H2H
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
                  Todos los Clubes
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">
                Posiciones donde cada duelo directo es un partido y las victorias son los goles.
              </p>
            </div>
          </div>

          {/* Navigation links */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/standings/custom"
              className="bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-700/60 px-3.5 py-1.5 rounded-lg transition font-medium text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>🎯</span> Tabla Personalizada
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
        {/* KPI Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">Clubes Activos en H2H</span>
            <span className="text-2xl font-extrabold text-white mt-1 block">
              {kpiStats.activeTeams} <span className="text-xs text-slate-500 font-normal">de {kpiStats.totalTeams}</span>
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">Duelos Disputados</span>
            <span className="text-2xl font-extrabold text-emerald-400 mt-1 block">
              {kpiStats.totalDuels.toLocaleString()} <span className="text-xs text-slate-500 font-normal">series H2H</span>
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">Partidos Reales</span>
            <span className="text-2xl font-extrabold text-teal-400 mt-1 block">
              {kpiStats.totalMatches.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">Líder Histórico</span>
            <span className="text-base font-bold text-amber-300 mt-1 block truncate">
              🥇 {baseStandings[0]?.team.current_name || '-'}
            </span>
            <span className="text-xs text-slate-400">
              {baseStandings[0]?.pts || 0} pts ({baseStandings[0]?.pj || 0} duelos)
            </span>
          </div>
        </section>

        {/* Explain Banner */}
        <section className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4 mb-6 text-xs text-slate-300 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="text-base">💡</span>
            <div>
              <strong className="text-emerald-300 font-semibold">¿Cómo funciona esta tabla?</strong> Cada rival enfrentado cuenta como 1 duelo (PJ). El club que haya ganado más partidos en el historial se lleva la victoria (3 pts). Si empatan en victorias o todos sus partidos fueron empates, termina en empate (1 pt, ej: 0-0 o 1-1). Las victorias directas representan los goles.
            </div>
          </div>
        </section>

        {/* Filters and Controls */}
        <section className="bg-slate-950 p-5 rounded-xl border border-slate-800 mb-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="w-full md:w-80 relative">
            <input
              type="text"
              placeholder="Buscar club o país..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Min PJ Filter */}
          <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
            <span className="text-xs text-slate-400 font-medium mr-1">Filtro de Duelos:</span>
            {[
              { label: 'Todos (PJ ≥ 1)', val: 1 },
              { label: 'PJ ≥ 5', val: 5 },
              { label: 'PJ ≥ 10', val: 10 },
              { label: 'PJ ≥ 20', val: 20 },
              { label: 'Incluir 0 PJ', val: 0 },
            ].map((f) => (
              <button
                key={f.val}
                onClick={() => {
                  setMinPj(f.val);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 text-xs rounded-md font-medium border transition ${
                  minPj === f.val
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Page size selector */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Mostrar:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-slate-200 focus:outline-none"
            >
              <option value={25}>25 filas</option>
              <option value={50}>50 filas</option>
              <option value={100}>100 filas</option>
              <option value={-1}>Todos</option>
            </select>
          </div>
        </section>

        {/* Table Container */}
        <div className="bg-slate-950 rounded-xl border border-slate-800 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-900/90 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 select-none">
                  <th className="py-3 px-3 text-center w-12">#</th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-emerald-300 transition"
                    onClick={() => handleSort('name')}
                  >
                    Club {sortField === 'name' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th
                    className="py-3 px-3 text-center cursor-pointer hover:text-emerald-300 transition"
                    onClick={() => handleSort('pj')}
                    title="Duelos disputados contra distintos rivales"
                  >
                    PJ {sortField === 'pj' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th
                    className="py-3 px-3 text-center cursor-pointer hover:text-emerald-300 transition text-emerald-400"
                    onClick={() => handleSort('pg')}
                    title="Series ganadas (más victorias directas)"
                  >
                    PG {sortField === 'pg' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th
                    className="py-3 px-3 text-center cursor-pointer hover:text-emerald-300 transition text-amber-400"
                    onClick={() => handleSort('pe')}
                    title="Series empatadas (igual cantidad de victorias o 0-0)"
                  >
                    PE {sortField === 'pe' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th
                    className="py-3 px-3 text-center cursor-pointer hover:text-emerald-300 transition text-rose-400"
                    onClick={() => handleSort('pp')}
                    title="Series perdidas (menos victorias directas)"
                  >
                    PP {sortField === 'pp' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th
                    className="py-3 px-3 text-center cursor-pointer hover:text-emerald-300 transition"
                    onClick={() => handleSort('gf')}
                    title="Goles a favor: Victorias directas conseguidas en total"
                  >
                    GF {sortField === 'gf' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th
                    className="py-3 px-3 text-center cursor-pointer hover:text-emerald-300 transition"
                    onClick={() => handleSort('gc')}
                    title="Goles en contra: Victorias del rival sufridas en total"
                  >
                    GC {sortField === 'gc' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th
                    className="py-3 px-3 text-center cursor-pointer hover:text-emerald-300 transition"
                    onClick={() => handleSort('dg')}
                    title="Diferencia: GF - GC"
                  >
                    DIF {sortField === 'dg' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th
                    className="py-3 px-4 text-center cursor-pointer hover:text-emerald-300 transition text-emerald-300 font-bold bg-slate-900/60"
                    onClick={() => handleSort('pts')}
                    title="Puntos: PG * 3 + PE"
                  >
                    PTS {sortField === 'pts' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th
                    className="py-3 px-3 text-center cursor-pointer hover:text-slate-200 transition hidden md:table-cell"
                    onClick={() => handleSort('totalRealMatches')}
                    title="Partidos reales jugados"
                  >
                    Partidos {sortField === 'totalRealMatches' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th className="py-3 px-3 text-center w-24">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-500 font-sans">
                      No se encontraron clubes con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, index) => {
                    const position = pageSize === -1 ? index + 1 : (currentPage - 1) * pageSize + index + 1;
                    const isPodium = position <= 3;
                    const diffPositive = row.dg > 0;
                    const diffNegative = row.dg < 0;

                    return (
                      <tr
                        key={row.team.id}
                        className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                        onClick={() => setSelectedRow(row)}
                      >
                        <td className="py-3 px-3 text-center font-bold text-slate-400">
                          {position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : position}
                        </td>
                        <td className="py-3 px-4 font-sans font-medium text-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="group-hover:text-emerald-400 transition-colors font-semibold text-sm">
                              {row.team.current_name}
                            </span>
                            {row.team.countries && (
                              <span className="text-xs text-slate-500 font-normal">
                                ({row.team.countries.name})
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
                        <td className="py-3 px-4 text-center text-emerald-300 font-bold text-sm bg-slate-900/30 group-hover:bg-emerald-950/30 transition-colors">
                          {row.pts}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-400 hidden md:table-cell">
                          {row.totalRealMatches}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRow(row);
                            }}
                            className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 rounded border border-slate-700 transition"
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

          {/* Pagination bar */}
          {pageSize !== -1 && totalPages > 1 && (
            <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
              <span>
                Mostrando {((currentPage - 1) * pageSize) + 1} a {Math.min(currentPage * pageSize, totalItems)} de {totalItems} clubes
              </span>

              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-30 hover:bg-slate-800 text-slate-200"
                >
                  «
                </button>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-30 hover:bg-slate-800 text-slate-200"
                >
                  Anterior
                </button>
                <span className="px-3 py-1 text-slate-300 font-semibold">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-30 hover:bg-slate-800 text-slate-200"
                >
                  Siguiente
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-30 hover:bg-slate-800 text-slate-200"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal / Drawer de Detalle del Club */}
      {selectedRow && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex justify-end transition-opacity"
          onClick={() => setSelectedRow(null)}
        >
          <div
            className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full p-6 overflow-y-auto flex flex-col shadow-2xl"
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

            {/* Quick summary stats of this team */}
            <div className="grid grid-cols-4 gap-2 mb-6 text-center font-mono">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-2xs block uppercase font-sans">Puntos</span>
                <span className="text-lg font-bold text-emerald-400">{selectedRow.pts}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-2xs block uppercase font-sans">Series Ganadas</span>
                <span className="text-lg font-bold text-emerald-300">{selectedRow.pg}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-2xs block uppercase font-sans">Empatadas</span>
                <span className="text-lg font-bold text-amber-300">{selectedRow.pe}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-2xs block uppercase font-sans">Perdidas</span>
                <span className="text-lg font-bold text-rose-400">{selectedRow.pp}</span>
              </div>
            </div>

            {/* Filter duels tabs & search */}
            <div className="flex flex-col sm:flex-row gap-2 justify-between items-center mb-4">
              <div className="flex items-center gap-1 text-xs">
                <button
                  onClick={() => setDuelFilter('all')}
                  className={`px-2.5 py-1 rounded font-medium transition ${
                    duelFilter === 'all'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Todos ({selectedRow.duels.length})
                </button>
                <button
                  onClick={() => setDuelFilter('W')}
                  className={`px-2.5 py-1 rounded font-medium transition ${
                    duelFilter === 'W'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Ganadas ({selectedRow.pg})
                </button>
                <button
                  onClick={() => setDuelFilter('D')}
                  className={`px-2.5 py-1 rounded font-medium transition ${
                    duelFilter === 'D'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Empatadas ({selectedRow.pe})
                </button>
                <button
                  onClick={() => setDuelFilter('L')}
                  className={`px-2.5 py-1 rounded font-medium transition ${
                    duelFilter === 'L'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Perdidas ({selectedRow.pp})
                </button>
              </div>

              <input
                type="text"
                placeholder="Filtrar rival..."
                value={duelSearch}
                onChange={(e) => setDuelSearch(e.target.value)}
                className="w-full sm:w-44 bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
              />
            </div>

            {/* Duels List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredDuels.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No hay rivales para este filtro.
                </div>
              ) : (
                filteredDuels.map((duel) => {
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
                            {duel.opponent.countries?.name || 'País desconocido'}
                          </span>
                        </div>
                      </div>

                      {/* Score / stats */}
                      <div className="flex items-center gap-3 text-right shrink-0">
                        <div>
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
