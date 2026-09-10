import type { MatchBasic, TeamBasic } from '@/business/h2hStandings';
import { supabase } from '@/services/supabase/supabase';
import StandingsAllClient from './StandingsAllClient';

export const dynamic = 'force-dynamic';

export default async function StandingsPage() {
  // 1. Obtener todos los equipos ordenados alfabéticamente
  const { data: dbTeams, error: teamsError } = await supabase
    .from('teams')
    .select(`
      id,
      current_name,
      countries (
        id,
        name
      )
    `)
    .order('current_name', { ascending: true });

  if (teamsError) {
    console.error("Error al obtener los equipos:", teamsError);
  }

  // 2. Obtener todos los partidos paginados trayendo solo campos requeridos
  let matches: MatchBasic[] = [];
  let from = 0;
  const limit = 1000;
  let keepFetching = true;

  while (keepFetching) {
    const { data: chunk, error: chunkError } = await supabase
      .from('matches')
      .select('home_team_id, away_team_id, home_goals, away_goals')
      .range(from, from + limit - 1);

    if (chunkError) {
      console.error(`Error obteniendo lote de partidos (${from}-${from + limit}):`, chunkError);
      break;
    }

    if (chunk && chunk.length > 0) {
      matches = matches.concat(chunk as MatchBasic[]);
      from += limit;
      if (chunk.length < limit) {
        keepFetching = false;
      }
    } else {
      keepFetching = false;
    }
  }

  const teams: TeamBasic[] = (dbTeams || []).map((t: any) => ({
    id: t.id,
    current_name: t.current_name,
    countries: Array.isArray(t.countries)
      ? t.countries[0]
      : t.countries
        ? { id: t.countries.id, name: t.countries.name }
        : null,
  }));

  return <StandingsAllClient teams={teams} matches={matches} />;
}
