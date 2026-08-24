'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useMemo, useState, useTransition } from 'react';

export interface DBTeam {
  id: number;
  current_name: string;
  country: string;
  api_sports_id: number | null;
  aliases: string[];
}

export interface EnrichedSheetRow {
  year: string;
  competition: string;
  instance: string;
  teamA: string;
  countryA: string;
  teamB: string;
  countryB: string;
  firstLeg: string;
  secondLeg: string;
  agg: string;
  teamA_db: DBTeam | null;
  teamB_db: DBTeam | null;
  leg1_imported: boolean;
  leg2_imported: boolean;
  is_single_leg: boolean;
  titles_imported?: boolean;
}

export interface DBCountry {
  id: number;
  name: string;
  iso_code: string | null;
}

interface ImporterDashboardProps {
  initialRows: EnrichedSheetRow[];
  initialDbTeams: DBTeam[];
  initialDbCountries: DBCountry[];
  selectedSeason: string;
  matchesTableExists: boolean;
  titlesTableExists?: boolean;
}

export default function ImporterDashboard({
  initialRows,
  initialDbTeams,
  initialDbCountries,
  selectedSeason,
  matchesTableExists,
  titlesTableExists = true,
}: ImporterDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Estados de Modales
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [registerForm, setRegisterForm] = useState({
    name: '',
    country: '',
    country_iso_code: '',
    api_sports_id: '',
  });
  const [isCountrySelected, setIsCountrySelected] = useState<boolean>(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState<boolean>(false);

  // Filtrar países en base a lo que escribe el usuario
  const matchedCountries = useMemo(() => {
    const val = registerForm.country;
    if (!val || val.trim() === '') return [];
    return (initialDbCountries || []).filter(c =>
      c.name.toLowerCase().includes(val.toLowerCase()) ||
      (c.iso_code && c.iso_code.toLowerCase().includes(val.toLowerCase()))
    );
  }, [registerForm.country, initialDbCountries]);

  const handleCountryChange = (val: string) => {
    setRegisterForm(prev => ({ ...prev, country: val }));
    setIsCountrySelected(false);
  };

  const handleSelectCountry = (c: DBCountry) => {
    setRegisterForm(prev => ({
      ...prev,
      country: c.name,
      country_iso_code: c.iso_code || '',
    }));
    setIsCountrySelected(true);
    setShowCountryDropdown(false);
  };

  const [isMapping, setIsMapping] = useState<boolean>(false);
  const [mappingForm, setMappingForm] = useState({
    teamId: '',
    alias: '',
    countryIso: '',
  });
  const [mappingSearch, setMappingSearch] = useState<string>('');
  const [importFilter, setImportFilter] = useState<'ALL' | 'IMPORTED' | 'PENDING'>('ALL');

  const filteredRows = useMemo(() => {
    return initialRows.filter(row => {
      const isImported = row.leg1_imported && row.leg2_imported;
      if (importFilter === 'IMPORTED') return isImported;
      if (importFilter === 'PENDING') return !isImported;
      return true;
    });
  }, [initialRows, importFilter]);

  const handleSeasonChange = (newSeason: string) => {
    startTransition(() => {
      router.push(`/importer?sheet=${newSeason}`);
    });
  };

  const handleRegisterTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/importer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register-team',
          name: registerForm.name,
          country: registerForm.country,
          country_iso_code: registerForm.country_iso_code || null,
          api_sports_id: registerForm.api_sports_id || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsRegistering(false);
        setRegisterForm({ name: '', country: '', country_iso_code: '', api_sports_id: '' });
        setIsCountrySelected(false);
        router.refresh();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Error registrando equipo');
    }
  };

  const handleMapAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mappingForm.teamId) {
      alert('Por favor selecciona un club existente');
      return;
    }
    try {
      const res = await fetch('/api/importer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'map-alias',
          team_id: Number(mappingForm.teamId),
          alias: mappingForm.alias,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsMapping(false);
        setMappingForm({ teamId: '', alias: '', countryIso: '' });
        setMappingSearch('');
        router.refresh();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Error en el mapeo');
    }
  };

  const handleImportMatches = async (row: EnrichedSheetRow) => {
    if (!row.teamA_db || !row.teamB_db) {
      alert('Ambos equipos deben estar registrados en la base de datos para poder importar los partidos.');
      return;
    }
    try {
      const res = await fetch('/api/importer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import-matches',
          year: row.year,
          competition: row.competition,
          instance: row.instance,
          teamA_id: row.teamA_db.id,
          teamB_id: row.teamB_db.id,
          firstLeg: row.firstLeg,
          secondLeg: row.secondLeg,
          agg: row.agg || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.refresh();
      } else {
        alert('Error importando: ' + data.error);
      }
    } catch (err) {
      alert('Error importando partidos');
    }
  };

  const handleImportTitles = async (row: EnrichedSheetRow) => {
    if (!row.teamA_db || !row.teamB_db) {
      alert('Ambos equipos deben estar registrados en la base de datos para poder guardar los títulos.');
      return;
    }
    try {
      const res = await fetch('/api/importer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import-titles',
          year: row.year,
          competition: row.competition,
          teamA_id: row.teamA_db.id,
          teamB_id: row.teamB_db.id,
          firstLeg: row.firstLeg,
          secondLeg: row.secondLeg || null,
          agg: row.agg || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.refresh();
      } else {
        alert('Error importando títulos: ' + data.error);
      }
    } catch (err) {
      alert('Error importando títulos');
    }
  };

  // Contadores rápidos
  const importedCount = initialRows.filter(r => r.leg1_imported && r.leg2_imported).length;
  const pendingTeamsCount = initialRows.filter(r => !r.teamA_db || !r.teamB_db).length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-16">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-10 px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-emerald-400">Importador de Google Sheets</h1>
            <p className="text-slate-400 text-sm">Gestiona y limpia el historial de tus torneos antes de guardarlos.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Temporada:</label>
              <select
                value={selectedSeason}
                onChange={(e) => handleSeasonChange(e.target.value)}
                disabled={isPending}
                className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none cursor-pointer disabled:opacity-50"
              >
                {Array.from({ length: 72 }, (_, i) => {
                  const year = 1955 + i;
                  const endYear = String(year + 1).slice(-2);
                  const seasonVal = `${year}-${endYear}`;
                  return (
                    <option key={i} value={seasonVal}>
                      {seasonVal}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Ver:</label>
              <select
                value={importFilter}
                onChange={(e) => setImportFilter(e.target.value as any)}
                className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none cursor-pointer"
              >
                <option value="ALL">Todos ({initialRows.length})</option>
                <option value="IMPORTED">Importados ({initialRows.filter(r => r.leg1_imported && r.leg2_imported).length})</option>
                <option value="PENDING">Pendientes ({initialRows.filter(r => !(r.leg1_imported && r.leg2_imported)).length})</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Link
                href="/"
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-lg transition flex items-center gap-1.5 text-sm cursor-pointer font-medium"
              >
                🏠 Menú Principal
              </Link>
              <button
                onClick={() => {
                  setRegisterForm({ name: '', country: '', country_iso_code: '', api_sports_id: '' });
                  setIsCountrySelected(false);
                  setShowCountryDropdown(false);
                  setIsRegistering(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg transition cursor-pointer"
              >
                + Registrar Club
              </button>
              <button
                onClick={() => router.refresh()}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-lg transition cursor-pointer"
              >
                🔄 Actualizar
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 mt-8">
        {/* Banner de Carga en Transición */}
        {isPending && (
          <div className="bg-emerald-950/40 border border-emerald-800 text-emerald-300 p-3 rounded-lg mb-8 text-sm flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-400"></div>
            Cargando temporada {selectedSeason} desde Google Sheets...
          </div>
        )}

        {/* Banner de Supabase SQL Warning */}
        {!matchesTableExists && (
          <div className="bg-amber-950/40 border border-amber-800 text-amber-300 p-4 rounded-lg mb-8 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <strong className="text-amber-400">Nota de base de datos:</strong> Solo se han detectado las tablas de países y clubes en Supabase. Puedes vincular y registrar clubes, pero el guardado de partidos estará deshabilitado hasta que ejecutes el resto del script SQL (tablas 5 a 9).
            </div>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                alert("Por favor abre el archivo README.md en tu editor, copia el script SQL de las tablas 5 a 9 y ejecútalo en el SQL Editor de tu dashboard de Supabase.");
              }}
              className="text-amber-400 hover:text-amber-300 underline font-semibold whitespace-nowrap cursor-pointer"
            >
              Ver instrucciones
            </a>
          </div>
        )}

        {/* Banner de Supabase Titles SQL Warning */}
        {matchesTableExists && !titlesTableExists && (
          <div className="bg-amber-950/40 border border-amber-800 text-amber-300 p-4 rounded-lg mb-8 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <strong className="text-amber-400">Nota de base de datos de títulos:</strong> La tabla `Titles` no se detecta en Supabase. El guardado de títulos de campeones y subcampeones estará deshabilitado hasta que ejecutes el script SQL para la tabla 9 en tu dashboard de Supabase.
            </div>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                alert("Por favor abre el archivo README.md en tu editor, copia el script SQL de la tabla 9 (Titles) y ejecútalo en el SQL Editor de tu dashboard de Supabase.");
              }}
              className="text-amber-400 hover:text-amber-300 underline font-semibold whitespace-nowrap cursor-pointer"
            >
              Ver instrucciones
            </a>
          </div>
        )}

        {/* Estadísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Partidos de la planilla</p>
            <p className="text-3xl font-bold mt-1 text-slate-200">{initialRows.length * 2} <span className="text-sm font-medium text-slate-500">({initialRows.length} eliminatorias)</span></p>
          </div>
          <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Eliminatorias Sincronizadas</p>
            <p className="text-3xl font-bold mt-1 text-emerald-400">{importedCount} <span className="text-sm font-medium text-slate-500">/ {initialRows.length}</span></p>
          </div>
          <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Eliminatorias Pendientes de Mapeo</p>
            <p className="text-3xl font-bold mt-1 text-amber-500">{pendingTeamsCount} <span className="text-sm font-medium text-slate-500">sin club en BD</span></p>
          </div>
        </div>

        {initialRows.length === 0 ? (
          <div className="bg-slate-950 rounded-xl border border-slate-800 py-16 text-center text-slate-400">
            No hay partidos registrados en la hoja de la temporada <strong className="text-slate-200">{selectedSeason}</strong>.
            <br />
            (Asegúrate de tener la pestaña creada en tu planilla de Google Sheets).
          </div>
        ) : (
          <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 text-xs uppercase font-semibold">
                    <th className="py-4 px-6">Temporada</th>
                    <th className="py-4 px-6">Comp / Ronda</th>
                    <th className="py-4 px-6 text-right">Equipo A (Local Ida)</th>
                    <th className="py-4 px-6 text-center">Ida</th>
                    <th className="py-4 px-6 text-center">Vuelta</th>
                    <th className="py-4 px-6">Equipo B (Local Vuelta)</th>
                    <th className="py-4 px-6 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-sm">
                  {filteredRows.map((row, idx) => {
                    const mappedA = !!row.teamA_db;
                    const mappedB = !!row.teamB_db;
                    const isImported = row.leg1_imported && row.leg2_imported;

                    // Determinar si es desempate o penales (penales desde 1970-71)
                    const yearStartStr = row.year.includes('/') ? row.year.split('/')[0] : row.year.split('-')[0];
                    const yearStart = parseInt(yearStartStr, 10);
                    const isPenalty = yearStart >= 1970;
                    const hasExtra = row.agg && row.agg.trim() !== '';

                    return (
                      <React.Fragment key={idx}>
                        <tr className="hover:bg-slate-900/50 transition">
                          <td className="py-4 px-6 font-medium text-slate-300">{row.year}</td>
                          <td className="py-4 px-6 text-slate-400">
                            <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs uppercase font-mono mr-2">{row.competition}</span>
                            {row.instance}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center justify-end gap-2">
                                <span className="bg-slate-800/80 text-slate-400 text-[10px] px-1.5 py-0.5 rounded border border-slate-700/30" title="País en Google Sheet">{row.countryA}</span>
                                <span className="font-semibold">{row.teamA}</span>
                              </div>
                              <div className="mt-0.5">
                                {mappedA ? (
                                  <span className="bg-emerald-950 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded border border-emerald-800/50 block" title={`ID: ${row.teamA_db!.id}`}>✓ {row.teamA_db!.current_name}</span>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setMappingForm({ teamId: '', alias: row.teamA, countryIso: row.countryA });
                                      setIsMapping(true);
                                    }}
                                    className="bg-rose-950/80 text-rose-300 hover:bg-rose-900 border border-rose-800/50 text-[10px] px-1.5 py-0.5 rounded transition cursor-pointer block"
                                  >
                                    Link Team
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center font-mono font-bold text-slate-200 bg-slate-900/20">{row.firstLeg}</td>
                          <td className="py-4 px-6 text-center font-mono font-bold text-slate-200 bg-slate-900/20">{row.secondLeg}</td>
                          <td className="py-4 px-6">
                            <div className="flex flex-col items-start gap-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{row.teamB}</span>
                                <span className="bg-slate-800/80 text-slate-400 text-[10px] px-1.5 py-0.5 rounded border border-slate-700/30" title="País en Google Sheet">{row.countryB}</span>
                              </div>
                              <div className="mt-0.5">
                                {mappedB ? (
                                  <span className="bg-emerald-950 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded border border-emerald-800/50 block" title={`ID: ${row.teamB_db!.id}`}>✓ {row.teamB_db!.current_name}</span>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setMappingForm({ teamId: '', alias: row.teamB, countryIso: row.countryB });
                                      setIsMapping(true);
                                    }}
                                    className="bg-rose-950/80 text-rose-300 hover:bg-rose-900 border border-rose-800/50 text-[10px] px-1.5 py-0.5 rounded transition cursor-pointer block"
                                  >
                                    Link Team
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <div className="flex flex-col gap-2 justify-center items-center">
                              {/* Botón Guardar / Importado para Partidos */}
                              {isImported ? (
                                <span className="bg-emerald-900/30 text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-800/30 w-full block text-center">
                                  Importado
                                </span>
                              ) : mappedA && mappedB && matchesTableExists ? (
                                <button
                                  onClick={() => handleImportMatches(row)}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer w-full text-center"
                                >
                                  Guardar
                                </button>
                              ) : (
                                <span className="text-slate-500 text-xs italic">Awaiting Link</span>
                              )}

                              {/* Botón Guardar / Importado para Títulos (solo si la instancia es final 'F') */}
                              {row.instance === 'F' && (
                                <>
                                  {row.titles_imported ? (
                                    <span className="bg-amber-900/20 text-amber-400 px-3 py-1 rounded-full text-[11px] font-semibold border border-amber-800/30 w-full block text-center">
                                      🏆 Guardado
                                    </span>
                                  ) : mappedA && mappedB && titlesTableExists ? (
                                    <button
                                      onClick={() => handleImportTitles(row)}
                                      className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer w-full text-center"
                                    >
                                      🏆 Títulos
                                    </button>
                                  ) : (
                                    titlesTableExists && <span className="text-slate-500 text-[10px] italic">Awaiting Titles</span>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                        {hasExtra && (
                          <tr className="bg-slate-950/30 border-b border-slate-900/30">
                            <td colSpan={7} className="py-2.5 px-6">
                              <div className="flex items-center gap-2.5 text-xs">
                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold border ${isPenalty
                                  ? 'bg-amber-950/60 text-amber-400 border-amber-800/50'
                                  : 'bg-cyan-950/60 text-cyan-400 border-cyan-800/50'
                                  }`}>
                                  {isPenalty ? '🏆 Tanda de Penales' : '⚽ Partido de Desempate'}
                                </span>
                                <span className="text-slate-400">
                                  Resultado: <strong className="font-mono text-slate-200 text-sm ml-1">{row.agg}</strong>
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 italic">
                        No hay eliminatorias que coincidan con el filtro seleccionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL REGISTRAR NUEVO EQUIPO */}
      {isRegistering && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-6 w-full max-w-md animate-fadeIn">
            <h2 className="text-xl font-bold text-slate-100 mb-4">Registrar Nuevo Club</h2>
            <form onSubmit={handleRegisterTeam} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs uppercase font-semibold mb-1">Nombre Oficial</label>
                <input
                  type="text"
                  required
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none"
                  placeholder="Ej. FK Borac Banja Luka"
                />
              </div>
              <div className="relative">
                <label className="block text-slate-400 text-xs uppercase font-semibold mb-1">Nombre del País</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={registerForm.country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    onFocus={() => setShowCountryDropdown(true)}
                    onBlur={() => {
                      setTimeout(() => setShowCountryDropdown(false), 200);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none pr-8"
                    placeholder="Ej. Slovakia, Bosnia, Wales"
                  />
                  {isCountrySelected && (
                    <span className="absolute right-2.5 top-2.5 text-emerald-400 text-xs font-bold" title="País existente seleccionado">
                      ✓
                    </span>
                  )}
                </div>

                {/* Autocompletado de países */}
                {showCountryDropdown && matchedCountries.length > 0 && !isCountrySelected && (
                  <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg z-50 shadow-2xl divide-y">
                    {matchedCountries.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={() => handleSelectCountry(c)}
                        className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-900 hover:text-white transition flex justify-between items-center text-xs"
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="bg-slate-850 text-slate-400 px-1.5 py-0.5 rounded text-[10px] font-mono">{c.iso_code || '-'}</span>
                      </button>
                    ))}
                  </div>
                )}
                {isCountrySelected && (
                  <p className="text-[11px] text-emerald-400/90 mt-1">
                    ✓ Se vinculará al país existente en la base de datos.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-slate-400 text-xs uppercase font-semibold mb-1">Código ISO / Abrev. del País</label>
                <input
                  type="text"
                  required
                  value={registerForm.country_iso_code}
                  onChange={(e) => setRegisterForm({ ...registerForm, country_iso_code: e.target.value })}
                  disabled={isCountrySelected}
                  className={`w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none ${isCountrySelected ? 'opacity-50 text-slate-400 cursor-not-allowed' : ''
                    }`}
                  placeholder="Ej. Svk, Wal, MKD, Bos"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs uppercase font-semibold mb-1">API-Sports ID (Opcional)</label>
                <input
                  type="number"
                  value={registerForm.api_sports_id}
                  onChange={(e) => setRegisterForm({ ...registerForm, api_sports_id: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none"
                  placeholder="Ej. 7248"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-medium px-4 py-2 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg transition"
                >
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ASOCIAR ALIAS A CLUB EXISTENTE */}
      {isMapping && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-6 w-full max-w-md animate-fadeIn">
            <h2 className="text-xl font-bold text-slate-100 mb-2">Vincular Club</h2>
            <p className="text-slate-400 text-xs mb-4">
              Vas a asociar el nombre de la planilla <strong className="text-amber-400">"{mappingForm.alias}"</strong> a un club registrado en tu base de datos.
            </p>
            <form onSubmit={handleMapAlias} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs uppercase font-semibold mb-1">Buscar Club Existente</label>
                <input
                  type="text"
                  value={mappingSearch}
                  onChange={(e) => setMappingSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 mb-2 focus:outline-none"
                  placeholder="Escribe el nombre del club..."
                />

                <div className="max-h-40 overflow-y-auto border border-slate-800 rounded-lg bg-slate-900/50 divide-y">
                  {initialDbTeams
                    .filter((t) => t.current_name.toLowerCase().includes(mappingSearch.toLowerCase()))
                    .map((team) => (
                      <div
                        key={team.id}
                        onClick={() => setMappingForm({ ...mappingForm, teamId: String(team.id) })}
                        className={`p-2.5 cursor-pointer text-xs flex justify-between items-center transition ${mappingForm.teamId === String(team.id)
                          ? 'bg-emerald-950/80 text-emerald-400 font-semibold'
                          : 'hover:bg-slate-800/80 text-slate-300'
                          }`}
                      >
                        <span>{team.current_name} ({team.country})</span>
                        <span className="text-[10px] text-slate-500">ID: {team.id}</span>
                      </div>
                    ))}
                  {initialDbTeams.filter((t) => t.current_name.toLowerCase().includes(mappingSearch.toLowerCase())).length === 0 && (
                    <p className="p-3 text-xs text-slate-500 text-center">No se encontraron clubes. Registra uno primero.</p>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => {
                    setIsMapping(false);
                    setRegisterForm({
                      name: mappingForm.alias,
                      country: '',
                      country_iso_code: mappingForm.countryIso,
                      api_sports_id: '',
                    });
                    setIsRegistering(true);
                  }}
                  className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold underline cursor-pointer"
                >
                  Registrar como nuevo club
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMapping(false);
                      setMappingSearch('');
                    }}
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-sm px-4 py-2 rounded-lg transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
                  >
                    Vincular
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
