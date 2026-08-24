'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface TeamInfo {
  id: number;
  current_name: string;
  countries: {
    id: number;
    name: string;
  } | null;
}

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

interface HistoricClientProps {
  teams: TeamInfo[];
  initialMatches: MatchRow[];
}

export default function HistoricClient({ teams, initialMatches }: HistoricClientProps) {
  // State for selected teams
  const [selectedTeams, setSelectedTeams] = useState<TeamInfo[]>([]);
  // State to track if localStorage has been initialized to avoid overwriting on first render
  const [isLoaded, setIsLoaded] = useState(false);

  // Load stored teams on mount
  useEffect(() => {
    const stored = localStorage.getItem('historic_selected_teams');
    if (stored) {
      try {
        const parsedIds = JSON.parse(stored) as number[];
        const restored = parsedIds
          .map((id) => teams.find((t) => t.id === id))
          .filter((t): t is TeamInfo => !!t);
        setSelectedTeams(restored);
      } catch (e) {
        console.error("Error reading stored teams from localStorage:", e);
      }
    }
    setIsLoaded(true);
  }, [teams]);

  // Save selection changes to localStorage
  useEffect(() => {
    if (isLoaded) {
      const ids = selectedTeams.map((t) => t.id);
      localStorage.setItem('historic_selected_teams', JSON.stringify(ids));
    }
  }, [selectedTeams, isLoaded]);

  // Drag and Drop states for reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    const updated = [...selectedTeams];
    const [removed] = updated.splice(draggedIndex, 1);
    updated.splice(index, 0, removed);
    setSelectedTeams(updated);
    setDraggedIndex(null);
  };

  // State for team search
  const [searchTerm, setSearchTerm] = useState('');
  // State to manage search dropdown open/close
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  // State for active H2H cell clicked details
  const [activeH2H, setActiveH2H] = useState<{
    teamA: TeamInfo;
    teamB: TeamInfo;
    matches: MatchRow[];
  } | null>(null);
  // State for H2H perspective tabs ('general', 'teamA' local, 'teamB' local)
  const [h2hTab, setH2hTab] = useState<'general' | 'teamA' | 'teamB'>('general');
  // State for search filter of common rivals table
  const [rivalSearchTerm, setRivalSearchTerm] = useState('');
  // State for rivals table page size / display count
  const [visibleRivalsCount, setVisibleRivalsCount] = useState(10);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter teams for search autocomplete
  const autocompleteResults = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return [];

    const selectedIds = new Set(selectedTeams.map((t) => t.id));
    return teams
      .filter((t) => t.current_name.toLowerCase().includes(query) && !selectedIds.has(t.id))
      .slice(0, 8); // Limit to top 8 results
  }, [searchTerm, selectedTeams, teams]);

  // Map of teams for quick name/country lookups
  const teamsMap = useMemo(() => {
    return new Map<number, TeamInfo>(teams.map((t) => [t.id, t]));
  }, [teams]);

  // Precalculated H2H matches dictionary
  const h2hMatchesDict = useMemo(() => {
    const dict = new Map<string, MatchRow[]>();
    if (selectedTeams.length < 2) return dict;

    const selectedIds = new Set(selectedTeams.map((t) => t.id));

    // Filter matches where both home and away teams are selected
    const relevantMatches = initialMatches.filter(
      (m) => selectedIds.has(m.home_team_id) && selectedIds.has(m.away_team_id)
    );

    relevantMatches.forEach((m) => {
      const idA = m.home_team_id;
      const idB = m.away_team_id;
      // Key is sorted string of team IDs to guarantee uniqueness
      const key = idA < idB ? `${idA}_${idB}` : `${idB}_${idA}`;

      if (!dict.has(key)) {
        dict.set(key, []);
      }
      dict.get(key)!.push(m);
    });

    return dict;
  }, [selectedTeams, initialMatches]);

  // Method to add team to selection
  const handleSelectTeam = (team: TeamInfo) => {
    if (!selectedTeams.some((t) => t.id === team.id)) {
      setSelectedTeams([...selectedTeams, team]);
    }
    setSearchTerm('');
    setIsDropdownOpen(false);
    setActiveH2H(null); // Reset H2H detail view
  };

  // Method to remove team from selection
  const handleRemoveTeam = (id: number) => {
    setSelectedTeams(selectedTeams.filter((t) => t.id !== id));
    setActiveH2H(null); // Reset H2H detail view
  };

  // Clear all selections
  const handleClearAll = () => {
    setSelectedTeams([]);
    setActiveH2H(null);
    setSearchTerm('');
    setIsDropdownOpen(false);
  };

  // Export selected teams list to a JSON file
  const handleExportTeams = () => {
    if (selectedTeams.length === 0) return;
    const teamIds = selectedTeams.map((t) => t.id);
    const exportData = {
      version: 1,
      type: "soccer-matrix",
      teamIds: teamIds,
      teamNames: selectedTeams.map((t) => t.current_name)
    };
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `matrix-equipos-${selectedTeams.length}-${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Import team selection from a JSON file
  const handleImportTeams = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);
        
        let importedIds: number[] = [];
        
        if (data && typeof data === 'object') {
          if (data.type === "soccer-matrix" && Array.isArray(data.teamIds)) {
            importedIds = data.teamIds;
          } else if (Array.isArray(data)) {
            importedIds = data.map((item: any) => {
              if (typeof item === 'number') return item;
              if (item && typeof item === 'object' && typeof item.id === 'number') return item.id;
              return null;
            }).filter((id): id is number => id !== null);
          }
        }
        
        if (importedIds.length === 0) {
          alert("El archivo no contiene un formato de equipos válido.");
          return;
        }

        // Map IDs to actual TeamInfo objects from the `teams` prop
        const restored = importedIds
          .map((id) => teams.find((t) => t.id === id))
          .filter((t): t is TeamInfo => !!t);

        if (restored.length === 0) {
          alert("Ninguno de los equipos importados coincide con los equipos cargados en la base de datos.");
          return;
        }

        setSelectedTeams(restored);
        setActiveH2H(null);
        alert(`Se cargaron con éxito ${restored.length} equipos.`);
      } catch (err) {
        console.error("Error al importar equipos:", err);
        alert("Ocurrió un error al procesar el archivo. Asegúrate de que sea un archivo JSON válido.");
      }
      
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  // Get matches between two teams
  const getMatchesList = (idA: number, idB: number) => {
    const key = idA < idB ? `${idA}_${idB}` : `${idB}_${idA}`;
    return h2hMatchesDict.get(key) || [];
  };

  // Helper to count how many of the other selected teams this team has faced in the matrix
  const getRowMatrixCoincidences = (teamRowId: number) => {
    let count = 0;
    selectedTeams.forEach((t) => {
      if (t.id === teamRowId) return;
      const matches = getMatchesList(teamRowId, t.id);
      if (matches.length > 0) {
        count++;
      }
    });
    return count;
  };

  // Cell click action on matrix
  const handleCellClick = (teamA: TeamInfo, teamB: TeamInfo) => {
    if (teamA.id === teamB.id) return;
    const matches = getMatchesList(teamA.id, teamB.id);
    if (matches.length === 0) return;

    setActiveH2H({ teamA, teamB, matches });
    setH2hTab('general');

    // Scroll to details section smoothly after render
    setTimeout(() => {
      detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Calculate detailed summary stats for selected H2H
  const activeH2HStats = useMemo(() => {
    if (!activeH2H) return null;
    const { teamA, teamB, matches } = activeH2H;
    let winsA = 0;
    let winsB = 0;
    let draws = 0;

    let winsAHome = 0;
    let winsBAtA = 0;
    let drawsAHome = 0;
    let totalAHome = 0;

    let winsBHome = 0;
    let winsAAtB = 0;
    let drawsBHome = 0;
    let totalBHome = 0;

    let winsANeutral = 0;
    let winsBNeutral = 0;
    let drawsNeutral = 0;
    let totalNeutral = 0;

    matches.forEach((m) => {
      const isHomeA = m.home_team_id === teamA.id;
      const isHomeB = m.home_team_id === teamB.id;

      const goalsA = isHomeA ? m.home_goals : m.away_goals;
      const goalsB = isHomeB ? m.home_goals : m.away_goals;
      const penA = isHomeA ? m.penalty_home_goals : m.penalty_away_goals;
      const penB = isHomeB ? m.penalty_home_goals : m.penalty_away_goals;

      let matchWinner: 'A' | 'B' | 'draw' = 'draw';

      if (goalsA > goalsB) {
        matchWinner = 'A';
      } else if (goalsB > goalsA) {
        matchWinner = 'B';
      }

      // Update general stats
      if (matchWinner === 'A') {
        winsA++;
      } else if (matchWinner === 'B') {
        winsB++;
      } else {
        draws++;
      }

      // Update venue-specific stats
      if (m.is_neutral) {
        totalNeutral++;
        if (matchWinner === 'A') winsANeutral++;
        else if (matchWinner === 'B') winsBNeutral++;
        else drawsNeutral++;
      } else if (isHomeA) {
        totalAHome++;
        if (matchWinner === 'A') winsAHome++;
        else if (matchWinner === 'B') winsBAtA++;
        else drawsAHome++;
      } else if (isHomeB) {
        totalBHome++;
        if (matchWinner === 'B') winsBHome++;
        else if (matchWinner === 'A') winsAAtB++;
        else drawsBHome++;
      }
    });

    return {
      winsA,
      winsB,
      draws,
      total: matches.length,
      aHome: { total: totalAHome, winsA: winsAHome, winsB: winsBAtA, draws: drawsAHome },
      bHome: { total: totalBHome, winsB: winsBHome, winsA: winsAAtB, draws: drawsBHome },
      neutral: { total: totalNeutral, winsA: winsANeutral, winsB: winsBNeutral, draws: drawsNeutral }
    };
  }, [activeH2H]);

  // Filter matches based on selected tab ('general', 'teamA' local, 'teamB' local) and sort by season descending (most recent first)
  const filteredMatches = useMemo(() => {
    if (!activeH2H) return [];
    let matches = [...activeH2H.matches];
    if (h2hTab === 'teamA') {
      matches = matches.filter(
        (m) => m.home_team_id === activeH2H.teamA.id && !m.is_neutral
      );
    } else if (h2hTab === 'teamB') {
      matches = matches.filter(
        (m) => m.home_team_id === activeH2H.teamB.id && !m.is_neutral
      );
    }

    return matches.sort((a, b) => {
      const yearA = a.seasons?.year_start ?? 0;
      const yearB = b.seasons?.year_start ?? 0;
      return yearB - yearA;
    });
  }, [activeH2H, h2hTab]);

  // Adapt the quick summary stats dynamically to the active tab
  const currentStats = useMemo(() => {
    if (!activeH2HStats || !activeH2H) return null;
    if (h2hTab === 'teamA') {
      return {
        total: activeH2HStats.aHome.total,
        winsA: activeH2HStats.aHome.winsA,
        winsB: activeH2HStats.aHome.winsB,
        draws: activeH2HStats.aHome.draws,
        labelA: `Victorias ${activeH2H.teamA.current_name} (Local)`,
        labelB: `Victorias ${activeH2H.teamB.current_name} (Visitante)`
      };
    }
    if (h2hTab === 'teamB') {
      return {
        total: activeH2HStats.bHome.total,
        winsA: activeH2HStats.bHome.winsA,
        winsB: activeH2HStats.bHome.winsB,
        draws: activeH2HStats.bHome.draws,
        labelA: `Victorias ${activeH2H.teamA.current_name} (Visitante)`,
        labelB: `Victorias ${activeH2H.teamB.current_name} (Local)`
      };
    }
    return {
      total: activeH2HStats.total,
      winsA: activeH2HStats.winsA,
      winsB: activeH2HStats.winsB,
      draws: activeH2HStats.draws,
      labelA: `Victorias ${activeH2H.teamA.current_name}`,
      labelB: `Victorias ${activeH2H.teamB.current_name}`
    };
  }, [activeH2H, activeH2HStats, h2hTab]);

  // Compute common rivals list
  const commonRivalsList = useMemo(() => {
    if (selectedTeams.length === 0) return [];

    const selectedIds = new Set(selectedTeams.map((t) => t.id));
    const rivalStats = new Map<
      number,
      {
        rivalId: number;
        totalMatches: number;
        breakdown: { [selectedId: number]: number };
      }
    >();

    initialMatches.forEach((m) => {
      const homeIn = selectedIds.has(m.home_team_id);
      const awayIn = selectedIds.has(m.away_team_id);

      // Case 1: local is selected, away is not
      if (homeIn && !awayIn) {
        const selectedId = m.home_team_id;
        const rivalId = m.away_team_id;
        if (!rivalStats.has(rivalId)) {
          rivalStats.set(rivalId, { rivalId, totalMatches: 0, breakdown: {} });
        }
        const stats = rivalStats.get(rivalId)!;
        stats.totalMatches += 1;
        stats.breakdown[selectedId] = (stats.breakdown[selectedId] || 0) + 1;
      }
      // Case 2: away is selected, local is not
      else if (!homeIn && awayIn) {
        const selectedId = m.away_team_id;
        const rivalId = m.home_team_id;
        if (!rivalStats.has(rivalId)) {
          rivalStats.set(rivalId, { rivalId, totalMatches: 0, breakdown: {} });
        }
        const stats = rivalStats.get(rivalId)!;
        stats.totalMatches += 1;
        stats.breakdown[selectedId] = (stats.breakdown[selectedId] || 0) + 1;
      }
    });

    // Map stats with name, country and format for table
    return Array.from(rivalStats.values())
      .map((stats) => {
        const teamObj = teamsMap.get(stats.rivalId);
        const uniqueCoincidences = Object.keys(stats.breakdown).length;
        return {
          ...stats,
          uniqueCoincidences,
          teamName: teamObj?.current_name || `Club #${stats.rivalId}`,
          country: teamObj?.countries?.name || 'Desconocido',
          teamObj,
        };
      })
      .sort((a, b) => {
        if (b.uniqueCoincidences !== a.uniqueCoincidences) {
          return b.uniqueCoincidences - a.uniqueCoincidences;
        }
        if (b.totalMatches !== a.totalMatches) {
          return b.totalMatches - a.totalMatches;
        }
        return a.teamName.localeCompare(b.teamName);
      });
  }, [selectedTeams, initialMatches, teamsMap]);

  // Filter common rivals list by search input
  const filteredCommonRivals = useMemo(() => {
    const q = rivalSearchTerm.toLowerCase().trim();
    if (!q) return commonRivalsList;

    return commonRivalsList.filter(
      (rival) =>
        rival.teamName.toLowerCase().includes(q) ||
        rival.country.toLowerCase().includes(q)
    );
  }, [commonRivalsList, rivalSearchTerm]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-24 selection:bg-pink-500 selection:text-slate-950">
      {/* Background glow decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-100 bg-linear-to-b from-pink-500/10 via-indigo-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">⚔️</span>
              <h1 className="text-2xl font-bold tracking-tight text-pink-400">Comparador Histórico (H2H)</h1>
            </div>
            <p className="text-slate-400 text-sm">Compara enfrentamientos directos entre clubes en Copas Europeas y analiza rivales en común.</p>
          </div>
          <div>
            <Link
              href="/"
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-lg transition font-medium text-sm flex items-center gap-1.5 cursor-pointer"
            >
              🏠 Menú Principal
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 mt-8">

        {/* SECTION 1: Team Search & Badges */}
        <section className="bg-slate-950 p-6 rounded-xl border border-slate-800 mb-8 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span>🔍</span> Seleccionar Clubes
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            {/* Search Input Container */}
            <div className="relative" ref={searchContainerRef}>
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">
                Buscar y agregar equipo
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ej: Real Madrid, AC Milan, Chelsea..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg pl-3 pr-10 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-pink-500/30 transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Dropdown Results */}
              {isDropdownOpen && autocompleteResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1.5 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50 max-h-60 overflow-y-auto divide-y">
                  {autocompleteResults.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => handleSelectTeam(team)}
                      className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-pink-500/10 hover:text-white transition-all flex justify-between items-center cursor-pointer"
                    >
                      <span className="font-semibold">{team.current_name}</span>
                      <span className="text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800/80">
                        {team.countries?.name || 'Desconocido'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {isDropdownOpen && searchTerm.trim() !== '' && autocompleteResults.length === 0 && (
                <div className="absolute left-0 right-0 mt-1.5 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-4 text-center text-xs text-slate-500 z-50">
                  No se encontraron clubes disponibles que coincidan.
                </div>
              )}
            </div>

            {/* Selected Badges Section */}
            <div className="lg:col-span-2 bg-slate-900/50 p-4 rounded-xl border border-slate-800/40 min-h-20 flex flex-col justify-between">
              <div>
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-2">
                  Equipos en Comparación ({selectedTeams.length})
                </span>

                {selectedTeams.length === 0 ? (
                  <p className="text-slate-600 text-sm italic">Usa el buscador de la izquierda para empezar a sumar clubes...</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedTeams.map((team, index) => (
                      <span
                        key={team.id}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e)}
                        onDrop={() => handleDrop(index)}
                        onDragEnd={() => setDraggedIndex(null)}
                        className={`inline-flex items-center gap-1.5 bg-slate-850 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-full text-xs font-medium hover:border-pink-500/50 transition-all cursor-grab select-none ${draggedIndex === index ? 'opacity-40 border-pink-500/30' : ''
                          }`}
                        title="Arrastra para reordenar en la matriz"
                      >
                        <span className="text-slate-500 select-none font-mono mr-0.5">⋮⋮</span>
                        <span>{team.current_name}</span>
                        <span className="text-[10px] text-slate-500 bg-slate-900 px-1 rounded-sm">
                          {team.countries?.name || 'Desconocido'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveTeam(team.id);
                          }}
                          className="hover:bg-slate-700 rounded-full w-4 h-4 inline-flex items-center justify-center text-slate-500 hover:text-white font-bold text-[10px] transition-colors cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 flex justify-between items-center gap-2 flex-wrap border-t border-slate-800/40 pt-4">
                {/* Import / Export controls */}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    id="import-teams-file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImportTeams}
                  />
                  <button
                    onClick={() => document.getElementById('import-teams-file')?.click()}
                    className="text-xs bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-750 px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1 cursor-pointer"
                    title="Cargar lista de equipos desde un archivo JSON"
                  >
                    📥 Cargar Matrix
                  </button>
                  <button
                    onClick={handleExportTeams}
                    disabled={selectedTeams.length === 0}
                    className={`text-xs px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1 cursor-pointer ${
                      selectedTeams.length === 0
                        ? 'bg-slate-900/50 text-slate-650 border border-slate-850 cursor-not-allowed'
                        : 'bg-pink-650 hover:bg-pink-650 text-white border border-pink-700/50 shadow-md shadow-pink-500/5 hover:shadow-pink-500/10'
                    }`}
                    title="Descargar la lista actual de equipos en un archivo JSON"
                  >
                    📤 Guardar Matrix
                  </button>
                </div>

                {selectedTeams.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-slate-500 hover:text-pink-400 transition-colors font-medium border border-transparent hover:border-pink-500/20 px-2.5 py-1 rounded cursor-pointer"
                  >
                    🧹 Limpiar Selección
                  </button>
                )}
              </div>
            </div>

          </div>
        </section>

        {/* SECTION 2: H2H Matrix Table */}
        <section className="mb-12">
          <div className="text-center md:text-left max-w-xl mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 justify-center md:justify-start">
              <span>⚔️</span> Matriz de Enfrentamientos Cruzados
            </h2>
            <p className="text-sm text-slate-400">
              Cruza los equipos seleccionados. Haz clic en una celda verde para desglosar el listado completo de enfrentamientos.
            </p>
          </div>

          {selectedTeams.length < 2 ? (
            <div className=" bg-slate-950 rounded-xl border border-slate-800 p-12 text-center shadow-xl">
              <span className="text-4xl block mb-3 opacity-50">🏟️</span>
              <h3 className="text-slate-300 font-bold text-lg mb-1">Matriz Inactiva</h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                Debes seleccionar al menos <span className="text-pink-400 font-semibold">dos clubes</span> para cruzar sus historiales de partidos.
              </p>
            </div>
          ) : (
            /* Wrapper div structured with 90% fixed width and scroll support */
            <div className=" bg-slate-950 p-6 rounded-xl border border-slate-800 shadow-2xl overflow-hidden">
              <div className="overflow-auto max-h-150 w-full rounded-lg border border-slate-800">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-900">
                      {/* Top left corner cell - sticky left & top */}
                      <th className="sticky left-0 top-0 bg-slate-900 z-30 border-r border-b border-slate-800 min-w-50 p-4 text-left text-slate-400 font-bold text-xs uppercase tracking-wider">
                        Clubes
                      </th>
                      {/* Column headers for selected teams */}
                      {selectedTeams.map((team) => (
                        <th
                          key={team.id}
                          className="sticky top-0 bg-slate-900 z-20 border-b border-slate-800 min-w-37.5 max-w-55 p-4 text-center text-xs text-slate-300 truncate"
                        >
                          <div className="font-bold truncate">{team.current_name}</div>
                          <div className="text-[10px] text-slate-500 font-normal mt-0.5 uppercase tracking-wide">
                            {team.countries?.name || 'Desconocido'}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTeams.map((teamRow) => (
                      <tr key={teamRow.id} className="hover:bg-slate-900/40 transition-colors">
                        {/* First column (Row Header) - sticky left */}
                        <td className="sticky left-0 bg-slate-950 font-bold border-r border-slate-800 p-4 text-sm text-slate-200 z-10 min-w-50 truncate shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                          <div className="text-slate-100 truncate">{teamRow.current_name}</div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-normal mt-0.5">
                            <span className="bg-slate-900 px-1 py-0.2 rounded border border-slate-800/80 text-[9px] uppercase tracking-wider font-semibold">
                              {teamRow.countries?.name || 'Desconocido'}
                            </span>
                            <span>•</span>
                            <span className="text-pink-400 font-medium font-mono">
                              {getRowMatrixCoincidences(teamRow.id)}/{selectedTeams.length - 1} H2H
                            </span>
                          </div>
                        </td>

                        {/* Cells in row */}
                        {selectedTeams.map((teamCol) => {
                          const isDiagonal = teamRow.id === teamCol.id;

                          if (isDiagonal) {
                            return (
                              <td
                                key={teamCol.id}
                                className="border-b border-slate-800/60 p-4 bg-slate-900/60 text-slate-600 text-center font-mono text-lg select-none"
                              >
                                \
                              </td>
                            );
                          }

                          const matchesBetween = getMatchesList(teamRow.id, teamCol.id);
                          const faced = matchesBetween.length > 0;
                          const isActiveDetail = activeH2H &&
                            ((activeH2H.teamA.id === teamRow.id && activeH2H.teamB.id === teamCol.id) ||
                              (activeH2H.teamA.id === teamCol.id && activeH2H.teamB.id === teamRow.id));

                          return (
                            <td
                              key={teamCol.id}
                              onClick={() => faced && handleCellClick(teamRow, teamCol)}
                              className={`border-b border-slate-800/60 p-4 text-center transition-all ${faced
                                ? isActiveDetail
                                  ? 'bg-pink-950/60 border-pink-500/60 text-pink-300 font-semibold cursor-pointer ring-2 ring-pink-500/50'
                                  : 'bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/20 text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer shadow-[inset_0_0_10px_rgba(16,185,129,0.05)]'
                                : 'text-slate-600 bg-slate-900/10'
                                }`}
                              title={faced
                                ? `${teamRow.current_name} vs ${teamCol.current_name} (${matchesBetween.length} partido${matchesBetween.length > 1 ? 's' : ''})`
                                : `${teamRow.current_name} vs ${teamCol.current_name} (Sin enfrentamientos)`
                              }
                            >
                              {faced ? (
                                <div className="flex flex-col items-center justify-center gap-0.5">
                                  <span className="text-xs uppercase tracking-wider text-emerald-500 font-bold">✅ SÍ</span>
                                  <span className="text-xs opacity-75 font-mono">({matchesBetween.length} PJ)</span>
                                </div>
                              ) : (
                                <span className="text-slate-600 text-xs tracking-wide">NO PJ</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* SECTION 3: H2H Detailed Matches List */}
        {activeH2H && activeH2HStats && currentStats && (
          <section ref={detailsRef} className="bg-slate-950 border border-pink-500/30 p-6 rounded-xl mb-12 shadow-xl animate-fadeIn">

            {/* Detail Title Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-800 mb-6">
              <div>
                <span className="text-pink-400 text-xs font-semibold uppercase tracking-wider">Historial H2H Detallado</span>
                <h3 className="text-xl font-bold text-white mt-1">
                  {activeH2H.teamA.current_name} <span className="text-slate-500 mx-1">vs</span> {activeH2H.teamB.current_name}
                </h3>
              </div>
              <button
                onClick={() => setActiveH2H(null)}
                className="text-xs bg-slate-900 hover:bg-slate-800 border border-slate-850 hover:border-slate-700 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                ✕ Cerrar Detalle
              </button>
            </div>

            {/* H2H Tabs / Tags Selector */}
            <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-800/60 pb-3">
              <button
                onClick={() => setH2hTab('general')}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                  h2hTab === 'general'
                    ? 'bg-pink-500/10 border-pink-500/30 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.1)]'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                }`}
              >
                General
              </button>
              <button
                onClick={() => setH2hTab('teamA')}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                  h2hTab === 'teamA'
                    ? 'bg-pink-500/10 border-pink-500/30 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.1)]'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                }`}
              >
                {activeH2H.teamA.current_name} Local
              </button>
              <button
                onClick={() => setH2hTab('teamB')}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                  h2hTab === 'teamB'
                    ? 'bg-pink-500/10 border-pink-500/30 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.1)]'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                }`}
              >
                {activeH2H.teamB.current_name} Local
              </button>
            </div>

            {/* Quick H2H Summary Box */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 text-center">
                <span className="text-xs text-slate-500 uppercase tracking-wider block">Partidos Jugados</span>
                <span className="text-2xl font-bold text-white font-mono">{currentStats.total}</span>
              </div>
              <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 text-center">
                <span className="text-xs text-slate-500 uppercase tracking-wider block truncate" title={currentStats.labelA}>
                  {currentStats.labelA}
                </span>
                <span className="text-2xl font-bold text-emerald-400 font-mono">{currentStats.winsA}</span>
              </div>
              <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 text-center">
                <span className="text-xs text-slate-500 uppercase tracking-wider block truncate" title={currentStats.labelB}>
                  {currentStats.labelB}
                </span>
                <span className="text-2xl font-bold text-emerald-400 font-mono">{currentStats.winsB}</span>
              </div>
              <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 text-center">
                <span className="text-xs text-slate-500 uppercase tracking-wider block">Empates</span>
                <span className="text-2xl font-bold text-amber-500 font-mono">{currentStats.draws}</span>
              </div>
            </div>

            {/* H2H Breakdown by Venue (Only in General Tab) */}
            {h2hTab === 'general' && (
              <div className="mb-8 border-t border-slate-800/60 pt-6">
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-3">Desglose por Localía</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Team A Home Stats Card */}
                  <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2 mb-3">
                      <span className="text-xs font-bold text-white truncate" title={`Local: ${activeH2H.teamA.current_name}`}>
                        Local: {activeH2H.teamA.current_name}
                      </span>
                      <span className="text-[10px] bg-pink-500/10 text-pink-400 font-mono font-bold px-2 py-0.5 rounded border border-pink-500/20 whitespace-nowrap">
                        {activeH2HStats.aHome.total} PJ
                      </span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Victorias {activeH2H.teamA.current_name}:</span>
                        <span className="font-semibold text-emerald-400 font-mono">{activeH2HStats.aHome.winsA}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Empates:</span>
                        <span className="font-semibold text-amber-500 font-mono">{activeH2HStats.aHome.draws}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Victorias {activeH2H.teamB.current_name}:</span>
                        <span className="font-semibold text-slate-400 font-mono">{activeH2HStats.aHome.winsB}</span>
                      </div>
                    </div>
                  </div>

                  {/* Team B Home Stats Card */}
                  <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2 mb-3">
                      <span className="text-xs font-bold text-white truncate" title={`Local: ${activeH2H.teamB.current_name}`}>
                        Local: {activeH2H.teamB.current_name}
                      </span>
                      <span className="text-[10px] bg-pink-500/10 text-pink-400 font-mono font-bold px-2 py-0.5 rounded border border-pink-500/20 whitespace-nowrap">
                        {activeH2HStats.bHome.total} PJ
                      </span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Victorias {activeH2H.teamB.current_name}:</span>
                        <span className="font-semibold text-emerald-400 font-mono">{activeH2HStats.bHome.winsB}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Empates:</span>
                        <span className="font-semibold text-amber-500 font-mono">{activeH2HStats.bHome.draws}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Victorias {activeH2H.teamA.current_name}:</span>
                        <span className="font-semibold text-slate-400 font-mono">{activeH2HStats.bHome.winsA}</span>
                      </div>
                    </div>
                  </div>

                  {/* Neutral Ground Stats Card */}
                  {activeH2HStats.neutral.total > 0 ? (
                    <div className="bg-indigo-950/20 p-4 rounded-xl border border-indigo-900/40">
                      <div className="flex items-center justify-between border-b border-indigo-900/30 pb-2 mb-3">
                        <span className="text-xs font-bold text-indigo-300">Cancha Neutral</span>
                        <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-mono font-bold px-2 py-0.5 rounded border border-indigo-500/20 whitespace-nowrap">
                          {activeH2HStats.neutral.total} PJ
                        </span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Victorias {activeH2H.teamA.current_name}:</span>
                          <span className="font-semibold text-indigo-300 font-mono">{activeH2HStats.neutral.winsA}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Empates:</span>
                          <span className="font-semibold text-amber-500 font-mono">{activeH2HStats.neutral.draws}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Victorias {activeH2H.teamB.current_name}:</span>
                          <span className="font-semibold text-indigo-300 font-mono">{activeH2HStats.neutral.winsB}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-900/10 p-4 rounded-xl border border-slate-850 border-dashed flex flex-col items-center justify-center text-center">
                      <span className="text-slate-600 text-xs italic">Sin partidos en cancha neutral</span>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* Timeline matches list */}
            {filteredMatches.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm bg-slate-900/20 rounded-lg border border-slate-800 border-dashed">
                No se encontraron partidos para esta condición de localía.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/80 text-xs font-semibold text-slate-400 border-b border-slate-800 uppercase tracking-wider">
                      <th className="p-4">Temporada</th>
                      <th className="p-4">Competición</th>
                      <th className="p-4">Ronda</th>
                      <th className="p-4 text-right">Local</th>
                      <th className="p-4 text-center">Resultado</th>
                      <th className="p-4">Visitante</th>
                      <th className="p-4">Condición</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredMatches.map((m) => {
                      const homeTeamName = teamsMap.get(m.home_team_id)?.current_name || `Club #${m.home_team_id}`;
                      const awayTeamName = teamsMap.get(m.away_team_id)?.current_name || `Club #${m.away_team_id}`;

                      const isHomeA = m.home_team_id === activeH2H.teamA.id;
                      const nameA = activeH2H.teamA.current_name;
                      const nameB = activeH2H.teamB.current_name;

                      // Compute who won
                      let winnerName = '';
                      if (m.home_goals > m.away_goals) {
                        winnerName = homeTeamName;
                      } else if (m.away_goals > m.home_goals) {
                        winnerName = awayTeamName;
                      }

                      const formattedSeason = m.seasons
                        ? `${m.seasons.year_start}-${String(m.seasons.year_end).slice(-2)}`
                        : 'N/A';

                      return (
                        <tr key={m.id} className="hover:bg-slate-900/30 text-sm">
                          <td className="p-4 font-mono text-slate-300">{formattedSeason}</td>
                          <td className="p-4 text-slate-300 font-semibold">{m.seasons?.competitions?.name || 'Desconocido'}</td>
                          <td className="p-4 text-slate-400">{m.round}</td>

                          {/* Home team cell */}
                          <td className={`p-4 text-right ${winnerName === homeTeamName ? 'font-bold text-white' : 'text-slate-400'}`}>
                            {homeTeamName}
                          </td>

                          {/* Result cell */}
                          <td className="p-4 text-center font-mono">
                            <span className="bg-slate-900 px-3 py-1 rounded text-white font-bold border border-slate-800">
                              {m.home_goals} - {m.away_goals}
                              {m.penalty_home_goals !== null && (
                                <span className="text-[10px] text-pink-400 block mt-0.5">
                                  ({m.penalty_home_goals}-{m.penalty_away_goals} pen)
                                </span>
                              )}
                            </span>
                          </td>

                          {/* Away team cell */}
                          <td className={`p-4 ${winnerName === awayTeamName ? 'font-bold text-white' : 'text-slate-400'}`}>
                            {awayTeamName}
                          </td>

                          <td className="p-4">
                            {m.is_neutral ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-900 text-indigo-400 font-medium">Neutral</span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-850 text-slate-500">Ida/Vuelta</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* SECTION 4: External Common Rivals Table */}
        <section className="bg-slate-950 p-6 rounded-xl border border-slate-800 shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-slate-900">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📊</span> Rivales Comunes Frecuentes
              </h2>
              <p className="text-sm text-slate-400">
                Lista ordenada de los clubes a los que se han enfrentado los equipos en comparación (excluyéndose a ellos mismos).
              </p>
            </div>

            {/* Search filter for rivals table */}
            {selectedTeams.length > 0 && (
              <div className="w-full md:w-64">
                <input
                  type="text"
                  placeholder="Filtrar rival o país..."
                  value={rivalSearchTerm}
                  onChange={(e) => {
                    setRivalSearchTerm(e.target.value);
                    setVisibleRivalsCount(10); // Reset expansion limit when searching
                  }}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none transition-all"
                />
              </div>
            )}
          </div>

          {selectedTeams.length === 0 ? (
            <div className="text-center py-8 text-slate-600 italic text-sm">
              Selecciona al menos un club para listar sus rivales enfrentados.
            </div>
          ) : filteredCommonRivals.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No hay rivales comunes o enfrentados en base a los criterios de búsqueda actuales.
            </div>
          ) : (
            <div>
              <div className="overflow-x-auto rounded-lg border border-slate-800/80">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/60 text-xs font-semibold text-slate-400 border-b border-slate-800 uppercase tracking-wider">
                      <th className="p-4 text-center w-16">Puesto</th>
                      <th className="p-4">Club Rival</th>
                      <th className="p-4 text-center w-36">Coincidencias</th>
                      <th className="p-4">Desglose de Enfrentamientos</th>
                      <th className="p-4 text-center w-28">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/60">
                    {filteredCommonRivals.slice(0, visibleRivalsCount).map((rival, index) => {
                      return (
                        <tr key={rival.rivalId} className="hover:bg-slate-900/30 text-sm">
                          {/* Position Rank */}
                          <td className="p-4 text-center font-mono font-bold text-pink-400">
                            #{index + 1}
                          </td>
                          {/* Rival Name & Country */}
                          <td className="p-4">
                            <div className="font-semibold text-white">{rival.teamName}</div>
                            <div className="text-xs text-slate-500">{rival.country}</div>
                          </td>
                          {/* Coincidences with the selected list */}
                          <td className="p-4 text-center bg-slate-900/20">
                            <div className="font-bold text-white font-mono text-base">{rival.uniqueCoincidences}</div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">({rival.totalMatches} PJ)</div>
                          </td>
                          {/* Breakdown of matches per selected team */}
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1.5">
                              {selectedTeams.map((selTeam) => {
                                const count = rival.breakdown[selTeam.id] || 0;
                                if (count === 0) return null;
                                return (
                                  <span
                                    key={selTeam.id}
                                    className="inline-flex items-center text-[11px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-400"
                                  >
                                    <strong className="text-slate-300 mr-1">{selTeam.current_name}:</strong> {count}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          {/* Action Button: Add to selection */}
                          <td className="p-4 text-center">
                            {rival.teamObj && (
                              <button
                                onClick={() => handleSelectTeam(rival.teamObj!)}
                                className="bg-pink-500/10 hover:bg-pink-500 text-pink-400 hover:text-white border border-pink-500/30 hover:border-pink-500 px-2.5 py-1 rounded text-xs transition font-semibold w-full cursor-pointer flex items-center justify-center gap-1"
                              >
                                <span>+</span> Agregar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Show more pagination */}
              {filteredCommonRivals.length > visibleRivalsCount && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => setVisibleRivalsCount((prev) => prev + 15)}
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 px-6 py-2 rounded-xl text-xs font-semibold text-slate-300 transition cursor-pointer"
                  >
                    Ver más rivales ({filteredCommonRivals.length - visibleRivalsCount} restantes)
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
