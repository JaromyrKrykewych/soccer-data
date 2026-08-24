import { supabase } from '@/services/supabase/supabase';
import HistoricClient, { TeamInfo } from './HistoricClient';

export const dynamic = 'force-dynamic';

export default async function HistoricPage() {
  // 1. Obtener todos los equipos de la base de datos, ordenados por nombre
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

  // 2. Obtener todos los partidos en un bucle paginado para superar el límite de 1000 de Supabase
  let matches: any[] = [];
  let from = 0;
  const limit = 1000;
  let keepFetching = true;

  while (keepFetching) {
    const { data: chunk, error: chunkError } = await supabase
      .from('matches')
      .select(`
        id,
        season_id,
        home_team_id,
        away_team_id,
        home_goals,
        away_goals,
        penalty_home_goals,
        penalty_away_goals,
        is_leg1,
        is_neutral,
        round,
        seasons (
          id,
          year_start,
          year_end,
          competitions (
            id,
            name
          )
        )
      `)
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

  const teams: TeamInfo[] = (dbTeams || []).map((t: any) => ({
    id: t.id,
    current_name: t.current_name,
    countries: Array.isArray(t.countries)
      ? t.countries[0]
      : t.countries
        ? { id: t.countries.id, name: t.countries.name }
        : null,
  }));

  return (
    <HistoricClient
      teams={teams}
      initialMatches={matches}
    />
  );
}
