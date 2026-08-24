import { getParsedSheetData, ParsedSheetRow } from '@/services';
import { supabase } from '@/services/supabase/supabase';
import ImporterDashboard, { DBTeam, EnrichedSheetRow } from './ImporterDashboard';

function getCompetitionFullName(code: string, yearStart: number): string {
  const c = code.toUpperCase().trim();
  if (c === 'CL') {
    return yearStart <= 1991 ? 'Copa de Europa' : 'UEFA Champions League';
  }
  if (c === 'EL') {
    return yearStart <= 2008 ? 'Copa UEFA' : 'UEFA Europa League';
  }
  if (c === 'CW') {
    return 'Recopa de Europa';
  }
  if (c === 'FC') {
    return 'Copa de Ferias';
  }
  if (c === 'CO' || c === 'ECL' || c === 'CONF') {
    return 'UEFA Europa Conference League';
  }
  if (c === 'SC') {
    return 'Supercopa de Europa';
  }
  return code;
}

export const dynamic = 'force-dynamic';

export default async function ImporterPage({
  searchParams,
}: {
  searchParams: Promise<{ sheet?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const sheetName = resolvedSearchParams.sheet || '2026-27';
  const sheetId = process.env.GOOGLE_SHEET_ID || '';
  const range = `'${sheetName}'!A:J`;

  // 1. Obtener los datos de Google Sheets (o fallback local)
  let sheetRows: ParsedSheetRow[] = [];
  try {
    sheetRows = await getParsedSheetData(sheetId, range);
  } catch (e) {
    console.error("Error reading sheet:", e);
  }

  // 2. Obtener los equipos de Supabase
  const { data: dbTeams, error: teamsError } = await supabase
    .from('teams')
    .select(`
      id,
      current_name,
      founded_year,
      country_id,
      api_sports_id,
      countries (
        id,
        name,
        iso_code
      )
    `);

  if (teamsError) {
    console.error("Supabase teams fetch error:", teamsError);
  }

  // 3. Obtener todos los alias (nombres) de Supabase
  const { data: dbAliases, error: aliasesError } = await supabase
    .from('teamnames')
    .select('id, team_id, name');

  if (aliasesError) {
    console.error("Supabase aliases fetch error:", aliasesError);
  }

  // 3.5. Obtener todos los países de Supabase
  const { data: dbCountries, error: countriesError } = await supabase
    .from('countries')
    .select('id, name, iso_code');

  if (countriesError) {
    console.error("Supabase countries fetch error:", countriesError);
  }

  // Formatear la lista de equipos registrados para enviarla al cliente
  const formattedTeams: DBTeam[] = (dbTeams || []).map((t: any) => {
    const aliases = (dbAliases || [])
      .filter((a) => a.team_id === t.id)
      .map((a) => a.name);

    return {
      id: t.id,
      current_name: t.current_name,
      country: t.countries?.name || 'Desconocido',
      api_sports_id: t.api_sports_id,
      aliases: Array.from(new Set([t.current_name, ...aliases])),
    };
  });

  // Auxiliar para buscar equipo
  const findTeam = (name: string): DBTeam | null => {
    return formattedTeams.find(
      (t) =>
        t.current_name.toLowerCase() === name.toLowerCase() ||
        t.aliases.some((alias) => alias.toLowerCase() === name.toLowerCase())
    ) || null;
  };

  // Parseamos los años a partir de sheetName (ej: "2024/25" o "2024-25" -> yearStart: 2024, yearEnd: 2025)
  const separator = sheetName.includes('/') ? '/' : '-';
  const parts = sheetName.split(separator);
  const yearStart = parseInt(parts[0], 10);
  let yearEnd = yearStart + 1;
  if (parts[1]) {
    const endPart = parseInt(parts[1], 10);
    yearEnd = endPart < 100 ? Math.floor(yearStart / 100) * 100 + endPart : endPart;
  }

  // 4. Obtener partidos importados de Supabase
  let importedMatches: any[] = [];
  let matchesTableExists = true;

  try {
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select(`
        id,
        season_id,
        home_team_id,
        away_team_id,
        is_leg1,
        round,
        seasons!inner (
          year_start,
          year_end,
          competitions (
            name
          )
        )
      `)
      .eq('seasons.year_start', yearStart)
      .eq('seasons.year_end', yearEnd);

    if (matchesError) {
      matchesTableExists = false;
    } else {
      importedMatches = matches || [];
    }
  } catch (e) {
    matchesTableExists = false;
  }

  // 4.5. Obtener títulos importados de Supabase
  let importedTitles: any[] = [];
  let titlesTableExists = true;

  try {
    const { data: checkTitles, error: checkTitlesError } = await supabase
      .from('titles')
      .select('id')
      .limit(1);

    if (checkTitlesError) {
      titlesTableExists = false;
    } else {
      const { data: titles, error: titlesError } = await supabase
        .from('titles')
        .select(`
          id,
          team_id,
          competition_id,
          season_id,
          title_name,
          seasons!inner (
            year_start,
            year_end,
            competitions (
              name
            )
          )
        `)
        .eq('seasons.year_start', yearStart)
        .eq('seasons.year_end', yearEnd);

      if (titlesError) {
        titlesTableExists = false;
      } else {
        importedTitles = titles || [];
      }
    }
  } catch (e) {
    titlesTableExists = false;
  }

  // 5. Enriquecer las filas con el estado de Supabase
  const enrichedRows: EnrichedSheetRow[] = sheetRows.map((row) => {
    const teamA_db = findTeam(row.teamA);
    const teamB_db = findTeam(row.teamB);

    let leg1_imported = false;
    let leg2_imported = false;
    let playoff_imported = false;
    let titles_imported = false;

    const is_single_leg = !row.secondLeg || row.secondLeg.trim() === '' || row.secondLeg.trim() === '-';
    const yearStartStr = row.year.includes('/') ? row.year.split('/')[0] : row.year.split('-')[0];
    const yearStart = parseInt(yearStartStr, 10);
    const isPenalty = yearStart >= 1970;
    const hasPlayoff = !isPenalty && row.agg && row.agg.trim() !== '' && row.agg.includes('-');

    if (teamA_db && teamB_db && matchesTableExists) {
      leg1_imported = importedMatches.some((m) => {
        const mappedCompName = getCompetitionFullName(row.competition, yearStart);
        return (
          m.home_team_id === teamA_db.id &&
          m.away_team_id === teamB_db.id &&
          m.is_leg1 === true &&
          m.round === row.instance &&
          m.seasons?.year_start === yearStart &&
          m.seasons?.competitions?.name === mappedCompName
        );
      });

      if (!is_single_leg) {
        leg2_imported = importedMatches.some((m) => {
          const mappedCompName = getCompetitionFullName(row.competition, yearStart);
          return (
            m.home_team_id === teamB_db.id &&
            m.away_team_id === teamA_db.id &&
            m.is_leg1 === false &&
            m.round === row.instance &&
            m.seasons?.year_start === yearStart &&
            m.seasons?.competitions?.name === mappedCompName
          );
        });
      } else {
        leg2_imported = true; // no hay partido de vuelta, lo damos por importado si la ida existe
      }

      if (hasPlayoff) {
        playoff_imported = importedMatches.some((m) => {
          const mappedCompName = getCompetitionFullName(row.competition, yearStart);
          return (
            m.home_team_id === teamA_db.id &&
            m.away_team_id === teamB_db.id &&
            m.round === `${row.instance} (Desempate)` &&
            m.seasons?.year_start === yearStart &&
            m.seasons?.competitions?.name === mappedCompName
          );
        });
      } else {
        playoff_imported = true;
      }
    }

    // Comprobar si la final ya tiene títulos importados
    if (row.instance === 'F' && teamA_db && teamB_db && titlesTableExists) {
      const mappedCompName = getCompetitionFullName(row.competition, yearStart);
      const compTitles = importedTitles.filter((t) => 
        t.seasons?.year_start === yearStart &&
        t.seasons?.competitions?.name === mappedCompName
      );
      titles_imported = compTitles.length >= 2;
    }

    return {
      ...row,
      teamA_db,
      teamB_db,
      leg1_imported,
      leg2_imported: leg2_imported && playoff_imported,
      is_single_leg,
      titles_imported,
    };
  });

  return (
    <ImporterDashboard
      initialRows={enrichedRows}
      initialDbTeams={formattedTeams}
      initialDbCountries={dbCountries || []}
      selectedSeason={sheetName}
      matchesTableExists={matchesTableExists}
      titlesTableExists={titlesTableExists}
    />
  );
}
