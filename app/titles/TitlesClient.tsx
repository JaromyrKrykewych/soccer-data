'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export interface TitleRow {
  id: number;
  title_name: 'champion' | 'runner-up';
  teams: {
    id: number;
    current_name: string;
    countries: {
      id: number;
      name: string;
    } | null;
  } | null;
  competitions: {
    id: number;
    name: string;
  } | null;
  seasons: {
    id: number;
    year_start: number;
    year_end: number;
  } | null;
}

interface TitlesClientProps {
  initialTitles: TitleRow[];
  titlesTableExists: boolean;
}

const isUefaEuropaLeagueOrCup = (name: string): boolean => {
  const normalized = name.toLowerCase().trim();
  return (
    normalized === 'copa uefa' ||
    normalized === 'uefa cup' ||
    normalized === 'uefa europa league' ||
    normalized === 'europa league'
  );
};

const isUefaChampionsLeagueOrCup = (name: string): boolean => {
  const normalized = name.toLowerCase().trim();
  return (
    normalized === 'copa de europa' ||
    normalized === 'uefa champions league' ||
    normalized === 'champions league'
  );
};

export default function TitlesClient({ initialTitles, titlesTableExists }: TitlesClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'palmares' | 'history'>('palmares');
  const [unifyUefaCup, setUnifyUefaCup] = useState(true);

  // 1. Obtener lista única de competiciones
  const competitions = useMemo(() => {
    const comps = new Set<string>();
    initialTitles.forEach((t) => {
      const name = t.competitions?.name;
      if (name) {
        if (unifyUefaCup && isUefaEuropaLeagueOrCup(name)) {
          comps.add('UEFA Europa League / Copa UEFA');
        } else if (unifyUefaCup && isUefaChampionsLeagueOrCup(name)) {
          comps.add('UEFA Champions League / Copa de Europa');
        } else {
          comps.add(name);
        }
      }
    });
    return Array.from(comps).sort();
  }, [initialTitles, unifyUefaCup]);

  // Si el tab activo no está en la lista de competiciones, volver a 'ALL'
  useMemo(() => {
    if (activeTab !== 'ALL' && !competitions.includes(activeTab)) {
      setActiveTab('ALL');
    }
  }, [competitions, activeTab]);

  // 2. Filtrar títulos por competición seleccionada
  const filteredByCompTitles = useMemo(() => {
    if (activeTab === 'ALL') return initialTitles;
    if (unifyUefaCup && activeTab === 'UEFA Europa League / Copa UEFA') {
      return initialTitles.filter(
        (t) => t.competitions?.name && isUefaEuropaLeagueOrCup(t.competitions.name)
      );
    }
    if (unifyUefaCup && activeTab === 'UEFA Champions League / Copa de Europa') {
      return initialTitles.filter(
        (t) => t.competitions?.name && isUefaChampionsLeagueOrCup(t.competitions.name)
      );
    }
    return initialTitles.filter((t) => t.competitions?.name === activeTab);
  }, [initialTitles, activeTab, unifyUefaCup]);

  // 3. Procesar Palmarés (Resumen de campeonatos y subcampeonatos por equipo)
  const palmaresList = useMemo(() => {
    const statsMap = new Map<number, { name: string; championCount: number; runnerUpCount: number }>();

    filteredByCompTitles.forEach((t) => {
      const teamId = t.teams?.id;
      const teamName = t.teams?.current_name;
      if (!teamId || !teamName) return;

      if (!statsMap.has(teamId)) {
        statsMap.set(teamId, { name: teamName, championCount: 0, runnerUpCount: 0 });
      }

      const teamStats = statsMap.get(teamId)!;
      if (t.title_name === 'champion') {
        teamStats.championCount += 1;
      } else if (t.title_name === 'runner-up') {
        teamStats.runnerUpCount += 1;
      }
    });

    const list = Array.from(statsMap.values());

    // Filtrar por término de búsqueda si existe
    const query = searchQuery.toLowerCase().trim();
    const searchedList = query
      ? list.filter((item) => item.name.toLowerCase().includes(query))
      : list;

    // Ordenar: Campeón desc, Subcampeón desc, Nombre asc
    return searchedList.sort((a, b) => {
      if (b.championCount !== a.championCount) {
        return b.championCount - a.championCount;
      }
      if (b.runnerUpCount !== a.runnerUpCount) {
        return b.runnerUpCount - a.runnerUpCount;
      }
      return a.name.localeCompare(b.name);
    });
  }, [filteredByCompTitles, searchQuery]);

  // 3.5. Procesar Palmarés por País (Resumen de campeonatos y subcampeonatos por país)
  const countryPalmaresList = useMemo(() => {
    const statsMap = new Map<string, { name: string; championCount: number; runnerUpCount: number }>();

    filteredByCompTitles.forEach((t) => {
      const countryName = t.teams?.countries?.name || 'Desconocido';

      if (!statsMap.has(countryName)) {
        statsMap.set(countryName, { name: countryName, championCount: 0, runnerUpCount: 0 });
      }

      const countryStats = statsMap.get(countryName)!;
      if (t.title_name === 'champion') {
        countryStats.championCount += 1;
      } else if (t.title_name === 'runner-up') {
        countryStats.runnerUpCount += 1;
      }
    });

    const list = Array.from(statsMap.values());

    // Filtrar por término de búsqueda si existe
    const query = searchQuery.toLowerCase().trim();
    const searchedList = query
      ? list.filter((item) => item.name.toLowerCase().includes(query))
      : list;

    // Ordenar: Campeón desc, Subcampeón desc, Nombre asc
    return searchedList.sort((a, b) => {
      if (b.championCount !== a.championCount) {
        return b.championCount - a.championCount;
      }
      if (b.runnerUpCount !== a.runnerUpCount) {
        return b.runnerUpCount - a.runnerUpCount;
      }
      return a.name.localeCompare(b.name);
    });
  }, [filteredByCompTitles, searchQuery]);

  // 4. Procesar historial cronológico por temporada
  const historyList = useMemo(() => {
    const seasonsMap = new Map<
      string,
      {
        seasonKey: string;
        yearStart: number;
        competitionName: string;
        champion: string;
        runnerUp: string;
      }
    >();

    filteredByCompTitles.forEach((t) => {
      const season = t.seasons;
      const compName = t.competitions?.name;
      if (!season || !compName) return;

      const yrStart = season.year_start;
      const yrEnd = String(season.year_end).slice(-2);
      const seasonKey = `${yrStart}-${yrEnd}`;

      // Creamos una clave única por temporada y competición para agrupar
      const uniqueKey = `${compName}_${seasonKey}`;

      if (!seasonsMap.has(uniqueKey)) {
        seasonsMap.set(uniqueKey, {
          seasonKey,
          yearStart: yrStart,
          competitionName: compName,
          champion: '-',
          runnerUp: '-',
        });
      }

      const row = seasonsMap.get(uniqueKey)!;
      if (t.title_name === 'champion') {
        row.champion = t.teams?.current_name || 'Desconocido';
      } else if (t.title_name === 'runner-up') {
        row.runnerUp = t.teams?.current_name || 'Desconocido';
      }
    });

    const list = Array.from(seasonsMap.values());

    // Filtrar por búsqueda (si coincide con campeón o subcampeón)
    const query = searchQuery.toLowerCase().trim();
    const searchedList = query
      ? list.filter(
        (row) =>
          row.champion.toLowerCase().includes(query) ||
          row.runnerUp.toLowerCase().includes(query)
      )
      : list;

    // Ordenar de más reciente a más antigua
    return searchedList.sort((a, b) => b.yearStart - a.yearStart);
  }, [filteredByCompTitles, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-16">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-10 px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-amber-400 flex items-center gap-2">
              🏆 Palmarés & Títulos
            </h1>
            <p className="text-slate-400 text-sm">Registro histórico de Campeones y Subcampeones.</p>
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
        {/* Banner de Supabase SQL Warning si no existe la tabla */}
        {!titlesTableExists && (
          <div className="bg-amber-950/40 border border-amber-800 text-amber-300 p-6 rounded-xl mb-8 text-sm flex flex-col gap-4">
            <div>
              <strong className="text-amber-400 text-base block mb-1">⚠️ Tabla Titles no detectada</strong>
              La tabla `titles` no se detecta en la base de datos de Supabase. El historial de campeonatos y subcampeonatos estará deshabilitado hasta que ejecutes el script SQL para crear la tabla.
            </div>
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 font-mono text-xs overflow-x-auto text-slate-300">
              {`CREATE TABLE Titles (
    id SERIAL PRIMARY KEY,
    team_id INT REFERENCES Teams(id) ON DELETE CASCADE,
    competition_id INT REFERENCES Competitions(id) ON DELETE CASCADE,
    season_id INT REFERENCES Seasons(id) ON DELETE CASCADE,
    title_name VARCHAR(100) NOT NULL CHECK (title_name IN ('champion', 'runner-up')),
    CONSTRAINT unique_season_team UNIQUE (season_id, team_id),
    CONSTRAINT unique_season_title UNIQUE (season_id, title_name)
);`}
            </div>
            <p className="text-slate-400 text-xs">
              Por favor ejecuta el script de arriba en la consola de Supabase (SQL Editor) y luego recarga esta página.
            </p>
          </div>
        )}

        {titlesTableExists && (
          <>
            {/* Panel superior con filtros y buscador */}
            <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
              {/* Buscador de Clubes */}
              <div className="flex flex-col gap-1.5 w-full md:w-80">
                <label className="text-slate-450 text-xs font-semibold uppercase tracking-wider">Buscar Club</label>
                <input
                  type="text"
                  placeholder="Ej: Real Madrid, Milan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none transition w-full"
                />
              </div>

              {/* Unificación de Copas Históricas */}
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-450 text-xs font-semibold uppercase tracking-wider">Unificar Copas Históricas</label>
                <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-lg">
                  <button
                    onClick={() => setUnifyUefaCup(true)}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${unifyUefaCup
                      ? 'bg-amber-550 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    🤝 Unificadas
                  </button>
                  <button
                    onClick={() => setUnifyUefaCup(false)}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${!unifyUefaCup
                      ? 'bg-amber-550 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    🔍 Separadas
                  </button>
                </div>
              </div>

              {/* Selector de Modo de Vista */}
              <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode('palmares')}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'palmares'
                    ? 'bg-amber-550 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  🥇 Palmarés General
                </button>
                <button
                  onClick={() => setViewMode('history')}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'history'
                    ? 'bg-amber-550 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  📅 Historial Cronológico
                </button>
              </div>
            </div>

            {/* Selector de Competición (Pestañas horizontales) */}
            <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-thin border-b border-slate-800/60">
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap border ${activeTab === 'ALL'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-550/40'
                  : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-905/80'
                  }`}
              >
                Todas las Copas
              </button>
              {competitions.map((comp) => (
                <button
                  key={comp}
                  onClick={() => setActiveTab(comp)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap border ${activeTab === comp
                    ? 'bg-amber-500/10 text-amber-400 border-amber-550/40'
                    : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-905/80'
                    }`}
                >
                  🏆 {comp}
                </button>
              ))}
            </div>

            {/* Listado de Datos según vista seleccionada */}
            {initialTitles.length === 0 ? (
              <div className="text-center py-16 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-4xl block mb-2">🤷‍♂️</span>
                <h3 className="text-lg font-semibold text-slate-350">No hay títulos cargados</h3>
                <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
                  Dirígete al Importador para registrar el palmarés de la final en la base de datos de Supabase.
                </p>
              </div>
            ) : viewMode === 'palmares' ? (
              /* TABLA DE PALMARÉS GENERAL (CLUBES & PAÍSES SIDE BY SIDE) */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* TABLA DE PALMARÉS CLUBES */}
                <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
                  <div className="p-4 bg-slate-900/40 border-b border-slate-850 flex items-center justify-between">
                    <h3 className="font-bold text-white flex items-center gap-1.5">
                      <span>🥇</span> Palmarés de Clubes
                    </h3>
                    <span className="text-xs text-slate-400 font-medium">({palmaresList.length} Equipos)</span>
                  </div>
                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-850 bg-slate-900/60 text-slate-400 text-xs font-bold uppercase tracking-wider">
                          <th className="py-4 px-6 w-16 text-center">Pos</th>
                          <th className="py-4 px-6">Club</th>
                          <th className="py-4 px-6 text-center">Campeón 🥇</th>
                          <th className="py-4 px-6 text-center">Subcampeón 🥈</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/50">
                        {palmaresList.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-500">
                              Ningún equipo coincide con la búsqueda.
                            </td>
                          </tr>
                        ) : (
                          palmaresList.map((item, index) => (
                            <tr
                              key={item.name}
                              className="hover:bg-slate-900/40 transition-colors group"
                            >
                              <td className="py-4 px-6 font-bold text-slate-400 text-center">
                                {index + 1}
                              </td>
                              <td className="py-4 px-6 font-bold text-white group-hover:text-amber-400 transition-colors">
                                {item.name}
                              </td>
                              <td className="py-4 px-6 text-center font-bold text-amber-400 text-base">
                                {item.championCount}
                              </td>
                              <td className="py-4 px-6 text-center font-bold text-slate-300 text-base">
                                {item.runnerUpCount}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* TABLA DE PALMARÉS PAÍSES */}
                <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col h-fit">
                  <div className="p-4 bg-slate-900/40 border-b border-slate-850 flex items-center justify-between">
                    <h3 className="font-bold text-white flex items-center gap-1.5">
                      <span>🌍</span> Palmarés de Países
                    </h3>
                    <span className="text-xs text-slate-400 font-medium">({countryPalmaresList.length} Países)</span>
                  </div>
                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-850 bg-slate-900/60 text-slate-400 text-xs font-bold uppercase tracking-wider">
                          <th className="py-4 px-6 w-16 text-center">Pos</th>
                          <th className="py-4 px-6">País</th>
                          <th className="py-4 px-6 text-center">Campeón 🥇</th>
                          <th className="py-4 px-6 text-center">Subcampeón 🥈</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/50">
                        {countryPalmaresList.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-500">
                              Ningún país coincide con la búsqueda.
                            </td>
                          </tr>
                        ) : (
                          countryPalmaresList.map((item, index) => (
                            <tr
                              key={item.name}
                              className="hover:bg-slate-900/40 transition-colors group"
                            >
                              <td className="py-4 px-6 font-bold text-slate-400 text-center">
                                {index + 1}
                              </td>
                              <td className="py-4 px-6 font-bold text-white group-hover:text-amber-400 transition-colors">
                                {item.name}
                              </td>
                              <td className="py-4 px-6 text-center font-bold text-amber-400 text-base">
                                {item.championCount}
                              </td>
                              <td className="py-4 px-6 text-center font-bold text-slate-300 text-base">
                                {item.runnerUpCount}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              /* HISTORIAL POR TEMPORADA */
              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-850 bg-slate-900/60 text-slate-400 text-xs font-bold uppercase tracking-wider">
                        <th className="py-4 px-6 w-32">Temporada</th>
                        {activeTab === 'ALL' && <th className="py-4 px-6">Competición</th>}
                        <th className="py-4 px-6">Campeón 🥇</th>
                        <th className="py-4 px-6">Subcampeón 🥈</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/50">
                      {historyList.length === 0 ? (
                        <tr>
                          <td
                            colSpan={activeTab === 'ALL' ? 4 : 3}
                            className="py-8 text-center text-slate-500"
                          >
                            Ninguna temporada coincide con la búsqueda.
                          </td>
                        </tr>
                      ) : (
                        historyList.map((row) => (
                          <tr
                            key={`${row.competitionName}_${row.seasonKey}`}
                            className="hover:bg-slate-900/40 transition-colors"
                          >
                            <td className="py-4 px-6 font-mono font-bold text-slate-300">
                              {row.seasonKey}
                            </td>
                            {activeTab === 'ALL' && (
                              <td className="py-4 px-6 text-slate-400 font-medium">
                                {row.competitionName}
                              </td>
                            )}
                            <td className="py-4 px-6 text-emerald-400 font-bold">
                              {row.champion}
                            </td>
                            <td className="py-4 px-6 text-slate-300 font-semibold">
                              {row.runnerUp}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
