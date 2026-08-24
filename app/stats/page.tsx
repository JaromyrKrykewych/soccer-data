import React from 'react';
import { supabase } from '@/services/supabase/supabase';
import StatsClient, { TeamStats } from './StatsClient';

export const dynamic = 'force-dynamic';

export default async function StatsPage() {
  // 1. Obtener todos los equipos de Supabase
  const { data: dbTeams, error: teamsError } = await supabase
    .from('teams')
    .select(`
      id,
      current_name,
      countries (
        name
      )
    `);

  // 2. Obtener el total exacto de partidos de Supabase (sin descargar los registros, solo el count en HEAD)
  const { count: totalMatchesCount, error: countError } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error("Error obteniendo conteo de partidos:", countError);
  }

  // 2.3. Obtener todas las temporadas de Supabase para mapear IDs a años
  const { data: dbSeasons, error: seasonsError } = await supabase
    .from('seasons')
    .select('id, year_start, year_end');

  if (seasonsError) {
    console.error("Error obteniendo temporadas:", seasonsError);
  }

  const seasonYearMap = new Map<number, string>();
  if (dbSeasons) {
    dbSeasons.forEach((s) => {
      seasonYearMap.set(s.id, `${s.year_start}/${s.year_end}`);
    });
  }

  // 2.5. Obtener todos los registros de partidos de Supabase paginados (para evitar el límite por defecto de 1000)
  let matches: any[] = [];
  let from = 0;
  const limit = 1000;
  let keepFetching = true;

  while (keepFetching) {
    const { data: chunk, error: chunkError } = await supabase
      .from('matches')
      .select('home_team_id, away_team_id, season_id')
      .range(from, from + limit - 1);

    if (chunkError) {
      console.error(`Error obteniendo lote de partidos (${from}-${from + limit}):`, chunkError);
      break;
    }

    if (chunk && chunk.length > 0) {
      matches = matches.concat(chunk);
      from += limit;
      if (chunk.length < limit) {
        keepFetching = false;
      }
    } else {
      keepFetching = false;
    }
  }

  const teams = dbTeams || [];

  // 3. Procesar las estadísticas en memoria
  const statsMap = new Map<number, { seasons: Set<string>; rivals: Set<number> }>();

  // Inicializar el mapa para todos los equipos registrados
  teams.forEach((t) => {
    statsMap.set(t.id, { seasons: new Set<string>(), rivals: new Set<number>() });
  });

  // Recorrer los partidos y contar rivales y temporadas únicas
  matches.forEach((m) => {
    const homeId = m.home_team_id;
    const awayId = m.away_team_id;
    const seasonId = m.season_id;
    const seasonYear = seasonId ? seasonYearMap.get(seasonId) : null;

    // Registrar para el local
    if (statsMap.has(homeId)) {
      const stats = statsMap.get(homeId)!;
      if (seasonYear) stats.seasons.add(seasonYear);
      stats.rivals.add(awayId);
    }

    // Registrar para el visitante
    if (statsMap.has(awayId)) {
      const stats = statsMap.get(awayId)!;
      if (seasonYear) stats.seasons.add(seasonYear);
      stats.rivals.add(homeId);
    }
  });

  // Mapear los resultados con los nombres de los equipos y rivales
  const teamStatsList: TeamStats[] = teams.map((team) => {
    const stats = statsMap.get(team.id) || { seasons: new Set<string>(), rivals: new Set<number>() };
    
    // Obtener nombres de los rivales
    const rivalsNames = Array.from(stats.rivals)
      .map((rivalId) => teams.find((t) => t.id === rivalId)?.current_name || 'Desconocido')
      .filter((name) => name !== 'Desconocido');

    return {
      id: team.id,
      name: team.current_name,
      country: (team.countries as any)?.name || 'Desconocido',
      totalSeasons: stats.seasons.size,
      distinctRivalsCount: stats.rivals.size,
      rivalsList: rivalsNames,
    };
  });

  const totalTeams = teams.length;
  const totalMatches = totalMatchesCount ?? matches.length; // Total de registros de partidos en la base de datos

  return (
    <StatsClient
      teamStatsList={teamStatsList}
      totalTeams={totalTeams}
      totalMatches={totalMatches}
    />
  );
}
