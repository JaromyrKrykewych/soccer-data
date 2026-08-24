import { supabase } from '@/services/supabase/supabase';
import MatchesClient from './MatchesClient';


export const dynamic = 'force-dynamic';

export default async function MatchesPage() {
  // Obtener equipos
  const { data: dbTeams } = await supabase
    .from('teams')
    .select('id, current_name');

  // Obtener todos los partidos de forma paginada para superar el límite de 1000 filas de Supabase
  let matches: any[] = [];
  let from = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: dbMatches, error } = await supabase
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
      .order('id', { ascending: false })
      .range(from, from + limit - 1);

    if (error || !dbMatches || dbMatches.length === 0) {
      hasMore = false;
    } else {
      matches = [...matches, ...dbMatches];
      from += limit;
      if (dbMatches.length < limit) {
        hasMore = false;
      }
    }
  }

  const teams = dbTeams || [];

  return (
    <MatchesClient
      initialMatches={matches}
      teams={teams}
    />
  );
}
