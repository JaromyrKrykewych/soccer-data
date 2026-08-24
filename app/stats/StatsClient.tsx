'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export interface TeamStats {
  id: number;
  name: string;
  country: string;
  totalSeasons: number;
  distinctRivalsCount: number;
  rivalsList: string[];
}

interface StatsClientProps {
  teamStatsList: TeamStats[];
  totalTeams: number;
  totalMatches: number;
}

export default function StatsClient({ teamStatsList, totalTeams, totalMatches }: StatsClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rivals' | 'seasons' | 'name'>('rivals');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showRivals, setShowRivals] = useState<Record<number, boolean>>({});
  const [selectedCountry, setSelectedCountry] = useState('');

  // Obtener lista única de países para el filtro
  const countries = useMemo(() => {
    const list = teamStatsList.map((t) => t.country).filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [teamStatsList]);

  const toggleRivals = (teamId: number) => {
    setShowRivals((prev) => ({
      ...prev,
      [teamId]: !prev[teamId],
    }));
  };

  // Obtener el equipo más activo (el que tiene más rivales únicos)
  const mostActiveTeam = useMemo(() => {
    if (teamStatsList.length === 0) return null;
    return [...teamStatsList].sort((a, b) => b.distinctRivalsCount - a.distinctRivalsCount)[0] || null;
  }, [teamStatsList]);

  // Manejador del ordenamiento al hacer clic en las columnas
  const handleSort = (field: 'rivals' | 'seasons' | 'name') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder(field === 'name' ? 'asc' : 'desc');
    }
  };

  // Filtrar por nombre y país
  const filteredStats = useMemo(() => {
    return teamStatsList.filter((t) => {
      const matchesSearch = !searchQuery.trim() ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.country.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCountry = !selectedCountry || t.country === selectedCountry;
      return matchesSearch && matchesCountry;
    });
  }, [teamStatsList, searchQuery, selectedCountry]);

  // Ordenar lista filtrada
  const sortedStats = useMemo(() => {
    const list = [...filteredStats];
    list.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortBy === 'rivals') {
        valA = a.distinctRivalsCount;
        valB = b.distinctRivalsCount;
      } else if (sortBy === 'seasons') {
        valA = a.totalSeasons;
        valB = b.totalSeasons;
      } else {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredStats, sortBy, sortOrder]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-16">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-10 px-8 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-emerald-400">Estadísticas Históricas</h1>
            <p className="text-slate-400 text-sm">Análisis de la información sincronizada en Supabase.</p>
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
        {/* Tarjetas de Estadísticas Globales */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Clubes Registrados</p>
            <p className="text-3xl font-bold mt-1 text-slate-200">{totalTeams}</p>
          </div>
          <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Partidos en Base de Datos</p>
            <p className="text-3xl font-bold mt-1 text-emerald-400">{totalMatches}</p>
          </div>
          <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Mayor Diversidad de Rivales</p>
            <p className="text-xl font-bold mt-2 text-amber-400 truncate" title={mostActiveTeam ? `${mostActiveTeam.name} (${mostActiveTeam.distinctRivalsCount} rivales)` : ''}>
              {mostActiveTeam ? `${mostActiveTeam.name} (${mostActiveTeam.distinctRivalsCount})` : 'N/A'}
            </p>
          </div>
        </div>

        {/* Buscador de Clubes */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>Ordenar por:</span>
            <span className="bg-slate-900 border border-slate-800 text-emerald-400 px-2 py-1 rounded text-xs font-semibold uppercase tracking-wider">
              {sortBy === 'rivals' ? 'Rivales Únicos' : sortBy === 'seasons' ? 'Temporadas Totales' : 'Nombre del Club'} ({sortOrder === 'asc' ? 'Ascendente' : 'Descendente'})
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none transition cursor-pointer"
            >
              <option value="">Todos los países</option>
              {countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Buscar club en la tabla..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* Tabla Principal */}
        <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-lg font-bold text-slate-200">Rivales Únicos por Equipo</h2>
            <p className="text-slate-400 text-xs mt-0.5">Clasificación de equipos según el número de oponentes diferentes que han enfrentado en competiciones europeas.</p>
          </div>

          {sortedStats.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              No hay datos que coincidan con la búsqueda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 text-xs uppercase font-semibold">
                    <th className="py-4 px-6 text-center w-16 select-none">Pos</th>
                    <th
                      onClick={() => handleSort('name')}
                      className="py-4 px-6 cursor-pointer select-none hover:text-emerald-400 transition"
                    >
                      Club {sortBy === 'name' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th
                      onClick={() => handleSort('rivals')}
                      className="py-4 px-6 text-center cursor-pointer select-none hover:text-emerald-400 transition w-44"
                    >
                      Rivales Únicos {sortBy === 'rivals' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th
                      onClick={() => handleSort('seasons')}
                      className="py-4 px-6 text-center cursor-pointer select-none hover:text-emerald-400 transition w-56"
                    >
                      Temporadas Jugadas {sortBy === 'seasons' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th className="py-4 px-6">Oponentes Enfrentados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-sm">
                  {sortedStats.map((team, idx) => (
                    <tr key={team.id} className="hover:bg-slate-900/50 transition">
                      <td className="py-4 px-6 text-center font-mono font-bold text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-200">{team.name}</span>
                          <span className="text-slate-500 text-xs">{team.country}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="inline-block bg-emerald-950 text-emerald-400 font-bold px-3 py-1 rounded-full border border-emerald-800/40 text-sm">
                          {team.distinctRivalsCount}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center font-mono font-medium text-slate-300">
                        {team.totalSeasons}
                      </td>
                      <td className="py-4 px-6">
                        {showRivals[team.id] ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap gap-1.5 max-w-xl">
                              {team.rivalsList.length === 0 ? (
                                <span className="text-slate-600 text-xs italic">Ninguno registrado</span>
                              ) : (
                                team.rivalsList.map((rival, rIdx) => (
                                  <span
                                    key={rIdx}
                                    className="bg-slate-900 text-slate-400 text-[10px] px-2 py-0.5 rounded border border-slate-800"
                                  >
                                    {rival}
                                  </span>
                                ))
                              )}
                            </div>
                            <button
                              onClick={() => toggleRivals(team.id)}
                              className="text-left text-xs text-amber-500 hover:text-amber-400 hover:underline w-fit font-medium cursor-pointer"
                            >
                              Ocultar rivales
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => toggleRivals(team.id)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1 rounded text-xs transition font-medium cursor-pointer"
                          >
                            Mostrar rivales
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
